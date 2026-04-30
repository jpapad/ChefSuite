import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { HACCPCheck, HACCPCheckInsert, HACCPCheckWithChecker, HACCPLocation } from '../types/database.types'

export function isPass(check: HACCPCheck): boolean {
  return check.temperature >= check.min_temp && check.temperature <= check.max_temp
}

export function useHACCP(dateIso?: string) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [checks, setChecks] = useState<HACCPCheckWithChecker[]>([])
  const [locations, setLocations] = useState<HACCPLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadChecks = useCallback(async () => {
    if (!teamId) { setChecks([]); setLoading(false); return }
    setLoading(true)
    let query = supabase
      .from('haccp_checks')
      .select('*, profiles:checked_by(full_name)')
      .order('created_at', { ascending: false })

    if (dateIso) {
      query = query
        .gte('created_at', `${dateIso}T00:00:00`)
        .lte('created_at', `${dateIso}T23:59:59`)
    }

    const { data, error: err } = await query
    type Row = HACCPCheck & { profiles: { full_name: string | null } | null }
    const rows = (data ?? []) as Row[]
    setChecks(rows.map<HACCPCheckWithChecker>((r) => ({ ...r, checked_by_name: r.profiles?.full_name ?? null })))
    setError(err?.message ?? null)
    setLoading(false)
  }, [teamId, dateIso])

  const loadLocations = useCallback(async () => {
    if (!teamId) return
    const { data } = await supabase
      .from('haccp_locations')
      .select('*')
      .order('name', { ascending: true })
    setLocations((data ?? []) as HACCPLocation[])
  }, [teamId])

  useEffect(() => { void loadChecks() }, [loadChecks])
  useEffect(() => { void loadLocations() }, [loadLocations])

  const logCheck = useCallback(async (payload: Omit<HACCPCheckInsert, 'team_id' | 'checked_by'>) => {
    if (!teamId || !profile) throw new Error('No team')
    const { data, error: err } = await supabase
      .from('haccp_checks')
      .insert({ ...payload, team_id: teamId, checked_by: profile.id })
      .select('*')
      .single()
    if (err) throw err
    const row: HACCPCheckWithChecker = { ...(data as HACCPCheck), checked_by_name: profile.full_name ?? null }
    setChecks((s) => [row, ...s])
    return row
  }, [teamId, profile])

  const deleteCheck = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('haccp_checks').delete().eq('id', id)
    if (err) throw err
    setChecks((s) => s.filter((c) => c.id !== id))
  }, [])

  const saveLocation = useCallback(async (
    name: string, minTemp: number, maxTemp: number, unit: 'C' | 'F',
  ) => {
    if (!teamId) throw new Error('No team')
    const { data, error: err } = await supabase
      .from('haccp_locations')
      .insert({ team_id: teamId, name, min_temp: minTemp, max_temp: maxTemp, unit })
      .select('*')
      .single()
    if (err) throw err
    const row = data as HACCPLocation
    setLocations((s) => [...s, row].sort((a, b) => a.name.localeCompare(b.name)))
    return row
  }, [teamId])

  const deleteLocation = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('haccp_locations').delete().eq('id', id)
    if (err) throw err
    setLocations((s) => s.filter((l) => l.id !== id))
  }, [])

  return {
    checks, locations, loading, error,
    reload: loadChecks,
    logCheck, deleteCheck,
    saveLocation, deleteLocation,
  }
}
