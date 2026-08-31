import type {
  Dataset,
  DatasetStats,
  Detection,
  IPObservation,
  RawRecord,
  Transaction,
  Wallet,
} from '@/types'
import { PATTERN_DEFS } from '@/lib/patterns'

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

export type SourceFormat = 'CSV' | 'JSON' | 'XML'

export interface ParseResult {
  format: SourceFormat
  records: RawRecord[]
  /** Rows that failed validation, with the reason, capped for display. */
  rejected: Array<{ row: number; reason: string }>
  duplicates: number
  fields: string[]
  totalRows: number
}

const ALIASES: Record<keyof RawRecord, string[]> = {
  txid: ['txid', 'tx_id', 'tx', 'transaction_id', 'transactionid', 'hash', 'txhash'],
  wallet: ['wallet', 'address', 'addr', 'wallet_address', 'account'],
  amount: ['amount', 'value', 'btc', 'amount_btc', 'val'],
  fee: ['fee', 'txfee', 'fee_btc', 'miner_fee'],
  ip: ['ip', 'ip_address', 'ipaddress', 'src_ip', 'source_ip', 'host'],
  port: ['port', 'src_port', 'source_port', 'dst_port'],
  timestamp: ['timestamp', 'time', 'ts', 'datetime', 'date', 'observed_at', 'block_time'],
}

const canonical = (header: string): keyof RawRecord | null => {
  const h = header.trim().toLowerCase().replace(/[\s-]+/g, '_')
  for (const key of Object.keys(ALIASES) as Array<keyof RawRecord>) {
    if (ALIASES[key].includes(h)) return key
  }
  return null
}

function parseTimestamp(raw: string | number): number | null {
  if (typeof raw === 'number') return raw > 1e11 ? raw : raw * 1000
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed)
    return n > 1e11 ? n : n * 1000
  }
  const t = Date.parse(trimmed)
  return Number.isNaN(t) ? null : t
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else quoted = !quoted
    } else if (ch === delimiter && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((v) => v.trim())
}

function toRecord(
  raw: Record<string, string | number>,
  rowIndex: number,
): { record?: RawRecord; reason?: string } {
  const txid = String(raw.txid ?? '').trim()
  const wallet = String(raw.wallet ?? '').trim()
  if (!txid) return { reason: 'missing txid' }
  if (!wallet) return { reason: 'missing wallet' }
  const amount = Number(raw.amount)
  if (!Number.isFinite(amount) || amount < 0) return { reason: 'amount is not a positive number' }
  const ts = parseTimestamp(raw.timestamp as string | number)
  if (ts === null) return { reason: 'unparseable timestamp' }
  const fee = Number(raw.fee)
  const port = Number(raw.port)
  return {
    record: {
      txid,
      wallet,
      amount,
      fee: Number.isFinite(fee) ? fee : 0,
      ip: String(raw.ip ?? '').trim() || '0.0.0.0',
      port: Number.isFinite(port) ? port : 8333,
      timestamp: new Date(ts).toISOString(),
    },
  }
}

