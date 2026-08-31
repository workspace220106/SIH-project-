import clsx from 'clsx'
import { useNexus } from '@/state/store'
import { useCountUp } from '@/hooks/useCountUp'
import { fmtDateTime, shortAddr } from '@/lib/graph'
import { PATTERN_DEFS } from '@/lib/patterns'
import { Label, PriorityChip, riskTone } from '@/components/ui'

/**
 * Command overview. The graph is the page; everything else sits on top of it
 * in as little space as the information needs.
 */
export function Command() {
  const analysis = useNexus((s) => s.analysis)
  const setView = useNexus((s) => s.setView)
  const select = useNexus((s) => s.select)
  const openLead = useNexus((s) => s.openLead)

  if (!analysis) return null

  const subject = analysis.dataset.wallets.find((w) => w.id === analysis.primarySubject)!
  const highPriority = analysis.alerts.filter(
    (a) => a.priority === 'HIGH' || a.priority === 'CRITICAL',
  ).length

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Counters — a single hairline row, not four cards */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex">
        <div className="pointer-events-auto grid grid-cols-4 divide-x divide-line border-b border-r border-line bg-void/80 backdrop-blur-md">
          <Counter k="ENTITIES" v={analysis.entities.length} />
          <Counter k="TRANSACTIONS" v={analysis.dataset.stats.transactions} />
          <Counter k="OPEN ALERTS" v={analysis.alerts.length} />
          <Counter k="HIGH PRIORITY" v={highPriority} tone="warn" />
        </div>
      </div>

      {/* Subject summary */}
      <aside className="panel pointer-events-auto absolute right-3 top-3 z-20 w-[318px]">
        <div className="border-b border-line px-4 py-2.5">
          <div className="flex items-baseline justify-between">
            <Label>Top subject</Label>
            <PriorityChip priority={subject.risk.priority} />
          </div>
          <button
            type="button"
            className="mt-1 block break-all text-left font-mono text-[12px] text-ink hover:text-accent"
            onClick={() => {
              select(subject.id, { fly: true })
              setView('graph', 'Opening subject in investigation graph')
            }}
          >
            {subject.address}
          </button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          <Metric k="RISK" v={subject.risk.score} tone={riskTone(subject.risk.score)} />
          <Metric k="CONFIDENCE" v={Math.round(subject.risk.confidence * 100)} suffix="%" />
          <div className="px-3 py-2.5">
            <Label>PRIORITY</Label>
            <div className={clsx('num mt-0.5 text-[19px] font-700', riskTone(subject.risk.score))}>
              {subject.risk.priority}
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          <Label>Matched detectors</Label>
          <div className="mt-2 flex flex-wrap gap-1">
            {analysis.dataset.planted
              .filter((p) => p.walletIds.includes(subject.id))
              .map((p) => (
                <span key={p.id} className="chip border-accent/50 text-accent">
                  {PATTERN_DEFS[p.id].shortName}
                </span>
              ))}
          </div>
        </div>

      </aside>

      {/* Recent leads */}
      <section className="panel pointer-events-auto absolute bottom-3 left-3 z-20 w-[440px]">
        <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
          <span className="display text-[11px] tracking-[0.16em] text-ink">
            RECENT INVESTIGATIVE LEADS
          </span>
          <button
            type="button"
            className="label hover:text-accent"
            onClick={() => setView('alerts', 'Opening the alert queue')}
          >
            ALL ALERTS →
          </button>
        </div>
        <ul>
          {analysis.leads.slice(0, 4).map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  openLead(l)
                  setView('graph', 'Opening lead #' + String(l.number).padStart(4, '0'))
                }}
                className="grid-row grid w-full grid-cols-[62px_1fr_88px_44px] items-center gap-2 px-4 py-2 text-left"
              >
                <span className="font-mono text-3xs text-ghost">
                  #{String(l.number).padStart(4, '0')}
                </span>
                <span className="truncate font-mono text-2xs text-muted">{shortAddr(l.who)}</span>
                <span className="truncate font-mono text-3xs uppercase tracking-[0.12em] text-faint">
                  {l.why[0] ?? '—'}
                </span>
                <span className={clsx('text-right font-mono text-2xs tabular-nums', riskTone(l.risk))}>
                  {l.risk}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-4 py-1.5">
          <span className="font-mono text-3xs uppercase tracking-[0.14em] text-ghost">
            capture window {fmtDateTime(analysis.dataset.stats.rangeStart)} →{' '}
            {fmtDateTime(analysis.dataset.stats.rangeEnd).slice(11)}
          </span>
        </div>
      </section>

      <div className="pointer-events-none absolute bottom-3 right-3 z-20 max-w-[300px] text-right">
        <p className="font-mono text-3xs uppercase leading-relaxed tracking-[0.14em] text-ghost">
          Drag to orbit · scroll to zoom · click a cluster label to inspect
        </p>
      </div>
    </div>
  )
}

function Counter({
  k,
  v,
  tone,
}: {
  k: string
  v: number
  tone?: 'warn'
}) {
  const value = useCountUp(v, 900)
  return (
    <div className="px-4 py-2.5">
      <Label>{k}</Label>
      <div
        className={clsx(
          'num mt-0.5 text-[24px] font-700 leading-none tabular-nums',
          tone === 'warn' ? 'text-accent' : 'text-ink',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function Metric({
  k,
  v,
  suffix,
  tone,
}: {
  k: string
  v: number
  suffix?: string
  tone?: string
}) {
  const value = useCountUp(v, 820)
  return (
    <div className="px-3 py-2.5">
      <Label>{k}</Label>
      <div className={clsx('num mt-0.5 text-[24px] font-700 leading-none tabular-nums', tone ?? 'text-ink')}>
        {value}
        {suffix && <span className="ml-0.5 font-mono text-[11px] font-400 text-ghost">{suffix}</span>}
      </div>
    </div>
  )
}
