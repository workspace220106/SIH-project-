import { useRef, useState } from 'react'
import clsx from 'clsx'
import { useNexus } from '@/state/store'
import { INGEST_STAGES } from '@/lib/api'
import { Label } from '@/components/ui'

const SCHEMA: Array<[string, string, string]> = [
  ['txid', 'string', 'txid · tx_id · hash · transaction_id'],
  ['wallet', 'string', 'wallet · address · addr · account'],
  ['amount', 'number', 'amount · value · btc'],
  ['fee', 'number', 'fee · txfee · miner_fee'],
  ['ip', 'string', 'ip · ip_address · src_ip · host'],
  ['port', 'number', 'port · src_port · dst_port'],
  ['timestamp', 'ISO 8601 or epoch', 'timestamp · time · ts · datetime'],
]

export function Intake() {
  const ingest = useNexus((s) => s.ingest)
  const ingestFile = useNexus((s) => s.ingestFile)
  const clearError = useNexus((s) => s.clearIngestError)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) void ingestFile(file)
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-void">
      <div className="mx-auto max-w-[860px] px-6 py-7">
        {/* Drop + pipeline */}
        <div>
          <h1 className="display text-[16px] tracking-[0.16em] text-ink">DATA INTAKE</h1>
          <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-muted">
            Files are read in this browser and never transmitted. Detection runs against whatever
            capture is loaded — drop one in, or keep working with the synthetic capture.
          </p>

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
              'regmark mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 shadow-sm transition-colors',
              dragging ? 'border-accent bg-accent/[0.04]' : 'border-line-strong bg-surface/60',
            )}
          >
            <span className="display text-[15px] tracking-[0.18em] text-ink">DROP DATASET</span>
            <span className="mt-2 font-mono text-2xs uppercase tracking-[0.16em] text-faint">
              CSV · JSON · XML
            </span>
            <button
              type="button"
              className="btn btn-primary mt-5 rounded-xl shadow-sm"
              onClick={() => inputRef.current?.click()}
              disabled={ingest.busy}
            >
              Choose a file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,.json,.xml,text/csv,application/json,text/xml,application/xml"
              className="sr-only"
              onChange={(e) => take(e.target.files)}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="label">Sample captures</span>
            {[
              ['CSV', '/samples/capture-sample.csv'],
              ['JSON', '/samples/capture-sample.json'],
              ['XML', '/samples/capture-sample.xml'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                download
                className="font-mono text-2xs uppercase tracking-[0.14em] text-muted underline decoration-line-strong underline-offset-4 hover:text-accent"
              >
                {label}
              </a>
            ))}
            <span className="font-mono text-3xs uppercase tracking-[0.14em] text-ghost">
              synthetic · safe to import
            </span>
          </div>

          {ingest.error && (
            <div className="mt-4 rounded-xl border border-risk-high/60 bg-risk-high/[0.06] px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-2xs uppercase tracking-[0.14em] text-risk-high">
                  Import failed
                </span>
                <button type="button" className="label hover:text-ink" onClick={clearError}>
                  DISMISS
                </button>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{ingest.error}</p>
            </div>
          )}

          {/* Pipeline */}
          <section className="mt-7">
            <Label>Pipeline</Label>
            <ol className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface/80 shadow-sm">
              {INGEST_STAGES.map((s, i) => {
                const done = ingest.stage > i + 1 || (!ingest.busy && ingest.stage === 6)
                const active = ingest.stage === i + 1
                return (
                  <li
                    key={s.key}
                    className={clsx(
                      'grid grid-cols-[26px_112px_1fr_54px] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0',
                      active && 'bg-accent/[0.05]',
                    )}
                  >
                    <span className="font-mono text-3xs tabular-nums text-ghost">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={clsx(
                        'font-mono text-2xs uppercase tracking-[0.16em]',
                        active ? 'text-accent font-medium' : done ? 'text-ink' : 'text-faint',
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="text-[11.5px] leading-snug text-faint">{s.detail}</span>
                    <span
                      className={clsx(
                        'text-right font-mono text-3xs uppercase tracking-[0.12em]',
                        active ? 'text-accent font-medium' : done ? 'text-muted' : 'text-ghost',
                      )}
                    >
                      {active ? 'RUN' : done ? 'OK' : '—'}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* Rejected rows */}
          {ingest.parse && ingest.parse.rejected.length > 0 && (
            <section className="mt-6">
              <div className="flex items-baseline justify-between">
                <Label>Rejected rows</Label>
                <span className="font-mono text-3xs tabular-nums text-muted">
                  {ingest.parse.rejected.length} shown
                </span>
              </div>
              <ul className="mt-2 max-h-[180px] overflow-y-auto rounded-xl border border-line bg-surface/80">
                {ingest.parse.rejected.map((r) => (
                  <li
                    key={r.row}
                    className="flex items-baseline gap-3 border-b border-line px-3 py-1 last:border-b-0"
                  >
                    <span className="font-mono text-3xs tabular-nums text-ghost">line {r.row}</span>
                    <span className="font-mono text-2xs text-muted">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Schema */}
          <section className="mt-7">
            <Label>Expected fields</Label>
            <table className="mt-3 w-full border-collapse overflow-hidden rounded-2xl border border-line bg-surface/80 shadow-sm">
              <thead>
                <tr className="border-b border-line">
                  <Th>FIELD</Th>
                  <Th>TYPE</Th>
                  <Th>ACCEPTED HEADERS</Th>
                </tr>
              </thead>
              <tbody>
                {SCHEMA.map(([field, type, aliases]) => (
                  <tr key={field} className="border-b border-line last:border-b-0">
                    <Td accent>{field}</Td>
                    <Td>{type}</Td>
                    <Td muted>{aliases}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 max-w-[620px] text-[11.5px] leading-relaxed text-faint">
              Rows sharing a txid are treated as one transaction: the earliest is the input side,
              the rest are outputs. Where a txid appears only once the direction of value cannot be
              recovered, and the detectors that depend on it are skipped rather than guessed at.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-1.5 text-left font-mono text-3xs uppercase tracking-[0.16em] text-ghost">
      {children}
    </th>
  )
}

function Td({
  children,
  accent,
  muted,
}: {
  children: React.ReactNode
  accent?: boolean
  muted?: boolean
}) {
  return (
    <td
      className={clsx(
        'px-3 py-1.5 font-mono text-2xs',
        accent ? 'text-accent' : muted ? 'text-faint' : 'text-muted',
      )}
    >
      {children}
    </td>
  )
}