export function parseCapture(text: string, filename: string): ParseResult {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  const format: SourceFormat =
    ext === 'json' ? 'JSON' : ext === 'xml' ? 'XML' : ext === 'csv' || ext === 'tsv' ? 'CSV' : guess(text)

  const rows: Array<Record<string, string | number>> = []
  let fields: string[] = []

  if (format === 'JSON') {
    const parsed = JSON.parse(text)
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { records?: unknown[] }).records)
        ? (parsed as { records: unknown[] }).records
        : []
    for (const item of list) {
      if (item && typeof item === 'object') {
        const mapped: Record<string, string | number> = {}
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          const c = canonical(k)
          if (c) mapped[c] = v as string | number
        }
        rows.push(mapped)
      }
    }
    fields = [...new Set(list.flatMap((i) => Object.keys((i ?? {}) as object)))]
  } else if (format === 'XML') {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    if (doc.querySelector('parsererror')) throw new Error('XML is not well formed')
    const all = Array.from(doc.documentElement.children)
    const nodes = all.length ? all : Array.from(doc.getElementsByTagName('*'))
    for (const node of nodes) {
      const mapped: Record<string, string | number> = {}
      for (const child of Array.from(node.children)) {
        const c = canonical(child.tagName)
        if (c) mapped[c] = child.textContent ?? ''
      }
      for (const attr of Array.from(node.attributes ?? [])) {
        const c = canonical(attr.name)
        if (c) mapped[c] = attr.value
      }
      if (Object.keys(mapped).length) rows.push(mapped)
    }
    fields = [...new Set(nodes.flatMap((n) => Array.from(n.children).map((c) => c.tagName)))]
  } else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
    if (!lines.length) throw new Error('File is empty')
    const delimiter = ['\t', ';', ','].find((d) => lines[0].includes(d)) ?? ','
    const header = splitCsvLine(lines[0], delimiter)
    fields = header
    const map = header.map(canonical)
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i], delimiter)
      const mapped: Record<string, string | number> = {}
      map.forEach((c, ci) => {
        if (c) mapped[c] = cells[ci] ?? ''
      })
      rows.push(mapped)
    }
  }

  const records: RawRecord[] = []
  const rejected: ParseResult['rejected'] = []
  const seen = new Set<string>()
  let duplicates = 0

  rows.forEach((raw, i) => {
    const { record, reason } = toRecord(raw, i)
    if (!record) {
      if (rejected.length < 50) rejected.push({ row: i + 2, reason: reason ?? 'invalid' })
      return
    }
    const key = record.txid + '|' + record.wallet + '|' + record.timestamp
    if (seen.has(key)) {
      duplicates++
      return
    }
    seen.add(key)
    records.push(record)
  })

  return { format, records, rejected, duplicates, fields, totalRows: rows.length }
}

function guess(text: string): SourceFormat {
  const head = text.trimStart().slice(0, 1)
  if (head === '{' || head === '[') return 'JSON'
  if (head === '<') return 'XML'
  return 'CSV'
}

/* ------------------------------------------------------------------ *
 * Reconstruction
 * ------------------------------------------------------------------ */

const WINDOW = 900_000 // 15 minutes
const RAPID_DWELL = 120_000

/**
 * Turns validated rows into the entity model.
 *
 * Rows sharing a txid are one transaction: the earliest row is the input side,
 * the rest are outputs. Where every txid appears exactly once the direction of
 * value cannot be recovered, and the detectors that depend on it are skipped
 * rather than guessed at.
 */
