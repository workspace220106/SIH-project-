import type {
  Dataset,
  DatasetStats,
  Detection,
  IPObservation,
  RawRecord,
  Transaction,
  TxParty,
  Wallet,
} from '@/types'
import { resolveGeo } from '@/lib/geoip'

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
  timestamp: ['timestamp', 'time', 'ts', 'datetime', 'date', 'observed_at', 'block_time'],
  txid: ['txid', 'tx_id', 'tx', 'transaction_id', 'transactionid', 'hash', 'txhash'],
  srcIp: ['src_ip', 'source_ip', 'srcip', 'sourceaddress', 'ip', 'ip_address', 'from_ip'],
  dstIp: ['dst_ip', 'dest_ip', 'destination_ip', 'dstip', 'to_ip', 'peer_ip'],
  srcPort: ['src_port', 'source_port', 'srcport', 'port', 'from_port'],
  dstPort: ['dst_port', 'dest_port', 'destination_port', 'dstport', 'to_port', 'peer_port'],
  inputAddresses: ['input_addresses', 'inputaddresses', 'inputs', 'input_addrs', 'in_addresses'],
  outputAddresses: ['output_addresses', 'outputaddresses', 'outputs', 'output_addrs', 'out_addresses'],
  inputAmounts: ['input_amounts', 'inputamounts', 'input_values', 'in_amounts'],
  outputAmounts: ['output_amounts', 'outputamounts', 'output_values', 'out_amounts'],
  fee: ['fee', 'txfee', 'fee_btc', 'miner_fee'],
  scriptType: ['script_type', 'scripttype', 'script', 'output_script_type'],
  geoCountry: ['geo_country', 'country', 'country_code', 'geoip_country', 'src_country'],
  asn: ['asn', 'as_number', 'autonomous_system', 'src_asn'],
}

const canonical = (header: string): keyof RawRecord | null => {
  const h = header.trim().toLowerCase().replace(/[\s-]+/g, '_')
  for (const key of Object.keys(ALIASES) as Array<keyof RawRecord>) {
    if (ALIASES[key].includes(h)) return key
  }
  return null
}

const ARRAY_FIELDS = new Set<keyof RawRecord>([
  'inputAddresses',
  'outputAddresses',
  'inputAmounts',
  'outputAmounts',
])

/**
 * Reads an array cell. Captures write these several ways: a JSON array, or a
 * pipe- or semicolon-separated list inside one CSV cell. Commas are not used
 * as an inner separator because they collide with CSV itself.
 */
function toArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean)
  const text = String(raw ?? '').trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text.replace(/'/g, '"'))
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
    } catch {
      /* fall through to separator splitting */
    }
  }
  return text
    .replace(/^[[]|[\]]$/g, '')
    .split(/[|;]/)
    .map((v) => v.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
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

type RawCell = string | number | string[]

function toRecord(raw: Record<string, RawCell>): { record?: RawRecord; reason?: string } {
  const txid = String(raw.txid ?? '').trim()
  if (!txid) return { reason: 'missing txid' }

  const ts = parseTimestamp(raw.timestamp as string | number)
  if (ts === null) return { reason: 'unparseable timestamp' }

  const inputAddresses = toArray(raw.inputAddresses)
  const outputAddresses = toArray(raw.outputAddresses)
  if (!inputAddresses.length && !outputAddresses.length) {
    return { reason: 'no input or output addresses' }
  }

  const inputAmounts = toArray(raw.inputAmounts).map(Number)
  const outputAmounts = toArray(raw.outputAmounts).map(Number)
  if (inputAmounts.some((n) => !Number.isFinite(n) || n < 0)) {
    return { reason: 'input_amounts contains a non-numeric or negative value' }
  }
  if (outputAmounts.some((n) => !Number.isFinite(n) || n < 0)) {
    return { reason: 'output_amounts contains a non-numeric or negative value' }
  }
  // A length mismatch means value cannot be attributed to an address, which
  // is worse than a missing column — reject rather than guess.
  if (inputAmounts.length && inputAmounts.length !== inputAddresses.length) {
    return {
      reason:
        'input_addresses (' +
        inputAddresses.length +
        ') and input_amounts (' +
        inputAmounts.length +
        ') differ in length',
    }
  }
  if (outputAmounts.length && outputAmounts.length !== outputAddresses.length) {
    return {
      reason:
        'output_addresses (' +
        outputAddresses.length +
        ') and output_amounts (' +
        outputAmounts.length +
        ') differ in length',
    }
  }

  const fee = Number(raw.fee)
  const srcPort = Number(raw.srcPort)
  const dstPort = Number(raw.dstPort)

  return {
    record: {
      timestamp: new Date(ts).toISOString(),
      txid,
      srcIp: String(raw.srcIp ?? '').trim() || '0.0.0.0',
      dstIp: String(raw.dstIp ?? '').trim() || '0.0.0.0',
      srcPort: Number.isFinite(srcPort) ? srcPort : 8333,
      dstPort: Number.isFinite(dstPort) ? dstPort : 8333,
      inputAddresses,
      outputAddresses,
      inputAmounts,
      outputAmounts,
      fee: Number.isFinite(fee) ? fee : 0,
      scriptType: String(raw.scriptType ?? '').trim() || undefined,
      geoCountry: String(raw.geoCountry ?? '').trim() || undefined,
      asn: String(raw.asn ?? '').trim() || undefined,
    },
  }
}

export function parseCapture(text: string, filename: string): ParseResult {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  const format: SourceFormat =
    ext === 'json' ? 'JSON' : ext === 'xml' ? 'XML' : ext === 'csv' || ext === 'tsv' ? 'CSV' : guess(text)

  const rows: Array<Record<string, RawCell>> = []
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
        const mapped: Record<string, RawCell> = {}
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          const c = canonical(k)
          if (c) mapped[c] = v as RawCell
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
      const mapped: Record<string, RawCell> = {}
      for (const child of Array.from(node.children)) {
        const c = canonical(child.tagName)
        if (!c) continue
        // Repeated child elements are the natural XML spelling of an array.
        const nested = Array.from(child.children)
        if (ARRAY_FIELDS.has(c) && nested.length) {
          mapped[c] = nested.map((n) => n.textContent?.trim() ?? '')
        } else if (ARRAY_FIELDS.has(c) && mapped[c]) {
          mapped[c] = [...(mapped[c] as string[]), child.textContent?.trim() ?? '']
        } else if (ARRAY_FIELDS.has(c)) {
          mapped[c] = [child.textContent?.trim() ?? '']
        } else {
          mapped[c] = child.textContent ?? ''
        }
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
      const mapped: Record<string, RawCell> = {}
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
    const { record, reason } = toRecord(raw)
    if (!record) {
      if (rejected.length < 50) rejected.push({ row: i + 2, reason: reason ?? 'invalid' })
      return
    }
    if (seen.has(record.txid)) {
      duplicates++
      return
    }
    seen.add(record.txid)
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
 * One record is one transaction. The address and amount arrays give both sides
 * directly, so nothing has to be inferred from row ordering.
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

  const host = (address: string, port: number, geo?: { country?: string; asn?: string }) => {
    let ip = ipByAddress.get(address)
    if (!ip) {
      const resolved = resolveGeo(address, geo)
      ip = {
        id: 'ip' + ipByAddress.size.toString().padStart(2, '0'),
        address,
        port,
        country: resolved.country,
        asn: resolved.asn,
        firstSeen: 0,
        lastSeen: 0,
        observationCount: 0,
        linkedWallets: [],
      }
      ipByAddress.set(address, ip)
    }
    return ip
  }

  const sides = (addresses: string[], amounts: number[]): TxParty[] =>
    addresses.map((address, i) => ({
      wallet: wallet(address).id,
      amount: Number.isFinite(amounts[i]) ? amounts[i] : 0,
    }))

  const transactions: Transaction[] = []
  let counter = 0
  let unpaired = 0

  for (const r of records) {
    const inputs = sides(r.inputAddresses, r.inputAmounts)
    const outputs = sides(r.outputAddresses, r.outputAmounts)
    if (!inputs.length || !outputs.length) unpaired++

    host(r.srcIp, r.srcPort, { country: r.geoCountry, asn: r.asn })
    if (r.dstIp && r.dstIp !== r.srcIp) host(r.dstIp, r.dstPort)

    transactions.push({
      id: 't' + (counter++).toString().padStart(4, '0'),
      txid: r.txid,
      timestamp: Date.parse(r.timestamp),
      inputs,
      outputs,
      amount: Number(outputs.reduce((a, o) => a + o.amount, 0).toFixed(8)),
      fee: r.fee,
      srcIp: r.srcIp,
      dstIp: r.dstIp,
      srcPort: r.srcPort,
      dstPort: r.dstPort,
      scriptType: r.scriptType ?? 'UNKNOWN',
    })
  }

  if (unpaired) {
    notes.push(
      unpaired +
        ' of ' +
        records.length +
        ' transactions carry only one side. They are kept for host and time correlation, but contribute no value flow.',
    )
  }
  if (!records.some((r) => r.geoCountry)) {
    notes.push(
      'No geo_country column in this capture. Countries were resolved from the local GeoIP database where one is installed; unresolved hosts show as ZZ.',
    )
  }

  transactions.sort((a, b) => a.timestamp - b.timestamp)

  // ---- aggregates -------------------------------------------------------
  const wallets = [...walletByAddress.values()]
  const byId = new Map(wallets.map((w) => [w.id, w]))
  for (const tx of transactions) {
    const touched = new Set<Wallet>()
    for (const side of tx.inputs) {
      const w = byId.get(side.wallet)
      if (!w) continue
      w.totalOut += side.amount
      w.degreeOut++
      touched.add(w)
    }
    for (const side of tx.outputs) {
      const w = byId.get(side.wallet)
      if (!w) continue
      w.totalIn += side.amount
      w.degreeIn++
      touched.add(w)
    }
    for (const w of touched) {
      w.txCount++
      w.firstSeen = w.firstSeen === 0 ? tx.timestamp : Math.min(w.firstSeen, tx.timestamp)
      w.lastSeen = Math.max(w.lastSeen, tx.timestamp)
    }
    const ip = ipByAddress.get(tx.srcIp)
    if (ip) {
      ip.observationCount++
      ip.firstSeen = ip.firstSeen === 0 ? tx.timestamp : Math.min(ip.firstSeen, tx.timestamp)
      ip.lastSeen = Math.max(ip.lastSeen, tx.timestamp)
      for (const side of tx.inputs) {
        if (!ip.linkedWallets.includes(side.wallet)) ip.linkedWallets.push(side.wallet)
      }
    }
  }

  assignClusters(wallets, transactions)
  const planted = detect(wallets, transactions)

  const stats: DatasetStats = {
    name,
    source: 'IMPORTED',
    format,
    records: records.length,
    fields: 11,
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
  transactions.forEach((t) => {
    const all = [...t.inputs, ...t.outputs].map((s) => s.wallet)
    for (let i = 1; i < all.length; i++) union(all[0], all[i])
  })

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

/** Transactions a wallet spends from, and transactions it receives into. */
function buildSideIndex(transactions: Transaction[]) {
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
  return { spends, receives }
}

function detect(wallets: Wallet[], transactions: Transaction[]): Detection[] {
  const out: Detection[] = []
  const { spends, receives } = buildSideIndex(transactions)

  // --- FAN-OUT / FAN-IN --------------------------------------------------
  for (const w of wallets) {
    for (const dir of ['out', 'in'] as const) {
      const list = (dir === 'out' ? spends.get(w.id) : receives.get(w.id)) ?? []
      if (!list.length) continue
      const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp)

      let best: { count: number; slice: Transaction[] } | null = null
      let lo = 0
      for (let hi = 0; hi < sorted.length; hi++) {
        while (sorted[hi].timestamp - sorted[lo].timestamp > WINDOW) lo++
        const slice = sorted.slice(lo, hi + 1)
        const counterparties = new Set(
          slice.flatMap((t) =>
            (dir === 'out' ? t.outputs : t.inputs)
              .map((s) => s.wallet)
              .filter((id) => id !== w.id),
          ),
        )
        if (!best || counterparties.size > best.count) {
          best = { count: counterparties.size, slice }
        }
      }
      if (!best || best.count < 8) continue

      const counterparties = [
        ...new Set(
          best.slice.flatMap((t) =>
            (dir === 'out' ? t.outputs : t.inputs)
              .map((s) => s.wallet)
              .filter((id) => id !== w.id),
          ),
        ),
      ]
      const total = best.slice.reduce(
        (a, t) =>
          a +
          (dir === 'out' ? t.outputs : t.inputs)
            .filter((s) => s.wallet !== w.id)
            .reduce((b, s) => b + s.amount, 0),
        0,
      )
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

  // --- RAPID MOVEMENT ----------------------------------------------------
  const dwellByWallet = new Map<string, number[]>()
  for (const w of wallets) {
    const ins = (receives.get(w.id) ?? []).map((t) => t.timestamp).sort((a, b) => a - b)
    const outs = (spends.get(w.id) ?? []).map((t) => t.timestamp).sort((a, b) => a - b)
    const dwells: number[] = []
    let j = 0
    for (const arrival of ins) {
      while (j < outs.length && outs[j] < arrival) j++
      if (j < outs.length) dwells.push(outs[j] - arrival)
    }
    if (dwells.length) dwellByWallet.set(w.id, dwells)
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const fast = wallets.filter((w) => {
    const d = dwellByWallet.get(w.id)
    return !!d && d.length > 0 && median(d) < RAPID_DWELL
  })
  if (fast.length >= 3) {
    const ids = new Set(fast.map((w) => w.id))
    const chainTx = transactions.filter(
      (t) =>
        t.inputs.some((s) => ids.has(s.wallet)) && t.outputs.some((s) => ids.has(s.wallet)),
    )
    if (chainTx.length >= 2) {
      const medians = fast.map((w) => median(dwellByWallet.get(w.id) ?? [0]))
      out.push(
        detection(
          'RAPID_MOVEMENT',
          fast[0].cluster,
          fast.map((w) => w.id),
          chainTx.map((t) => t.id),
          fast[0].id,
          Math.min(0.95, 0.55 + fast.length / 24),
          chainTx[chainTx.length - 1].timestamp,
          'median dwell ' + Math.round(median(medians) / 1000) + 's across ' + fast.length + ' wallets',
        ),
      )
    }
  }

  // --- BURST -------------------------------------------------------------
  out.push(...detectFrequencyOnly(wallets, transactions))

  // --- COINJOIN / MIXING -------------------------------------------------
  // Many inputs, many outputs, and outputs all the same size. The equal values
  // are what defeat input-to-output matching.
  for (const tx of transactions) {
    if (tx.inputs.length < 3 || tx.outputs.length < 3) continue
    const amounts = tx.outputs.map((o) => o.amount)
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
    if (mean <= 0) continue
    const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length)
    if (sd / mean >= 0.1) continue
    const participants = [...new Set([...tx.inputs, ...tx.outputs].map((s) => s.wallet))]
    out.push(
      detection(
        'COINJOIN',
        wallets.find((w) => w.id === tx.inputs[0].wallet)?.cluster ?? 0,
        participants,
        [tx.id],
        tx.inputs[0].wallet,
        Math.min(0.94, 0.55 + tx.outputs.length / 20),
        tx.timestamp,
        tx.inputs.length +
          ' inputs → ' +
          tx.outputs.length +
          ' equal outputs of ' +
          mean.toFixed(3) +
          ' BTC',
      ),
    )
  }

  // --- PEELING -----------------------------------------------------------
  // A peel is a transaction with a large continuing output and a small one
  // leaving. Following the large side repeatedly traces the chain.
  for (const start of wallets) {
    const chain: Transaction[] = []
    const visited = new Set<string>([start.id])
    let current = start.id
    let carried = 0
    let ok = true

    for (let hop = 0; hop < 10; hop++) {
      const candidates = (spends.get(current) ?? []).filter((t) =>
        t.outputs.some((s) => !visited.has(s.wallet)),
      )
      if (!candidates.length) break
      const tx = candidates.sort((a, b) => b.amount - a.amount)[0]
      const onward = [...tx.outputs]
        .filter((s) => !visited.has(s.wallet))
        .sort((a, b) => b.amount - a.amount)[0]
      if (!onward) break

      const total = tx.outputs.reduce((a, s) => a + s.amount, 0)
      const peelRatio = total > 0 ? (total - onward.amount) / total : 0
      if (chain.length && (peelRatio < 0.08 || peelRatio > 0.45)) {
        ok = false
        break
      }
      chain.push(tx)
      visited.add(onward.wallet)
      carried = onward.amount
      current = onward.wallet
    }

    if (ok && chain.length >= 4) {
      out.push(
        detection(
          'PEELING',
          start.cluster,
          [...visited],
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

  return dedupe(out)
}

/** Frequency analysis needs no direction, so it runs on every capture. */
function detectFrequencyOnly(wallets: Wallet[], transactions: Transaction[]): Detection[] {
  const out: Detection[] = []
  const clusters = [...new Set(wallets.map((w) => w.cluster))]
  const walletCluster = new Map(wallets.map((w) => [w.id, w.cluster]))

  for (const c of clusters) {
    const tx = transactions
      .filter((t) => t.inputs.some((s) => walletCluster.get(s.wallet) === c))
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
      ...new Set(peak[1].flatMap((t) => [...t.inputs, ...t.outputs].map((s) => s.wallet))),
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
