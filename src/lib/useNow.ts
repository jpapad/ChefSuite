import { useEffect, useState } from 'react'

/** Current time in ms, refreshed every `intervalMs` (for live timers). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Seconds → "MM:SS" (minutes keep counting past 59). */
export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Seconds → "H:MM:SS" from an hour up, otherwise "MM:SS" (for countdowns). */
export function countdown(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s < 3600) return mmss(s)
  const h = Math.floor(s / 3600)
  return `${h}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
