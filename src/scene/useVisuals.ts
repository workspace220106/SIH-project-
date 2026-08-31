import { useMemo } from 'react'
import { Color } from 'three'
import type { Entity, EntityKind } from '@/types'
import { useNexus } from '@/state/store'
import { ALPHA, C, fade, NODE_SCALE, riskColor } from '@/scene/constants'

/**
 * Turns application state into the flat typed arrays the renderer consumes.
 * Recomputed only when something structural changes; per-frame easing toward
 * these targets happens in the layer components.
 */

export interface KindBuffers {
  kind: EntityKind
  entities: Entity[]
  /** id → index within this kind */
  indexOf: Map<string, number>
  positions: Float32Array
  /** target colour, already faded toward the background */
  colors: Float32Array
  /** target uniform scale */
  scales: Float32Array
  /** target alpha, retained for hit-testing decisions */
  alphas: Float32Array
}

export interface EdgeBuffers {
  positions: Float32Array
  colors: Float32Array
  ids: string[]
  count: number
}

const KINDS: EntityKind[] = ['wallet', 'transaction', 'ip']

export function useGraphGeometry() {
  const analysis = useNexus((s) => s.analysis)

  return useMemo(() => {
    if (!analysis) return null
    const byKind = KINDS.map((kind) => {
      const entities = analysis.entities.filter((e) => e.kind === kind)
      const positions = new Float32Array(entities.length * 3)
      entities.forEach((e, i) => {
        positions[i * 3] = e.x
        positions[i * 3 + 1] = e.y
        positions[i * 3 + 2] = e.z
      })
      return {
        kind,
        entities,
        indexOf: new Map(entities.map((e, i) => [e.id, i])),
        positions,
        colors: new Float32Array(entities.length * 3),
        scales: new Float32Array(entities.length),
        alphas: new Float32Array(entities.length),
      } as KindBuffers
    })

    const edges = analysis.edges
    const positions = new Float32Array(edges.length * 6)
    edges.forEach((e, i) => {
      const a = analysis.index.entityById.get(e.source)
      const b = analysis.index.entityById.get(e.target)
      if (!a || !b) return
      positions[i * 6] = a.x
      positions[i * 6 + 1] = a.y
      positions[i * 6 + 2] = a.z
      positions[i * 6 + 3] = b.x
      positions[i * 6 + 4] = b.y
      positions[i * 6 + 5] = b.z
    })

    // Flat, entity-order positions — the glow layer draws every node in one pass.
    const allPositions = new Float32Array(analysis.entities.length * 3)
    analysis.entities.forEach((e, i) => {
      allPositions[i * 3] = e.x
      allPositions[i * 3 + 1] = e.y
      allPositions[i * 3 + 2] = e.z
    })

    return {
      byKind,
      allPositions,
      kindMap: new Map(byKind.map((b) => [b.kind, b])),
      edgeBuffers: {
        positions,
        colors: new Float32Array(edges.length * 6),
        ids: edges.map((e) => e.id),
        count: edges.length,
      } as EdgeBuffers,
    }
  }, [analysis])
}

export interface VisualTargets {
  /** kind → per-instance alpha/scale/colour */
  nodes: Map<EntityKind, { alpha: Float32Array; scale: Float32Array; color: Float32Array }>
  /** entity-order halo colour and radius, additively blended */
  glow: { color: Float32Array; size: Float32Array }
  edges: { alpha: Float32Array; color: Float32Array }
  /** ids currently treated as the emphasis set, for markers and labels */
  emphasis: Set<string>
}

const scratch = new Color()
const out = new Color()

/**
 * `reveal` (0–1) is the landing sequence's progressive disclosure. In the live
 * workstation it is always 1.
 */
