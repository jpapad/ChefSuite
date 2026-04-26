import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TimeEntry, TimeEntryWithMember } from '../types/database.types'

async function fetchNameMap(teamId: string): Promise<Map<string, string | null>> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('team_id', teamId)
  const map = new Map<string, string | null>()
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
    map.set(p.id, p.full_name)
  }
  return map
}

export function useTimeclock(date: string) {
  const { profile, user } = useAuth()
  const teamId = profile?.team_id ?? null

  const [entries, setEntries] = useState<TimeEntryWithMember[]>([])
  const [nameMap, setNameMap] = useState<Map<string, string | null>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dayStart = `${date}T00:00:00`
  const dayEnd = `${date}T23:59:59`

  const load = useCallback(async () => {
    if (!teamId) { setEntries([]); setLoading(false); return }
    setLoading(true)
    const [{ data, error: err }, names] = await Promise.all([
      supabase
        .from('time_entries')
        .select('*')
        .eq('team_id', teamId)
        .gte('clock_in', dayStart)
        .lte('clock_in', dayEnd)
        .order('clock_in', { ascending: false }),
      fetchNameMap(teamId),
    ])
    if (err) { setError(err.message); setLoading(false); return }
    setNameMap(names)
    setEntries((data as TimeEntry[] ?? []).map((e) => ({ ...e, member_name: names.get(e.member_id) ?? null })))
    setLoading(false)
  }, [teamId, dayStart, dayEnd])

  useEffect(() => { void load() }, [load])

  const myOpenEntry = entries.find((e) => e.member_id === user?.id && !e.clock_out) ?? null

  const clockIn = useCallback(async (notes?: string) => {
    if (!teamId || !user) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('time_entries')
      .insert({ team_id: teamId, member_id: user.id, clock_in: new Date().toISOString(), notes: notes ?? null })
      .select('*')
      .single()
    if (err) throw err
    const entry = data as TimeEntry
    setEntries((prev) => [{ ...entry, member_name: nameMap.get(entry.member_id) ?? null }, ...prev])
  }, [teamId, user, nameMap])

  const clockOut = useCallback(async (entryId: string) => {
    const { data, error: err } = await supabase
      .from('time_entries')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', entryId)
      .select('*')
      .single()
    if (err) throw err
    const entry = data as TimeEntry
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...entry, member_name: nameMap.get(entry.member_id) ?? null } : e))
  }, [nameMap])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('time_entries').delete().eq('id', id)
    if (err) throw err
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { entries, loading, error, myOpenEntry, clockIn, clockOut, remove, reload: load }
}

export function durationMins(clockIn: string, clockOut: string | null): number {
  const end = clockOut ? new Date(clockOut) : new Date()
  return Math.max(0, Math.round((end.getTime() - new Date(clockIn).getTime()) / 60000))
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
