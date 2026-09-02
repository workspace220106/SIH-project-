import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useNexus, type View } from '@/state/store'

/** All registered system modules kept in codebase for future scope. */
export const ALL_MODULES: Array<{ view: View; label: string; key: string }> = [
  { view: 'command', label: 'COMMAND', key: '1' },
  { view: 'graph', label: 'INVESTIGATION', key: '2' },
  { view: 'alerts', label: 'ALERTS', key: '3' },
  { view: 'patterns', label: 'PATTERNS', key: '4' },
  { view: 'intake', label: 'INTAKE', key: '5' },
]

/** Active modules shown in the navigation bar. The shortcut shown on each tab
 *  is the one the keyboard handler actually listens for. */
const VISIBLE_MODULES = ALL_MODULES

/** One row: who we are, where we are, and the synthetic status. */
export function TopRail() {
  const view = useNexus((s) => s.view)
  const setView = useNexus((s) => s.setView)
  const alerts = useNexus((s) => s.analysis?.alerts ?? [])

  const priority = alerts.filter((a) => a.priority === 'HIGH' || a.priority === 'CRITICAL').length

  return (
    <header className="relative z-30 m-2.5 mb-1.5 flex h-[48px] shrink-0 items-center justify-between rounded-2xl border border-line bg-surface/95 px-3.5 shadow-sm backdrop-blur-md">
      <button
        type="button"
        onClick={() => setView('landing', 'Return to brief')}
        className="group flex items-center gap-2.5 pr-3 transition-opacity hover:opacity-85"
      >
        <span className="display text-[18px] font-700 leading-none tracking-[0.22em] text-accent">
          TRADELINE
        </span>
        <span className="hidden items-center gap-1.5 rounded-full border border-accent/60 bg-accent/[0.08] px-2.5 py-[2px] font-mono text-3xs uppercase tracking-[0.14em] text-accent sm:flex">
          <span className="h-[6px] w-[6px] rounded-full bg-accent" />
          Synthetic
        </span>
      </button>

      <nav className="flex items-center gap-1.5" aria-label="Modules">
        {VISIBLE_MODULES.map((m) => {
          const active = view === m.view
          return (
            <button
              key={m.view}
              type="button"
              onClick={() => setView(m.view)}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-2xs uppercase tracking-[0.14em] transition-all',
                active
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-black hover:bg-black/[0.05]',
              )}
            >
              <span className={clsx('text-3xs', active ? 'text-white/80' : 'text-black/60')}>{m.key}</span>
              <span>{m.label}</span>
              {m.view === 'alerts' && priority > 0 && (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.5 text-3xs font-bold',
                    active ? 'bg-white text-accent' : 'bg-risk-high/15 border border-risk-high/60 text-risk-high',
                  )}
                >
                  {priority}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="w-[80px]" />
    </header>
  )
}

