/**
 * Writes sample captures into public/samples so the intake path can be
 * demonstrated without anyone having to hand-build a file.
 *
 *   npx esbuild scripts/emit-sample.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=.tmp/emit.cjs && node .tmp/emit.cjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { generateDataset } from '@/data/synthetic'

const { transactions, wallets } = generateDataset(9314)
const address = new Map(wallets.map((w) => [w.id, w.address]))

interface Row {
  txid: string
  wallet: string
  amount: number
  fee: number
  ip: string
  port: number
  timestamp: string
}

const rows: Row[] = []
for (const tx of transactions) {
  const iso = new Date(tx.timestamp).toISOString()
  // Input side first, then the output side — the ordering the reconstruction
  // rule relies on.
  rows.push({
    txid: tx.txid,
    wallet: address.get(tx.sourceWallet)!,
    amount: Number((tx.amount + tx.fee).toFixed(8)),
    fee: tx.fee,
    ip: tx.observedIp,
    port: tx.port,
    timestamp: iso,
  })
  rows.push({
    txid: tx.txid,
    wallet: address.get(tx.destinationWallet)!,
    amount: tx.amount,
    fee: 0,
    ip: tx.observedIp,
    port: tx.port,
    timestamp: iso,
  })
}

mkdirSync('public/samples', { recursive: true })

const header = 'txid,wallet,amount,fee,ip,port,timestamp'
const csv = [header, ...rows.map((r) => [r.txid, r.wallet, r.amount, r.fee, r.ip, r.port, r.timestamp].join(','))].join('\n')
writeFileSync('public/samples/capture-sample.csv', csv + '\n', 'utf8')

writeFileSync('public/samples/capture-sample.json', JSON.stringify(rows.slice(0, 400), null, 0), 'utf8')

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<capture source="synthetic" note="Not a record of observed activity.">',
  ...rows.slice(0, 400).map(
    (r) =>
      `  <record><txid>${r.txid}</txid><wallet>${r.wallet}</wallet><amount>${r.amount}</amount>` +
      `<fee>${r.fee}</fee><ip>${r.ip}</ip><port>${r.port}</port><timestamp>${r.timestamp}</timestamp></record>`,
  ),
  '</capture>',
].join('\n')
writeFileSync('public/samples/capture-sample.xml', xml + '\n', 'utf8')

console.log('rows', rows.length, 'transactions', transactions.length)
