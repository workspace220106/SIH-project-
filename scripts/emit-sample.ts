/**
 * Writes sample captures into public/samples in the problem statement's field
 * format, so the intake path can be demonstrated without hand-building a file.
 *
 *   npx esbuild scripts/emit-sample.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=.tmp/emit.cjs && node .tmp/emit.cjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { generateDataset } from '@/data/synthetic'

const { transactions, wallets, ips } = generateDataset(9314)
const address = new Map(wallets.map((w) => [w.id, w.address]))
const hostByIp = new Map(ips.map((i) => [i.address, i]))

interface Row {
  timestamp: string
  txid: string
  src_ip: string
  dst_ip: string
  src_port: number
  dst_port: number
  input_addresses: string[]
  output_addresses: string[]
  input_amounts: number[]
  output_amounts: number[]
  fee: number
  script_type: string
  geo_country: string
  asn: string
}

const rows: Row[] = transactions.map((tx) => {
  const host = hostByIp.get(tx.srcIp)
  return {
    timestamp: new Date(tx.timestamp).toISOString(),
    txid: tx.txid,
    src_ip: tx.srcIp,
    dst_ip: tx.dstIp,
    src_port: tx.srcPort,
    dst_port: tx.dstPort,
    input_addresses: tx.inputs.map((s) => address.get(s.wallet) ?? s.wallet),
    output_addresses: tx.outputs.map((s) => address.get(s.wallet) ?? s.wallet),
    input_amounts: tx.inputs.map((s) => s.amount),
    output_amounts: tx.outputs.map((s) => s.amount),
    fee: tx.fee,
    script_type: tx.scriptType,
    geo_country: host?.country ?? 'ZZ',
    asn: host?.asn ?? 'AS0',
  }
})

mkdirSync('public/samples', { recursive: true })

// CSV: arrays are pipe-separated inside a single cell, so commas stay free to
// delimit columns.
const header = [
  'timestamp', 'txid', 'src_ip', 'dst_ip', 'src_port', 'dst_port',
  'input_addresses', 'output_addresses', 'input_amounts', 'output_amounts',
  'fee', 'script_type', 'geo_country', 'asn',
].join(',')
const csv = [
  header,
  ...rows.map((r) =>
    [
      r.timestamp, r.txid, r.src_ip, r.dst_ip, r.src_port, r.dst_port,
      r.input_addresses.join('|'),
      r.output_addresses.join('|'),
      r.input_amounts.join('|'),
      r.output_amounts.join('|'),
      r.fee, r.script_type, r.geo_country, r.asn,
    ].join(','),
  ),
].join('\n')
writeFileSync('public/samples/capture-sample.csv', csv + '\n', 'utf8')

writeFileSync(
  'public/samples/capture-sample.json',
  JSON.stringify(rows.slice(0, 120), null, 0),
  'utf8',
)

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<capture source="synthetic" note="Not a record of observed activity.">',
  ...rows.slice(0, 120).map((r) =>
    [
      '  <record>',
      '    <timestamp>' + r.timestamp + '</timestamp>',
      '    <txid>' + r.txid + '</txid>',
      '    <src_ip>' + r.src_ip + '</src_ip>',
      '    <dst_ip>' + r.dst_ip + '</dst_ip>',
      '    <src_port>' + r.src_port + '</src_port>',
      '    <dst_port>' + r.dst_port + '</dst_port>',
      '    <input_addresses>' +
        r.input_addresses.map((a) => '<address>' + esc(a) + '</address>').join('') +
        '</input_addresses>',
      '    <output_addresses>' +
        r.output_addresses.map((a) => '<address>' + esc(a) + '</address>').join('') +
        '</output_addresses>',
      '    <input_amounts>' +
        r.input_amounts.map((a) => '<amount>' + a + '</amount>').join('') +
        '</input_amounts>',
      '    <output_amounts>' +
        r.output_amounts.map((a) => '<amount>' + a + '</amount>').join('') +
        '</output_amounts>',
      '    <fee>' + r.fee + '</fee>',
      '    <script_type>' + r.script_type + '</script_type>',
      '    <geo_country>' + r.geo_country + '</geo_country>',
      '    <asn>' + r.asn + '</asn>',
      '  </record>',
    ].join('\n'),
  ),
  '</capture>',
].join('\n')
writeFileSync('public/samples/capture-sample.xml', xml + '\n', 'utf8')

console.log('wrote', rows.length, 'transactions in the official field format')

/* ------------------------------------------------------------------ *
 * A deliberately messy capture, to exercise the preparation stage.
 * Every defect here is one a real exporter actually produces.
 * ------------------------------------------------------------------ */

