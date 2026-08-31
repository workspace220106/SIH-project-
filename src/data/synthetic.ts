import type {
  Dataset,
  DatasetStats,
  Detection,
  IPObservation,
  Transaction,
  Wallet,
} from '@/types'
import { bech32Tail, between, gauss, hex, intBetween, mulberry32, pick, type Rand } from '@/lib/rng'

/**
 * Synthetic dataset generator.
 *
 * Produces a believable — never real — Bitcoin traffic capture with five
 * deliberately planted behavioural patterns, so detector output can be
 * checked against ground truth during a demonstration.
 */

export const EPOCH = Date.UTC(2026, 7, 29, 9, 0, 0) // 2026-08-29 09:00 UTC
const MIN = 60_000

/** Retained name for the ground-truth matches this generator plants. */
export type PlantedPattern = Detection

export type { Dataset }

const CLUSTER_LABELS = [
  'SETTLEMENT RING',
  'DISPERSION SET',
  'COLLECTION SET',
  'PEELING CHAIN',
  'BURST SEGMENT',
  'PERIPHERY',
]

function makeWallet(r: Rand, index: number, cluster: number): Wallet {
  return {
    id: 'w' + index.toString().padStart(3, '0'),
    address: 'bc1q' + bech32Tail(r, 38),
    firstSeen: 0,
    lastSeen: 0,
    txCount: 0,
    totalIn: 0,
    totalOut: 0,
    degreeIn: 0,
    degreeOut: 0,
    cluster,
    risk: { score: 0, confidence: 0, priority: 'LOW', signals: [] },
  }
}

let txCounter = 0

function makeTx(
  r: Rand,
  source: Wallet,
  dest: Wallet,
  timestamp: number,
  amount: number,
  ip: IPObservation,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id: 't' + (txCounter++).toString().padStart(4, '0'),
    txid: hex(r, 64),
    timestamp: Math.round(timestamp),
    amount: Math.max(0.0004, Number(amount.toFixed(8))),
    fee: Number(between(r, 0.000042, 0.00068).toFixed(8)),
    inputs: intBetween(r, 1, 4),
    outputs: intBetween(r, 1, 3),
    sourceWallet: source.id,
    destinationWallet: dest.id,
    observedIp: ip.address,
    port: ip.port,
    ...extra,
  }
}

