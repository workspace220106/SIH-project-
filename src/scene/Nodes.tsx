import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import type { EntityKind } from '@/types'
import { useNexus } from '@/state/store'
import type { KindBuffers, VisualTargets } from '@/scene/useVisuals'

const m4 = new Matrix4()
const pos = new Vector3()
const quat = new Quaternion()
const scaleV = new Vector3()
const col = new Color()

interface Props {
  buffers: KindBuffers
  targets: VisualTargets
  interactive: boolean
}

/**
 * One instanced draw call per entity kind. Colour and scale ease toward the
 * targets produced by `useVisualTargets`, which is what makes selection feel
 * like the field responding rather than the page re-rendering.
 */
export function InstancedNodes({ buffers, targets, interactive }: Props) {
  const meshRef = useRef<InstancedMesh>(null)
  const select = useNexus((s) => s.select)
  const hover = useNexus((s) => s.hover)

  const n = buffers.entities.length
  const current = useMemo(
    () => ({ scale: new Float32Array(n), color: new Float32Array(n * 3) }),
    [n],
  )

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.count = n
    for (let i = 0; i < n; i++) {
      pos.set(buffers.positions[i * 3], buffers.positions[i * 3 + 1], buffers.positions[i * 3 + 2])
      m4.compose(pos, quat, scaleV.setScalar(0.001))
      mesh.setMatrixAt(i, m4)
      mesh.setColorAt(i, col.setRGB(0, 0, 0))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [buffers, n])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = targets.nodes.get(buffers.kind)
    if (!t) return
    const k = Math.min(1, delta * 7.5)

    for (let i = 0; i < n; i++) {
      current.scale[i] += (t.scale[i] - current.scale[i]) * k
      const s = current.scale[i]
      pos.set(buffers.positions[i * 3], buffers.positions[i * 3 + 1], buffers.positions[i * 3 + 2])
      m4.compose(pos, quat, scaleV.setScalar(s))
      mesh.setMatrixAt(i, m4)

      const o = i * 3
      current.color[o] += (t.color[o] - current.color[o]) * k
      current.color[o + 1] += (t.color[o + 1] - current.color[o + 1]) * k
      current.color[o + 2] += (t.color[o + 2] - current.color[o + 2]) * k
      mesh.setColorAt(i, col.setRGB(current.color[o], current.color[o + 1], current.color[o + 2]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  })

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return
    e.stopPropagation()
    const id = e.instanceId
    if (id === undefined) return
    const entity = buffers.entities[id]
    const alpha = targets.nodes.get(buffers.kind)?.alpha[id] ?? 0
    hover(alpha > 0.02 ? entity.id : null)
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return
    e.stopPropagation()
    const id = e.instanceId
    if (id === undefined) return
    const alpha = targets.nodes.get(buffers.kind)?.alpha[id] ?? 0
    if (alpha <= 0.02) return
    select(buffers.entities[id].id, { fly: true })
  }

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, Math.max(1, n)]}
        onPointerMove={onMove}
        onPointerOut={() => interactive && hover(null)}
        onClick={onClick}
        frustumCulled={false}
      >
        <NodeGeometry kind={buffers.kind} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

function NodeGeometry({ kind }: { kind: EntityKind }) {
  // Wallets are the entities an analyst reasons about, so they get the
  // segments; transactions are numerous and tiny and never need them.
  if (kind === 'wallet') return <sphereGeometry args={[1, 18, 12]} />
  if (kind === 'ip') return <sphereGeometry args={[1, 12, 8]} />
  return <sphereGeometry args={[1, 8, 6]} />
}
