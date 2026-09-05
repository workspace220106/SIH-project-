/**
 * Runs ingestion, parsing and the model over every input path and asserts the
 * result. Covers CSV, JSON, XML, the messy capture and the adversarial one.
 * Exits non-zero on failure.
 *
 *   npm run verify
 */
import { readFileSync } from 'node:fs'
import { cleanCapture } from '@/lib/clean'
import { parseCapture, datasetFromRecords } from '@/lib/ingest'
import { assemble } from '@/lib/graph'

interface Case {
  label: string
  file: string
  /** Run the preparation stage first, as the Intake screen does. */
  prepare?: boolean
}

const CASES: Case[] = [
  { label: 'CSV   capture-sample', file: 'public/samples/capture-sample.csv' },
  { label: 'JSON  capture-sample', file: 'public/samples/capture-sample.json' },
  { label: 'XML   capture-sample', file: 'public/samples/capture-sample.xml' },
  { label: 'CSV   raw-messy', file: 'public/samples/capture-raw-messy.csv', prepare: true },
  { label: 'CSV   adversarial', file: 'public/samples/adversarial-worst-capture.csv', prepare: true },
]

let failures = 0
const check = (label: string, ok: boolean, detail: string) => {
  if (!ok) failures++
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(34)} ${detail}`)
}

console.log(`platform: ${process.platform} ${process.arch} | node ${process.version}`)
console.log(`tz      : ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`)

for (const c of CASES) {
  console.log(`=== ${c.label} ===`)

  let text: string
  try {
    text = readFileSync(c.file, 'utf8')
  } catch {
    console.log(`   SKIP  file not present: ${c.file}\n`)
    continue
  }

  // The XML reader uses DOMParser, a browser API, so this headless script
  // cannot cover that path. Report it rather than skipping silently.
  if (c.file.endsWith('.xml') && typeof DOMParser === 'undefined') {
    console.log('   NOTE  XML uses DOMParser (browser API); not testable headlessly.')
    console.log('         Verify XML import in the running app instead.\n')
    continue
  }

  // ---- preparation, for captures that arrive dirty -----------------------
  let name = c.file.split('/').pop() as string
  if (c.prepare) {
    const cleaned = cleanCapture(text, name)
    check(
      'preparation accepted rows',
      cleaned.report.accepted > 0,
      `${cleaned.report.totalRows} in → ${cleaned.report.accepted} clean, ${cleaned.report.rejected.length} rejected`,
    )
    check(
      'preparation rejects the unusable',
      cleaned.report.rejected.length > 0,
      `refuses bad rows rather than guessing`,
    )
    text = cleaned.csv
    name = name.replace(/\.csv$/, '.clean.csv')
  }

  // ---- ingestion and parsing --------------------------------------------
  const parsed = parseCapture(text, name)
  check('format detected', !!parsed.format, parsed.format)
  check('records parsed', parsed.records.length > 0, `${parsed.records.length} records, ${parsed.rejected.length} rejected`)

  const withBothSides = parsed.records.filter(
    (r) => r.inputAddresses.length > 0 && r.outputAddresses.length > 0,
  ).length
  check(
    'both sides populated',
    withBothSides === parsed.records.length,
    `${withBothSides}/${parsed.records.length} have input+output arrays`,
  )

  const balanced = parsed.records.filter(
    (r) =>
      r.inputAddresses.length === r.inputAmounts.length &&
      r.outputAddresses.length === r.outputAmounts.length,
  ).length
  check(
    'address/amount arrays aligned',
    balanced === parsed.records.length,
    `${balanced}/${parsed.records.length} aligned`,
  )

  const readable = parsed.records.every((r) => Number.isFinite(Date.parse(r.timestamp)))
  check('timestamps normalised', readable, 'every record has a parseable ISO timestamp')

  // ---- the engine and the model -----------------------------------------
  const dataset = datasetFromRecords(parsed.records, name, parsed.format)
  const a = assemble(dataset)

  // Source order is whatever the exporter wrote. The temporal detectors need
  // the dataset chronological, which is where the sort happens.
  const chrono = dataset.transactions.every(
    (t, i, arr) => i === 0 || arr[i - 1].timestamp <= t.timestamp,
  )
  check('dataset is chronological', chrono, 'sorted regardless of source order')

  check('dataset built', dataset.wallets.length > 0, `${dataset.wallets.length} wallets, ${dataset.transactions.length} tx`)
  check(
    'model fitted on THIS capture',
    a.model.trainedOn === dataset.wallets.length,
    `trainedOn ${a.model.trainedOn} === wallets ${dataset.wallets.length}`,
  )
  check('every wallet scored', a.anomalies.size === dataset.wallets.length, `${a.anomalies.size} scored`)

  const scores = [...a.anomalies.values()].map((x) => x.score)
  const distinct = new Set(scores.map((s) => s.toFixed(6))).size
  check(
    'scores discriminate',
    distinct > 1,
    `${distinct} distinct values, ${Math.min(...scores).toFixed(4)}–${Math.max(...scores).toFixed(4)}`,
  )
  check(
    'scores in range',
    scores.every((s) => s >= 0 && s <= 1),
    'all within [0,1]',
  )

  const explained = [...a.anomalies.values()].filter((x) => x.contributions.length > 0).length
  check('explanations produced', explained > 0, `${explained} wallets have ranked feature contributions`)

  // Leads need risk >= 50 plus a matched detector, so a small capture can
  // legitimately produce none. Only assert when there is a lead.
  if (a.leads.length) {
    const modelInEvidence = a.leads.some((l) => l.evidence.some((e) => e.type === 'ML_ANOMALY'))
    check('model reaches the evidence', modelInEvidence, 'MODEL ANOMALY row present in a lead')
  } else {
    console.log('   note  no lead cleared risk>=50 with a matched detector (correct restraint)')
  }

  check(
    'detectors fired',
    a.patterns.length > 0,
    [...new Set(a.patterns.map((p) => p.shortName))].join(', ') || 'none',
  )
  check('alerts generated', a.alerts.length > 0, `${a.alerts.length} alerts, ${a.leads.length} leads`)

  console.log()
}

// ---- determinism ---------------------------------------------------------
console.log('=== determinism ===')
{
  const text = readFileSync('public/samples/capture-sample.csv', 'utf8')
  const once = assemble(datasetFromRecords(parseCapture(text, 'a.csv').records, 'a.csv', 'CSV'))
  const twice = assemble(datasetFromRecords(parseCapture(text, 'a.csv').records, 'a.csv', 'CSV'))
  const key = (x: typeof once) =>
    [...x.anomalies.entries()].sort().map(([k, v]) => k + v.score.toFixed(9)).join('|')
  check('two runs agree exactly', key(once) === key(twice), 'seeded model is reproducible')
}

console.log()
if (failures) {
  console.log(`FAILED — ${failures} check(s) did not pass`)
  process.exit(1)
}
console.log('ALL CHECKS PASSED')
