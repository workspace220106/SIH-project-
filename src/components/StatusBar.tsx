import { useNexus } from '@/state/store'
import { shortAddr } from '@/lib/graph'

/** Three facts and one control. Anything more competes with the graph. */
export function StatusBar() {
  const analysis = useNexus((s) => s.analysis)
  const selectedId = useNexus((s) => s.selectedId)
  const focus = useNexus((s) => s.focus)
  const entity = selectedId ? analysis?.index.entityById.get(selectedId) : null

  return (
    <footer className="z-30 flex h-[26px] shrink-0 items-center gap-4 overflow-hidden border-t border-line bg-surface px-4 font-mono text-3xs uppercase tracking-[0.14em] text-black">
      <span className="shrink-0 tabular-nums text-black font-semibold">
        {analysis?.entities.length ?? 0} nodes · {analysis?.edges.length ?? 0} links
      </span>
      <span className="truncate">
        {entity ? (
          <>
            <span className="text-accent font-semibold">
              {entity.kind === 'wallet' ? shortAddr(entity.label) : entity.label}
            </span>
            <span className="text-black"> · {focus.entities.size} in view</span>
          </>
        ) : (
          <span className="text-black">no selection</span>
        )}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-4">
        <MotionControl />
        <span className="text-black font-medium">OFFLINE ENVIRONMENT</span>
      </span>
    </footer>
  )
}

function MotionControl() {
  const motion = useNexus((s) => s.motion)
  const setMotion = useNexus((s) => s.setMotion)
  const next = { system: 'full', full: 'reduced', reduced: 'system' } as const
  return (
    <button
      type="button"
      onClick={() => setMotion(next[motion])}
      className="flex items-center gap-1.5 hover:opacity-80"
      title="Cycle motion preference"
    >
      <span className="text-black font-semibold">motion</span>
      <span className="text-accent font-bold uppercase">{motion}</span>
    </button>
  )
}