export function datasetFromRecords(
  records: RawRecord[],
  name: string,
  format: SourceFormat,
): Dataset {
  const notes: string[] = []
  const walletByAddress = new Map<string, Wallet>()
  const ipByAddress = new Map<string, IPObservation>()

  const wallet = (address: string): Wallet => {
    let w = walletByAddress.get(address)
    if (!w) {
      w = {
        id: 'w' + walletByAddress.size.toString().padStart(3, '0'),
        address,
        firstSeen: 0,
        lastSeen: 0,
        txCount: 0,
        totalIn: 0,
        totalOut: 0,
        degreeIn: 0,
        degreeOut: 0,
        cluster: 0,
        risk: { score: 0, confidence: 0, priority: 'LOW', signals: [] },
      }
      walletByAddress.set(address, w)
    }
    return w
  }

  const host = (address: string, port: number): IPObservation => {
    let ip = ipByAddress.get(address)
    if (!ip) {
      ip = {
        id: 'ip' + ipByAddress.size.toString().padStart(2, '0'),
        address,
        port,
        firstSeen: 0,
        lastSeen: 0,
        observationCount: 0,
        linkedWallets: [],
      }
      ipByAddress.set(address, ip)
    }
    return ip
  }

  // Group by txid, oldest first.
  const groups = new Map<string, RawRecord[]>()
  for (const r of records) {
    const g = groups.get(r.txid) ?? []
    g.push(r)
    groups.set(r.txid, g)
  }
  const paired = [...groups.values()].filter((g) => g.length > 1).length
  const directional = groups.size > 0 && paired / groups.size >= 0.3
  if (!directional) {
    notes.push(
      'Every txid appears once, so input and output sides cannot be separated. Fan-in, fan-out, rapid movement and peeling are skipped; host correlation and frequency analysis still run.',
    )
  }

  const transactions: Transaction[] = []
  let counter = 0

  groups.forEach((rows, txid) => {
    rows.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    const source = wallet(rows[0].wallet)
    const ts = Date.parse(rows[0].timestamp)
    const ip = host(rows[0].ip, rows[0].port)

    const outputs = directional ? rows.slice(1) : []
    if (!outputs.length) {
      // Single-sided observation: recorded so the host and time correlation
      // survive, but it carries no direction.
      transactions.push({
        id: 't' + (counter++).toString().padStart(4, '0'),
        txid,
        timestamp: ts,
        amount: rows[0].amount,
        fee: rows[0].fee,
        inputs: 1,
        outputs: 0,
        sourceWallet: source.id,
        destinationWallet: source.id,
        observedIp: rows[0].ip,
        port: rows[0].port,
      })
      return
    }

    for (const out of outputs) {
      const dest = wallet(out.wallet)
      transactions.push({
        id: 't' + (counter++).toString().padStart(4, '0'),
        txid,
        timestamp: Date.parse(out.timestamp) || ts,
        amount: out.amount,
        fee: out.fee || rows[0].fee,
        inputs: 1,
        outputs: outputs.length,
        sourceWallet: source.id,
        destinationWallet: dest.id,
        observedIp: rows[0].ip,
        port: rows[0].port,
      })
    }
    void ip
  })

  transactions.sort((a, b) => a.timestamp - b.timestamp)

  // Aggregates
  const wallets = [...walletByAddress.values()]
  const byId = new Map(wallets.map((w) => [w.id, w]))
  for (const tx of transactions) {
    const s = byId.get(tx.sourceWallet)!
    const d = byId.get(tx.destinationWallet)!
    s.txCount++
    s.totalOut += tx.amount
    s.degreeOut++
    if (d !== s) {
      d.txCount++
      d.totalIn += tx.amount
      d.degreeIn++
    }
    for (const w of new Set([s, d])) {
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

  assignClusters(wallets, transactions)

  const planted = directional
    ? detect(wallets, transactions, byId)
    : detectFrequencyOnly(wallets, transactions)

  const stats: DatasetStats = {
    name,
    source: 'IMPORTED',
    format,
    records: records.length,
    fields: 7,
    duplicates: 0,
    invalidRows: 0,
    rangeStart: transactions[0]?.timestamp ?? Date.now(),
    rangeEnd: transactions[transactions.length - 1]?.timestamp ?? Date.now(),
    wallets: wallets.length,
    transactions: transactions.length,
    ips: [...ipByAddress.values()].filter((i) => i.observationCount > 0).length,
  }

  return {
    wallets,
    transactions,
    ips: [...ipByAddress.values()].filter((i) => i.observationCount > 0),
    planted,
    stats,
    notes,
  }
}

/** Connected components, largest first, capped so the layout stays readable. */
function assignClusters(wallets: Wallet[], transactions: Transaction[]) {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = parent.get(x) ?? x
    if (root !== x) {
      root = find(root)
      parent.set(x, root)
    }
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  wallets.forEach((w) => parent.set(w.id, w.id))
  transactions.forEach((t) => union(t.sourceWallet, t.destinationWallet))

  const groups = new Map<string, Wallet[]>()
  wallets.forEach((w) => {
    const r = find(w.id)
    const g = groups.get(r) ?? []
    g.push(w)
    groups.set(r, g)
  })
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length)
  ordered.forEach((group, i) => {
    const cluster = Math.min(i, 9)
    group.forEach((w) => {
      w.cluster = cluster
    })
  })
}

function detection(
  id: Detection['id'],
  cluster: number,
  walletIds: string[],
  txIds: string[],
  anchorWallet: string,
  strength: number,
  detectedAt: number,
  metric: string,
): Detection {
  return { id, cluster, walletIds, txIds, anchorWallet, strength, detectedAt, metric }
}

function detect(
  wallets: Wallet[],
  transactions: Transaction[],
  byId: Map<string, Wallet>,
): Detection[] {
  const out: Detection[] = []
  const outgoing = new Map<string, Transaction[]>()
  const incoming = new Map<string, Transaction[]>()
  for (const t of transactions) {
    ;(outgoing.get(t.sourceWallet) ?? outgoing.set(t.sourceWallet, []).get(t.sourceWallet)!).push(t)
    ;(incoming.get(t.destinationWallet) ??
      incoming.set(t.destinationWallet, []).get(t.destinationWallet)!).push(t)
  }

  // --- FAN-OUT / FAN-IN ------------------------------------------------
  for (const w of wallets) {
    for (const dir of ['out', 'in'] as const) {
      const list = (dir === 'out' ? outgoing.get(w.id) : incoming.get(w.id)) ?? []
      if (list.length < 8) continue
      const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp)
      let best: { count: number; start: number; slice: Transaction[] } | null = null
      let lo = 0
      for (let hi = 0; hi < sorted.length; hi++) {
        while (sorted[hi].timestamp - sorted[lo].timestamp > WINDOW) lo++
        const slice = sorted.slice(lo, hi + 1)
        const distinct = new Set(
          slice.map((t) => (dir === 'out' ? t.destinationWallet : t.sourceWallet)),
        ).size
        if (!best || distinct > best.count) best = { count: distinct, start: sorted[lo].timestamp, slice }
      }
      if (!best || best.count < 8) continue
      const counterparties = [
        ...new Set(best.slice.map((t) => (dir === 'out' ? t.destinationWallet : t.sourceWallet))),
      ]
      const total = best.slice.reduce((a, t) => a + t.amount, 0)
      out.push(
        detection(
          dir === 'out' ? 'FAN_OUT' : 'FAN_IN',
          w.cluster,
          [w.id, ...counterparties],
          best.slice.map((t) => t.id),
          w.id,
          Math.min(0.97, 0.48 + best.count / 34),
          best.slice[best.slice.length - 1].timestamp,
          dir === 'out'
            ? '1 → ' + best.count + ' destinations, ' + total.toFixed(2) + ' BTC'
            : best.count + ' → 1 consolidation, ' + total.toFixed(2) + ' BTC aggregate',
        ),
      )
    }
  }

  // --- RAPID MOVEMENT --------------------------------------------------
  const dwellByWallet = new Map<string, number[]>()
  for (const w of wallets) {
    const ins = (incoming.get(w.id) ?? []).sort((a, b) => a.timestamp - b.timestamp)
    const outs = (outgoing.get(w.id) ?? []).sort((a, b) => a.timestamp - b.timestamp)
    const dwells: number[] = []
    let j = 0
    for (const i of ins) {
      while (j < outs.length && outs[j].timestamp < i.timestamp) j++
      if (j < outs.length) dwells.push(outs[j].timestamp - i.timestamp)
    }
    if (dwells.length) dwellByWallet.set(w.id, dwells)
  }
  const fast = wallets.filter((w) => {
    const d = dwellByWallet.get(w.id)
    if (!d || d.length < 1) return false
    const sorted = [...d].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] < RAPID_DWELL
  })
  if (fast.length >= 3) {
    const ids = new Set(fast.map((w) => w.id))
    const chainTx = transactions.filter(
      (t) => ids.has(t.sourceWallet) && ids.has(t.destinationWallet),
    )
    if (chainTx.length >= 2) {
      const medians = fast
        .map((w) => {
          const d = [...(dwellByWallet.get(w.id) ?? [])].sort((a, b) => a - b)
          return d[Math.floor(d.length / 2)]
        })
        .sort((a, b) => a - b)
      const median = medians[Math.floor(medians.length / 2)]
      out.push(
        detection(
          'RAPID_MOVEMENT',
          fast[0].cluster,
          fast.map((w) => w.id),
          chainTx.map((t) => t.id),
          fast[0].id,
          Math.min(0.95, 0.55 + fast.length / 24),
          chainTx[chainTx.length - 1].timestamp,
          'median dwell ' + Math.round(median / 1000) + 's across ' + fast.length + ' wallets',
        ),
      )
    }
  }

  // --- BURST ------------------------------------------------------------
  out.push(...detectFrequencyOnly(wallets, transactions))

  // --- PEELING ----------------------------------------------------------
  for (const start of wallets) {
    const chain: Transaction[] = []
    const visited = new Set<string>([start.id])
    let current = start.id
    let carried = 0
    let ok = true
    for (let hop = 0; hop < 10; hop++) {
      const outs = (outgoing.get(current) ?? [])
        .filter((t) => !visited.has(t.destinationWallet))
        .sort((a, b) => b.amount - a.amount)
      if (!outs.length) break
      const main = outs[0]
      const rest = outs.slice(1).reduce((a, t) => a + t.amount, 0)
      const totalOut = main.amount + rest
      const ratio = totalOut > 0 ? rest / totalOut : 0
      if (chain.length && (ratio < 0.08 || ratio > 0.45)) {
        ok = false
        break
      }
      chain.push(main)
      visited.add(main.destinationWallet)
      carried = main.amount
      current = main.destinationWallet
    }
    if (ok && chain.length >= 4) {
      const wallets_ = [start.id, ...chain.map((t) => t.destinationWallet)]
      out.push(
        detection(
          'PEELING',
          start.cluster,
          wallets_,
          chain.map((t) => t.id),
          start.id,
          Math.min(0.95, 0.5 + chain.length / 22),
          chain[chain.length - 1].timestamp,
          chain.length +
            ' hops, ' +
            chain[0].amount.toFixed(2) +
            ' → ' +
            carried.toFixed(2) +
            ' BTC retained',
        ),
      )
      break // one representative chain is enough to raise the lead
    }
  }

  void byId
  return dedupe(out)
}

