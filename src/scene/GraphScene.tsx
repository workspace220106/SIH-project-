import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useNexus } from '@/state/store'
import { useGraphGeometry, useVisualTargets } from '@/scene/useVisuals'
import { InstancedNodes } from '@/scene/Nodes'
import { EdgeLayer } from '@/scene/Edges'
import { FlowParticles } from '@/scene/Particles'
import { HaloLayer } from '@/scene/Halo'
import { Dust } from '@/scene/Dust'
import { CameraRig } from '@/scene/CameraRig'
import { RangeRings } from '@/scene/RangeRings'
import { shortAddr } from '@/lib/graph'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface Props {
  /** 0–1 progressive disclosure, used by the landing sequence. */
  reveal?: number
  revealCluster?: number | null
  interactive?: boolean
  showRings?: boolean
  showClusterLabels?: boolean
  autoRotate?: boolean
  /** DOM overlays are skipped when the field is hidden behind a document view. */
  overlays?: boolean
}

export function GraphScene({
  reveal = 1,
  revealCluster = null,
  interactive = true,
  showRings = true,
  showClusterLabels = true,
  autoRotate = false,
  overlays = true,
}: Props) {
  const geometry = useGraphGeometry()
  const targets = useVisualTargets(reveal, revealCluster)
  const reduced = usePrefersReducedMotion()

  if (!geometry || !targets) return null

  return (
    <>
      <CameraRig enabled={interactive} autoRotate={autoRotate && !reduced} />
      <fog attach="fog" args={['#FBFBFF', 110, 430]} />
      <Dust />
      {showRings && <RangeRings />}

      <EdgeLayer buffers={geometry.edgeBuffers} targets={targets} />
      {geometry.byKind.map((buf) => (
        <InstancedNodes key={buf.kind} buffers={buf} targets={targets} interactive={interactive} />
      ))}
      <HaloLayer positions={geometry.allPositions} targets={targets} />
      <FlowParticles buffers={geometry.edgeBuffers} targets={targets} still={reduced} />

      {overlays && showClusterLabels && <ClusterLabels interactive={interactive} />}
      {overlays && interactive && <SelectionMarker />}
      {overlays && interactive && <HoverMarker />}
    </>
  )
}

function ClusterLabels({ interactive }: { interactive: boolean }) {
  const clusters = useNexus((s) => s.analysis?.clusters ?? [])
  const probe = useNexus((s) => s.probe)
  const inspectCluster = useNexus((s) => s.inspectCluster)
  const flyTo = useNexus((s) => s.flyTo)

  return (
    <>
      {clusters.map((c) => (
        <Html
          key={c.id}
          position={c.centroid}
          center
          zIndexRange={[20, 10]}
          style={{ pointerEvents: interactive ? 'auto' : 'none' }}
        >
          <button
            type="button"
            disabled={!interactive}
            // The label sits inside the canvas container, so without this the
            // click also registers as a miss and clears the selection.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              inspectCluster(c.id)
              flyTo(c.centroid, 130)
            }}
            className="group -translate-y-10 whitespace-nowrap px-1 text-left"
          >
            <span className="block font-mono text-3xs uppercase tracking-[0.18em] text-faint transition-colors group-hover:text-accent">
              {c.label}
            </span>
            <span className="mt-[2px] block font-mono text-3xs text-ghost transition-colors group-hover:text-muted">
              {c.size} nodes · risk {c.risk}
              {probe.armed && probe.inspected.has(c.id) ? ' · inspected' : ''}
            </span>
          </button>
        </Html>
      ))}
    </>
  )
}

function SelectionMarker() {
  const selectedId = useNexus((s) => s.selectedId)
  const analysis = useNexus((s) => s.analysis)
  const entity = selectedId ? analysis?.index.entityById.get(selectedId) : null
  const label = useMemo(() => {
    if (!entity) return ''
    return entity.kind === 'wallet' ? shortAddr(entity.label) : entity.label
  }, [entity])

  if (!entity) return null

  return (
    <Html position={[entity.x, entity.y, entity.z]} center zIndexRange={[40, 30]}>
      <div className="pointer-events-none relative h-[74px] w-[74px]">
        <Corner className="left-0 top-0 border-l border-t" />
        <Corner className="right-0 top-0 border-r border-t" />
        <Corner className="bottom-0 left-0 border-b border-l" />
        <Corner className="bottom-0 right-0 border-b border-r" />
        <div className="absolute left-[82px] top-1/2 -translate-y-1/2 whitespace-nowrap">
          <div className="h-px w-5 bg-accent/60" />
          <div className="mt-1 font-mono text-2xs uppercase tracking-[0.16em] text-accent">
            {label}
          </div>
          <div className="font-mono text-3xs text-muted">
            {entity.kind.toUpperCase()} · RISK {entity.risk}
          </div>
        </div>
      </div>
    </Html>
  )
}

function Corner({ className }: { className: string }) {
  return <div className={'absolute h-3 w-3 border-accent ' + className} />
}

function HoverMarker() {
  const hoverId = useNexus((s) => s.hoverId)
  const selectedId = useNexus((s) => s.selectedId)
  const analysis = useNexus((s) => s.analysis)
  const entity = hoverId && hoverId !== selectedId ? analysis?.index.entityById.get(hoverId) : null
  if (!entity) return null

  return (
    <Html position={[entity.x, entity.y, entity.z]} zIndexRange={[35, 25]}>
      <div className="pointer-events-none translate-x-4 -translate-y-6 whitespace-nowrap border border-line-strong bg-void/90 px-2 py-1 backdrop-blur-sm">
        <div className="font-mono text-3xs uppercase tracking-[0.14em] text-muted">
          {entity.kind}
        </div>
        <div className="font-mono text-2xs text-ink">
          {entity.kind === 'wallet' ? shortAddr(entity.label) : entity.label}
        </div>
        <div className="font-mono text-3xs text-faint">
          risk {entity.risk}
          {entity.amount !== undefined ? ' · ' + entity.amount.toFixed(4) + ' BTC' : ''}
        </div>
      </div>
    </Html>
  )
}
