import { useRef, useState } from 'react'
import clsx from 'clsx'
import { useNexus } from '@/state/store'
import { INGEST_STAGES } from '@/lib/api'
import { geoDatabaseStatus } from '@/lib/geoip'
import { PrepareBox } from '@/components/PrepareBox'
import { useNexus as useStore } from '@/state/store'
import { Label } from '@/components/ui'

const SCHEMA: Array<[string, string, string]> = [
  ['timestamp', 'ISO 8601 or epoch', 'timestamp · time · ts · datetime'],
  ['txid', 'string', 'txid · tx_id · hash · transaction_id'],
  ['src_ip', 'IPv4', 'src_ip · source_ip · ip'],
  ['dst_ip', 'IPv4', 'dst_ip · dest_ip · peer_ip'],
  ['src_port', 'number', 'src_port · source_port · port'],
  ['dst_port', 'number', 'dst_port · dest_port · peer_port'],
  ['input_addresses[]', 'array', 'input_addresses · inputs · in_addresses'],
  ['output_addresses[]', 'array', 'output_addresses · outputs · out_addresses'],
  ['input_amounts[]', 'array', 'input_amounts · input_values'],
  ['output_amounts[]', 'array', 'output_amounts · output_values'],
  ['fee', 'number', 'fee · txfee · miner_fee'],
  ['script_type', 'string (optional)', 'script_type · script'],
  ['geo_country', 'ISO 3166-1 (optional)', 'geo_country · country · country_code'],
  ['asn', 'string (optional)', 'asn · as_number'],
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
      <div className="mx-auto max-w-[1040px] px-6 py-7">
        {/* Drop + pipeline */}
        <div>
          <h1 className="display text-[16px] tracking-[0.16em] text-ink">DATA INTAKE</h1>
          <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-muted">
            Files are read in this browser and never transmitted. Prepare a raw capture on the
            right to get a canonical file, then drop that on the left to run detection — or drop an
            already-clean capture straight in.
          </p>

          {/* Two stages: prepare a raw capture, then analyse a clean one. */}
          <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2">
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
              'regmark flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 shadow-sm transition-colors',
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

            <PrepareBox />
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="label">Sample captures</span>
            {[
              ['CSV', '/samples/capture-sample.csv'],
              ['JSON', '/samples/capture-sample.json'],
              ['XML', '/samples/capture-sample.xml'],
              ['RAW / MESSY', '/samples/capture-raw-messy.csv'],
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
              synthetic · the raw one is for the preparation stage
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
              One row is one transaction. Array columns accept a JSON array or a pipe-separated
              list inside a single cell (<span className="font-mono">addr1|addr2</span>); XML may
              repeat child elements instead. A row whose address and amount arrays differ in length
              is rejected rather than guessed at, because value could not be attributed to an
              address. Country and ASN are read from the capture when present, otherwise resolved
              from the local GeoIP database.
            </p>
          </section>

          {/* Model */}
          <section className="mt-7">
            <Label>Detection model</Label>
            <ModelCard />
          </section>

          {/* GeoIP */}
          <section className="mt-7">
            <Label>GeoIP database</Label>
            <GeoStatus />
          </section>
        </div>
      </div>
    </div>
  )
}

/** States what the detector is, so no one has to take the word "AI" on trust. */
function ModelCard() {
  const model = useStore((st) => st.analysis?.model)
  const flaggedShare = model && model.trainedOn ? (model.flagged / model.trainedOn) * 100 : 0
  if (!model) return null
  return (
    <div className="mt-3 max-w-[620px] rounded-2xl border border-line bg-surface/80 px-4 py-3 shadow-sm">
      <div className="flex items-baseline gap-2">
        <span className="h-[6px] w-[6px] rounded-full bg-accent" />
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-ink">{model.name}</span>
        <span className="font-mono text-3xs uppercase tracking-[0.12em] text-faint">
          {model.family}
        </span>
        <span className="ml-auto font-mono text-3xs tabular-nums text-muted">
          {model.trees} trees · sample {model.sampleSize}
        </span>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
        Fitted on this capture alone — {model.trainedOn} wallets, no labels and no pre-trained
        weights, because an incoming capture carries no ground truth to learn from. It flagged{' '}
        {model.flagged} wallets ({flaggedShare.toFixed(0)}%) above the 90th-percentile threshold.
        Each score is explained by re-scoring the wallet with one feature at a time reset to the
        population median.
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {model.features.map((f) => (
          <span key={f} className="chip border-line-strong text-muted">
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Says plainly whether a local database is installed, and what happens if not. */
function GeoStatus() {
  const geo = geoDatabaseStatus()
  return (
    <div className="mt-3 max-w-[620px] rounded-2xl border border-line bg-surface/80 px-4 py-3 shadow-sm">
      <div className="flex items-baseline gap-2">
        <span
          className={clsx('h-[6px] w-[6px] rounded-full', geo.loaded ? 'bg-accent' : 'bg-line-strong')}
        />
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-ink">
          {geo.loaded ? geo.label : 'Resolving from capture'}
        </span>
        {geo.loaded && (
          <span className="ml-auto font-mono text-3xs tabular-nums text-muted">
            {geo.entries.toLocaleString()} ranges
          </span>
        )}
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
        {geo.loaded
          ? 'Addresses without a country in the capture are resolved locally against this database. No lookup leaves this host.'
          : 'Country and ASN are being read from the capture’s own geo_country and asn columns, which the field specification requires it to carry. A local GeoLite2 database is the fallback for captures that omit them: run npm run geoip against an extracted MaxMind export and the lookup runs here, offline, against sorted ranges.'}
      </p>
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
