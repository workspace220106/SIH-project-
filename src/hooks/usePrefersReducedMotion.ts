import { useEffect, useState } from 'react'
import { useNexus } from '@/state/store'

function systemPreference(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Motion follows the operating system by default. The analyst can override it
 * from the status bar, because a workstation configured for reduced motion is
 * still expected to run the replay and the landing sequence on request.
 */
export function usePrefersReducedMotion(): boolean {
  const preference = useNexus((s) => s.motion)
  const [system, setSystem] = useState(systemPreference)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setSystem(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (preference === 'full') return false
  if (preference === 'reduced') return true
  return system
}
