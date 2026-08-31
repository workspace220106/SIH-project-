import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { Priority } from '@/types'

/* ------------------------------------------------------------------ *
 * Typographic primitives
 * ------------------------------------------------------------------ */

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx('label', className)}>{children}</span>
}

export function Eyebrow({
  children,
  accent,
  className,
}: {
  children: ReactNode
  accent?: boolean
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-2 font-mono text-3xs uppercase tracking-[0.2em]',
        accent ? 'text-accent' : 'text-faint',
        className,
      )}
    >
      <span className={clsx('h-px w-4', accent ? 'bg-accent' : 'bg-line-strong')} />
      {children}
    </div>
  )
}

export function SectionHead({
  title,
  meta,
  action,
}: {
  title: string
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-2.5">
      <h2 className="display text-[12px] font-600 tracking-[0.14em] text-accent">{title}</h2>
      <div className="flex items-center gap-3">
        {meta && <span className="font-mono text-3xs uppercase tracking-[0.14em] text-faint">{meta}</span>}
        {action}
      </div>
    </div>
  )
}

/** Label / value pair on one line, with a dotted leader between them. */
export function Field({
  k,
  v,
  mono = true,
  tone,
}: {
  k: string
  v: ReactNode
  mono?: boolean
  tone?: 'accent' | 'muted' | 'default'
}) {
  return (
    <div className="flex items-baseline gap-2 py-[3px]">
      <span className="label shrink-0">{k}</span>
      <span className="rule-dotted mb-[3px] min-w-3 flex-1 opacity-40" />
      <span
        className={clsx(
          'shrink-0 text-right text-[11.5px] tabular-nums',
          mono && 'font-mono',
          tone === 'accent' ? 'text-accent' : tone === 'muted' ? 'text-muted' : 'text-ink',
        )}
      >
        {v}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */

const PRIORITY_STYLE: Record<Priority, string> = {
  CRITICAL: 'border-risk-crit/70 text-risk-crit',
  HIGH: 'border-risk-high/70 text-risk-high',
  MEDIUM: 'border-risk-mod/60 text-risk-mod',
  LOW: 'border-line-strong text-faint',
}

export function PriorityChip({ priority, className }: { priority: Priority; className?: string }) {
  return <span className={clsx('chip rounded-full px-2.5 py-0.5', PRIORITY_STYLE[priority], className)}>{priority}</span>
}

export function riskTone(score: number): string {
  if (score >= 90) return 'text-risk-crit'
  if (score >= 75) return 'text-risk-high'
  if (score >= 50) return 'text-risk-mod'
  return 'text-muted'
}

export function riskBar(score: number): string {
  if (score >= 90) return 'bg-risk-crit'
  if (score >= 75) return 'bg-risk-high'
  if (score >= 50) return 'bg-risk-mod'
  return 'bg-risk-low'
}

/** Horizontal contribution bar. Used for signals and evidence strength. */
export function Meter({
  value,
  max = 100,
  tone = 'accent',
  height = 4,
}: {
  value: number
  max?: number
  tone?: 'accent' | 'risk' | 'neutral'
  height?: number
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="w-full bg-line rounded-full overflow-hidden" style={{ height }}>
      <div
        className={clsx(
          'h-full rounded-full origin-left transition-[width] duration-500 ease-instrument',
          tone === 'accent' ? 'bg-accent' : tone === 'risk' ? riskBar(value) : 'bg-muted',
        )}
        style={{ width: pct + '%' }}
      />
    </div>
  )
}

export function StatusDot({ tone = 'ok' }: { tone?: 'ok' | 'warn' | 'idle' }) {
  return (
    <span
      className={clsx(
        'inline-block h-[6px] w-[6px] rounded-full',
        tone === 'ok' ? 'bg-accent' : tone === 'warn' ? 'bg-risk-high' : 'bg-ghost',
      )}
    />
  )
}

/* ------------------------------------------------------------------ *
 * Containers
 * ------------------------------------------------------------------ */

export function Panel({
  children,
  className,
  accent,
  solid,
}: {
  children: ReactNode
  className?: string
  accent?: boolean
  solid?: boolean
}) {
  return (
    <div
      className={clsx(
        'regmark rounded-2xl overflow-hidden',
        solid ? 'panel-solid' : 'panel',
        accent && 'regmark-accent',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-mono text-2xs uppercase tracking-[0.14em] text-faint">{children}</p>
    </div>
  )
}
