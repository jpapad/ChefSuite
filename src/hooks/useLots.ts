import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { InventoryLot, LotUsage } from '../types/database.types'

export interface LotDraft {
  inventory_item_id: string
  lot_number: string | null
  expires_on: string | null
  quantity: number
  supplier_id: string | null
  purchase_order_id: string | null
  notes: string | null
}

export function useLots() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null
  const [lots, setLots] = useState<InventoryLot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setLots([]); setLoading(false); return }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('inventory_lots')
      .select('*')
      .eq('team_id', teamId)
      .order('received_at', { ascending: false })
      .limit(1000)
    setLots((data ?? []) as InventoryLot[])
    setError(err?.message ?? null)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  /** Record received lots. Stock is added separately by the caller when needed. */
  const receive = useCallback(async (drafts: LotDraft[]) => {
    if (!teamId) throw new Error('No team')
    const rows = drafts.filter((d) => d.quantity > 0).map((d) => ({
      team_id: teamId,
      inventory_item_id: d.inventory_item_id,
      lot_number: d.lot_number,
      expires_on: d.expires_on,
      quantity_received: d.quantity,
      quantity_remaining: d.quantity,
      supplier_id: d.supplier_id,
      purchase_order_id: d.purchase_order_id,
      notes: d.notes,
      created_by: userId,
    }))
    if (rows.length === 0) return
    const { error: err } = await supabase.from('inventory_lots').insert(rows)
    if (err) throw err
    await load()
  }, [teamId, userId, load])

  const setStatus = useCallback(async (lotId: string, status: InventoryLot['status']) => {
    const { error: err } = await supabase.from('inventory_lots').update({ status }).eq('id', lotId)
    if (err) throw err
    await load()
  }, [load])

  const recall = useCallback(async (lotId: string, removeStock: boolean) => {
    const { error: err } = await supabase.rpc('recall_lot', { p_lot_id: lotId, p_remove_stock: removeStock })
    if (err) throw err
    await load()
  }, [load])

  const usageFor = useCallback(async (lotIds: string[]): Promise<LotUsage[]> => {
    if (lotIds.length === 0) return []
    const { data, error: err } = await supabase
      .from('lot_usage')
      .select('*')
      .in('lot_id', lotIds)
      .order('used_at', { ascending: false })
    if (err) throw err
    return (data ?? []) as LotUsage[]
  }, [])

  return { lots, loading, error, reload: load, receive, setStatus, recall, usageFor }
}

/** Days until a lot expires (negative = expired); null without date. */
export function lotDaysLeft(expiresOn: string | null): number | null {
  if (!expiresOn) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(expiresOn + 'T00:00:00').getTime() - today.getTime()) / 86400000)
}
