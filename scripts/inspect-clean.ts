/**
 * Runs the preparation stage over the messy sample and prints what it repaired
 * and what it refused.
 *
 *   npx esbuild scripts/inspect-clean.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=.tmp/clean.cjs && node .tmp/clean.cjs
 */
import { readFileSync } from 'node:fs'
import { cleanCapture } from '@/lib/clean'

const text = readFileSync('public/samples/capture-raw-messy.csv', 'utf8')
const { report, csv } = cleanCapture(text, 'capture-raw-messy.csv')

console.log('format', report.format)
console.log('rows read', report.totalRows, '| accepted', report.accepted, '| duplicates', report.duplicates)

console.log('\nheader map')
for (const h of report.headerMap) console.log('  ', h.from, '->', h.to)

console.log('\nfields found  ', report.fieldsFound.join(', '))
console.log('fields missing', report.fieldsMissing.join(', ') || '(none)')

console.log('\nrepairs')
for (const r of report.repairs) console.log('  ', r.count, r.label)

console.log('\nrejected', report.rejected.length)
for (const r of report.rejected.slice(0, 10)) console.log('   line', r.row, '—', r.reason)

console.log('\nclean csv, first 2 lines:')
console.log(csv.split('\n').slice(0, 3).join('\n'))
