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
