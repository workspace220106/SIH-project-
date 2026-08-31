import { useEffect } from 'react'
import { useNexus, type View } from '@/state/store'

const MODULE_KEYS: Record<string, View> = {
  '1': 'command',
  '2': 'graph',
  '3': 'alerts',
  '4': 'patterns',
  '5': 'intake',
}

/**
 * Keyboard is the primary interface for an analyst who works here all day.
 * Everything reachable by hover is reachable by key.
 */
export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const s = useNexus.getState()
      const key = e.key.toLowerCase()

      if (MODULE_KEYS[e.key]) {
        s.setView(MODULE_KEYS[e.key])
        return
      }

      switch (key) {
        case 'escape':
          if (s.highlight) s.setHighlight(null)
          else if (s.selectedId) s.select(null)
          else s.setView('command')
          break
        case 'e':
          s.expandSelection()
          break
        case 'w':
          if (s.selectedId) {
            s.setView('graph')
            s.setPanel('why')
          }
          break
        case 't':
          if (s.selectedId) {
            s.setView('graph')
            s.setPanel('trace')
          }
          break
        case 'r':
          s.setView('graph')
          s.setPanel('replay')
          break
        case 'i':
          s.setPanel('intel')
          break
        case ' ':
          if (s.replay.active) {
            e.preventDefault()
            s.setReplay({ playing: !s.replay.playing })
          }
          break
        case 'f':
          if (s.selectedId) {
            const ent = s.analysis?.index.entityById.get(s.selectedId)
            if (ent) s.flyTo([ent.x, ent.y, ent.z], 30)
          }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
