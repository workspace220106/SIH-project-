import clsx from 'clsx'
import { motion } from 'framer-motion'
import { useNexus } from '@/state/store'
import { fmtBtc, fmtTime, shortAddr, shortTxid } from '@/lib/graph'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { Label } from '@/components/ui'

/**
 * Money-flow tracing. The chain is read top to bottom with the value carried
 * at each step, because the question is always "how much of it arrived here".
 */
export function TracePanel() {
  const trace = useNexus((s) => s.trace)
  const direction = useNexus((s) => s.traceDirection)
  const depth = useNexus((s) => s.traceDepth)
  const runTrace = useNexus((s) => s.runTrace)
  const analysis = useNexus((s) => s.analysis)
  const selectedId = useNexus((s) => s.selectedId)
  const select = useNexus((s) => s.select)
  const flyTo = useNexus((s) => s.flyTo)
  const setHighlight = useNexus((s) => s.setHighlight)
  const reduced = usePrefersReducedMotion()

  if (!selectedId) {
    return (
      <div className="px-4 py-10">
        <p className="max-w-[250px] text-[12px] leading-relaxed text-muted">
          Select a wallet, then trace. Forward follows the largest onward transfer at each hop;
          backward walks the same rule in reverse.
        </p>
      </div>
    )
  }

  const label = (id: string) => {
    const e = analysis?.index.entityById.get(id)
    return e ? (e.kind === 'wallet' ? shortAddr(e.label) : e.label) : id
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <Label>Money flow</Label>
        <div className="mt-2 flex gap-1">
          {(['forward', 'backward'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => runTrace(d, depth)}
              className={clsx(
                'flex-1 border py-[5px] font-mono text-3xs uppercase tracking-[0.14em] transition-colors',
                direction === d
                  ? 'border-accent/60 bg-accent/[0.08] text-accent'
                  : 'border-line-strong text-faint hover:text-ink',
              )}
            >
              Trace {d}
            </button>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {[3, 5, 10].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => runTrace(direction, d)}
              className={clsx(
                'flex-1 border py-[4px] font-mono text-3xs transition-colors',
                depth === d
                  ? 'border-accent/60 bg-accent/[0.08] text-accent'
                  : 'border-line-strong text-faint hover:text-ink',
              )}
            >
              {d} HOPS
            </button>
          ))}
        </div>
      </header>

      {trace && trace.hops.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
            <Stat k="HOPS" v={String(trace.hops.length)} />
            <Stat k="TOTAL VALUE" v={fmtBtc(trace.totalValue, 2) + ' BTC'} accent />
          </div>

          <ol className="flex-1 overflow-y-auto px-4 py-3">
            <Node label={label(trace.hops[0].fromEntity)} root />
            {trace.hops.map((h, i) => (
              <motion.li
                key={h.edgeId + i}
                initial={reduced ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduced ? 0 : i * 0.07, duration: 0.3 }}
              >
                <button
                  type="button"
                  className="group my-1 w-full border-l border-line-strong pl-4 text-left transition-colors hover:border-accent"
                  onClick={() => {
                    const from = analysis?.index.entityById.get(h.fromEntity)
                    if (from) flyTo([from.x, from.y, from.z], 44)
                    setHighlight({
                      label: 'HOP ' + h.index + ' · ' + fmtBtc(h.amount, 4) + ' BTC',
                      entities: new Set([h.fromEntity, h.toEntity]),
                      edges: new Set([h.edgeId]),
                      source: 'trace',
                    })
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-3xs text-ghost">
                      {String(h.index).padStart(2, '0')}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums text-accent">
                      {fmtBtc(h.amount, 4)} BTC
                    </span>
                    <span className="ml-auto font-mono text-3xs text-faint">{fmtTime(h.timestamp)}</span>
                  </div>
                  <div className="mt-[2px] font-mono text-3xs text-ghost group-hover:text-faint">
                    {shortTxid(h.txid)}
                  </div>
                </button>
                <Node label={label(h.toEntity)} onClick={() => select(h.toEntity, { fly: true })} />
              </motion.li>
            ))}
          </ol>

          <div className="border-t border-line p-3">
            <button
              type="button"
              className="btn w-full justify-center"
              onClick={() => runTrace(direction, Math.min(10, depth + 2))}
              disabled={depth >= 10}
            >
              Expand hops
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-8">
          <p className="text-[12px] leading-relaxed text-muted">
            No onward path from this wallet in the current window. Widen the time filter or trace in
            the other direction.
          </p>
        </div>
      )}
    </div>
  )
}

function Node({
  label,
  root,
  onClick,
}: {
  label: string
  root?: boolean
  onClick?: () => void
}) {
  const content = (
    <span className="flex items-center gap-2">
      <span className={clsx('h-[7px] w-[7px] border', root ? 'border-accent bg-accent' : 'border-muted')} />
      <span className={clsx('font-mono text-[11.5px]', root ? 'text-accent' : 'text-ink')}>{label}</span>
    </span>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="block py-[3px] text-left hover:opacity-80">
      {content}
    </button>
  ) : (
    <div className="py-[3px]">{content}</div>
  )
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="bg-surface px-4 py-2.5">
      <Label>{k}</Label>
      <div
        className={clsx(
          'num mt-0.5 text-[19px] font-600 tabular-nums',
          accent ? 'text-accent' : 'text-ink',
        )}
      >
        {v}
      </div>
    </div>
  )
}