export function useVisualTargets(reveal = 1, revealCluster: number | null = null): VisualTargets | null {
  const geometry = useGraphGeometry()
  const analysis = useNexus((s) => s.analysis)
  const selectedId = useNexus((s) => s.selectedId)
  const focus = useNexus((s) => s.focus)
  const highlight = useNexus((s) => s.highlight)
  const filters = useNexus((s) => s.filters)
  const density = useNexus((s) => s.density)
  const replay = useNexus((s) => s.replay)
  const replayTrack = useNexus((s) => s.replayTrack)
  const probe = useNexus((s) => s.probe)

  const trackIds = useMemo(() => new Set(replayTrack.map((t) => t.id)), [replayTrack])

  const replayActive = useMemo(() => {
    if (!replay.active) return null
    const ids = new Set<string>()
    for (let i = 0; i < Math.min(replay.cursor, replayTrack.length); i++) ids.add(replayTrack[i].id)
    return ids
  }, [replay.active, replay.cursor, replayTrack])

  return useMemo(() => {
    if (!geometry || !analysis) return null

    const nodes = new Map<EntityKind, { alpha: Float32Array; scale: Float32Array; color: Float32Array }>()
    const emphasis = new Set<string>()
    const alphaById = new Map<string, number>()
    const glowColor = new Float32Array(analysis.entities.length * 3)
    const glowSize = new Float32Array(analysis.entities.length)
    const glowIndex = new Map(analysis.entities.map((e, i) => [e.id, i]))
    const hasHighlight = !!highlight
    const hasSelection = !!selectedId

    // Deterministic reveal order: the sparse field fills from the centre out.
    const revealCut = reveal

    for (const buf of geometry.byKind) {
      const n = buf.entities.length
      const alpha = new Float32Array(n)
      const scale = new Float32Array(n)
      const color = new Float32Array(n * 3)

      for (let i = 0; i < n; i++) {
        const e = buf.entities[i]

        // --- gate: filters -------------------------------------------------
        let visible = filters.kinds[e.kind]
        if (visible && e.risk < filters.riskMin) visible = false
        if (visible && density === 'CLUSTERED' && e.kind === 'transaction' && e.importance < 0.35) {
          visible = false
        }
        if (visible && replayActive && e.kind === 'transaction') {
          if (trackIds.has(e.id) && !replayActive.has(e.id)) visible = false
        }
        // Landing reveal: nodes appear in index order scaled by progress.
        if (visible && revealCut < 1) {
          const gate = (i * 0.6180339887) % 1
          if (gate > revealCut) visible = false
          if (revealCluster !== null && e.cluster !== revealCluster && revealCut > 0.72) {
            // late acts pull attention to one cluster
            visible = gate < revealCut * 0.5
          }
        }

        let a: number = visible ? ALPHA.ambient : ALPHA.hidden
        let col = e.kind === 'wallet' ? riskColor(e.risk) : e.kind === 'ip' ? C.ip : C.transaction
        scratch.copy(col)

        if (visible) {
          if (e.kind === 'wallet') {
            a = ALPHA.ambient + Math.min(0.26, e.importance * 0.3)
          } else if (e.kind === 'transaction') {
            a = 0.3 + e.importance * 0.22
          } else {
            a = 0.34
          }

          if (hasHighlight) {
            if (highlight!.entities.has(e.id)) {
              a = ALPHA.focus
              scratch.lerp(C.accent, 0.55)
              emphasis.add(e.id)
            } else {
              a = ALPHA.dim
            }
          } else if (hasSelection) {
            const d = focus.depth.get(e.id)
            if (e.id === selectedId) {
              a = ALPHA.primary
              scratch.copy(C.accent)
              emphasis.add(e.id)
            } else if (d !== undefined) {
              a = d <= 1 ? ALPHA.focus : d <= 2 ? ALPHA.near : 0.4
              if (d <= 1) scratch.lerp(C.accent, 0.24)
            } else {
              a = ALPHA.dim
            }
          }

          if (probe.armed && !probe.found && e.kind === 'wallet' && probe.inspected.has(e.cluster)) {
            scratch.lerp(C.accent, 0.3)
          }

          if (replayActive?.has(e.id)) {
            a = Math.max(a, 0.9)
            scratch.lerp(C.accent, 0.5)
          }
        }

        fade(out, scratch, a)
        color[i * 3] = out.r
        color[i * 3 + 1] = out.g
        color[i * 3 + 2] = out.b
        alpha[i] = a
        const base =
          e.kind === 'wallet'
            ? NODE_SCALE.wallet(e.importance)
            : e.kind === 'transaction'
              ? NODE_SCALE.transaction(e.importance)
              : NODE_SCALE.ip()
        scale[i] = visible ? base * (e.id === selectedId ? 1.32 : emphasis.has(e.id) ? 1.14 : 1) : 0.0001
        alphaById.set(e.id, a)

        // The halo carries the emphasis: it grows with risk and with whether
        // the node is part of what the interface is currently claiming.
        const gi = glowIndex.get(e.id)!
        const heat = e.kind === 'wallet' ? Math.max(0, (e.risk - 45) / 55) : 0
        const lift =
          e.id === selectedId ? 1.15 : emphasis.has(e.id) ? 1.1 : 0.95 + heat * 1.45
        // Squared in alpha: a node the interface has pushed into the
        // background must stop glowing, or the field turns into a haze.
        const g = a * a * lift
        glowColor[gi * 3] = scratch.r * g
        glowColor[gi * 3 + 1] = scratch.g * g
        glowColor[gi * 3 + 2] = scratch.b * g
        glowSize[gi] = visible
          ? scale[i] * (3 + heat * 2 + (e.id === selectedId ? 0.6 : 0))
          : 0
      }

      nodes.set(buf.kind, { alpha, scale, color })
    }

    // --- edges -------------------------------------------------------------
    const ec = geometry.edgeBuffers.count
    const edgeAlpha = new Float32Array(ec)
    const edgeColor = new Float32Array(ec * 6)

    for (let i = 0; i < ec; i++) {
      const edge = analysis.edges[i]
      const sVis = alphaById.get(edge.source) ?? 0
      const tVis = alphaById.get(edge.target) ?? 0
      let visible = sVis > 0.001 && tVis > 0.001
      if (visible && edge.suspicious && edge.patterns.length) {
        visible = edge.patterns.some((p) => filters.patterns[p])
      }

      // An edge is never brighter than the dimmer of the two nodes it joins.
      const ceiling = Math.min(sVis, tVis)
      let a = visible ? Math.min(ceiling, edge.kind === 'network' ? 0.16 : 0.3) : 0
      scratch.copy(edge.kind === 'network' ? C.edgeNetwork : edge.suspicious ? C.edgeSuspicious : C.edge)

      if (visible) {
        if (hasHighlight) {
          if (highlight!.edges.has(edge.id)) {
            a = 1
            scratch.copy(C.edgeTraced)
          } else {
            a = 0.06
          }
        } else if (hasSelection) {
          if (focus.edges.has(edge.id)) {
            const d = Math.min(
              focus.depth.get(edge.source) ?? 9,
              focus.depth.get(edge.target) ?? 9,
            )
            a = d <= 1 ? 0.85 : d <= 2 ? 0.42 : 0.2
            if (d <= 1) scratch.lerp(C.accent, 0.5)
          } else {
            a = 0.05
          }
        }
        if (replayActive) {
          const txId = edge.id.startsWith('e-') ? edge.id.slice(2, -2) : ''
          if (replayActive.has(txId)) {
            a = 1
            scratch.copy(C.edgeTraced)
          }
        }
      }

      fade(out, scratch, a)
      for (let v = 0; v < 2; v++) {
        edgeColor[i * 6 + v * 3] = out.r
        edgeColor[i * 6 + v * 3 + 1] = out.g
        edgeColor[i * 6 + v * 3 + 2] = out.b
      }
      edgeAlpha[i] = a
    }

    return {
      nodes,
      glow: { color: glowColor, size: glowSize },
      edges: { alpha: edgeAlpha, color: edgeColor },
      emphasis,
    }
  }, [
    geometry,
    analysis,
    trackIds,
    selectedId,
    focus,
    highlight,
    filters,
    density,
    replayActive,
    replayTrack,
    probe,
    reveal,
    revealCluster,
  ])
}
