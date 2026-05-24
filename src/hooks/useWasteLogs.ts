import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { WasteLogInsert, WasteLogRow, WasteLogUpdate } from '../types/database.types'

const SELECT = '*, ingredient:ingredient_id(id, name, unit, cost_per_unit), menu_item:menu_item_id(id, name)'

interface State {
  entries: WasteLogRow[]
  loading: boolean
  error: string | null
}

export function useWasteLogs() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null
  const [state, setState] = useState<State>({ entries: [], loading: true, error: null })

  const load = useCallback(async () => {
    if (!teamId) { setState({ entries: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('waste_logs')
      .select(SELECT)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(300)
    setState({ entries: (data ?? []) as WasteLogRow[], loading: false, error: error?.message ?? null })
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const create = useCallback(async (
    payload: WasteLogInsert,
  ): Promise<WasteLogRow> => {
    if (!teamId) throw new Error('No team')
    const { data, error } = await supabase
      .from('waste_logs')
      .insert({ ...payload, team_id: teamId, user_id: userId })
      .select(SELECT)
      .single()
    if (error) throw error
    const row = data as WasteLogRow

    // Auto-create supplier credit for damaged goods
    if (payload.reason_code === 'supplier_damaged' && payload.supplier_id && payload.calculated_cost) {
      const description = row.ingredient?.name
        ? `Κατεστραμμένο από προμηθευτή: ${row.ingredient.name} (${payload.quantity} ${payload.unit})`
        : row.menu_item?.name
        ? `Κατεστραμμένο πιάτο από προμηθευτή: ${row.menu_item.name}`
        : `Κατεστραμμένα εμπορεύματα`
      await supabase.from('supplier_credits').insert({
        team_id:      teamId,
        supplier_id:  payload.supplier_id,
        waste_log_id: row.id,
        amount:       payload.calculated_cost,
        description,
        status:       'pending',
      })
    }

    setState((s) => ({ ...s, entries: [row, ...s.entries] }))
    return row
  }, [teamId, userId])

  const update = useCallback(async (id: string, patch: WasteLogUpdate): Promise<WasteLogRow> => {
    const { data, error } = await supabase
      .from('waste_logs')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()
    if (error) throw error
    const row = data as WasteLogRow
    setState((s) => ({ ...s, entries: s.entries.map((e) => e.id === id ? row : e) }))
    return row
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('waste_logs').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }))
  }, [])

  return { ...state, reload: load, create, update, remove }
}
