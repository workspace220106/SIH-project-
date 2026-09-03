import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { Lead } from '@/types'
import { useNexus } from '@/state/store'
import { confidenceBand, fmtDateTime, shortAddr } from '@/lib/graph'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { Label, PriorityChip, riskTone } from '@/components/ui'

const ROWS = ['WHO', 'WHAT', 'WHY', 'EVIDENCE', 'PRIORITY', 'NEXT TARGET'] as const

/**
 * The lead is the output of the whole pipeline, so it is written the way a
 * handover note is written: who, what, why, what backs it, and where to go next.
 */
export function LeadPanel() {
  const activeLead = useNexus((s) => s.activeLead)
  const leads = useNexus((s) => s.analysis?.leads ?? [])
  const lead = activeLead ?? leads[0]
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(reduced ? ROWS.length : 0)

  useEffect(() => {
    if (reduced) {
      setShown(ROWS.length)
      return
    }
    setShown(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setShown(i)
      if (i >= ROWS.length) window.clearInterval(id)
    }, 220)
    return () => window.clearInterval(id)
  }, [lead?.id, reduced])

  const setPanel = useNexus((s) => s.setPanel)
  const select = useNexus((s) => s.select)
  const runTrace = useNexus((s) => s.runTrace)
  const analysis = useNexus((s) => s.analysis)

  if (!lead) {
    return (
      <div className="px-4 py-10">
        <p className="text-[12px] leading-relaxed text-muted">
          No lead has been generated yet. Open a flagged wallet and run the explanation.
        </p>
      </div>
    )
  }

  const values: Record<(typeof ROWS)[number], string> = {
    WHO: shortAddr(lead.who),
    WHAT: lead.what,
    WHY: lead.why.join(' + '),
    EVIDENCE: lead.evidence.length + ' items · graph, transaction and temporal',
    PRIORITY: lead.priority,
    'NEXT TARGET': shortAddr(lead.nextTarget),
  }

  const openInGraph = () => {
    const wallet = analysis?.dataset.wallets.find((w) => w.address === lead.who)
    if (wallet) select(wallet.id, { fly: true })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-line px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="display text-[13px] tracking-[0.16em] text-ink">
            INVESTIGATIVE LEAD #{String(lead.number).padStart(4, '0')}
          </span>
          <PriorityChip priority={lead.priority} />
        </div>
        <div className="mt-1 font-mono text-3xs uppercase tracking-[0.14em] text-faint">
          generated {fmtDateTime(lead.createdAt)} · {lead.status}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <dl className="divide-y divide-line">
          {ROWS.map((row, i) => (
            <motion.div
              key={row}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={i < shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-[76px_1fr] gap-3 px-4 py-2.5"
            >
              <dt className="label pt-[3px]">{row}</dt>
              <dd
                className={clsx(
                  'break-words font-mono text-[11.5px] leading-relaxed',
                  row === 'PRIORITY' ? riskTone(lead.risk) : 'text-ink',
                )}
              >
                {values[row]}
              </dd>
            </motion.div>
          ))}
        </dl>

        <div className="grid grid-cols-2 gap-px border-y border-line bg-line">
          <div className="bg-surface px-4 py-3">
            <Label>Risk</Label>
            <div className={clsx('num mt-0.5 text-[26px] font-700 tabular-nums', riskTone(lead.risk))}>
              {lead.risk}
            </div>
          </div>
          <div className="bg-surface px-4 py-3">
            <Label>Confidence</Label>
            <div className="num mt-0.5 text-[26px] font-700 tabular-nums text-ink">
              {(lead.confidence * 100).toFixed(0)}
              <span className="ml-0.5 font-mono text-[11px] font-400 text-ghost">%</span>
            </div>
            <div className="font-mono text-3xs uppercase tracking-[0.12em] text-faint">
              {confidenceBand(lead.confidence)}
            </div>
          </div>
        </div>

        <div className="space-y-1 p-3">
          <button type="button" className="btn btn-primary h-[32px] w-full justify-center" onClick={openInGraph}>
            Open investigation
          </button>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              className="btn justify-center"
              onClick={() => {
                openInGraph()
                setPanel('trace')
                runTrace('forward', 5)
              }}
            >
              Trace flow
            </button>
            <button type="button" className="btn justify-center" onClick={() => setPanel('why')}>
              View evidence
            </button>
          </div>
          <button
            type="button"
            className="btn w-full justify-center"
            onClick={() => downloadReport(lead)}
          >
            Generate report
          </button>
        </div>

        <RecentLeads current={lead} />
      </div>
    </div>
  )
}

function RecentLeads({ current }: { current: Lead }) {
  const leads = useNexus((s) => s.analysis?.leads ?? [])
  const openLead = useNexus((s) => s.openLead)
  const others = leads.filter((l) => l.id !== current.id)
  if (!others.length) return null

  return (
    <section className="border-t border-line px-4 py-3">
      <Label>Other open leads</Label>
      <ul className="mt-2 space-y-px">
        {others.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => openLead(l)}
              className="grid w-full grid-cols-[64px_1fr_28px] items-center gap-2 py-[3px] text-left hover:bg-white/[0.025]"
            >
              <span className="font-mono text-3xs text-ghost">#{String(l.number).padStart(4, '0')}</span>
              <span className="truncate font-mono text-2xs text-muted">{shortAddr(l.who)}</span>
              <span className={clsx('text-right font-mono text-2xs tabular-nums', riskTone(l.risk))}>
                {l.risk}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Report generation is local — the workstation has no outbound path. */
function downloadReport(lead: Lead) {
  const lines = [
    'TRADELINE — INVESTIGATIVE LEAD #' + String(lead.number).padStart(4, '0'),
    'SYNTHETIC DATA · OFFLINE ENVIRONMENT',
    'GENERATED ' + fmtDateTime(lead.createdAt),
    '',
    'SUBJECT      ' + lead.who,
    'TECHNIQUE    ' + lead.what,
    'MATCHED      ' + lead.why.join(', '),
    'RISK         ' + lead.risk + '/100',
    'CONFIDENCE   ' + (lead.confidence * 100).toFixed(1) + '% (' + confidenceBand(lead.confidence) + ')',
    'PRIORITY     ' + lead.priority,
    'NEXT TARGET  ' + lead.nextTarget,
    '',
    'EVIDENCE',
    ...lead.evidence.map(
      (e) =>
        '  ' +
        String(e.index).padStart(2, '0') +
        '  ' +
        e.title.padEnd(22) +
        e.metric +
        '  [strength ' +
        (e.strength * 100).toFixed(0) +
        ']',
    ),
    '',
    'This lead was produced from synthetic data for demonstration. It is not a record of',
    'observed activity and must not be treated as one.',
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'TRADELINE-LEAD-' + String(lead.number).padStart(4, '0') + '.txt'
  a.click()
  URL.revokeObjectURL(url)
}
