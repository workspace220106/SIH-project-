import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Entity, RiskSignal, Wallet } from '@/types'
import { useNexus } from '@/state/store'
import { useCountUp } from '@/hooks/useCountUp'
import { fmtBtc, fmtDateTime, shortAddr } from '@/lib/graph'
import { PATTERN_DEFS } from '@/lib/patterns'
import { Field, Label, Meter, PriorityChip, riskTone } from '@/components/ui'

export function IntelPanel() {
  const analysis = useNexus((s) => s.analysis)
  const selectedId = useNexus((s) => s.selectedId)
  const select = useNexus((s) => s.select)
  const entity = selectedId ? analysis?.index.entityById.get(selectedId) : null

  if (!entity || !analysis) {
    return (
      <div className="px-4 py-10">
        <p className="font-mono text-2xs uppercase leading-relaxed tracking-[0.14em] text-faint">
          No entity selected.
        </p>
        <p className="mt-3 max-w-[240px] text-[12px] leading-relaxed text-muted">
          Click any node in the field, or open an alert. The panel follows the graph — it never
          shows something the graph is not also showing.
        </p>
      </div>
    )
  }

  const wallet =
    entity.kind === 'wallet' ? analysis.dataset.wallets.find((w) => w.id === entity.id) : undefined

  const neighbours = (analysis.index.neighbours.get(entity.id) ?? [])
    .map((id) => analysis.index.entityById.get(id))
    .filter((e): e is Entity => !!e)
    .sort((a, b) => b.risk - a.risk)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Identity entity={entity} />
      <div className="flex-1 overflow-y-auto">
        {wallet && <RiskBreakdown wallet={wallet} />}
        <Attributes entity={entity} />
        <Connections neighbours={neighbours} onSelect={(id) => select(id, { fly: true })} />
      </div>
    </div>
  )
}

function Identity({ entity }: { entity: Entity }) {
  const kindLabel =
    entity.kind === 'wallet' ? 'WALLET' : entity.kind === 'ip' ? 'HOST OBSERVATION' : 'TRANSACTION'
  return (
    <header className="border-b border-line px-4 py-3">
      <div className="flex items-center justify-between">
        <Label>{kindLabel}</Label>
        <span className="font-mono text-3xs uppercase tracking-[0.14em] text-ghost">
          {String(entity.meta.cluster ?? entity.cluster)}
        </span>
      </div>
      <div className="mt-1.5 break-all font-mono text-[13px] leading-tight text-ink">
        {entity.kind === 'wallet' ? entity.label : entity.label}
      </div>
      <div className="mt-1 font-mono text-3xs uppercase tracking-[0.14em] text-faint">
        first seen {fmtDateTime(entity.timestamp)}
      </div>
    </header>
  )
}

/**
 * Risk is shown as its parts before it is shown as a number, and each part is
 * clickable. The point is not the score, it is what produced it.
 */
