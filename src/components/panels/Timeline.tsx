import clsx from 'clsx'
import type { TimelineEvent } from '@/types'
import { useNexus } from '@/state/store'
import { fmtTime } from '@/lib/graph'
import { Label } from '@/components/ui'

const KIND_MARK: Record<TimelineEvent['kind'], string> = {
  transaction: 'TX',
  link: 'LINK',
  detection: 'DETECT',
  escalation: 'RISK',
  lead: 'LEAD',
}

/**
 * The forensic timeline. Positions on the rail are proportional to real time,
 * so a burst looks like a burst; the cards below are evenly spaced so they stay
 * readable. Selecting an event moves the camera to the entity behind it.
 */
export function Timeline() {
  const analysis = useNexus((s) => s.analysis)
  const select = useNexus((s) => s.select)
  const setHighlight = useNexus((s) => s.setHighlight)
  const highlight = useNexus((s) => s.highlight)
  const events = analysis?.timeline ?? []

  if (!events.length) return null

  const start = events[0].timestamp
  const end = events[events.length - 1].timestamp
  const span = Math.max(1, end - start)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-line px-3 py-1.5">
        <Label>Timeline · subject</Label>
        <span className="font-mono text-3xs tabular-nums text-ghost">
          {fmtTime(start)} → {fmtTime(end)}
        </span>
      </div>

      {/* Proportional rail */}
      <div className="relative mx-3 mt-2 h-[14px] shrink-0">
        <div className="absolute inset-x-0 top-[6px] h-px bg-line-strong" />
        {events.map((e) => (
          <span
            key={e.id}
            className={clsx(
              'absolute top-0 h-[13px] w-px',
              e.kind === 'lead' || e.kind === 'escalation' ? 'bg-accent' : 'bg-muted',
            )}
            style={{ left: ((e.timestamp - start) / span) * 100 + '%' }}
          />
        ))}
      </div>

      {/* Event cards */}
      <ol className="no-scrollbar flex flex-1 items-stretch gap-px overflow-x-auto px-3 pb-2 pt-2">
        {events.map((e) => {
          const active = highlight?.label === e.title
          return (
            <li key={e.id} className="min-w-[168px] flex-1">
              <button
                type="button"
                onClick={() => {
                  if (e.entityId) select(e.entityId, { fly: true })
                  setHighlight({
                    label: e.title,
                    entities: new Set(e.entityId ? [e.entityId] : []),
                    edges: new Set(e.edgeId ? [e.edgeId] : []),
                    source: 'timeline',
                  })
                }}
                className={clsx(
                  'h-full w-full border-l px-2.5 py-1.5 text-left transition-colors',
                  active
                    ? 'border-accent bg-accent/[0.06]'
                    : 'border-line-strong hover:border-ghost hover:bg-white/[0.02]',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-3xs tabular-nums text-accent">
                    {fmtTime(e.timestamp).slice(0, 5)}
                  </span>
                  <span className="font-mono text-3xs uppercase tracking-[0.14em] text-ghost">
                    {KIND_MARK[e.kind]}
                  </span>
                </div>
                <div className="mt-1 truncate font-mono text-[11px] text-ink">{e.title}</div>
                <div className="truncate text-[10.5px] leading-snug text-faint">{e.detail}</div>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
