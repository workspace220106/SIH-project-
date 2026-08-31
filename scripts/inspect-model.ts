/**
 * Developer utility: run the detection engine headlessly and print the
 * scoring distribution. Used to sanity-check the risk model after changes.
 *
 *   npx esbuild scripts/inspect-model.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src --outfile=.tmp/inspect.cjs && node .tmp/inspect.cjs
 */
import { analyse, shortAddr } from '@/lib/graph'

const a = analyse()

console.log('entities', a.entities.length, 'edges', a.edges.length)
console.log('dataset', a.dataset.stats)
console.log('\ntop wallets by risk')
for (const w of [...a.dataset.wallets].sort((x, y) => y.risk.score - x.risk.score).slice(0, 12)) {
  console.log(
    w.id,
    shortAddr(w.address),
    'risk', w.risk.score,
    'conf', w.risk.confidence.toFixed(3),
    w.risk.priority,
    'signals', w.risk.signals.map((s) => s.key[0] + s.value).join(' '),
  )
}

const subject = a.dataset.wallets.find((w) => w.id === a.primarySubject)!
console.log('\nprimary subject', subject.id, subject.risk.score, subject.risk.confidence)
console.log('leads', a.leads.map((l) => l.id + ':' + l.risk + '/' + Math.round(l.confidence * 100)).join(' '))
console.log('alerts', a.alerts.length, 'patterns', a.patterns.length)
console.log('\nevidence for lead 0')
a.leads[0]?.evidence.forEach((e) => console.log(' ', e.index, e.title, '|', e.metric, '|', e.strength.toFixed(2)))
console.log('\nbounds', bounds(a.entities))

function bounds(entities: { x: number; y: number; z: number }[]) {
  const xs = entities.map((e) => e.x)
  const ys = entities.map((e) => e.y)
  const zs = entities.map((e) => e.z)
  const r = (v: number[]) => [Math.min(...v).toFixed(1), Math.max(...v).toFixed(1)].join(' … ')
  return { x: r(xs), y: r(ys), z: r(zs) }
}
