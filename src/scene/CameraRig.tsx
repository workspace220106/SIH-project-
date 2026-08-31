import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useNexus } from '@/state/store'
import { telemetry } from '@/scene/telemetry'

const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)

interface Props {
  enabled?: boolean
  autoRotate?: boolean
  /** Seconds a fly-to takes. Short enough to stay responsive, long enough to read. */
  duration?: number
}

/**
 * Orbit control plus a scripted fly-to. Every camera move in the product is a
 * response to a decision the analyst made, so the rig only ever animates when
 * the store publishes a new fly command.
 */
export function CameraRig({ enabled = true, autoRotate = false, duration = 1.05 }: Props) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const fly = useNexus((s) => s.fly)

  const anim = useRef<{
    t: number
    from: Vector3
    to: Vector3
    fromTarget: Vector3
    toTarget: Vector3
  } | null>(null)

  useEffect(() => {
    if (!fly || !controls.current) return
    const target = new Vector3(...fly.position)
    const offset = camera.position.clone().sub(controls.current.target)
    if (offset.lengthSq() < 1) offset.set(0, 0.4, 1)
    offset.normalize().multiplyScalar(fly.distance)
    // Approach slightly above the plane; a level approach reads as a slide.
    offset.y = Math.max(offset.y, fly.distance * 0.16)
    anim.current = {
      t: 0,
      from: camera.position.clone(),
      to: target.clone().add(offset),
      fromTarget: controls.current.target.clone(),
      toTarget: target,
    }
  }, [fly, camera])

  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return

    if (anim.current) {
      anim.current.t = Math.min(1, anim.current.t + delta / duration)
      const e = easeOutQuint(anim.current.t)
      camera.position.lerpVectors(anim.current.from, anim.current.to, e)
      c.target.lerpVectors(anim.current.fromTarget, anim.current.toTarget, e)
      c.update()
      if (anim.current.t >= 1) anim.current = null
    }

    const offset = camera.position.clone().sub(c.target)
    telemetry.distance = offset.length()
    telemetry.azimuth = (Math.atan2(offset.x, offset.z) * 180) / Math.PI
    telemetry.elevation = (Math.asin(offset.y / (telemetry.distance || 1)) * 180) / Math.PI
    telemetry.fps = telemetry.fps * 0.9 + (1 / Math.max(delta, 0.0001)) * 0.1
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={enabled}
      enablePan
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.55}
      panSpeed={0.7}
      zoomSpeed={0.7}
      minDistance={12}
      maxDistance={420}
      autoRotate={autoRotate}
      autoRotateSpeed={0.22}
    />
  )
}
