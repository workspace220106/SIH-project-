import { useEffect } from 'react'
import { useNexus } from '@/state/store'

const BASE_INTERVAL = 620

/**
 * Advances the replay cursor and walks the camera along the path. Lives above
 * the panel so playback keeps running when the analyst switches to another tab
 * of the dock.
 */
export function useReplayDriver() {
  const replay = useNexus((s) => s.replay)
  const track = useNexus((s) => s.replayTrack)

  useEffect(() => {
    if (!replay.active || !replay.playing || !track.length) return
    const id = window.setInterval(() => {
      const s = useNexus.getState()
      const next = s.replay.cursor + 1
      if (next > track.length) {
        s.setReplay({ playing: false })
        return
      }
      s.setReplay({ cursor: next })

      // Follow, but only slowly enough to be readable.
      if (s.replay.speed <= 2) {
        const tx = track[next - 1]
        const entity = tx ? s.analysis?.index.entityById.get(tx.id) : null
        if (entity) s.flyTo([entity.x, entity.y, entity.z], 46)
      }
    }, BASE_INTERVAL / replay.speed)
    return () => window.clearInterval(id)
  }, [replay.active, replay.playing, replay.speed, track])
}
