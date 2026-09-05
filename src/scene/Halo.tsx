import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Vector3,
} from 'three'
import type { VisualTargets } from '@/scene/useVisuals'

const m4 = new Matrix4()
const pos = new Vector3()
const scaleV = new Vector3()
const col = new Color()

/** Radial falloff: a tight core inside a wide, soft corona. */
function makeHaloTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.75)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.38)')
  g.addColorStop(0.75, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * The glow around every node. Camera-facing quads, one draw call for the field.
 */
export function HaloLayer({
  positions,
  targets,
}: {
  positions: Float32Array
  targets: VisualTargets
}) {
  const ref = useRef<InstancedMesh>(null)
  const camera = useThree((s) => s.camera)
  const count = positions.length / 3
  const current = useMemo(
    () => ({ color: new Float32Array(count * 3), size: new Float32Array(count) }),
    [count],
  )
  const texture = useMemo(makeHaloTexture, [])

  useEffect(() => () => texture.dispose(), [texture])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    for (let i = 0; i < count; i++) {
      m4.identity()
      mesh.setMatrixAt(i, m4)
      mesh.setColorAt(i, col.setRGB(0, 0, 0))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [count])

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const k = Math.min(1, delta * 6)

    for (let i = 0; i < count; i++) {
      current.size[i] += (targets.glow.size[i] - current.size[i]) * k
      pos.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      // Face the camera. The quad is the halo, so it must never foreshorten.
      m4.compose(pos, camera.quaternion, scaleV.setScalar(current.size[i]))
      mesh.setMatrixAt(i, m4)

      const o = i * 3
      current.color[o] += (targets.glow.color[o] - current.color[o]) * k
      current.color[o + 1] += (targets.glow.color[o + 1] - current.color[o + 1]) * k
      current.color[o + 2] += (targets.glow.color[o + 2] - current.color[o + 2]) * k
      mesh.setColorAt(i, col.setRGB(current.color[o], current.color[o + 1], current.color[o + 2]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(1, count)]}
      frustumCulled={false}
      raycast={() => null}
      renderOrder={1}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </instancedMesh>
  )
}
