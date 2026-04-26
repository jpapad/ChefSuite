import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { OnlineOrder, OnlineOrderItem, OnlineOrderUpdate, OnlineOrderWithItems } from '../types/database.types'

const ACTIVE_STATUSES = ['pending', 'preparing', 'ready']

export function useOnlineOrders() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [orders, setOrders] = useState<OnlineOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setOrders([]); setLoading(false); return }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('online_orders')
      .select('*, online_order_items(*)')
      .eq('team_id', teamId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at')
    if (err) { setError(err.message); setLoading(false); return }
    const rows = (data ?? []) as Array<OnlineOrder & { online_order_items: OnlineOrderItem[] }>
    setOrders(rows.map((r) => ({ ...r, items: r.online_order_items })))
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  // Real-time: reload on any change
  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`orders:${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'online_orders', filter: `team_id=eq.${teamId}` },
        () => { void load() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [teamId, load])

  const updateStatus = useCallback(async (id: string, patch: OnlineOrderUpdate) => {
    const { error: err } = await supabase
      .from('online_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err
    await load()
  }, [load])

  return { orders, loading, error, updateStatus, reload: load }
}

// Public: place an order (no auth)
export async function placeOrder(payload: {
  team_id: string
  menu_id: string
  table_ref: string | null
  customer_name: string | null
  customer_notes: string | null
  items: Array<{ menu_item_id: string | null; name: string; price: number | null; quantity: number; notes: string | null }>
}) {
  const { data: order, error: orderErr } = await supabase
    .from('online_orders')
    .insert({
      team_id: payload.team_id,
      menu_id: payload.menu_id,
      table_ref: payload.table_ref,
      customer_name: payload.customer_name,
      customer_notes: payload.customer_notes,
    })
    .select()
    .single()
  if (orderErr) throw orderErr

  const orderId = (order as OnlineOrder).id
  const { error: itemsErr } = await supabase.from('online_order_items').insert(
    payload.items.map((i) => ({ ...i, order_id: orderId })),
  )
  if (itemsErr) throw itemsErr

  return order as OnlineOrder
}