/** Frequency analysis needs no direction, so it runs on every capture. */
function detectFrequencyOnly(wallets: Wallet[], transactions: Transaction[]): Detection[] {
  const out: Detection[] = []
  const clusters = [...new Set(wallets.map((w) => w.cluster))]
  const walletCluster = new Map(wallets.map((w) => [w.id, w.cluster]))

  for (const c of clusters) {
    const tx = transactions
      .filter((t) => walletCluster.get(t.sourceWallet) === c)
      .sort((a, b) => a.timestamp - b.timestamp)
    if (tx.length < 20) continue
    const bucket = 600_000
    const counts = new Map<number, Transaction[]>()
    for (const t of tx) {
      const k = Math.floor(t.timestamp / bucket)
      const list = counts.get(k) ?? []
      list.push(t)
      counts.set(k, list)
    }
    const sizes = [...counts.values()].map((v) => v.length).sort((a, b) => a - b)
    const median = sizes[Math.floor(sizes.length / 2)] || 1
    const peak = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    if (!peak || peak[1].length < median * 8) continue
    const involved = [
      ...new Set(peak[1].flatMap((t) => [t.sourceWallet, t.destinationWallet])),
    ]
    out.push(
      detection(
        'BURST_ACTIVITY',
        c,
        involved,
        peak[1].map((t) => t.id),
        involved[0],
        Math.min(0.93, 0.5 + peak[1].length / (median * 40)),
        peak[1][peak[1].length - 1].timestamp,
        peak[1].length +
          ' transactions in a 10m window — ' +
          (peak[1].length / median).toFixed(1) +
          '× cluster baseline',
      ),
    )
  }
  return out
}

/** Keep the strongest detection of each type per anchor. */
function dedupe(list: Detection[]): Detection[] {
  const best = new Map<string, Detection>()
  for (const d of list) {
    const key = d.id + '|' + d.anchorWallet
    const existing = best.get(key)
    if (!existing || d.strength > existing.strength) best.set(key, d)
  }
  // Cap per detector type so one noisy capture cannot flood the queue.
  const byType = new Map<string, Detection[]>()
  for (const d of best.values()) {
    const l = byType.get(d.id) ?? []
    l.push(d)
    byType.set(d.id, l)
  }
  const out: Detection[] = []
  byType.forEach((l) => {
    l.sort((a, b) => b.strength - a.strength)
    out.push(...l.slice(0, 6))
  })
  return out
}

export const PATTERN_NAME = (id: Detection['id']) => PATTERN_DEFS[id].shortName
