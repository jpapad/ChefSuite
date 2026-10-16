import { useCallback, useState } from 'react'

const KEY = 'chefsuite_duotone'

function read() {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

/** Per-device preference: show dish photos in black/orange duotone (default on). */
export function useDuotone(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(read)
  const set = useCallback((next: boolean) => {
    setOn(next)
    try { localStorage.setItem(KEY, next ? 'on' : 'off') } catch { /* private mode */ }
  }, [])
  return [on, set]
}
