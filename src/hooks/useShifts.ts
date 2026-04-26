import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Shift, ShiftInsert, ShiftUpdate } from '../types/database.types'

interface State {
  shifts: Shift[]
  loading: boolean
  error: string | null
}

export function useShifts(weekStart: string) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [state, setState] = useState<State>({ shifts: [], loading: true, error: null })

  const load = useCallback(async () => {
    if (!teamId) { setState({ shifts: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true, error: null }))
    // Fetch the 7 days of the week
    const end = shiftWeekEnd(weekStart)
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('team_id', teamId)
      .gte('shift_date', weekStart)
      .lte('shift_date', end)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true })
    setState({ shifts: (data ?? []) as Shift[], loading: false, error: error?.message ?? null })
  }, [teamId, weekStart])

  useEffect(() => { void load() }, [load])

  const create = useCallback(async (payload: Omit<ShiftInsert, 'team_id'>): Promise<Shift> => {
    if (!teamId) throw new Error('No team')
    const { data, error } = await supabase
      .from('shifts').insert({ ...payload, team_id: teamId }).select('*').single()
    if (error) throw error
    const row = data as Shift
    setState((s) => ({ ...s, shifts: [...s.shifts, row].sort(sortShifts) }))
    return row
  }, [teamId])

  const update = useCallback(async (id: string, patch: ShiftUpdate): Promise<Shift> => {
    const { data, error } = await supabase.from('shifts').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    const row = data as Shift
    setState((s) => ({ ...s, shifts: s.shifts.map((sh) => sh.id === id ? row : sh).sort(sortShifts) }))
    return row
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('shifts').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, shifts: s.shifts.filter((sh) => sh.id !== id) }))
  }, [])

  return { ...state, reload: load, create, update, remove }
}

function sortShifts(a: Shift, b: Shift): number {
  if (a.shift_date !== b.shift_date) return a.shift_date.localeCompare(b.shift_date)
  return a.start_time.localeCompare(b.start_time)
}

export function getWeekStart(iso?: string): string {
  const d = iso ? new Date(iso + 'T00:00:00') : new Date()
  const day = d.getDay() // 0=Sun
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

export function shiftWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
