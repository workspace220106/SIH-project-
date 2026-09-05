import type { RawRecord } from '@/types'

/**
 * Capture preparation.
 *
 * Repairs what can be repaired deterministically (header names, timestamps,
 * satoshi amounts, ip:port, three array encodings) and rejects the rest with
 * a line number and a reason. Output is canonical CSV that the ingest path
 * takes as is.
 */

export const CANONICAL_COLUMNS = [
  'timestamp',
  'txid',
  'src_ip',
  'dst_ip',
  'src_port',
  'dst_port',
  'input_addresses',
  'output_addresses',
  'input_amounts',
  'output_amounts',
  'fee',
  'script_type',
  'geo_country',
  'asn',
] as const

export interface Repair {
  key: string
  label: string
  count: number
}

export interface CleaningReport {
  format: 'CSV' | 'JSON' | 'XML'
  totalRows: number
  accepted: number
  duplicates: number
  rejected: Array<{ row: number; reason: string }>
  repairs: Repair[]
  /** Canonical fields the source actually supplied. */
  fieldsFound: string[]
  /** Canonical fields absent, filled with a documented default. */
  fieldsMissing: string[]
  headerMap: Array<{ from: string; to: string }>
}

export interface CleaningResult {
  records: RawRecord[]
  report: CleaningReport
  /** Canonical CSV. */
  csv: string
}

/* ------------------------------------------------------------------ *
 * Header resolution
 * ------------------------------------------------------------------ */

type Canon = (typeof CANONICAL_COLUMNS)[number]

const HEADER_ALIASES: Record<Canon, string[]> = {
  timestamp: ['timestamp', 'time', 'ts', 'datetime', 'date', 'observed_at', 'block_time', 'seen_at'],
  txid: ['txid', 'tx_id', 'tx', 'transaction_id', 'transactionid', 'hash', 'txhash', 'transaction'],
  src_ip: ['src_ip', 'source_ip', 'srcip', 'ip', 'ip_address', 'from_ip', 'sender_ip', 'host'],
  dst_ip: ['dst_ip', 'dest_ip', 'destination_ip', 'dstip', 'to_ip', 'peer_ip', 'receiver_ip'],
  src_port: ['src_port', 'source_port', 'srcport', 'port', 'from_port', 'sender_port'],
  dst_port: ['dst_port', 'dest_port', 'destination_port', 'dstport', 'to_port', 'peer_port'],
  input_addresses: ['input_addresses', 'inputaddresses', 'inputs', 'input_addrs', 'in_addresses', 'from_addresses', 'sender_addresses'],
  output_addresses: ['output_addresses', 'outputaddresses', 'outputs', 'output_addrs', 'out_addresses', 'to_addresses', 'receiver_addresses'],
  input_amounts: ['input_amounts', 'inputamounts', 'input_values', 'in_amounts', 'input_value'],
  output_amounts: ['output_amounts', 'outputamounts', 'output_values', 'output_value', 'out_amounts', 'amount', 'value', 'btc'],
  fee: ['fee', 'txfee', 'fee_btc', 'miner_fee', 'fees'],
  script_type: ['script_type', 'scripttype', 'script', 'output_script_type', 'type'],
  geo_country: ['geo_country', 'country', 'country_code', 'geoip_country', 'src_country', 'cc'],
  asn: ['asn', 'as_number', 'autonomous_system', 'src_asn', 'as'],
}

/** Word separators carry no meaning in a column name. */
const compact = (s: string) => s.replace(/_/g, '')

/** Loose match: ignores case, spacing, punctuation and BOM. */
function resolveHeader(raw: string): Canon | null {
  const h = raw
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, '_')
    .replace(/[^a-z0-9_[\]]/g, '')
    .replace(/\[\]$/, '')
  if (!h) return null
  const hc = compact(h)
  for (const key of CANONICAL_COLUMNS) {
    for (const alias of HEADER_ALIASES[key]) {
      // "Time Stamp", "timestamp" and "time_stamp" are the same column.
      if (h === alias || hc === compact(alias)) return key
    }
  }
  return null
}

/* ------------------------------------------------------------------ *
 * Value repair
 * ------------------------------------------------------------------ */

