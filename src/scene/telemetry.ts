import { useEffect, useState } from 'react'

/**
 * Camera readout. Deliberately kept outside React state — the HUD samples it
 * a few times a second instead of re-rendering on every frame.
 */
export const telemetry = {
  azimuth: 0,
  elevation: 0,
  distance: 0,
  fps: 0,
  drawn: 0,
}

export function useTelemetry(intervalMs = 140) {
  const [snapshot, setSnapshot] = useState(() => ({ ...telemetry }))
  useEffect(() => {
    const id = window.setInterval(() => setSnapshot({ ...telemetry }), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return snapshot
}
