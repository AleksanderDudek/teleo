import { useEffect, useLayoutEffect, useRef } from 'react'

/** Space toggles the microphone (spec §11), except while typing or on a focused control. */
export function useSpaceKey(handler: () => void): void {
  const latest = useRef(handler)
  useLayoutEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, button, dialog, [role="radio"]')) return
      event.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
