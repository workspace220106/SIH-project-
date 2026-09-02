import { useEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import type { Evidence } from '@/types'
import { useNexus } from '@/state/store'
import { buildEvidence, confidenceBand } from '@/lib/graph'
import { useCountUp } from '@/hooks/useCountUp'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { Label, Meter, PriorityChip, riskTone } from '@/components/ui'

/**
 * The explanation is not a paragraph. It is a ranked list of the specific
 * things the detectors matched, each one wired to the part of the graph that
 * produced it. Selecting a reason is how an analyst checks the system's work.
 */
export function WhyPanel() {
  const analysis = useNexus((s) => s.analysis)
  const selectedId = useNexus((s) => s.selectedId)
  const revealed = useNexus((s) => s.revealedEvidence)
  const reveal = useNexus((s) => s.revealEvidence)
  const activeEvidence = useNexus((s) => s.activeEvidence)
  const setActiveEvidence = useNexus((s) => s.setActiveEvidence)
  const openLead = useNexus((s) => s.openLead)
  const reduced = usePrefersReducedMotion()
  const timer = useRef<number>()

  const wallet = useMemo(() => {
    if (!analysis || !selectedId) return null
    const entity = analysis.index.entityById.get(selectedId)
    if (!entity) return null
    if (entity.kind === 'wallet') return analysis.dataset.wallets.find((w) => w.id === entity.id) ?? null
    const neighbourWallet = (analysis.index.neighbours.get(entity.id) ?? []).find(
      (n) => analysis.index.entityById.get(n)?.kind === 'wallet',
    )
    return analysis.dataset.wallets.find((w) => w.id === neighbourWallet) ?? null
  }, [analysis, selectedId])

  const evidence = useMemo(() => {
    if (!analysis || !wallet) return [] as Evidence[]
    const pats = analysis.dataset.planted.filter((p) => p.walletIds.includes(wallet.id))
    return buildEvidence(wallet, pats, analysis.index, analysis.anomalies.get(wallet.id))
  }, [analysis, wallet])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const runReveal = () => {
    if (reduced) {
      reveal(evidence.length)
      return
    }
    let i = 0
    const step = () => {
      i += 1
      reveal(i)
      if (i < evidence.length) timer.current = window.setTimeout(step, 340)
    }
    reveal(0)
    timer.current = window.setTimeout(step, 120)
  }

  const score = useCountUp(revealed >= evidence.length && wallet ? wallet.risk.score : 0, 900)
  const lead = analysis?.leads.find((l) => l.who === wallet?.address)

  if (!wallet) {
    return (
      <div className="px-4 py-10">
        <p className="max-w-[250px] text-[12px] leading-relaxed text-muted">
          Select a wallet to see why it was flagged. Transactions and hosts inherit their
          explanation from the wallet they belong to.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <Label>Explanation</Label>
        <div className="mt-1 break-all font-mono text-[12px] text-ink">{wallet.address}</div>
      </header>

      {revealed === 0 ? (
        <div className="flex flex-1 flex-col justify-center px-4 py-6">
          <p className="text-[12.5px] leading-relaxed text-muted">
            Five detectors matched this wallet. They are ranked by how much each one moved the
            composite score — not by the order they fired.
          </p>
          <button type="button" className="btn btn-primary mt-5 h-[38px] justify-center" onClick={runReveal}>
            Why suspicious?
          </button>
          <p className="mt-3 text-[10.5px] leading-snug text-ghost">
            Each reason stays clickable afterwards. Selecting one isolates the exact nodes and edges
            it was derived from.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ol className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {evidence.slice(0, revealed).map((e) => (
                <motion.li
                  key={e.index}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setActiveEvidence(activeEvidence === e.index ? null : e.index, e)
                    }
                    aria-pressed={activeEvidence === e.index}
                    className={clsx(
                      'w-full px-4 py-3 text-left transition-colors',
                      activeEvidence === e.index ? 'bg-accent/[0.05]' : 'hover:bg-white/[0.02]',
                    )}
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        className={clsx(
                          'num text-[15px] font-600 tabular-nums',
                          activeEvidence === e.index ? 'text-accent' : 'text-ghost',
                        )}
                      >
                        {String(e.index).padStart(2, '0')}
                      </span>
                      <span
                        className={clsx(
                          'font-mono text-2xs uppercase tracking-[0.16em]',
                          activeEvidence === e.index ? 'text-accent' : 'text-ink',
                        )}
                      >
                        {e.title}
                      </span>
                      <span className="ml-auto font-mono text-3xs tabular-nums text-faint">
                        {(e.strength * 100).toFixed(0)}
                      </span>
                    </div>
                    <div className="mt-1.5 pl-[30px]">
                      <Meter
                        value={e.strength * 100}
                        tone={activeEvidence === e.index ? 'accent' : 'neutral'}
                        height={2}
                      />
                      <div className="mt-2 font-mono text-[11px] text-muted">{e.metric}</div>
                      {activeEvidence === e.index && (
                        <motion.div
                          initial={reduced ? false : { opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.24 }}
                          className="text-[11.5px] leading-relaxed text-faint"
                        >
                          <p className="mt-2">{e.description}</p>
                          <p className="mt-2 text-accent">
                            {e.relatedEntities.length} entities · {e.relatedEdges.length} edges
                            highlighted in the field
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>

          {revealed >= evidence.length && (
            <motion.div
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="border-t border-line px-4 py-4"
            >
              <div className="flex items-end justify-between">
                <div>
                  <Label>Risk</Label>
                  <div className={clsx('num text-[38px] font-700 leading-none', riskTone(wallet.risk.score))}>
                    {score}
                    <span className="ml-1 font-mono text-[12px] font-400 text-ghost">/100</span>
                  </div>
                </div>
                <div className="text-right">
                  <Label>Confidence</Label>
                  <div className="mt-1 font-mono text-[13px] uppercase tracking-[0.12em] text-ink">
                    {confidenceBand(wallet.risk.confidence)}
                  </div>
                  <div className="font-mono text-3xs tabular-nums text-faint">
                    {(wallet.risk.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <PriorityChip priority={wallet.risk.priority} />
                <span className="font-mono text-3xs uppercase tracking-[0.14em] text-faint">
                  {evidence.length} corroborating signals
                </span>
              </div>
              {lead && (
                <button
                  type="button"
                  className="btn btn-primary mt-4 h-[34px] w-full justify-center"
                  onClick={() => openLead(lead)}
                >
                  Open investigative lead
                </button>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
