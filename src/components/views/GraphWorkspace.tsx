import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useNexus, type PanelMode } from '@/state/store'
import { FilterPanel } from '@/components/FilterPanel'
import { IntelPanel } from '@/components/panels/IntelPanel'
import { WhyPanel } from '@/components/panels/WhyPanel'
import { TracePanel } from '@/components/panels/TracePanel'
import { ReplayPanel } from '@/components/panels/ReplayPanel'
import { LeadPanel } from '@/components/panels/LeadPanel'
import { Timeline } from '@/components/panels/Timeline'
import { PATTERN_DEFS } from '@/lib/patterns'

/** All registered panel modes preserved in codebase for future scope. */
export const ALL_PANEL_TABS: Array<{ id: PanelMode; label: string }> = [
  { id: 'intel', label: 'OVERVIEW' },
  { id: 'why', label: 'WHY' },
  { id: 'trace', label: 'TRACE' },
  { id: 'replay', label: 'REPLAY' },
]

/** Visible tabs shown in the right panel header. */
const TABS = ALL_PANEL_TABS

/**
 * The workspace is the field. Panels open in response to an action, such as
 * selecting a node or asking a question, and stay closed otherwise, so the
 * default state of the screen is the graph and nothing else.
 */
export function GraphWorkspace() {
  const panel = useNexus((s) => s.panel)
  const setPanel = useNexus((s) => s.setPanel)
  const panelOpen = useNexus((s) => s.panelOpen)
  const setPanelOpen = useNexus((s) => s.setPanelOpen)
  const highlight = useNexus((s) => s.highlight)
  const setHighlight = useNexus((s) => s.setHighlight)
  const selectedId = useNexus((s) => s.selectedId)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [compact, setCompact] = useState(() => window.innerWidth < 1200)

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 1200)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const showTimeline = timelineOpen && !!selectedId

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Toolbar */}
      <div className="pointer-events-auto absolute left-3 top-3 z-20 flex flex-wrap items-start gap-2">
        <FilterPanel />
        <HopControl />
        <button
          type="button"
          className={clsx('btn panel', showTimeline && 'btn-active')}
          onClick={() => setTimelineOpen((v) => !v)}
          disabled={!selectedId}
        >
          Timeline
        </button>
        <ProbeControl />
      </div>

      {/* Why the field looks the way it does — the only always-on annotation */}
      {highlight && (
        <div className="panel pointer-events-auto absolute left-3 top-[48px] z-20 flex max-w-[520px] animate-reveal-up items-center gap-3 rounded-2xl px-3.5 py-2 shadow-sm">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
          <span className="truncate font-mono text-2xs uppercase tracking-[0.13em] text-accent font-medium">
            {highlight.label}
          </span>
          <button
            type="button"
            className="label ml-auto shrink-0 hover:text-ink"
            onClick={() => setHighlight(null)}
          >
            CLEAR
          </button>
        </div>
      )}

      {/* Intelligence dock */}
      {panelOpen ? (
        <aside
          className={clsx(
            'panel pointer-events-auto absolute right-3 top-3 z-20 flex w-[344px] animate-reveal-up flex-col rounded-2xl overflow-hidden shadow-lg xl:w-[368px]',
            compact && showTimeline ? 'bottom-[136px]' : 'bottom-3',
          )}
        >
          <div className="flex shrink-0 items-stretch border-b border-line">
            {panel === 'lead' ? (
              <button
                type="button"
                onClick={() => setPanel('why')}
                className="flex-1 py-2 font-mono text-3xs uppercase tracking-[0.14em] text-accent"
              >
                ← BACK TO EVIDENCE
              </button>
            ) : (
              TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPanel(t.id)}
                  aria-current={panel === t.id ? 'true' : undefined}
                  className={clsx(
                    'relative flex-1 py-2 font-mono text-3xs uppercase tracking-[0.14em] transition-colors',
                    panel === t.id ? 'text-accent font-medium' : 'text-faint hover:text-ink',
                  )}
                >
                  {t.label}
                  {panel === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" />}
                </button>
              ))
            )}
            <button
              type="button"
              className="border-l border-line px-3 font-mono text-3xs text-faint hover:text-ink"
              onClick={() => setPanelOpen(false)}
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {panel === 'intel' && <IntelPanel />}
            {panel === 'why' && <WhyPanel />}
            {panel === 'trace' && <TracePanel />}
            {panel === 'replay' && <ReplayPanel />}
            {panel === 'lead' && <LeadPanel />}
          </div>
        </aside>
      ) : (
        <button
          type="button"
          className="btn panel pointer-events-auto absolute right-3 top-3 z-20 rounded-xl"
          onClick={() => setPanelOpen(true)}
        >
          {selectedId ? 'Open panel' : 'Intelligence'}
        </button>
      )}

      {/* Timeline */}
      {showTimeline && (
        <div
          className={clsx(
            'panel pointer-events-auto absolute bottom-3 left-3 z-20 h-[118px] animate-reveal-up rounded-2xl overflow-hidden shadow-md',
            !compact && panelOpen ? 'right-[360px] xl:right-[384px]' : 'right-3',
          )}
        >
          <Timeline />
        </div>
      )}

      {/* When nothing is selected the screen says what to do, and nothing more */}
      {!selectedId && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 text-center">
          <p className="font-mono text-3xs uppercase tracking-[0.18em] text-ghost">
            Click a node to open it · drag to orbit · scroll to zoom
          </p>
        </div>
      )}
    </div>
  )
}

