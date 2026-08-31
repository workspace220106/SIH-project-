import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import clsx from 'clsx'
import { useNexus } from '@/state/store'
import { GraphCanvas } from '@/scene/GraphCanvas'
import { GraphScene } from '@/scene/GraphScene'
import { useCountUp } from '@/hooks/useCountUp'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { shortAddr } from '@/lib/graph'
import { PATTERN_DEFS } from '@/lib/patterns'
import { Eyebrow, Meter } from '@/components/ui'

/* The ten acts. Numbering is meaningful here: this is a sequence, and the
   analyst is being walked through it in order. */
const ACTS = [
  { id: 'FIELD', title: 'A capture, before anything is known', body: 'Seven fields per record — txid, wallet, amount, fee, ip, port, timestamp. On their own they are a list. Nothing in a list looks suspicious.' },
  { id: 'VOLUME', title: 'Volume arrives faster than it can be read', body: 'A single afternoon of traffic. Every transaction is legitimate until something about its shape says otherwise.' },
  { id: 'STRUCTURE', title: 'Correlation turns records into relationships', body: 'IP ↔ TXID ↔ time. The same host reappears across wallets that never transact directly. That is the first thing worth knowing.' },
  { id: 'CLUSTERS', title: 'Structure separates into behaviour', body: 'Six sets emerge from the same capture. Most are ordinary settlement. Two are not shaped like settlement at all.' },
  { id: 'APPROACH', title: 'One set does not behave like the others', body: 'Its transaction amounts are too uniform, its intervals too regular. Neither is illegal. Together they are a signature.' },
  { id: 'DISPERSION', title: 'Fan-out: one wallet, seventeen destinations', body: 'Seven minutes, near-identical amounts. Human spending is not uniform. Automation is.' },
  { id: 'VELOCITY', title: 'The same funds move again before anyone could act', body: 'Median dwell of forty-seven seconds across five wallets, then eight hops of peeling toward the periphery.' },
  { id: 'SCORE', title: 'Four independent signals, one composite', body: 'Transaction, graph, temporal and behavioural features are scored separately, then weighted. Agreement between them is what produces confidence.' },
  { id: 'WORKSPACE', title: 'The graph becomes the workspace', body: 'Every claim the system makes is anchored to the nodes and edges that produced it. Select a reason and the evidence lights up.' },
  { id: 'LEAD', title: 'What an analyst actually receives', body: 'Not a score. A subject, a technique, the evidence behind it, and the next place to look.' },
] as const

const SECTION_COUNT = ACTS.length