export function generateDataset(seed = 26146): Dataset {
  const r = mulberry32(seed)
  txCounter = 0

  // ---- IP observations -------------------------------------------------
  const ips: IPObservation[] = []
  for (let i = 0; i < 20; i++) {
    ips.push({
      id: 'ip' + i.toString().padStart(2, '0'),
      address: [
        intBetween(r, 5, 223),
        intBetween(r, 0, 255),
        intBetween(r, 0, 255),
        intBetween(r, 1, 254),
      ].join('.'),
      port: pick(r, [8333, 8333, 8333, 8332, 18333, 9050, 9051, 443, 51413]),
      firstSeen: 0,
      lastSeen: 0,
      observationCount: 0,
      linkedWallets: [],
    })
  }

  // ---- Wallets, distributed across behavioural clusters ----------------
  const wallets: Wallet[] = []
  const clusterSizes = [14, 20, 14, 9, 12, 12]
  let wi = 0
  clusterSizes.forEach((size, cluster) => {
    for (let i = 0; i < size; i++) wallets.push(makeWallet(r, wi++, cluster))
  })
  const byCluster = (c: number) => wallets.filter((w) => w.cluster === c)

  const transactions: Transaction[] = []
  const planted: Detection[] = []

  // IPs are sticky per wallet — an operator reuses infrastructure, and that
  // co-location across a cluster is itself a correlation signal.
  const walletIp = new Map<string, IPObservation>()
  const ipFor = (w: Wallet): IPObservation => {
    let ip = walletIp.get(w.id)
    if (!ip) {
      const pool = ips.slice(w.cluster * 3, w.cluster * 3 + 4)
      ip = pick(r, pool.length ? pool : ips)
      walletIp.set(w.id, ip)
    }
    return ip
  }

  const emit = (s: Wallet, d: Wallet, t: number, amt: number, extra?: Partial<Transaction>) => {
    const tx = makeTx(r, s, d, t, amt, ipFor(s), extra)
    transactions.push(tx)
    return tx
  }

  // ---- Background settlement traffic -----------------------------------
  const background = [...byCluster(0), ...byCluster(5)]
  for (let i = 0; i < 78; i++) {
    const s = pick(r, background)
    let d = pick(r, background)
    let guard = 0
    while (d.id === s.id && guard++ < 8) d = pick(r, background)
    emit(s, d, EPOCH + between(r, 0, 300) * MIN, Math.abs(gauss(r, 0.42, 0.36)) + 0.01)
  }

  // ---- FAN-OUT: one source disperses to many destinations --------------
  const fanOutSet = byCluster(1)
  const fanOutHub = fanOutSet[0]
  const fanOutTargets = fanOutSet.slice(1, 18)
  const fanOutStart = EPOCH + 92 * MIN
  const fanOutTx = fanOutTargets.map((d, i) =>
    emit(fanOutHub, d, fanOutStart + i * between(r, 12_000, 34_000), between(r, 0.09, 0.31)),
  )
  planted.push({
    id: 'FAN_OUT',
    cluster: 1,
    walletIds: [fanOutHub.id, ...fanOutTargets.map((w) => w.id)],
    txIds: fanOutTx.map((t) => t.id),
    anchorWallet: fanOutHub.id,
    strength: 0.94,
    detectedAt: fanOutStart + 9 * MIN,
    metric: '1 → ' + fanOutTargets.length + ' destinations within 7m 04s',
  })

  // ---- FAN-IN: many sources consolidate into one collector -------------
  const fanInSet = byCluster(2)
  const collector = fanInSet[0]
  const fanInSources = fanInSet.slice(1, 13)
  const fanInStart = EPOCH + 148 * MIN
  const fanInTx = fanInSources.map((s, i) =>
    emit(s, collector, fanInStart + i * between(r, 9_000, 41_000), between(r, 0.04, 0.22)),
  )
  const fanInTotal = fanInTx.reduce((a, t) => a + t.amount, 0)
  planted.push({
    id: 'FAN_IN',
    cluster: 2,
    walletIds: [collector.id, ...fanInSources.map((w) => w.id)],
    txIds: fanInTx.map((t) => t.id),
    anchorWallet: collector.id,
    strength: 0.88,
    detectedAt: fanInStart + 11 * MIN,
    metric: fanInSources.length + ' → 1 consolidation, ' + fanInTotal.toFixed(2) + ' BTC aggregate',
  })

  // ---- PEELING / MULTI-HOP: value walks a chain, shedding at each hop --
  // The chain originates at the dispersion hub: the same operator, a second
  // technique. That overlap is what turns two detections into one subject.
  const chain = [fanOutHub, ...byCluster(3).slice(0, 8)]
  const peelStart = EPOCH + 178 * MIN
  let carried = 6.4
  const peelTx: Transaction[] = []
  for (let i = 0; i < chain.length - 1; i++) {
    const shed = carried * between(r, 0.16, 0.31)
    carried = carried - shed
    peelTx.push(
      emit(chain[i], chain[i + 1], peelStart + i * between(r, 150_000, 320_000), carried, {
        hop: i + 1,
      }),
    )
    // The peeled remainder leaves toward the periphery — the classic tell.
    peelTx.push(emit(chain[i], pick(r, byCluster(5)), peelStart + i * 160_000 + 42_000, shed))
  }
  planted.push({
    id: 'PEELING',
    cluster: 3,
    walletIds: chain.map((w) => w.id),
    txIds: peelTx.map((t) => t.id),
    anchorWallet: chain[0].id,
    strength: 0.91,
    detectedAt: peelStart + 26 * MIN,
    metric: chain.length - 1 + ' hops, 6.40 → ' + carried.toFixed(2) + ' BTC retained',
  })

  // ---- BURST + RAPID MOVEMENT ------------------------------------------
  const burstSet = byCluster(4)
  const burstStart = EPOCH + 214 * MIN
  const burstTx: Transaction[] = []
  const rapidTx: Transaction[] = []
  const burstActors = [...burstSet, fanOutHub]
  for (let i = 0; i < 30; i++) {
    const s = pick(r, burstActors)
    let d = pick(r, burstSet)
    let guard = 0
    while (d.id === s.id && guard++ < 8) d = pick(r, burstSet)
    burstTx.push(emit(s, d, burstStart + i * between(r, 3_500, 14_000), between(r, 0.02, 0.19)))
  }
  // A single relay path where funds rest for under 90 seconds per wallet.
  const relay = [fanOutHub, ...burstSet.slice(0, 5)]
  let relayT = burstStart + 30 * MIN
  let relayAmt = 3.18
  for (let i = 0; i < relay.length - 1; i++) {
    relayT += between(r, 26_000, 84_000)
    relayAmt *= between(r, 0.93, 0.985)
    rapidTx.push(emit(relay[i], relay[i + 1], relayT, relayAmt, { hop: i + 1 }))
  }
  planted.push({
    id: 'BURST_ACTIVITY',
    cluster: 4,
    walletIds: burstActors.map((w) => w.id),
    txIds: burstTx.map((t) => t.id),
    anchorWallet: burstSet[0].id,
    strength: 0.83,
    detectedAt: burstStart + 6 * MIN,
    metric: '30 transactions in 5m 48s — 11.2× cluster baseline',
  })
  planted.push({
    id: 'RAPID_MOVEMENT',
    cluster: 4,
    walletIds: relay.map((w) => w.id),
    txIds: rapidTx.map((t) => t.id),
    anchorWallet: relay[0].id,
    strength: 0.89,
    detectedAt: relayT,
    metric: 'median dwell 47s across ' + (relay.length - 1) + ' transfers',
  })

  // ---- Bridges: the clusters are not islands ---------------------------
  const bridges: Array<[number, number]> = [
    [1, 3],
    [3, 4],
    [2, 1],
    [4, 2],
    [0, 1],
    [5, 3],
  ]
  bridges.forEach(([a, b]) => {
    emit(pick(r, byCluster(a)), pick(r, byCluster(b)), EPOCH + between(r, 60, 280) * MIN, between(r, 0.12, 0.9))
  })

  transactions.sort((a, b) => a.timestamp - b.timestamp)

  // ---- Roll up wallet + IP aggregates ----------------------------------
  const walletById = new Map(wallets.map((w) => [w.id, w]))
  const ipByAddress = new Map(ips.map((i) => [i.address, i]))
  for (const tx of transactions) {
    const s = walletById.get(tx.sourceWallet)!
    const d = walletById.get(tx.destinationWallet)!
    s.txCount++
    d.txCount++
    s.totalOut += tx.amount
    d.totalIn += tx.amount
    s.degreeOut++
    d.degreeIn++
    for (const w of [s, d]) {
      w.firstSeen = w.firstSeen === 0 ? tx.timestamp : Math.min(w.firstSeen, tx.timestamp)
      w.lastSeen = Math.max(w.lastSeen, tx.timestamp)
    }
    const ip = ipByAddress.get(tx.observedIp)
    if (ip) {
      ip.observationCount++
      ip.firstSeen = ip.firstSeen === 0 ? tx.timestamp : Math.min(ip.firstSeen, tx.timestamp)
      ip.lastSeen = Math.max(ip.lastSeen, tx.timestamp)
      if (!ip.linkedWallets.includes(s.id)) ip.linkedWallets.push(s.id)
    }
  }

  const active = wallets.filter((w) => w.txCount > 0)
  const activeIps = ips.filter((i) => i.observationCount > 0)

  const stats: DatasetStats = {
    name: 'NTRO-CAPTURE-26146',
    source: 'SYNTHETIC',
    format: 'GENERATED',
    records: transactions.length,
    fields: 7,
    duplicates: 0,
    invalidRows: 0,
    rangeStart: transactions[0].timestamp,
    rangeEnd: transactions[transactions.length - 1].timestamp,
    wallets: active.length,
    transactions: transactions.length,
    ips: activeIps.length,
  }

  return { wallets: active, transactions, ips: activeIps, planted, stats }
}

export const clusterLabel = (c: number) => CLUSTER_LABELS[c] ?? 'SET ' + c
