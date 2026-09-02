/**
 * Developer utility: run the *imported* path end to end and prove the model
 * refits on it.
 *
 * Raw messy file → clean → parse → build dataset → assemble. This is the same
 * chain the Intake screen drives, so if the anomaly detector is not fitting on
 * imported captures it shows up here.
 *
 *   npm run inspect:imported
 */
import { readFileSync } from 'node:fs'
import { cleanCapture } from '@/lib/clean'
import { parseCapture, datasetFromRecords } from '@/lib/ingest'
import { assemble, analyse, shortAddr } from '@/lib/graph'

const nl = '\n'
const raw = readFileSync('public/samples/capture-raw-messy.csv', 'utf8')

// Stage 1 — preparation
const cleaned = cleanCapture(raw, 'capture-raw-messy.csv')
console.log('prepare  :', cleaned.report.totalRows, 'rows in →', cleaned.report.accepted, 'clean')

// Stage 2 — ingestion of the cleaned artifact, exactly as the drop zone does
const parsed = parseCapture(cleaned.csv, 'capture-raw-messy.clean.csv')
console.log('ingest   :', parsed.records.length, 'records parsed,', parsed.rejected.length, 'rejected')

// Stage 3 — the shared engine
const dataset = datasetFromRecords(parsed.records, 'capture-raw-messy.clean.csv', 'CSV')
const imported = assemble(dataset)
const synthetic = analyse()

console.log(nl + 'model fitted on the IMPORTED capture')
console.log('  name      :', imported.model.name, '(' + imported.model.family + ')')
console.log('  trees     :', imported.model.trees, '| sample', imported.model.sampleSize)
console.log('  trainedOn :', imported.model.trainedOn, 'wallets')
console.log('  flagged   :', imported.model.flagged, 'above the 90th-percentile threshold')

console.log(nl + 'proof it refit rather than reusing the synthetic fit')
console.log('  synthetic trainedOn :', synthetic.model.trainedOn)
console.log('  imported  trainedOn :', imported.model.trainedOn)
console.log('  dataset wallets     :', dataset.wallets.length)
console.log(
  '  matches imported dataset?',
  imported.model.trainedOn === dataset.wallets.length ? 'YES' : 'NO — MISMATCH',
)
console.log(
  '  differs from synthetic?  ',
  imported.model.trainedOn !== synthetic.model.trainedOn ? 'YES' : 'NO — SUSPICIOUS',
)

const scores = [...imported.anomalies.values()].map((a) => a.score)
const distinct = new Set(scores.map((s) => s.toFixed(6))).size
console.log(nl + 'anomaly output on the imported capture')
console.log('  scored wallets :', imported.anomalies.size)
console.log('  distinct scores:', distinct, distinct > 1 ? '(varies — the model is discriminating)' : '(CONSTANT — DEGENERATE)')
console.log('  min / max      :', Math.min(...scores).toFixed(4), '/', Math.max(...scores).toFixed(4))

console.log(nl + 'top imported wallets, with the model signal broken out')
for (const w of [...dataset.wallets].sort((a, b) => b.risk.score - a.risk.score).slice(0, 5)) {
  const anom = imported.anomalies.get(w.id)
  const drivers = (anom?.contributions ?? [])
    .slice(0, 2)
    .map((c) => c.label + ' ' + Math.round(c.share * 100) + '%')
    .join(', ')
  console.log(
    ' ',
    w.id,
    shortAddr(w.address),
    'risk',
    String(w.risk.score).padStart(2),
    '|',
    w.risk.signals.map((s) => s.key.slice(0, 4) + ':' + String(s.value).padStart(3)).join(' '),
    '|',
    drivers || '(no dominant feature)',
  )
}

const lead = imported.leads[0]
console.log(nl + 'evidence on the top imported lead')
if (!lead) console.log('  (no lead generated)')
for (const e of lead?.evidence ?? []) {
  console.log(' ', e.index, e.title.padEnd(20), e.metric)
}

const hasModelRow = (lead?.evidence ?? []).some((e) => e.type === 'ML_ANOMALY')
console.log(nl + 'model appears in the imported lead evidence?', hasModelRow ? 'YES' : 'NO')
