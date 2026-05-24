import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { OrderWatchlistInsert } from '../types/database.types'

// ── Joined type (hook-local) ───────────────────────────────────────────────

export interface WatchlistEntry {
  id: string
  team_id: string
  ingredient_id: string
  supplier_id: string | null
  requested_quantity: number
  notes: string | null
  created_at: string
  ingredient_name: string
  ingredient_unit: string
  supplier_name: string | null
}

type RawEntry = {
  id: string; team_id: string; ingredient_id: string; supplier_id: string | null
  requested_quantity: number; notes: string | null; created_at: string
  inventory: { name: string; unit: string } | null
  suppliers: { name: string } | null
}

function toEntry(r: RawEntry): WatchlistEntry {
  return {
    id: r.id, team_id: r.team_id,
    ingredient_id: r.ingredient_id,
    supplier_id: r.supplier_id,
    requested_quantity: r.requested_quantity,
    notes: r.notes,
    created_at: r.created_at,
    ingredient_name: r.inventory?.name ?? '—',
    ingredient_unit: r.inventory?.unit ?? '',
    supplier_name: r.suppliers?.name ?? null,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrderWatchlist() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!teamId) { setEntries([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('order_watchlist')
      .select('*, inventory:ingredient_id(name, unit), suppliers:supplier_id(name)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
    if (!error) setEntries(((data ?? []) as RawEntry[]).map(toEntry))
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const addItem = useCallback(
    async (payload: OrderWatchlistInsert): Promise<WatchlistEntry> => {
      if (!teamId) throw new Error('No team')
      const { data, error } = await supabase
        .from('order_watchlist')
        .insert({ ...payload, team_id: teamId })
        .select('*, inventory:ingredient_id(name, unit), suppliers:supplier_id(name)')
        .single()
      if (error) throw error
      const entry = toEntry(data as RawEntry)
      setEntries((prev) => [entry, ...prev])
      return entry
    },
    [teamId],
  )

  const removeItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('order_watchlist').delete().eq('id', id)
    if (error) throw error
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const bulkRemove = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const { error } = await supabase.from('order_watchlist').delete().in('id', ids)
    if (error) throw error
    setEntries((prev) => prev.filter((e) => !ids.includes(e.id)))
  }, [])

  /** All watchlist entries for a specific supplier */
  const getItemsForSupplier = useCallback(
    (supplierId: string) => entries.filter((e) => e.supplier_id === supplierId),
    [entries],
  )

  return {
    entries,
    loading,
    reload: load,
    addItem,
    removeItem,
    bulkRemove,
    getItemsForSupplier,
    total: entries.length,
  }
}
