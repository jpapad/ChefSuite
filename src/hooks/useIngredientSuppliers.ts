import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  IngredientSupplier,
  IngredientSupplierInsert,
  IngredientSupplierUpdate,
} from '../types/database.types'

interface State {
  links: IngredientSupplier[]
  loading: boolean
  error: string | null
}

export function useIngredientSuppliers() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [state, setState] = useState<State>({ links: [], loading: true, error: null })

  const load = useCallback(async () => {
    if (!teamId) { setState({ links: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true, error: null }))

    const { data, error } = await supabase
      .from('ingredient_suppliers')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })

    if (error) {
      setState({ links: [], loading: false, error: error.message })
    } else {
      setState({ links: (data ?? []) as IngredientSupplier[], loading: false, error: null })
    }
  }, [teamId])

  useEffect(() => { void load() }, [load])

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const addLink = useCallback(
    async (payload: Omit<IngredientSupplierInsert, 'team_id'>): Promise<IngredientSupplier> => {
      if (!teamId) throw new Error('No team')
      const { data, error } = await supabase
        .from('ingredient_suppliers')
        .insert({ ...payload, team_id: teamId, price_updated_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      const created = data as IngredientSupplier
      setState((s) => ({ ...s, links: [...s.links, created] }))
      return created
    },
    [teamId],
  )

  const updateLink = useCallback(
    async (id: string, patch: IngredientSupplierUpdate): Promise<IngredientSupplier> => {
      const extra = patch.purchase_price != null ? { price_updated_at: new Date().toISOString() } : {}
      const { data, error } = await supabase
        .from('ingredient_suppliers')
        .update({ ...patch, ...extra })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      const updated = data as IngredientSupplier
      setState((s) => ({
        ...s,
        links: s.links.map((l) => (l.id === id ? updated : l)),
      }))
      return updated
    },
    [],
  )

  const removeLink = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('ingredient_suppliers').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, links: s.links.filter((l) => l.id !== id) }))
  }, [])

  // ── Derived helpers ──────────────────────────────────────────────────────────

  /** All links for a specific inventory item */
  const getLinksForItem = useCallback(
    (inventoryItemId: string) =>
      state.links.filter((l) => l.inventory_item_id === inventoryItemId),
    [state.links],
  )

  /** Preferred link for a specific inventory item, or undefined */
  const getPreferredLink = useCallback(
    (inventoryItemId: string) =>
      state.links.find((l) => l.inventory_item_id === inventoryItemId && l.is_preferred),
    [state.links],
  )

  return {
    ...state,
    reload: load,
    addLink,
    updateLink,
    removeLink,
    getLinksForItem,
    getPreferredLink,
  }
}
