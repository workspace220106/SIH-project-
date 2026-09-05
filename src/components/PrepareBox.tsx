import { useRef, useState } from 'react'
import clsx from 'clsx'
import { useNexus } from '@/state/store'
import { Label } from '@/components/ui'

/**
 * Stage one of intake: turn a raw capture into a canonical one.
 *
 * Kept separate from the detection drop zone on purpose. Cleaning is a step an
 * investigator should be able to inspect and sign off before anything is
 * analysed: what was repaired, what was dropped and why. The output is a file
 * they hold, not a hidden intermediate.
 */
export function PrepareBox() {
  const prepare = useNexus((s) => s.prepare)
  const prepareFile = useNexus((s) => s.prepareFile)
  const clearPrepare = useNexus((s) => s.clearPrepare)
  const ingestFile = useNexus((s) => s.ingestFile)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) void prepareFile(file)
  }

  const report = prepare.result?.report
  const cleanName = (prepare.filename ?? 'capture').replace(/\.[^.]+$/, '') + '.clean.csv'

  const download = () => {
    if (!prepare.result) return
    const blob = new Blob([prepare.result.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = cleanName
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Skip the round trip through the filesystem when the analyst just wants on. */
  const analyseNow = () => {
    if (!prepare.result) return
    void ingestFile(new File([prepare.result.csv], cleanName, { type: 'text/csv' }))
  }

  return (
    <div className="flex h-full flex-col">
      {!report ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            take(e.dataTransfer.files)
          }}
          className={clsx(
            'regmark flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-colors',
            dragging ? 'border-accent bg-accent/[0.04]' : 'border-line-strong bg-surface/60',
          )}
        >
          <span className="display text-[15px] tracking-[0.18em] text-ink">PREPARE RAW CAPTURE</span>
          <span className="mt-2 max-w-[280px] font-mono text-2xs uppercase leading-relaxed tracking-[0.14em] text-faint">
            Messy headers · mixed date formats · satoshis · ip:port · duplicates
          </span>
          <button
            type="button"
            className="btn mt-5"
            onClick={() => inputRef.current?.click()}
            disabled={prepare.busy}
          >
            {prepare.busy ? 'Cleaning…' : 'Choose a raw file'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.json,.xml,text/csv,application/json,text/xml,application/xml"
            className="sr-only"
            onChange={(e) => take(e.target.files)}
          />
          {prepare.error && (
            <p className="mt-4 max-w-[300px] text-[11.5px] leading-relaxed text-risk-high">
              {prepare.error}
            </p>
          )}
        </div>
      ) : (
        <div className="regmark flex-1 rounded-2xl border border-line bg-surface/80 p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="display text-[13px] tracking-[0.16em] text-ink">CLEANED</span>
            <button type="button" className="label hover:text-accent" onClick={clearPrepare}>
              CLEAR
            </button>
          </div>
          <p className="mt-1 truncate font-mono text-3xs uppercase tracking-[0.12em] text-faint">
            {prepare.filename} · {report.format}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
            <Stat k="READ" v={report.totalRows} />
            <Stat k="CLEAN" v={report.accepted} accent />
            <Stat k="DROPPED" v={report.totalRows - report.accepted} />
          </div>

          {report.headerMap.length > 0 && (
            <div className="mt-3">
              <Label>Columns renamed</Label>
              <ul className="mt-1 max-h-[74px] space-y-[2px] overflow-y-auto">
                {report.headerMap.map((h) => (
                  <li key={h.from} className="font-mono text-3xs text-muted">
                    <span className="text-faint">{h.from}</span> → {h.to}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.repairs.length > 0 && (
            <div className="mt-3">
              <Label>Repairs applied</Label>
              <ul className="mt-1 space-y-[2px]">
                {report.repairs.map((r) => (
                  <li key={r.key} className="flex items-baseline gap-2">
                    <span className="w-8 shrink-0 text-right font-mono text-3xs tabular-nums text-accent">
                      {r.count}
                    </span>
                    <span className="text-[11px] leading-snug text-muted">{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.rejected.length > 0 && (
            <div className="mt-3">
              <Label>Rows dropped, with the reason</Label>
              <ul className="mt-1 max-h-[86px] space-y-[2px] overflow-y-auto">
                {report.rejected.map((r) => (
                  <li key={r.row} className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-3xs tabular-nums text-ghost">
                      line {r.row}
                    </span>
                    <span className="font-mono text-3xs leading-snug text-muted">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.fieldsMissing.length > 0 && (
            <p className="mt-3 text-[11px] leading-snug text-faint">
              Absent from the source and defaulted:{' '}
              <span className="font-mono text-muted">{report.fieldsMissing.join(', ')}</span>
            </p>
          )}

          <div className="mt-4 space-y-1">
            <button
              type="button"
              className="btn btn-primary h-[32px] w-full justify-center"
              onClick={download}
            >
              Download {cleanName}
            </button>
            <button type="button" className="btn w-full justify-center" onClick={analyseNow}>
              Or analyse it now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ k, v, accent }: { k: string; v: number; accent?: boolean }) {
  return (
    <div className="bg-surface px-3 py-2">
      <Label>{k}</Label>
      <div
        className={clsx(
          'num mt-0.5 text-[19px] font-700 tabular-nums',
          accent ? 'text-accent' : 'text-ink',
        )}
      >
        {v}
      </div>
    </div>
  )
}
