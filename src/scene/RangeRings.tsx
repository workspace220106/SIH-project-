import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'

/**
 * Spatial reference. Without a floor plane the graph has no sense of scale;
 * three dim rings and a pair of axis ticks give the eye something to measure
 * against without drawing attention to themselves.
 */
export function RangeRings({ radii = [46, 96, 158] }: { radii?: number[] }) {
  const geometry = useMemo(() => {
    const segments = 128
    const verts: number[] = []
    for (const r of radii) {
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2
        const a1 = ((i + 1) / segments) * Math.PI * 2
        verts.push(Math.cos(a0) * r, 0, Math.sin(a0) * r)
        verts.push(Math.cos(a1) * r, 0, Math.sin(a1) * r)
      }
    }
    const max = Math.max(...radii)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      verts.push(dx * (max + 4), 0, dz * (max + 4), dx * (max + 16), 0, dz * (max + 16))
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3))
    return g
  }, [radii])

  return (
    <lineSegments geometry={geometry} raycast={() => null} frustumCulled={false}>
      <lineBasicMaterial color="#14181B" toneMapped={false} transparent opacity={0.9} />
    </lineSegments>
  )
}
