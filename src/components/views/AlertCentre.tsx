import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Alert, Priority } from '@/types'
import { useNexus } from '@/state/store'
import { buildEvidence, fmtTime, shortAddr } from '@/lib/graph'
import { PATTERN_DEFS } from '@/lib/patterns'
import { Label, PriorityChip, riskTone } from '@/components/ui'

type SortKey = 'risk' | 'time' | 'confidence' | 'priority'

const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 }

/**
 * The queue. Sorted by risk because that is the order the work gets done in,
 * and every row carries the four things needed to decide whether to open it.
 */
export function AlertCentre() {
  const analysis = useNexus((s) => s.analysis)
  const select = useNexus((s) => s.select)
  const setView = useNexus((s) => s.setView)
  const setPanel = useNexus((s) => s.setPanel)
  const [sort, setSort] = useState<SortKey>('risk')
  const [minPriority, setMinPriority] = useState<Priority | 'ALL'>('ALL')
  const [active, setActive] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = (analysis?.alerts ?? []).filter(
      (a) => minPriority === 'ALL' || PRIORITY_RANK[a.priority] >= PRIORITY_RANK[minPriority],
    )
    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sort === 'risk') return b.risk - a.risk
      if (sort === 'time') return b.timestamp - a.timestamp
      if (sort === 'confidence') return b.confidence - a.confidence
      return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.risk - a.risk
    })
    return sorted
  }, [analysis, sort, minPriority])

  const selected = rows.find((r) => r.id === active) ?? rows[0]

  const open = (alert: Alert) => {
    select(alert.entityId, { fly: true })
    setPanel('why')
    setView('graph', 'Opening ' + alert.id + ' in the investigation graph')
  }

  if (!analysis) return null

  return (
    <div className="absolute inset-0 flex bg-void">
      {/* Queue */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-line">
        <div className="flex items-center gap-3 border-b border-line px-4 py-2">
          <span className="display text-[12px] tracking-[0.16em] text-ink">ALERT QUEUE</span>
          <span className="font-mono text-3xs uppercase tracking-[0.14em] text-ghost">
            {rows.length} of {analysis.alerts.length}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Label>PRIORITY</Label>
            {(['ALL', 'MEDIUM', 'HIGH'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMinPriority(p)}
                className={clsx(
                  'border px-2.5 py-[3px] rounded-full font-mono text-3xs uppercase tracking-[0.12em] transition-colors',
                  minPriority === p
                    ? 'border-accent/60 bg-accent/[0.08] text-accent font-medium'
                    : 'border-line-strong text-faint hover:text-ink',
                )}
              >
                {p === 'ALL' ? 'ALL' : '≥ ' + p}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[92px_1fr_58px_112px_54px_70px_78px] items-center gap-3 border-b border-line px-4 py-1.5">
          <HeaderCell label="PRIORITY" onClick={() => setSort('priority')} active={sort === 'priority'} />
          <HeaderCell label="ENTITY" />
          <HeaderCell label="RISK" onClick={() => setSort('risk')} active={sort === 'risk'} align="right" />
          <HeaderCell label="PATTERN" />
          <HeaderCell label="COUNTRY" />
          <HeaderCell label="TIME" onClick={() => setSort('time')} active={sort === 'time'} align="right" />
          <HeaderCell
            label="CONFIDENCE"
            onClick={() => setSort('confidence')}
            active={sort === 'confidence'}
            align="right"
          />
        </div>

        <ul className="flex-1 overflow-y-auto">
          {rows.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setActive(a.id)}
                onDoubleClick={() => open(a)}
                className={clsx(
                  'grid-row grid w-full grid-cols-[92px_1fr_58px_112px_54px_70px_78px] items-center gap-3 px-4 py-[7px] text-left',
                  selected?.id === a.id && 'bg-accent/[0.05]',
                )}
              >
                <PriorityChip priority={a.priority} className="justify-self-start" />
                <span className="truncate font-mono text-2xs text-muted">
                  {shortAddr(a.entityLabel)}
                </span>
                <span className={clsx('text-right font-mono text-2xs tabular-nums', riskTone(a.risk))}>
                  {a.risk}
                </span>
                <span className="truncate font-mono text-3xs uppercase tracking-[0.12em] text-faint">
                  {PATTERN_DEFS[a.pattern].shortName}
                </span>
                <span
                  className={clsx(
                    'font-mono text-3xs uppercase tracking-[0.12em]',
                    a.country === 'ZZ' ? 'text-ghost' : 'text-muted',
                  )}
                >
                  {a.country === 'ZZ' ? '—' : a.country}
                </span>
                <span className="text-right font-mono text-3xs tabular-nums text-faint">
                  {fmtTime(a.timestamp).slice(0, 5)}
                </span>
                <span className="text-right font-mono text-3xs tabular-nums text-muted">
                  {(a.confidence * 100).toFixed(0)}%
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-line px-4 py-1.5">
          <span className="font-mono text-3xs uppercase tracking-[0.14em] text-ghost">
            Select a row to preview · double-click or press Open investigation
          </span>
        </div>
      </div>

      {/* Preview */}
      <aside className="flex w-[368px] shrink-0 flex-col">
        {selected ? <AlertPreview alert={selected} onOpen={() => open(selected)} /> : null}
      </aside>
    </div>
  )
}

function HeaderCell({
  label,
  onClick,
  active,
  align = 'left',
}: {
  label: string
  onClick?: () => void
  active?: boolean
  align?: 'left' | 'right'
}) {
  const cls = clsx(
    'font-mono text-3xs uppercase tracking-[0.16em] transition-colors',
    align === 'right' && 'text-right',
    active ? 'text-accent' : 'text-ghost',
    onClick && 'hover:text-muted',
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {label}
      {active ? ' ↓' : ''}
    </button>
  ) : (
    <span className={cls}>{label}</span>
  )
}

function AlertPreview({ alert, onOpen }: { alert: Alert; onOpen: () => void }) {
  const analysis = useNexus((s) => s.analysis)
  const wallet = analysis?.dataset.wallets.find((w) => w.id === alert.entityId)

  const evidence = useMemo(() => {
    if (!analysis || !wallet) return []
    const pats = analysis.dataset.planted.filter((p) => p.walletIds.includes(wallet.id))
    return buildEvidence(wallet, pats, analysis.index)
  }, [analysis, wallet])

  if (!wallet) return null

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-baseline justify-between">
          <Label>{alert.id}</Label>
          <PriorityChip priority={alert.priority} />
        </div>
        <div className="mt-1.5 break-all font-mono text-[12px] text-ink">{wallet.address}</div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        <Cell k="RISK" v={String(alert.risk)} tone={riskTone(alert.risk)} />
        <Cell k="CONFIDENCE" v={(alert.confidence * 100).toFixed(0) + '%'} />
        <Cell k="DETECTED" v={fmtTime(alert.timestamp).slice(0, 5)} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <Label>Evidence</Label>
        <ol className="mt-2 space-y-2">
          {evidence.map((e) => (
            <li key={e.index} className="flex gap-2">
              <span className="num text-[12px] tabular-nums text-ghost">
                {String(e.index).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-2xs uppercase tracking-[0.14em] text-ink">
                  {e.title}
                </div>
                <div className="font-mono text-3xs leading-snug text-faint">{e.metric}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-t border-line p-3">
        <button type="button" className="btn btn-primary h-[32px] w-full justify-center" onClick={onOpen}>
          Open investigation
        </button>
      </div>
    </>
  )
}

function Cell({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="px-3 py-2.5">
      <Label>{k}</Label>
      <div className={clsx('num mt-0.5 text-[20px] font-700 tabular-nums', tone ?? 'text-ink')}>{v}</div>
    </div>
  )
}
