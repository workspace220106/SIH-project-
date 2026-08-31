import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Color } from 'three'
import { useNexus } from '@/state/store'

interface Props {
  children: ReactNode
  /** Deselect when the analyst clicks empty space. */
  clearOnMiss?: boolean
  className?: string
  /** Stops the render loop when the field is not on screen. */
  paused?: boolean
}

export function GraphCanvas({ children, clearOnMiss = true, className, paused }: Props) {
  const select = useNexus((s) => s.select)

  return (
    <Canvas
      className={className}
      dpr={[1, 1.75]}
      frameloop={paused ? 'never' : 'always'}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ position: [24, 74, 236], fov: 40, near: 0.5, far: 1200 }}
      onCreated={({ scene, gl }) => {
        scene.background = new Color('#FBFBFF')
        gl.setClearColor('#FBFBFF', 1)
      }}
      onPointerMissed={() => {
        if (clearOnMiss) select(null)
      }}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  )
}
