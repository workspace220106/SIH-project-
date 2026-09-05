/**
 * Runs the detection engine headlessly and prints the output. For checking the
 * risk model and anomaly detector after changes.
 *
 *   npx esbuild scripts/inspect-model.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=.tmp/inspect.cjs && node .tmp/inspect.cjs
 */
import { analyse, shortAddr } from '@/lib/graph'

const a = analyse()
const nl = '\n'

console.log('entities', a.entities.length, 'edges', a.edges.length)
console.log('dataset', a.dataset.stats)

console.log(nl + 'model')
console.log(' ', a.model.name, '|', a.model.trees, 'trees | sample', a.model.sampleSize)
console.log('  trained on', a.model.trainedOn, 'wallets |', a.model.flagged, 'above threshold')
console.log('  features:', a.model.features.join(', '))

console.log(nl + 'top wallets by risk')
for (const w of [...a.dataset.wallets].sort((x, y) => y.risk.score - x.risk.score).slice(0, 10)) {
  console.log(
    ' ',
    w.id,
    shortAddr(w.address),
    'risk',
    w.risk.score,
    'conf',
    w.risk.confidence.toFixed(3),
    w.risk.priority,
    '|',
    w.risk.signals.map((s) => s.key.slice(0, 4) + ':' + s.value).join(' '),
  )
}

console.log(nl + 'anomaly detector — highest scores and why')
const ranked = [...a.anomalies.entries()].sort((x, y) => y[1].score - x[1].score).slice(0, 6)
for (const [id, result] of ranked) {
  const w = a.dataset.wallets.find((x) => x.id === id)
  if (!w) continue
  const drivers = result.contributions
    .slice(0, 3)
    .map((c) => c.label + ' ' + Math.round(c.share * 100) + '%')
    .join(', ')
  console.log(' ', id, shortAddr(w.address), 'raw', result.score.toFixed(4), '|', drivers)
}

const subject = a.dataset.wallets.find((w) => w.id === a.primarySubject)
if (subject) {
  console.log(
    nl + 'primary subject',
    subject.id,
    subject.risk.score,
    subject.risk.confidence.toFixed(3),
  )
  console.log('  anomaly contributions:')
  for (const c of a.anomalies.get(subject.id)?.contributions ?? []) {
    console.log('   ', Math.round(c.share * 100) + '%', c.label, '—', c.reads)
  }
}

console.log(nl + 'leads', a.leads.map((l) => l.id + ':' + l.risk).join(' '))
console.log('alerts', a.alerts.length, 'patterns', a.patterns.map((p) => p.shortName).join(', '))

console.log(nl + 'evidence for lead 0')
a.leads[0]?.evidence.forEach((e) =>
  console.log(' ', e.index, e.title, '|', e.metric, '|', e.strength.toFixed(2)),
)

const xs = a.entities.map((e) => e.x)
const ys = a.entities.map((e) => e.y)
const zs = a.entities.map((e) => e.z)
const range = (v: number[]) => Math.min(...v).toFixed(0) + ' … ' + Math.max(...v).toFixed(0)
console.log(nl + 'bounds', { x: range(xs), y: range(ys), z: range(zs) })

console.log(nl + 'common-input-ownership')
console.log('  entities:', a.ownership.groups.size, '| multi-address:', a.ownership.merged.length)
for (const g of a.ownership.merged.slice(0, 4)) {
  const addrs = g.walletIds
    .map((id) => a.index.walletById.get(id))
    .filter(Boolean)
    .map((w) => shortAddr(w!.address))
  console.log('  ', g.id, '→', addrs.join(', '), '| from', g.evidenceTxIds.length, 'co-spends')
}
