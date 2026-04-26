import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Workstation, WorkstationInsert, WorkstationUpdate } from '../types/database.types'

interface State {
  workstations: Workstation[]
  loading: boolean
  error: string | null
}

export function useWorkstations() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [state, setState] = useState<State>({ workstations: [], loading: true, error: null })

  const load = useCallback(async () => {
    if (!teamId) { setState({ workstations: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('workstations')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order', { ascending: true })
    setState({ workstations: (data ?? []) as Workstation[], loading: false, error: error?.message ?? null })
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const create = useCallback(async (name: string): Promise<Workstation> => {
    if (!teamId) throw new Error('No team')
    const maxOrder = state.workstations.reduce((m, w) => Math.max(m, w.sort_order), -1)
    const payload: WorkstationInsert = { name: name.trim(), sort_order: maxOrder + 1, team_id: teamId }
    const { data, error } = await supabase.from('workstations').insert(payload).select('*').single()
    if (error) throw error
    const row = data as Workstation
    setState((s) => ({ ...s, workstations: [...s.workstations, row] }))
    return row
  }, [teamId, state.workstations])

  const update = useCallback(async (id: string, patch: WorkstationUpdate): Promise<Workstation> => {
    const { data, error } = await supabase.from('workstations').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    const row = data as Workstation
    setState((s) => ({ ...s, workstations: s.workstations.map((w) => w.id === id ? row : w) }))
    return row
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('workstations').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, workstations: s.workstations.filter((w) => w.id !== id) }))
  }, [])

  return { ...state, reload: load, create, update, remove }
}
