import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { InventoryMovement } from '../types/database.types'

export function useInventoryMovements(itemId: string | null) {
  const { profile } = useAuth()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!itemId || !profile?.team_id) return
    setLoading(true)
    const { data } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(50)
    setMovements((data ?? []) as InventoryMovement[])
    setLoading(false)
  }, [itemId, profile?.team_id])

  useEffect(() => { void load() }, [load])

  const log = useCallback(async (
    delta: number,
    reason: string,
    teamId: string,
  ) => {
    if (!itemId || !profile?.team_id) return
    await supabase.from('inventory_movements').insert({
      item_id: itemId,
      team_id: teamId,
      delta,
      reason,
      user_id: profile.id,
    })
  }, [itemId, profile])

  return { movements, loading, reload: load, log }
}
