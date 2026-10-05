import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useInventory } from './useInventory'
import { useSuppliers } from './useSuppliers'
import { useIngredientSuppliers } from './useIngredientSuppliers'
import { buildOrderSuggestions } from '../lib/autoOrder'

/** Average daily usage (last 30 days of stock movements) → order suggestions per supplier. */
export function useOrderSuggestions() {
  const { profile } = useAuth()
  const { items } = useInventory()
  const { suppliers } = useSuppliers()
  const { links } = useIngredientSuppliers()
  const [avgDaily, setAvgDaily] = useState<Map<string, number> | null>(null)

  useEffect(() => {
    if (!profile?.team_id) return
    const since = new Date(); since.setDate(since.getDate() - 29)
    void supabase
      .from('inventory_movements')
      .select('item_id, delta')
      .lt('delta', 0)
      .gte('created_at', since.toISOString())
      .then(({ data }) => {
        const map = new Map<string, number>()
        for (const r of (data ?? []) as { item_id: string; delta: number }[]) {
          map.set(r.item_id, (map.get(r.item_id) ?? 0) + Math.abs(r.delta) / 30)
        }
        setAvgDaily(map)
      })
  }, [profile?.team_id])

  const suggestions = useMemo(
    () => (avgDaily ? buildOrderSuggestions(items, suppliers, links, avgDaily) : []),
    [items, suppliers, links, avgDaily],
  )

  return { suggestions, loading: avgDaily === null }
}
