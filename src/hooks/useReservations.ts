import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Reservation, ReservationInsert, ReservationUpdate } from '../types/database.types'

export function useReservations(date?: string) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setReservations([]); setLoading(false); return }
    setLoading(true)
    let q = supabase
      .from('reservations')
      .select('*')
      .eq('team_id', teamId)

    if (date) {
      q = q.eq('reservation_date', date)
    } else {
      // Upcoming: today and future, not cancelled/completed
      const today = new Date().toISOString().slice(0, 10)
      q = q.gte('reservation_date', today).not('status', 'in', '("completed","cancelled")')
    }

    q = q.order('reservation_date').order('reservation_time')
    const { data, error: err } = await q
    if (err) { setError(err.message); setLoading(false); return }
    setReservations((data as Reservation[]) ?? [])
    setLoading(false)
  }, [teamId, date])

  useEffect(() => { void load() }, [load])

  const update = useCallback(async (id: string, patch: ReservationUpdate) => {
    const { data, error: err } = await supabase
      .from('reservations')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    setReservations((prev) => prev.map((r) => r.id === id ? data as Reservation : r))
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('reservations').delete().eq('id', id)
    if (err) throw err
    setReservations((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { reservations, loading, error, update, remove, reload: load }
}

// Public insert — no auth
export async function submitReservation(payload: ReservationInsert) {
  const { data, error } = await supabase.from('reservations').insert(payload).select().single()
  if (error) throw error
  return data as Reservation
}
