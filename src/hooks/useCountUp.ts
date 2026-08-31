import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Counts a numeric readout toward its new value. Risk scores change because
 * evidence changed, so the transition is the point — it should be visible but
 * never slow enough to make the analyst wait.
 */
export function useCountUp(value: number, durationMs = 720, decimals = 0): string {
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const origin = from.current
    const delta = value - origin
    if (Math.abs(delta) < 0.0001) {
      setDisplay(value)
      return
    }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 4)
      setDisplay(origin + delta * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = value
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, durationMs, reduced])

  useEffect(() => {
    from.current = display
  }, [display])

  return display.toFixed(decimals)
}
