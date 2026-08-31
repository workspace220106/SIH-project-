import { useNexus } from '@/state/store'
import { shortAddr } from '@/lib/graph'

/** Three facts and one control. Anything more competes with the graph. */
export function StatusBar() {
  const analysis = useNexus((s) => s.analysis)
  const selectedId = useNexus((s) => s.selectedId)
  const focus = useNexus((s) => s.focus)
  const entity = selectedId ? analysis?.index.entityById.get(selectedId) : null

  return (
    <footer className="z-30 flex h-[24px] shrink-0 items-center gap-4 overflow-hidden border-t border-line bg-[#0A0C0D] px-4 font-mono text-3xs uppercase tracking-[0.14em] text-faint">
      <span className="shrink-0 tabular-nums text-muted">
        {analysis?.entities.length ?? 0} nodes · {analysis?.edges.length ?? 0} links
      </span>
      <span className="truncate">
        {entity ? (
          <>
            <span className="text-accent">
              {entity.kind === 'wallet' ? shortAddr(entity.label) : entity.label}
            </span>
            <span className="text-ghost"> · {focus.entities.size} in view</span>
          </>
        ) : (
          <span className="text-ghost">no selection</span>
        )}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-4">
        <MotionControl />
        <span className="text-ghost">NTRO · PS 26146</span>
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
      className="flex items-center gap-1.5 hover:text-muted"
      title="Cycle motion preference"
    >
      <span className="text-ghost">motion</span>
      <span className="text-muted">{motion}</span>
    </button>
  )
}