/** Splits an array cell however the exporter chose to encode it. */
function parseList(raw: unknown): { values: string[]; repaired: boolean } {
  if (Array.isArray(raw)) return { values: raw.map((v) => String(v).trim()).filter(Boolean), repaired: false }
  const text = String(raw ?? '').trim()
  if (!text) return { values: [], repaired: false }

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text.replace(/'/g, '"'))
      if (Array.isArray(parsed)) {
        return { values: parsed.map((v) => String(v).trim()).filter(Boolean), repaired: true }
      }
    } catch {
      /* fall through */
    }
  }
  const stripped = text.replace(/^\[|\]$/g, '')
  const parts = stripped
    .split(/[|;,]/)
    .map((v) => v.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
  return { values: parts, repaired: parts.length > 1 || text !== stripped }
}

/** Timestamp formats a capture is likely to use. Ambiguous dates are day-first. */
function parseTimestamp(raw: unknown): { value: number | null; repaired: boolean } {
  if (typeof raw === 'number') {
    return { value: raw > 1e11 ? raw : raw * 1000, repaired: true }
  }
  const text = String(raw ?? '').trim()
  if (!text) return { value: null, repaired: false }

  if (/^\d{9,}$/.test(text)) {
    const n = Number(text)
    return { value: n > 1e11 ? n : n * 1000, repaired: true }
  }

  const direct = Date.parse(text)
  if (!Number.isNaN(direct)) {
    // A bare "YYYY-MM-DD HH:MM:SS" is parsed as local time by the engine;
    // captures are UTC, so re-read it as UTC rather than shifting it.
    const bare = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text)
    if (bare) return { value: Date.parse(text.replace(' ', 'T') + 'Z'), repaired: true }
    return { value: direct, repaired: text.includes('/') }
  }

  // DD/MM/YYYY or DD-MM-YYYY, with optional time.
  const m = text.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const [, a, b, y, hh = '0', mm = '0', ss = '0'] = m
    const day = Number(a)
    const month = Number(b)
    // If the first field cannot be a day, it must be the month.
    const [d, mo] = day > 12 ? [day, month] : month > 12 ? [month, day] : [day, month]
    const value = Date.UTC(Number(y), mo - 1, d, Number(hh), Number(mm), Number(ss))
    return { value: Number.isNaN(value) ? null : value, repaired: true }
  }
  return { value: null, repaired: false }
}

/**
 * Amounts. Strips currency marks and separators. A whole number above 100,000
 * is treated as satoshis.
 */
function parseAmount(raw: unknown): { value: number | null; repaired: boolean; sats: boolean } {
  if (typeof raw === 'number') {
    if (Number.isInteger(raw) && raw >= 100_000) return { value: raw / 1e8, repaired: true, sats: true }
    return { value: raw, repaired: false, sats: false }
  }
  const text = String(raw ?? '').trim()
  if (!text) return { value: null, repaired: false, sats: false }

  const isSats = /sat/i.test(text)
  const cleaned = text.replace(/[₿฿$€£,\s]/g, '').replace(/sats?/i, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return { value: null, repaired: false, sats: false }

  if (isSats || (Number.isInteger(n) && n >= 100_000)) {
    return { value: n / 1e8, repaired: true, sats: true }
  }
  return { value: n, repaired: cleaned !== text, sats: false }
}

/** Pulls a port off an address, and normalises IPv6 brackets. */
function parseHost(raw: unknown): { ip: string; port: number | null; repaired: boolean } {
  const text = String(raw ?? '').trim()
  if (!text) return { ip: '', port: null, repaired: false }

  const v6 = text.match(/^\[(.+)\](?::(\d+))?$/)
  if (v6) return { ip: v6[1], port: v6[2] ? Number(v6[2]) : null, repaired: true }

  const v4 = text.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/)
  if (v4) return { ip: v4[1], port: Number(v4[2]), repaired: true }

  return { ip: text, port: null, repaired: text !== String(raw ?? '') }
}

const isValidIp = (ip: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)
    ? ip.split('.').every((o) => Number(o) >= 0 && Number(o) <= 255)
    : /^[0-9a-f:]+$/i.test(ip) && ip.includes(':')

/* ------------------------------------------------------------------ *
 * Row parsing
 * ------------------------------------------------------------------ */

function splitDelimited(line: string, delimiter: string): string[] {
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
  return out
}

function detectFormat(text: string, filename: string): 'CSV' | 'JSON' | 'XML' {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'json') return 'JSON'
  if (ext === 'xml') return 'XML'
  if (ext === 'csv' || ext === 'tsv') return 'CSV'
  const head = text.trimStart().slice(0, 1)
  if (head === '{' || head === '[') return 'JSON'
  if (head === '<') return 'XML'
  return 'CSV'
}

