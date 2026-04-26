import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Supplier, SupplierInsert, SupplierUpdate } from '../types/database.types'

interface State {
  suppliers: Supplier[]
  loading: boolean
  error: string | null
}

export function useSuppliers() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [state, setState] = useState<State>({ suppliers: [], loading: true, error: null })

  const load = useCallback(async () => {
    if (!teamId) { setState({ suppliers: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('team_id', teamId)
      .order('name', { ascending: true })
    setState({ suppliers: (data ?? []) as Supplier[], loading: false, error: error?.message ?? null })
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const create = useCallback(async (payload: Omit<SupplierInsert, 'team_id'>): Promise<Supplier> => {
    if (!teamId) throw new Error('No team')
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ ...payload, team_id: teamId })
      .select('*')
      .single()
    if (error) throw error
    const row = data as Supplier
    setState((s) => ({ ...s, suppliers: [...s.suppliers, row].sort((a, b) => a.name.localeCompare(b.name)) }))
    return row
  }, [teamId])

  const update = useCallback(async (id: string, patch: SupplierUpdate): Promise<Supplier> => {
    const { data, error } = await supabase.from('suppliers').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    const row = data as Supplier
    setState((s) => ({ ...s, suppliers: s.suppliers.map((sup) => sup.id === id ? row : sup) }))
    return row
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, suppliers: s.suppliers.filter((sup) => sup.id !== id) }))
  }, [])

  return { ...state, reload: load, create, update, remove }
}