const messyHeader = [
  'Time Stamp', 'Transaction ID', 'Source IP', 'Dest IP',
  'From Addresses', 'To Addresses', 'Input Value', 'Output Value',
  'Fees', 'Type', 'Country', 'AS',
].join(',')

const q = (v: string) => (/[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)

const messyLines = rows.slice(0, 90).map((r, i) => {
  const iso = r.timestamp
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')

  // Four different date conventions across the file.
  const when =
    i % 4 === 0
      ? String(Math.floor(d.getTime() / 1000))
      : i % 4 === 1
        ? pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() +
          ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes())
        : i % 4 === 2
          ? iso.replace('T', ' ').replace('.000Z', '')
          : iso

  // Ports welded onto the address, and no port columns at all.
  const src = i % 3 === 0 ? r.src_ip + ':' + r.src_port : r.src_ip
  const dst = i % 5 === 0 ? r.dst_ip + ':' + r.dst_port : r.dst_ip

  // Three array encodings.
  const joinAddrs = (a: string[]) =>
    i % 3 === 0 ? JSON.stringify(a) : i % 3 === 1 ? a.join(';') : a.join('|')

  // Satoshis on some rows, a currency symbol on others.
  const amounts = (a: number[]) =>
    i % 3 === 0
      ? a.map((v) => String(Math.round(v * 1e8))).join('|')
      : i % 3 === 1
        ? a.map((v) => '₿' + v.toFixed(8)).join('|')
        : a.join('|')

  return [
    when, r.txid, src, dst,
    q(joinAddrs(r.input_addresses)), q(joinAddrs(r.output_addresses)),
    q(amounts(r.input_amounts)), q(amounts(r.output_amounts)),
    r.fee, i % 7 === 0 ? '' : r.script_type,
    i % 6 === 0 ? '' : r.geo_country, r.asn,
  ].join(',')
})

// Defects the cleaner must reject rather than repair.
messyLines.splice(12, 0, ',9f2c1a55deadbeef,10.0.0.1,10.0.0.2,bc1qaaa,bc1qbbb,0.5,0.5,0.0001,P2WPKH,IN,AS9498')
messyLines.splice(25, 0, [rows[3].timestamp, 'badip0001', '999.1.1.1', '10.0.0.2', 'bc1qccc', 'bc1qddd', '0.5', '0.5', '0.0001', 'P2WPKH', 'IN', 'AS4837'].join(','))
messyLines.splice(38, 0, [rows[4].timestamp, 'mismatch01', '10.0.0.3', '10.0.0.4', q('bc1qeee|bc1qfff'), 'bc1qggg', q('0.2|0.3'), q('0.1|0.2|0.3'), '0.0001', 'P2WPKH', 'NL', 'AS4837'].join(','))
messyLines.splice(51, 0, [rows[5].timestamp, 'negative01', '10.0.0.5', '10.0.0.6', 'bc1qhhh', 'bc1qiii', '-0.4', '0.4', '0.0001', 'P2WPKH', 'DE', 'AS4837'].join(','))
// A duplicate txid, which should be counted and dropped.
messyLines.splice(64, 0, messyLines[8])

writeFileSync('public/samples/capture-raw-messy.csv', [messyHeader, ...messyLines].join('\n') + '\n', 'utf8')
console.log('wrote public/samples/capture-raw-messy.csv —', messyLines.length, 'rows with mixed formats and 5 defects')
