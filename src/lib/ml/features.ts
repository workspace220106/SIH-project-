import type { Transaction, Wallet } from '@/types'
import type { IsolationForest } from '@/lib/ml/isolationForest'

/**
 * Feature vector for the anomaly detector, plus per-instance explanation.
 * Every feature comes from the capture alone and reads in plain words.
 */

export interface FeatureSpec {
  key: string
  label: string
  /** How to phrase a high value when it drives a score. */
  reads: (value: number) => string
}

export const FEATURES: FeatureSpec[] = [
  {
    key: 'outDegree',
    label: 'Outgoing degree',
    reads: (v) => 'spends to ' + Math.round(v) + ' counterparties',
  },
  {
    key: 'inDegree',
    label: 'Incoming degree',
    reads: (v) => 'receives from ' + Math.round(v) + ' counterparties',
  },
  {
    key: 'txCount',
    label: 'Transaction count',
    reads: (v) => Math.round(v) + ' transactions in the window',
  },
  {
    key: 'volume',
    label: 'Value moved',
    reads: (v) => Math.exp(v).toFixed(2) + ' BTC total in and out',
  },
  {
    key: 'velocity',
    label: 'Velocity',
    reads: (v) => 'median gap ' + formatGapSeconds(Math.exp(8 - v)),
  },
  {
    key: 'amountUniformity',
    label: 'Amount uniformity',
    reads: (v) => 'output spread σ/μ = ' + (1 / Math.max(v, 0.01) - 1).toFixed(2),
  },
  {
    key: 'burstFan',
    label: 'Burst fan-out',
    reads: (v) => Math.round(v) + ' counterparties inside one 15-minute window',
  },
  {
    key: 'meanOutputs',
    label: 'Outputs per transaction',
    reads: (v) => v.toFixed(1) + ' outputs on average',
  },
]

const formatGapSeconds = (s: number) =>
  s < 60 ? Math.round(s) + 's' : s < 3600 ? (s / 60).toFixed(1) + 'm' : (s / 3600).toFixed(1) + 'h'

const WINDOW = 900_000

export interface FeatureMatrix {
  walletIds: string[]
  rows: number[][]
  /** Column medians. Neutral value when ablating. */
  medians: number[]
}

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Builds the design matrix. One row per wallet, one column per feature. */
export function extractFeatures(wallets: Wallet[], transactions: Transaction[]): FeatureMatrix {
  const spends = new Map<string, Transaction[]>()
  const receives = new Map<string, Transaction[]>()
  const push = (m: Map<string, Transaction[]>, k: string, t: Transaction) => {
    const list = m.get(k)
    if (list) list.push(t)
    else m.set(k, [t])
  }
  for (const t of transactions) {
    for (const side of t.inputs) push(spends, side.wallet, t)
    for (const side of t.outputs) push(receives, side.wallet, t)
  }

  const rows: number[][] = []
  const walletIds: string[] = []

  for (const w of wallets) {
    const out = spends.get(w.id) ?? []
    const inc = receives.get(w.id) ?? []
    const all = [...out, ...inc].sort((a, b) => a.timestamp - b.timestamp)

    // Median inter-transaction gap, expressed so that faster means larger.
    const gaps: number[] = []
    for (let i = 1; i < all.length; i++) gaps.push(all[i].timestamp - all[i - 1].timestamp)
    const gapSeconds = gaps.length ? median(gaps) / 1000 : 3600
    const velocity = 8 - Math.log(Math.max(1, gapSeconds))

    // Coefficient of variation of amounts sent. Automated dispersion is uniform.
    const sentAmounts = out.flatMap((t) =>
      t.outputs.filter((s) => s.wallet !== w.id).map((s) => s.amount),
    )
    const mean = sentAmounts.length
      ? sentAmounts.reduce((a, b) => a + b, 0) / sentAmounts.length
      : 0
    const variance = sentAmounts.length
      ? sentAmounts.reduce((a, b) => a + (b - mean) ** 2, 0) / sentAmounts.length
      : 0
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1
    const amountUniformity = 1 / (1 + cv)

    // Largest number of distinct counterparties inside any 15-minute window.
    const sortedOut = [...out].sort((a, b) => a.timestamp - b.timestamp)
    let burstFan = 0
    let lo = 0
    for (let hi = 0; hi < sortedOut.length; hi++) {
      while (sortedOut[hi].timestamp - sortedOut[lo].timestamp > WINDOW) lo++
      const parties = new Set(
        sortedOut
          .slice(lo, hi + 1)
          .flatMap((t) => t.outputs.map((s) => s.wallet))
          .filter((id) => id !== w.id),
      )
      if (parties.size > burstFan) burstFan = parties.size
    }

    const meanOutputs = out.length
      ? out.reduce((a, t) => a + t.outputs.length, 0) / out.length
      : 0

    walletIds.push(w.id)
    rows.push([
      w.degreeOut,
      w.degreeIn,
      w.txCount,
      Math.log(1 + w.totalIn + w.totalOut),
      velocity,
      amountUniformity,
      burstFan,
      meanOutputs,
    ])
  }

  const medians = FEATURES.map((_, col) => median(rows.map((r) => r[col])))
  return { walletIds, rows, medians }
}

export interface FeatureContribution {
  key: string
  label: string
  /** Share of the score this feature accounts for, 0-1. */
  share: number
  value: number
  reads: string
}

/**
 * Per-instance ablation. Replace one feature with the population median,
 * re-score, and take the drop as that feature's contribution.
 */
export function explainScore(
  forest: IsolationForest,
  row: number[],
  medians: number[],
): FeatureContribution[] {
  const base = forest.score(row)
  const drops = row.map((_, i) => {
    const ablated = row.slice()
    ablated[i] = medians[i]
    return Math.max(0, base - forest.score(ablated))
  })

  const total = drops.reduce((a, b) => a + b, 0)
  return FEATURES.map((f, i) => ({
    key: f.key,
    label: f.label,
    share: total > 0 ? drops[i] / total : 0,
    value: row[i],
    reads: f.reads(row[i]),
  }))
    .filter((c) => c.share > 0.02)
    .sort((a, b) => b.share - a.share)
}
