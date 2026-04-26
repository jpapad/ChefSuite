import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { WasteEntry, WasteEntryInsert, WasteEntryUpdate } from '../types/database.types'

interface State {
  entries: WasteEntry[]
  loading: boolean
  error: string | null
}

export function useWasteLog() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null
  const [state, setState] = useState<State>({ entries: [], loading: true, error: null })

  const load = useCallback(async () => {
    if (!teamId) { setState({ entries: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('waste_entries')
      .select('*')
      .eq('team_id', teamId)
      .order('wasted_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    setState({ entries: (data ?? []) as WasteEntry[], loading: false, error: error?.message ?? null })
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const create = useCallback(async (payload: Omit<WasteEntryInsert, 'team_id' | 'recorded_by'>): Promise<WasteEntry> => {
    if (!teamId) throw new Error('No team')
    const { data, error } = await supabase
      .from('waste_entries')
      .insert({ ...payload, team_id: teamId, recorded_by: userId })
      .select('*')
      .single()
    if (error) throw error
    const row = data as WasteEntry
    setState((s) => ({ ...s, entries: [row, ...s.entries] }))
    return row
  }, [teamId, userId])

  const update = useCallback(async (id: string, patch: WasteEntryUpdate): Promise<WasteEntry> => {
    const { data, error } = await supabase.from('waste_entries').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    const row = data as WasteEntry
    setState((s) => ({ ...s, entries: s.entries.map((e) => e.id === id ? row : e) }))
    return row
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('waste_entries').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }))
  }, [])

  return { ...state, reload: load, create, update, remove }
}
