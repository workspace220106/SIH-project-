import { useEffect, useState } from 'react'
import { INGEST_STAGES } from '@/lib/api'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Cold start. The pipeline stages are the same six the ingestion view shows,
 * because that is genuinely what runs before the workstation is usable.
 */
export function Boot({ onDone }: { onDone: () => void }) {
  const reduced = usePrefersReducedMotion()
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (reduced) {
      onDone()
      return
    }
    const step = 165
    const id = window.setInterval(() => {
      setStage((s) => {
        if (s >= INGEST_STAGES.length) {
          window.clearInterval(id)
          onDone()
          return s
        }
        return s + 1
      })
    }, step)
    return () => window.clearInterval(id)
  }, [onDone, reduced])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void"
      onClick={onDone}
      role="status"
      aria-label="Starting NEXUS"
    >
      <div className="w-[340px]">
        <div className="display text-[30px] font-700 leading-none tracking-[0.24em] text-ink">
          NEXUS
        </div>
        <div className="mt-2 font-mono text-3xs uppercase tracking-[0.22em] text-faint">
          Bitcoin transaction intelligence · PS 26146
        </div>

        <div className="mt-7 space-y-[6px]">
          {INGEST_STAGES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3">
              <span
                className={
                  'h-[3px] w-[3px] ' + (i < stage ? 'bg-accent' : 'bg-ghost')
                }
              />
              <span
                className={
                  'font-mono text-3xs uppercase tracking-[0.18em] transition-colors duration-300 ' +
                  (i < stage ? 'text-muted' : 'text-ghost')
                }
              >
                {s.label}
              </span>
              <span className="rule-dotted mb-[1px] flex-1 opacity-30" />
              <span className="font-mono text-3xs text-faint">
                {i < stage ? 'OK' : '··'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-7 h-px w-full bg-line">
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-linear"
            style={{ width: (stage / INGEST_STAGES.length) * 100 + '%' }}
          />
        </div>
        <div className="mt-2 font-mono text-3xs uppercase tracking-[0.16em] text-ghost">
          Offline environment · synthetic dataset
        </div>
      </div>
    </div>
  )
}
