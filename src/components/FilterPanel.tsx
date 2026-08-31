import { useState } from 'react'
import clsx from 'clsx'
import type { EntityKind, PatternId } from '@/types'
import { useNexus } from '@/state/store'
import { PATTERN_DEFS, PATTERN_ORDER } from '@/lib/patterns'
import { Label } from '@/components/ui'

const KIND_LABEL: Record<EntityKind, string> = {
  wallet: 'WALLET',
  transaction: 'TRANSACTION',
  ip: 'HOST',
}

const RISK_PRESETS: Array<[string, number]> = [
  ['ALL', 0],
  ['≥50', 50],
  ['≥75', 75],
  ['≥90', 90],
]

/**
 * Three controls, behind a button. Each one maps to a single clause a backend
 * can answer — a risk floor, an entity type, a matched pattern — so nothing
 * here implies query machinery that does not exist.
 */
export function FilterPanel() {
  const [open, setOpen] = useState(false)
  const filters = useNexus((s) => s.filters)
  const reset = useNexus((s) => s.resetFilters)

  const active =
    filters.riskMin > 0 ||
    Object.values(filters.kinds).some((v) => !v) ||
    Object.values(filters.patterns).some((v) => !v)

  return (
    <div className="relative">
      <button
        type="button"
        className={clsx('btn panel', (open || active) && 'btn-active')}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Filters
        {active && <span className="h-[5px] w-[5px] bg-accent" />}
      </button>

      {open && (
        <div className="panel regmark absolute left-0 top-[34px] z-30 w-[236px] animate-reveal-up p-3">
          <Group title="RISK">
            <div className="flex gap-1">
              {RISK_PRESETS.map(([label, v]) => (
                <Chip
                  key={label}
                  label={label}
                  on={filters.riskMin === v}
                  onClick={() => useNexus.getState().setFilters({ riskMin: v })}
                />
              ))}
            </div>
          </Group>

          <Group title="ENTITY TYPE">
            {(Object.keys(KIND_LABEL) as EntityKind[]).map((k) => (
              <Toggle
                key={k}
                label={KIND_LABEL[k]}
                on={filters.kinds[k]}
                onChange={() =>
                  useNexus
                    .getState()
                    .setFilters({ kinds: { ...filters.kinds, [k]: !filters.kinds[k] } })
                }
              />
            ))}
          </Group>

          <Group title="PATTERN">
            {PATTERN_ORDER.map((p: PatternId) => (
              <Toggle
                key={p}
                label={PATTERN_DEFS[p].shortName}
                on={filters.patterns[p]}
                onChange={() =>
                  useNexus
                    .getState()
                    .setFilters({ patterns: { ...filters.patterns, [p]: !filters.patterns[p] } })
                }
              />
            ))}
          </Group>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
            <button type="button" className="label hover:text-accent" onClick={reset}>
              RESET
            </button>
            <button type="button" className="label hover:text-ink" onClick={() => setOpen(false)}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 last:mb-0">
      <Label className="mb-1.5 block">{title}</Label>
      <div className="space-y-[2px]">{children}</div>
    </section>
  )
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex-1 border py-[3px] font-mono text-3xs tracking-[0.1em] transition-colors',
        on ? 'border-accent/60 bg-accent/[0.08] text-accent' : 'border-line-strong text-faint hover:text-ink',
      )}
    >
      {label}
    </button>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className="group flex w-full items-center gap-2 py-[2px] text-left"
    >
      <span
        className={clsx(
          'h-[9px] w-[9px] border transition-colors',
          on ? 'border-accent bg-accent' : 'border-line-strong',
        )}
      />
      <span
        className={clsx(
          'font-mono text-2xs uppercase tracking-[0.12em] transition-colors',
          on ? 'text-ink' : 'text-faint group-hover:text-muted',
        )}
      >
        {label}
      </span>
    </button>
  )
}