/** Reads any supported encoding into loosely-typed rows keyed by canonical name. */
function readRows(
  text: string,
  format: 'CSV' | 'JSON' | 'XML',
): { rows: Array<Record<string, unknown>>; headerMap: Array<{ from: string; to: string }> } {
  const headerMap: Array<{ from: string; to: string }> = []
  const rows: Array<Record<string, unknown>> = []
  const seenHeaders = new Set<string>()

  const note = (from: string, to: Canon) => {
    if (from.trim() !== to && !seenHeaders.has(from)) {
      seenHeaders.add(from)
      headerMap.push({ from: from.trim() || '(blank)', to })
    }
  }

  if (format === 'JSON') {
    const parsed = JSON.parse(text)
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { records?: unknown[] }).records)
        ? (parsed as { records: unknown[] }).records
        : []
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const mapped: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        const c = resolveHeader(k)
        if (c) {
          mapped[c] = v
          note(k, c)
        }
      }
      rows.push(mapped)
    }
  } else if (format === 'XML') {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    if (doc.querySelector('parsererror')) throw new Error('XML is not well formed')
    const nodes = Array.from(doc.documentElement.children)
    for (const node of nodes) {
      const mapped: Record<string, unknown> = {}
      for (const child of Array.from(node.children)) {
        const c = resolveHeader(child.tagName)
        if (!c) continue
        note(child.tagName, c)
        const nested = Array.from(child.children)
        mapped[c] = nested.length
          ? nested.map((n) => n.textContent?.trim() ?? '')
          : (child.textContent ?? '')
      }
      if (Object.keys(mapped).length) rows.push(mapped)
    }
  } else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
    if (!lines.length) throw new Error('File is empty')
    const delimiter = ['\t', ';', ','].find((d) => lines[0].includes(d)) ?? ','
    const header = splitDelimited(lines[0], delimiter).map((h) => h.trim())
    const map = header.map((h) => {
      const c = resolveHeader(h)
      if (c) note(h, c)
      return c
    })
    for (let i = 1; i < lines.length; i++) {
      const cells = splitDelimited(lines[i], delimiter)
      const mapped: Record<string, unknown> = {}
      map.forEach((c, ci) => {
        if (c) mapped[c] = (cells[ci] ?? '').trim()
      })
      rows.push(mapped)
    }
  }

  return { rows, headerMap }
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export function cleanCapture(text: string, filename: string): CleaningResult {
  const format = detectFormat(text, filename)
  const { rows, headerMap } = readRows(text, format)

  const counters = new Map<string, number>()
  const bump = (key: string) => counters.set(key, (counters.get(key) ?? 0) + 1)

  const records: RawRecord[] = []
  const rejected: CleaningReport['rejected'] = []
  const seenTxids = new Set<string>()
  let duplicates = 0

  const fieldsFound = new Set<string>()
  rows.forEach((r) => Object.keys(r).forEach((k) => fieldsFound.add(k)))

  rows.forEach((row, i) => {
    const line = i + 2 // header is line 1
    const reject = (reason: string) => {
      if (rejected.length < 60) rejected.push({ row: line, reason })
    }

    const txid = String(row.txid ?? '').trim()
    if (!txid) return reject('no txid')
    if (seenTxids.has(txid)) {
      duplicates++
      bump('duplicate')
      return
    }

    const ts = parseTimestamp(row.timestamp)
    if (ts.value === null) return reject('timestamp could not be read')
    if (ts.repaired) bump('timestamp')

    // --- hosts ------------------------------------------------------------
    const src = parseHost(row.src_ip)
    const dst = parseHost(row.dst_ip)
    if (src.repaired || dst.repaired) bump('host')
    if (src.ip && !isValidIp(src.ip)) return reject('src_ip "' + src.ip + '" is not an address')
    if (dst.ip && !isValidIp(dst.ip)) return reject('dst_ip "' + dst.ip + '" is not an address')

    let srcPort = Number(String(row.src_port ?? '').trim())
    let dstPort = Number(String(row.dst_port ?? '').trim())
    if (!Number.isFinite(srcPort) && src.port !== null) {
      srcPort = src.port
      bump('port_from_host')
    }
    if (!Number.isFinite(dstPort) && dst.port !== null) {
      dstPort = dst.port
      bump('port_from_host')
    }

    // --- sides ------------------------------------------------------------
    const inAddr = parseList(row.input_addresses)
    const outAddr = parseList(row.output_addresses)
    if (inAddr.repaired || outAddr.repaired) bump('array')
    if (!inAddr.values.length && !outAddr.values.length) {
      return reject('no input or output addresses')
    }

    const inRaw = parseList(row.input_amounts)
    const outRaw = parseList(row.output_amounts)
    const inAmt: number[] = []
    const outAmt: number[] = []
    let bad = false
    for (const [source, target] of [
      [inRaw.values, inAmt],
      [outRaw.values, outAmt],
    ] as Array<[string[], number[]]>) {
      for (const v of source) {
        const parsed = parseAmount(v)
        if (parsed.value === null || parsed.value < 0) {
          bad = true
          break
        }
        if (parsed.sats) bump('satoshi')
        else if (parsed.repaired) bump('amount')
        target.push(parsed.value)
      }
      if (bad) break
    }
    if (bad) return reject('an amount was negative or unreadable')

    if (inAmt.length && inAmt.length !== inAddr.values.length) {
      return reject(
        'input_addresses (' + inAddr.values.length + ') and input_amounts (' + inAmt.length + ') differ in length',
      )
    }
    if (outAmt.length && outAmt.length !== outAddr.values.length) {
      return reject(
        'output_addresses (' + outAddr.values.length + ') and output_amounts (' + outAmt.length + ') differ in length',
      )
    }

    const fee = parseAmount(row.fee)
    if (fee.repaired) bump('amount')

    const country = String(row.geo_country ?? '').trim().toUpperCase()
    if (!row.script_type || !country) bump('default')

    seenTxids.add(txid)
    records.push({
      timestamp: new Date(ts.value).toISOString(),
      txid,
      srcIp: src.ip || '0.0.0.0',
      dstIp: dst.ip || '0.0.0.0',
      srcPort: Number.isFinite(srcPort) ? srcPort : 8333,
      dstPort: Number.isFinite(dstPort) ? dstPort : 8333,
      inputAddresses: inAddr.values,
      outputAddresses: outAddr.values,
      inputAmounts: inAmt,
      outputAmounts: outAmt,
      fee: fee.value ?? 0,
      scriptType: String(row.script_type ?? '').trim() || 'UNKNOWN',
      geoCountry: country && country.length === 2 ? country : undefined,
      asn: String(row.asn ?? '').trim() || undefined,
    })
  })

  const REPAIR_LABELS: Record<string, string> = {
    timestamp: 'Timestamps normalised to UTC ISO 8601',
    amount: 'Amounts stripped of symbols and separators',
    satoshi: 'Satoshi values converted to BTC',
    host: 'Addresses normalised, ports separated',
    port_from_host: 'Ports recovered from address:port',
    array: 'Array columns split into lists',
    duplicate: 'Duplicate txids dropped',
    default: 'Missing optional fields defaulted',
  }

  const repairs: Repair[] = [...counters.entries()]
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, label: REPAIR_LABELS[key] ?? key, count }))
    .sort((a, b) => b.count - a.count)

  return {
    records,
    report: {
      format,
      totalRows: rows.length,
      accepted: records.length,
      duplicates,
      rejected,
      repairs,
      fieldsFound: CANONICAL_COLUMNS.filter((c) => fieldsFound.has(c)),
      fieldsMissing: CANONICAL_COLUMNS.filter((c) => !fieldsFound.has(c)),
      headerMap,
    },
    csv: toCanonicalCsv(records),
  }
}

/** Canonical CSV output. */
export function toCanonicalCsv(records: RawRecord[]): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [CANONICAL_COLUMNS.join(',')]
  for (const r of records) {
    lines.push(
      [
        r.timestamp,
        r.txid,
        r.srcIp,
        r.dstIp,
        r.srcPort,
        r.dstPort,
        r.inputAddresses.join('|'),
        r.outputAddresses.join('|'),
        r.inputAmounts.join('|'),
        r.outputAmounts.join('|'),
        r.fee,
        r.scriptType ?? 'UNKNOWN',
        r.geoCountry ?? '',
        r.asn ?? '',
      ]
        .map(cell)
        .join(','),
    )
  }
  return lines.join('\n') + '\n'
}
