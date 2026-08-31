import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useNexus, type View } from '@/state/store'

const MODULES: Array<{ view: View; label: string; key: string }> = [
  { view: 'command', label: 'COMMAND', key: '1' },
  { view: 'graph', label: 'INVESTIGATION', key: '2' },
  { view: 'alerts', label: 'ALERTS', key: '3' },
  { view: 'patterns', label: 'PATTERNS', key: '4' },
  { view: 'intake', label: 'INTAKE', key: '5' },
]

/** One row: who we are, where we are, and the two facts that must never be
 *  ambiguous — that the data is synthetic and the host is offline. */
export function TopRail() {
  const view = useNexus((s) => s.view)
  const setView = useNexus((s) => s.setView)
  const alerts = useNexus((s) => s.analysis?.alerts ?? [])
  const stats = useNexus((s) => s.analysis?.dataset.stats)
  const clock = useClock()

  const priority = alerts.filter((a) => a.priority === 'HIGH' || a.priority === 'CRITICAL').length

  return (
    <header className="relative z-30 flex h-[46px] shrink-0 items-stretch border-b border-line bg-surface/90 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setView('landing', 'Return to brief')}
        className="group flex items-center gap-2.5 border-r border-line px-4"
      >
        <span className="display text-[17px] font-700 leading-none tracking-[0.22em] text-ink transition-colors group-hover:text-accent">
          NEXUS
        </span>
        <span className="hidden items-center gap-1.5 border border-accent/50 px-1.5 py-[2px] font-mono text-3xs uppercase tracking-[0.14em] text-accent sm:flex">
          <span className="h-[5px] w-[5px] bg-accent" />
          Synthetic
        </span>
      </button>

      <nav className="flex items-stretch" aria-label="Modules">
        {MODULES.map((m) => {
          const active = view === m.view
          return (
            <button
              key={m.view}
              type="button"
              onClick={() => setView(m.view)}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative flex items-center gap-2 border-r border-line px-3.5 font-mono text-2xs uppercase tracking-[0.14em] transition-colors',
                active ? 'bg-accent/[0.06] text-accent' : 'text-faint hover:text-ink',
              )}
            >
              <span className="text-3xs text-ghost">{m.key}</span>
              {m.label}
              {m.view === 'alerts' && priority > 0 && (
                <span className="border border-risk-high/60 px-1 text-3xs text-risk-high">
                  {priority}
                </span>
              )}
              {active && <span className="absolute inset-x-0 bottom-0 h-px bg-accent" />}
            </button>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-4 px-4 font-mono text-3xs uppercase tracking-[0.16em] text-faint">
        <span className="hidden sm:inline">Offline</span>
        <span className="hidden text-muted tabular-nums md:inline">
          {stats ? stats.records + ' records' : '—'}
        </span>
        <span className="tabular-nums text-muted">{clock}</span>
      </div>
    </header>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now.toISOString().slice(11, 19) + 'Z'
}
