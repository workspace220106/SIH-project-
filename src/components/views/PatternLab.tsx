import { useEffect } from 'react'
import clsx from 'clsx'
import type { PatternId } from '@/types'
import { useNexus } from '@/state/store'
import { PatternGlyph } from '@/components/PatternGlyph'
import { PATTERN_DEFS, PATTERN_ORDER } from '@/lib/patterns'
import { fmtTime, shortAddr } from '@/lib/graph'
import { Label, Meter } from '@/components/ui'

/**
 * Pattern lab. Selecting a detector isolates its real matches in the live
 * field. The schematic on the left and the graph on the right are the same
 * claim drawn two ways.
 */
export function PatternLab() {
  const analysis = useNexus((s) => s.analysis)
  const morph = useNexus((s) => s.morphPattern)
  const setMorph = useNexus((s) => s.setMorphPattern)
  const setHighlight = useNexus((s) => s.setHighlight)
  const flyTo = useNexus((s) => s.flyTo)
  const select = useNexus((s) => s.select)
  const setView = useNexus((s) => s.setView)
  const setPanel = useNexus((s) => s.setPanel)

  const apply = (id: PatternId) => {
    if (!analysis) return
    const pattern = analysis.patterns.find((p) => p.id === id)
    if (!pattern) return
    setMorph(id)
    setHighlight({
      label: PATTERN_DEFS[id].shortName + ' · ' + pattern.entities.length + ' entities matched',
      entities: new Set(pattern.entities),
      edges: new Set(pattern.edges),
      source: 'pattern',
    })
    const anchor = analysis.index.entityById.get(pattern.entities[0])
    if (anchor) flyTo([anchor.x, anchor.y, anchor.z], 92)
  }

  useEffect(() => {
    if (analysis && !morph) apply('FAN_OUT')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis])

  if (!analysis) return null

  const active = morph ?? 'FAN_OUT'
  const def = PATTERN_DEFS[active]
  const pattern = analysis.patterns.find((p) => p.id === active)
  const planted = analysis.dataset.planted.find((p) => p.id === active)
  const anchorWallet = analysis.dataset.wallets.find((w) => w.id === planted?.anchorWallet)

  return (
    <div className="pointer-events-none absolute inset-0 flex">
      {/* Catalogue */}
      <div className="pointer-events-auto flex w-[300px] shrink-0 flex-col border-r border-line bg-surface/[0.94] backdrop-blur-md">
        <div className="border-b border-line px-4 py-2.5">
          <span className="display text-[12px] tracking-[0.16em] text-ink">PATTERN LAB</span>
          <p className="mt-1 text-[11px] leading-snug text-faint">
            {PATTERN_ORDER.length} detectors run over every capture. Select one to isolate its
            matches in the field.
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {PATTERN_ORDER.map((id) => {
            const d = PATTERN_DEFS[id]
            const p = analysis.patterns.find((x) => x.id === id)
            const on = active === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => apply(id)}
                  aria-pressed={on}
                  className={clsx(
                    'w-full border-b border-line px-4 py-3 text-left transition-colors',
                    on ? 'bg-accent/[0.05]' : 'hover:bg-white/[0.02]',
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className={clsx(
                        'font-mono text-2xs uppercase tracking-[0.16em]',
                        on ? 'text-accent' : 'text-ink',
                      )}
                    >
                      {d.shortName}
                    </span>
                    <span className="font-mono text-3xs uppercase tracking-[0.12em] text-ghost">
                      {d.shape}
                    </span>
                  </div>
                  <div className="mt-2">
                    <PatternGlyph id={id} active={on} />
                  </div>
                  {p && (
                    <div className="mt-2 flex items-center gap-2">
                      <Meter value={p.strength * 100} tone={on ? 'accent' : 'neutral'} height={2} />
                      <span className="font-mono text-3xs tabular-nums text-faint">
                        {(p.strength * 100).toFixed(0)}
                      </span>
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Field */}
      <div className="relative min-w-0 flex-1">
        <div
          key={active}
          className="panel pointer-events-auto absolute left-4 top-4 z-20 w-[400px] animate-reveal-up rounded-2xl overflow-hidden shadow-md"
        >
          <div className="border-b border-line px-4 py-2.5">
            <div className="flex items-baseline justify-between">
              <span className="display text-[13px] tracking-[0.14em] text-ink">{def.name}</span>
              <span className="chip border-accent/50 text-accent">{def.shape}</span>
            </div>
          </div>
          <div className="px-4 py-3">
            <Label>Detection rule</Label>
            <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-accent">{def.formula}</p>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">{def.description}</p>
            <p className="mt-3 border-l-2 border-line-strong pl-3 text-[11.5px] leading-relaxed text-faint">
              {def.disposition}
            </p>
          </div>
          {pattern && planted && (
            <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
              <Stat k="ENTITIES" v={String(pattern.entities.length)} />
              <Stat k="EDGES" v={String(pattern.edges.length)} />
              <Stat k="DETECTED" v={fmtTime(pattern.detectedAt).slice(0, 5)} />
            </div>
          )}
          {planted && (
            <div className="border-t border-line px-4 py-3">
              <Label>Match in this capture</Label>
              <p className="mt-1.5 font-mono text-[11.5px] text-ink">{planted.metric}</p>
              {anchorWallet && (
                <button
                  type="button"
                  className="btn mt-3 w-full justify-center"
                  onClick={() => {
                    select(anchorWallet.id, { fly: true })
                    setPanel('why')
                    setView('graph', 'Opening ' + def.shortName + ' anchor')
                  }}
                >
                  Open anchor {shortAddr(anchorWallet.address)}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-3 py-2.5">
      <Label>{k}</Label>
      <div className="num mt-0.5 text-[18px] font-700 tabular-nums text-ink">{v}</div>
    </div>
  )
}