function RiskBreakdown({ wallet }: { wallet: Wallet }) {
  const score = useCountUp(wallet.risk.score, 760)
  const setHighlight = useNexus((s) => s.setHighlight)
  const highlight = useNexus((s) => s.highlight)
  const analysis = useNexus((s) => s.analysis)

  const contributions = useMemo(
    () => wallet.risk.signals.map((s) => ({ ...s, points: s.value * s.weight })),
    [wallet],
  )
  const total = contributions.reduce((a, c) => a + c.points, 0)

  const highlightSignal = (signal: RiskSignal) => {
    if (!analysis) return
    if (highlight?.label.startsWith(signal.label)) {
      setHighlight(null)
      return
    }
    const entities = new Set<string>([wallet.id])
    const edges = new Set<string>()

    if (signal.key === 'graph') {
      ;(analysis.index.neighbours.get(wallet.id) ?? []).forEach((n) => entities.add(n))
      ;(analysis.index.incident.get(wallet.id) ?? []).forEach((e) => edges.add(e))
    } else {
      const relevant = analysis.dataset.planted.filter((p) => {
        if (!p.walletIds.includes(wallet.id)) return false
        if (signal.key === 'temporal') return p.id === 'RAPID_MOVEMENT' || p.id === 'BURST_ACTIVITY'
        if (signal.key === 'transaction') return p.id === 'FAN_OUT' || p.id === 'FAN_IN'
        return true
      })
      relevant.forEach((p) => {
        p.walletIds.forEach((w) => entities.add(w))
        p.txIds.forEach((t) => {
          entities.add(t)
          edges.add('e-' + t + '-i')
          edges.add('e-' + t + '-o')
        })
      })
      if (!edges.size) {
        ;(analysis.index.incident.get(wallet.id) ?? []).forEach((e) => edges.add(e))
      }
    }
    setHighlight({
      label: signal.label + ' signal — ' + signal.detail,
      entities,
      edges,
      source: 'evidence',
    })
  }

  return (
    <section className="border-b border-line px-4 py-4">
      <div className="flex items-end gap-4">
        <div>
          <Label>Composite risk</Label>
          <div className={clsx('num mt-0.5 text-[46px] font-700 leading-none', riskTone(wallet.risk.score))}>
            {score}
          </div>
        </div>
        <div className="flex-1 pb-1.5">
          <div className="flex items-center gap-2">
            <PriorityChip priority={wallet.risk.priority} />
            <span className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
              {(wallet.risk.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          {/* Contribution band: width is weight × value, so the widest slice is
              literally the reason the score is what it is. */}
          <div className="mt-2 flex h-[6px] w-full gap-px bg-line">
            {contributions.map((c) => (
              <span
                key={c.key}
                className={clsx(
                  'h-full transition-all duration-500 ease-instrument',
                  c.key === 'behaviour'
                    ? 'bg-accent'
                    : c.key === 'graph'
                      ? 'bg-accent/70'
                      : c.key === 'temporal'
                        ? 'bg-accent/45'
                        : 'bg-accent/25',
                )}
                style={{ width: (c.points / Math.max(total, 1)) * 100 + '%' }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-[7px]">
        {contributions.map((c) => {
          const active = highlight?.label.startsWith(c.label)
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => highlightSignal(c)}
              className={clsx(
                'group w-full border-l-2 pl-2 text-left transition-colors',
                active ? 'border-accent' : 'border-transparent hover:border-line-strong',
              )}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={clsx(
                    'font-mono text-2xs uppercase tracking-[0.14em]',
                    active ? 'text-accent' : 'text-muted',
                  )}
                >
                  {c.label}
                </span>
                <span className="rule-dotted mb-[3px] flex-1 opacity-40" />
                <span className="font-mono text-2xs tabular-nums text-faint">×{c.weight.toFixed(2)}</span>
                <span className="w-7 text-right font-mono text-2xs tabular-nums text-ink">
                  {c.value}
                </span>
              </div>
              <div className="mt-1">
                <Meter value={c.value} tone={active ? 'accent' : 'neutral'} height={2} />
              </div>
              <div className="mt-1 text-[10.5px] leading-snug text-faint">{c.detail}</div>
            </button>
          )
        })}
      </div>
      <p className="mt-3 border-t border-line pt-2 text-[10.5px] leading-snug text-ghost">
        Select a signal to light its evidence in the graph. Select it again to clear.
      </p>
    </section>
  )
}

function Attributes({ entity }: { entity: Entity }) {
  const analysis = useNexus((s) => s.analysis)
  const [all, setAll] = useState(false)

  const patterns = useMemo(() => {
    if (!analysis) return []
    return analysis.dataset.planted.filter(
      (p) => p.walletIds.includes(entity.id) || p.txIds.includes(entity.id),
    )
  }, [analysis, entity])

  // Five fields answer the question an analyst opens a node with. The rest are
  // available, but they are not the default state of the panel.
  const PRIMARY: Record<string, string[]> = {
    wallet: ['entity', 'transactions', 'received', 'sent', 'degreeIn', 'degreeOut'],
    // The network-layer fields are what make a transaction correlatable, so
    // they belong in the default view rather than behind the disclosure.
    transaction: ['amount', 'fee', 'inputs', 'outputs', 'srcIp', 'country'],
    ip: ['address', 'port', 'country', 'asn', 'observations', 'wallets'],
  }
  const primary = PRIMARY[entity.kind] ?? []
  const entries = Object.entries(entity.meta)
  const shown = all ? entries : entries.filter(([k]) => primary.includes(k))

  return (
    <section className="border-b border-line px-4 py-3">
      <div className="flex items-baseline justify-between">
        <Label>Detail</Label>
        <button
          type="button"
          className="label hover:text-accent"
          onClick={() => setAll((v) => !v)}
        >
          {all ? 'SHOW LESS' : 'ALL FIELDS'}
        </button>
      </div>
      <div className="mt-2">
        {shown.map(([k, v]) => (
          <Field
            key={k}
            k={k.replace(/([A-Z])/g, ' $1').toUpperCase()}
            v={
              typeof v === 'number'
                ? k === 'amount' || k === 'received' || k === 'sent' || k === 'fee'
                  ? fmtBtc(v, k === 'fee' ? 8 : 4)
                  : v.toLocaleString()
                : k === 'address' || k === 'source' || k === 'destination'
                  ? shortAddr(String(v))
                  : k === 'txid'
                    ? String(v).slice(0, 10) + '…'
                    : String(v)
            }
          />
        ))}
      </div>

      {patterns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {patterns.map((p) => (
            <span key={p.id} className="chip border-accent/50 text-accent">
              {PATTERN_DEFS[p.id].shortName}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function Connections({
  neighbours,
  onSelect,
}: {
  neighbours: Entity[]
  onSelect: (id: string) => void
}) {
  const expand = useNexus((s) => s.expandSelection)
  const hops = useNexus((s) => s.hops)
  const [open, setOpen] = useState(false)

  return (
    <section className="px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-baseline justify-between text-left"
        aria-expanded={open}
      >
        <Label>{neighbours.length} direct connections</Label>
        <span className="label hover:text-accent">{open ? 'HIDE' : 'SHOW'}</span>
      </button>

      {open && (
        <>
          <ul className="mt-2 max-h-[220px] space-y-px overflow-y-auto">
            {neighbours.slice(0, 40).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className="grid w-full grid-cols-[52px_1fr_28px] items-center gap-2 py-[3px] text-left transition-colors hover:bg-white/[0.025]"
                >
                  <span className="font-mono text-3xs uppercase tracking-[0.12em] text-ghost">
                    {n.kind === 'transaction' ? 'TX' : n.kind === 'wallet' ? 'WALLET' : 'HOST'}
                  </span>
                  <span className="truncate font-mono text-2xs text-muted">
                    {n.kind === 'wallet' ? shortAddr(n.label) : n.label}
                  </span>
                  <span className={clsx('text-right font-mono text-2xs tabular-nums', riskTone(n.risk))}>
                    {n.risk}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn mt-3 w-full justify-center" onClick={expand}>
            Expand to {Math.min(5, hops + 1)} hops
          </button>
        </>
      )}
    </section>
  )
}
