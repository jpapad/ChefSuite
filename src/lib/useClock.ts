import { useEffect, useState } from 'react'

function format(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "HH:MM" that stays current; re-renders at most every 15 s. */
export function useClock() {
  const [time, setTime] = useState(() => format(new Date()))
  useEffect(() => {
    const id = setInterval(() => setTime(format(new Date())), 15_000)
    return () => clearInterval(id)
  }, [])
  return time
}

/** Service label for the current hour: morning, lunch or evening. */
export function shiftKey(d = new Date()): 'shiftMorning' | 'shiftLunch' | 'shiftEvening' {
  const h = d.getHours()
  return h < 11 ? 'shiftMorning' : h < 17 ? 'shiftLunch' : 'shiftEvening'
}
