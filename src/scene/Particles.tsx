import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points } from 'three'
import { useNexus } from '@/state/store'
import type { EdgeBuffers, VisualTargets } from '@/scene/useVisuals'

const MAX = 240

interface Props {
  buffers: EdgeBuffers
  targets: VisualTargets
  /** Motion is suppressed when the analyst has asked for reduced motion. */
  still?: boolean
}

/**
 * Value in transit. Particles only run on edges that are currently making a
 * claim — a highlighted evidence set, an active trace, or the replay cursor —
 * so movement in the scene always means something.
 */
export function FlowParticles({ buffers, targets, still }: Props) {
  const ref = useRef<Points>(null)
  const analysis = useNexus((s) => s.analysis)
  const highlight = useNexus((s) => s.highlight)
  const replay = useNexus((s) => s.replay)

  const active = useMemo(() => {
    if (!analysis) return [] as number[]
    // An edge only carries particles when it is actually drawn — during the
    // landing reveal and under filters, most of them are not.
    const lit = (i: number) => targets.edges.alpha[i] > 0.4
    if (highlight && highlight.edges.size) {
      const indexOf = new Map(analysis.edges.map((e, i) => [e.id, i]))
      return [...highlight.edges]
        .map((id) => indexOf.get(id))
        .filter((i): i is number => i !== undefined && lit(i))
        .slice(0, MAX)
    }
    if (replay.active) return []
    return analysis.edges
      .map((e, i) => (e.suspicious && e.kind === 'flow' && lit(i) ? i : -1))
      .filter((i) => i >= 0)
      .slice(0, MAX)
  }, [analysis, highlight, replay.active, targets])

  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX * 3), 3))
    g.setDrawRange(0, 0)
    return g
  }, [])

  const phases = useMemo(() => {
    const p = new Float32Array(MAX)
    for (let i = 0; i < MAX; i++) p[i] = (i * 0.37) % 1
    return p
  }, [])

  useFrame((_, delta) => {
    const attr = geometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    const count = active.length
    geometry.setDrawRange(0, count)
    if (!count) {
      attr.needsUpdate = true
      return
    }
    const step = still ? 0 : delta * 0.34
    for (let i = 0; i < count; i++) {
      phases[i] = (phases[i] + step) % 1
      const e = active[i] * 6
      const t = phases[i]
      arr[i * 3] = buffers.positions[e] + (buffers.positions[e + 3] - buffers.positions[e]) * t
      arr[i * 3 + 1] =
        buffers.positions[e + 1] + (buffers.positions[e + 4] - buffers.positions[e + 1]) * t
      arr[i * 3 + 2] =
        buffers.positions[e + 2] + (buffers.positions[e + 5] - buffers.positions[e + 2]) * t
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false} raycast={() => null}>
      <pointsMaterial
        size={1.5}
        sizeAttenuation
        color="#2B59C3"
        transparent
        opacity={0.9}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}
