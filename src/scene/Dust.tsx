import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry } from 'three'
import { mulberry32 } from '@/lib/rng'

/**
 * Distant dust. It carries no data. Its only job is parallax, so the field
 * reads as a volume you are inside rather than a flat plot. Seeded, so it is
 * the same on every machine.
 */
export function Dust({ count = 900, inner = 240, outer = 620 }) {
  const geometry = useMemo(() => {
    const r = mulberry32(4211)
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Uniform on a spherical shell.
      const u = r() * 2 - 1
      const theta = r() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const radius = inner + r() * (outer - inner)
      pos[i * 3] = Math.cos(theta) * s * radius
      pos[i * 3 + 1] = u * radius * 0.55
      pos[i * 3 + 2] = Math.sin(theta) * s * radius
      const v = 0.035 + r() * 0.075
      col[i * 3] = v
      col[i * 3 + 1] = v * 1.04
      col[i * 3 + 2] = v * 1.18
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('color', new BufferAttribute(col, 3))
    return g
  }, [count, inner, outer])

  return (
    <points geometry={geometry} frustumCulled={false} raycast={() => null} renderOrder={0}>
      <pointsMaterial
        size={1.5}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        fog={false}
        toneMapped={false}
      />
    </points>
  )
}