function HopControl() {
  const hops = useNexus((s) => s.hops)
  const setHops = useNexus((s) => s.setHops)
  return (
    <div className="panel flex items-stretch rounded-xl overflow-hidden shadow-sm">
      <span className="flex items-center px-2.5 font-mono text-3xs uppercase tracking-[0.16em] text-ghost">
        HOPS
      </span>
      {[1, 2, 3, 5].map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => setHops(h)}
          className={clsx(
            'w-7 border-l border-line font-mono text-2xs tabular-nums transition-colors',
            hops === h ? 'bg-accent/[0.08] text-accent font-medium' : 'text-faint hover:text-ink',
          )}
        >
          {h}
        </button>
      ))}
    </div>
  )
}

/**
 * A locating exercise rather than a game. No score and no reward animation.
 * The payoff is the detection, same as the real work.
 */
function ProbeControl() {
  const probe = useNexus((s) => s.probe)
  const armProbe = useNexus((s) => s.armProbe)
  const resetProbe = useNexus((s) => s.resetProbe)
  const analysis = useNexus((s) => s.analysis)
  const setPanel = useNexus((s) => s.setPanel)

  const subjectPatterns =
    analysis?.dataset.planted
      .filter((p) => p.walletIds.includes(analysis.primarySubject))
      .slice(0, 3) ?? []

  if (!probe.armed) {
    return (
      <button type="button" className="btn panel" onClick={armProbe}>
        Locate exercise
      </button>
    )
  }

  return (
    <div className="panel w-[300px] animate-reveal-up px-3 py-2.5">
      {!probe.found ? (
        <>
          <div className="flex items-baseline justify-between">
            <span className="label-active">Find the suspicious cluster</span>
            <button type="button" className="label hover:text-ink" onClick={resetProbe}>
              EXIT
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
            Open the set whose shape does not look like settlement.
          </p>
          <div className="mt-2 font-mono text-3xs uppercase tracking-[0.14em] text-ghost">
            {probe.inspected.size} of 6 inspected
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="label-active">Pattern detected</span>
            <button type="button" className="label hover:text-ink" onClick={resetProbe}>
              CLOSE
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {subjectPatterns.map((p, i) => (
              <li key={p.id} className="grid grid-cols-[20px_1fr] gap-2">
                <span className="font-mono text-3xs text-ghost">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="block font-mono text-2xs uppercase tracking-[0.14em] text-accent">
                    {PATTERN_DEFS[p.id].shortName}
                  </span>
                  <span className="block font-mono text-3xs leading-snug text-faint">
                    {p.metric}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-primary mt-3 h-[28px] w-full justify-center"
            onClick={() => setPanel('why')}
          >
            See the evidence
          </button>
        </>
      )}
    </div>
  )
}
