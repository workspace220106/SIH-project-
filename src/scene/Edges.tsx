import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, LineSegments } from 'three'
import type { EdgeBuffers, VisualTargets } from '@/scene/useVisuals'

interface Props {
  buffers: EdgeBuffers
  targets: VisualTargets
}

/**
 * All relationships in one draw call. Brightness is carried in vertex colour
 * rather than opacity so the lines can fade against the background without a
 * transparency sort.
 */
export function EdgeLayer({ buffers, targets }: Props) {
  const ref = useRef<LineSegments>(null)
  const current = useMemo(() => new Float32Array(buffers.count * 6), [buffers.count])

  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(buffers.positions, 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(buffers.count * 6), 3))
    return g
  }, [buffers])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const attr = geometry.getAttribute('color') as BufferAttribute
    const target = targets.edges.color
    const k = Math.min(1, delta * 6.5)
    const arr = attr.array as Float32Array
    for (let i = 0; i < arr.length; i++) {
      current[i] += (target[i] - current[i]) * k
      arr[i] = current[i]
    }
    attr.needsUpdate = true
  })

  return (
    <lineSegments ref={ref} geometry={geometry} frustumCulled={false} raycast={() => null}>
      <lineBasicMaterial vertexColors toneMapped={false} />
    </lineSegments>
  )
}