export function Landing() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const [quantised, setQuantised] = useState(0)
  const [intro, setIntro] = useState(0)
  const analysis = useNexus((s) => s.analysis)
  const setView = useNexus((s) => s.setView)
  const select = useNexus((s) => s.select)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const max = el.scrollHeight - el.clientHeight
        const p = max > 0 ? el.scrollTop / max : 0
        progress.current = p
        setQuantised((prev) => (Math.abs(prev - p) > 0.012 ? p : prev))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // The capture precipitates into view on arrival — the first thing the page
  // does is show records becoming a network, before anyone has scrolled.
  useEffect(() => {
    if (reduced) {
      setIntro(1)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 3800)
      setIntro(t * t * (3 - 2 * t))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduced])

  const act = Math.min(SECTION_COUNT - 1, Math.floor(quantised * SECTION_COUNT + 0.0001))
  const subject = analysis?.dataset.wallets.find((w) => w.id === analysis.primarySubject)
  const subjectCluster = analysis?.index.entityById.get(analysis.primarySubject)?.cluster ?? null
  const lead = analysis?.leads[0]

  // Progressive disclosure follows scroll position even under reduced motion:
  // it is a change of state, not an animation. Only the easing is suppressed.
  const reveal = Math.max(0.04 + intro * 0.24, Math.min(1, quantised * 1.55))
  const revealCluster = quantised > 0.42 && quantised < 0.86 ? subjectCluster : null

  const enter = () => {
    if (analysis) select(analysis.primarySubject, { fly: true })
    setView('graph', 'Entering live investigation graph')
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      {/* Field */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <GraphCanvas clearOnMiss={false}>
          <GraphScene
            reveal={reveal}
            revealCluster={revealCluster}
            interactive={false}
            showClusterLabels={quantised > 0.28 && quantised < 0.9}
            showRings={quantised > 0.12}
          />
          <StoryCamera
            progressRef={progress}
            clusterCentroid={subjectCentroid(analysis)}
            snap={reduced}
          />
        </GraphCanvas>
      </div>

      {/* Reading scrim — the field stays visible, the text stays legible */}
      <div
        className="pointer-events-none fixed inset-y-0 left-0 z-[5] w-[52%] bg-gradient-to-r from-void via-void/80 to-transparent transition-opacity duration-700"
        style={{ opacity: act <= 5 ? 1 : 0 }}
      />
      <div
        className="pointer-events-none fixed inset-y-0 right-0 z-[5] w-[52%] bg-gradient-to-l from-void via-void/80 to-transparent transition-opacity duration-700"
        style={{ opacity: act > 5 ? 1 : 0 }}
      />

      {/* Persistent frame */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5">
        <div>
          <div className="display text-[15px] font-700 tracking-[0.22em] text-accent">
            TRADELINE
          </div>
          <div className="mt-1.5 font-mono text-3xs uppercase tracking-[0.18em] text-faint">
            NTRO · PS 26146 · Bitcoin transaction traffic monitoring
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          <span className="hidden font-mono text-3xs uppercase tracking-[0.18em] text-faint md:inline">
            Synthetic data · offline
          </span>
          <MotionToggle />
          <button type="button" className="btn" onClick={enter}>
            Skip to workstation
          </button>
        </div>
      </div>

      {/* Story */}
      <div ref={scrollerRef} className="relative z-10 h-full overflow-y-auto overflow-x-hidden">
        {ACTS.map((a, i) => (
          <section
            key={a.id}
            className="relative flex h-screen items-center px-6 sm:px-10 lg:px-16"
            aria-label={a.id}
          >
            <div
              className={clsx(
                'max-w-[520px] transition-all duration-700 ease-instrument',
                act === i ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                i > 5 && 'ml-auto text-right lg:mr-[104px]',
              )}
            >
              {i === 4 ? (
                <div className="flex items-center gap-2">
                  <span className="h-[7px] w-[7px] shrink-0 animate-ticker bg-accent" />
                  <span className="font-mono text-3xs uppercase tracking-[0.2em] text-accent">
                    Suspicious activity detected · dispersion set
                  </span>
                </div>
              ) : (
                <Eyebrow accent={act === i} className={i > 5 ? 'justify-end' : undefined}>
                  {String(i + 1).padStart(2, '0')} · {a.id}
                </Eyebrow>
              )}
              <h2 className="mt-4 font-display text-[30px] font-600 leading-[1.12] tracking-[-0.01em] text-accent sm:text-[38px]">
                {a.title}
              </h2>
              <p className="mt-4 max-w-[440px] text-[14px] leading-[1.62] text-muted">
                {i > 5 ? <span className="block text-right">{a.body}</span> : a.body}
              </p>

              {i === 5 && analysis && <DispersionCard />}
              {i === 6 && analysis && <VelocityCard />}
              {i === 7 && subject && <ScoreCard />}
              {i === 8 && <WorkspaceCard />}
              {i === 9 && lead && subject && (
                <LeadCard
                  onEnter={enter}
                  subject={shortAddr(subject.address)}
                  leadId={lead.id}
                  what={lead.what}
                  next={shortAddr(lead.nextTarget)}
                />
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-line bg-void/70 px-6 py-2 backdrop-blur-sm">
        <span className="font-mono text-3xs uppercase tracking-[0.18em] text-ghost">
          Scroll to advance · {String(act + 1).padStart(2, '0')} / {SECTION_COUNT}
        </span>
        <span className="font-mono text-3xs uppercase tracking-[0.18em] text-ghost">
          {analysis?.entities.length ?? 0} entities · {analysis?.edges.length ?? 0} relationships
        </span>
      </div>
    </div>
  )
}

/** The sequence is the pitch, so it must be runnable even where the operating
    system asks for reduced motion. */
function MotionToggle() {
  const motion = useNexus((s) => s.motion)
  const setMotion = useNexus((s) => s.setMotion)
  const reduced = usePrefersReducedMotion()
  if (!reduced && motion === 'system') return null
  return (
    <button
      type="button"
      className="btn"
      onClick={() => setMotion(reduced ? 'full' : 'system')}
    >
      {reduced ? 'Play sequence' : 'Motion: full'}
    </button>
  )
}

/* ---- act cards ------------------------------------------------------- */

function DispersionCard() {
  const pattern = useNexus((s) => s.analysis?.patterns.find((p) => p.id === 'FAN_OUT'))
  if (!pattern) return null
  return (
    <div className="regmark mt-7 rounded-2xl border border-line bg-surface/80 p-5 shadow-sm backdrop-blur-md">
      <div className="flex items-baseline justify-between">
        <span className="label-active">FAN-OUT</span>
        <span className="font-mono text-2xs text-muted">
          strength {(pattern.strength * 100).toFixed(0)}%
        </span>
      </div>
      <p className="mt-2 text-left font-mono text-[11.5px] leading-relaxed text-muted">
        {PATTERN_DEFS.FAN_OUT.formula}
      </p>
      <div className="mt-3">
        <Meter value={pattern.strength * 100} />
      </div>
    </div>
  )
}

function VelocityCard() {
  const patterns = useNexus((s) => s.analysis?.patterns ?? [])
  const shown = patterns.filter((p) => p.id === 'RAPID_MOVEMENT' || p.id === 'PEELING')
  return (
    <div className="mt-7 space-y-2 rounded-2xl border border-line bg-surface/80 p-4 shadow-sm backdrop-blur-md">
      {shown.map((p) => (
        <div key={p.id} className="flex items-baseline gap-3 border-b border-line pb-2 text-left last:border-0 last:pb-0">
          <span className="label-active w-[86px] shrink-0">{p.shortName}</span>
          <span className="font-mono text-[11.5px] text-muted">{p.formula}</span>
        </div>
      ))}
    </div>
  )
}

function ScoreCard() {
  const analysis = useNexus((s) => s.analysis)
  const subject = analysis?.dataset.wallets.find((w) => w.id === analysis.primarySubject)
  const score = useCountUp(subject?.risk.score ?? 0, 900)
  if (!subject) return null

  return (
    <div className="regmark regmark-accent mt-7 rounded-2xl border border-line bg-surface/85 p-5 text-left shadow-sm backdrop-blur-md">
      <div className="flex items-end gap-6">
        <div>
          <span className="label">Composite risk</span>
          <div className="num mt-1 text-[52px] font-700 leading-none text-accent">{score}</div>
        </div>
        <div className="flex-1 space-y-2 pb-1">
          {subject.risk.signals.map((s) => (
            <div key={s.key} className="flex items-center gap-3">
              <span className="label w-[74px] shrink-0">{s.label}</span>
              <Meter value={s.value} tone="neutral" height={3} />
              <span className="w-6 shrink-0 text-right font-mono text-2xs tabular-nums text-muted">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-5 border-t border-line pt-3">
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-muted">
          Confidence {(subject.risk.confidence * 100).toFixed(0)}%
        </span>
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-risk-high">
          Priority {subject.risk.priority}
        </span>
      </div>
    </div>
  )
}

function WorkspaceCard() {
  return (
    <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-left shadow-sm">
      {[
        ['SELECT', 'Camera moves, neighbours resolve, unrelated nodes fade'],
        ['EXPAND', 'Pull the next hop into view, up to ten'],
        ['TRACE', 'Follow value forward or backward through the chain'],
        ['EXPLAIN', 'Each reason highlights the exact evidence in the graph'],
      ].map(([k, v]) => (
        <div key={k} className="bg-surface/85 p-3.5 backdrop-blur-md">
          <div className="label-active">{k}</div>
          <div className="mt-1.5 text-[11.5px] leading-snug text-muted">{v}</div>
        </div>
      ))}
    </div>
  )
}

function LeadCard({
  onEnter,
  subject,
  leadId,
  what,
  next,
}: {
  onEnter: () => void
  subject: string
  leadId: string
  what: string
  next: string
}) {
  return (
    <div className="regmark regmark-accent mt-7 rounded-2xl border border-line bg-surface/88 p-5 text-left shadow-sm backdrop-blur-md">
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <span className="display text-[13px] tracking-[0.16em] text-ink">
          INVESTIGATIVE LEAD {leadId.replace('LEAD-', '#00')}
        </span>
        <span className="chip border-risk-high/70 text-risk-high">HIGH</span>
      </div>
      <dl className="mt-3 space-y-2">
        <Row k="WHO" v={subject} />
        <Row k="WHAT" v={what} />
        <Row k="NEXT" v={next} />
      </dl>
      <button type="button" className="btn btn-primary mt-5 h-[36px] w-full justify-center" onClick={onEnter}>
        Investigate
      </button>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="label w-[44px] shrink-0 pt-[3px]">{k}</dt>
      <dd className="font-mono text-[11.5px] leading-relaxed text-ink">{v}</dd>
    </div>
  )
}

/* ---- camera ---------------------------------------------------------- */

function subjectCentroid(analysis: ReturnType<typeof useNexus.getState>['analysis']) {
  if (!analysis) return [0, 0, 0] as [number, number, number]
  const cluster = analysis.index.entityById.get(analysis.primarySubject)?.cluster
  const c = analysis.clusters.find((x) => x.id === cluster)
  return (c?.centroid ?? [0, 0, 0]) as [number, number, number]
}

/**
 * Scripted camera for the landing sequence. Reads raw scroll from a ref so it
 * stays smooth independent of the quantised React state driving the reveal.
 */
function StoryCamera({
  progressRef,
  clusterCentroid,
  snap,
}: {
  progressRef: React.MutableRefObject<number>
  clusterCentroid: [number, number, number]
  snap?: boolean
}) {
  const { camera } = useThree()
  const target = useMemo(() => new Vector3(), [])
  const desired = useMemo(() => new Vector3(), [])
  const look = useMemo(() => new Vector3(), [])

  const keys = useMemo(() => {
    const c = new Vector3(...clusterCentroid)
    return [
      { p: 0.0, pos: new Vector3(10, 46, 330), look: new Vector3(0, 0, 0) },
      { p: 0.18, pos: new Vector3(150, 84, 262), look: new Vector3(0, 0, 0) },
      { p: 0.32, pos: new Vector3(-118, 128, 224), look: new Vector3(0, 6, 0) },
      { p: 0.46, pos: c.clone().add(new Vector3(96, 62, 130)), look: c.clone() },
      { p: 0.6, pos: c.clone().add(new Vector3(44, 26, 62)), look: c.clone() },
      { p: 0.72, pos: c.clone().add(new Vector3(-38, 18, 48)), look: c.clone() },
      { p: 0.84, pos: c.clone().add(new Vector3(-86, 44, 108)), look: c.clone().multiplyScalar(0.6) },
      { p: 1.0, pos: new Vector3(60, 96, 268), look: new Vector3(0, 0, 0) },
    ]
  }, [clusterCentroid])

  useFrame((_, delta) => {
    const p = progressRef.current
    let i = 0
    while (i < keys.length - 2 && p > keys[i + 1].p) i++
    const a = keys[i]
    const b = keys[i + 1]
    const span = Math.max(0.0001, b.p - a.p)
    const t = Math.max(0, Math.min(1, (p - a.p) / span))
    const e = t * t * (3 - 2 * t)

    desired.lerpVectors(a.pos, b.pos, e)
    look.lerpVectors(a.look, b.look, e)

    const k = snap ? 1 : Math.min(1, delta * 2.6)
    camera.position.lerp(desired, k)
    target.lerp(look, k)
    camera.lookAt(target)
  })

  return null
}
