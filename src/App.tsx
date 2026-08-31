import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNexus } from '@/state/store'
import { useHotkeys } from '@/hooks/useHotkeys'
import { Boot } from '@/components/Boot'
import { TopRail } from '@/components/TopRail'
import { StatusBar } from '@/components/StatusBar'
import { GraphCanvas } from '@/scene/GraphCanvas'
import { GraphScene } from '@/scene/GraphScene'
import { useReplayDriver } from '@/hooks/useReplayDriver'
import { Landing } from '@/components/views/Landing'
import { Command } from '@/components/views/Command'
import { GraphWorkspace } from '@/components/views/GraphWorkspace'
import { AlertCentre } from '@/components/views/AlertCentre'
import { PatternLab } from '@/components/views/PatternLab'
import { Intake } from '@/components/views/Intake'

export default function App() {
  const ready = useNexus((s) => s.ready)
  const load = useNexus((s) => s.load)
  const view = useNexus((s) => s.view)
  const [booted, setBooted] = useState(false)
  useHotkeys()
  useReplayDriver()

  useEffect(() => {
    void load()
  }, [load])

  if (!booted || !ready) return <Boot onDone={() => setBooted(true)} />
  if (view === 'landing') return <Landing />

  const fieldVisible = view === 'command' || view === 'graph' || view === 'patterns'

  return (
    <div className="flex h-full flex-col bg-void">
      <TopRail />
      <main className="relative flex-1 overflow-hidden">
        {/* One field, mounted once. Views are overlays on top of it, so the
            camera keeps its position across a module change instead of the
            scene being torn down and rebuilt. */}
        <div className="absolute inset-0 isolate z-0">
          <GraphCanvas paused={!fieldVisible}>
            <GraphScene
              autoRotate={view === 'command'}
              showClusterLabels={view !== 'patterns'}
              overlays={fieldVisible}
            />
          </GraphCanvas>
        </div>

        {/* Views swap with a CSS fade rather than a JS-driven one: a module
            change must never be able to leave the workspace mid-transition. */}
        <div key={view} className="absolute inset-0 z-10 animate-fade-in">
          {view === 'command' && <Command />}
          {view === 'graph' && <GraphWorkspace />}
          {view === 'alerts' && <AlertCentre />}
          {view === 'patterns' && <PatternLab />}
          {view === 'intake' && <Intake />}
        </div>
        <TransitionNote />
      </main>
      <StatusBar />
    </div>
  )
}

/**
 * A transition should say where the analyst has been taken and why, then get
 * out of the way. Two seconds, one line, no dismissal needed.
 */
function TransitionNote() {
  const note = useNexus((s) => s.transitionNote)
  const view = useNexus((s) => s.view)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!note) return
    setVisible(true)
    const id = window.setTimeout(() => setVisible(false), 2000)
    return () => window.clearTimeout(id)
  }, [note, view])

  return (
    <AnimatePresence>
      {visible && note && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 border border-line-strong bg-void/92 px-3 py-1.5 backdrop-blur-sm"
        >
          <span className="font-mono text-3xs uppercase tracking-[0.2em] text-accent">{note}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
