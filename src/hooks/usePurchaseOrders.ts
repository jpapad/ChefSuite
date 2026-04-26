import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  PurchaseOrder,
  PurchaseOrderInsert,
  PurchaseOrderItem,
  PurchaseOrderItemInsert,
  PurchaseOrderUpdate,
  PurchaseOrderWithSupplier,
} from '../types/database.types'

type RawOrder = PurchaseOrder & { suppliers: { name: string } | null }

function toWithSupplier(r: RawOrder): PurchaseOrderWithSupplier {
  return { ...r, supplier_name: r.suppliers?.name ?? null }
}

export function usePurchaseOrders() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [orders, setOrders] = useState<PurchaseOrderWithSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setOrders([]); setLoading(false); return }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('purchase_orders')
      .select('*, suppliers:supplier_id(name)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setOrders((data as RawOrder[] ?? []).map(toWithSupplier))
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const create = useCallback(async (payload: Omit<PurchaseOrderInsert, 'team_id'>) => {
    if (!teamId) throw new Error('No team')
    const { data, error: err } = await supabase
      .from('purchase_orders')
      .insert({ ...payload, team_id: teamId })
      .select('*, suppliers:supplier_id(name)')
      .single()
    if (err) throw err
    const row = toWithSupplier(data as RawOrder)
    setOrders((prev) => [row, ...prev])
    return row
  }, [teamId])

  const update = useCallback(async (id: string, patch: PurchaseOrderUpdate) => {
    const { data, error: err } = await supabase
      .from('purchase_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, suppliers:supplier_id(name)')
      .single()
    if (err) throw err
    const row = toWithSupplier(data as RawOrder)
    setOrders((prev) => prev.map((o) => o.id === id ? row : o))
    return row
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (err) throw err
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }, [])

  return { orders, loading, error, create, update, remove, reload: load }
}

export function usePurchaseOrderItems(orderId: string | null) {
  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) { setItems([]); return }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at')
    if (!err) setItems((data as PurchaseOrderItem[]) ?? [])
    setLoading(false)
  }, [orderId])

  useEffect(() => { void load() }, [load])

  const addItem = useCallback(async (payload: Omit<PurchaseOrderItemInsert, 'order_id'>) => {
    if (!orderId) throw new Error('No order')
    const { data, error: err } = await supabase
      .from('purchase_order_items')
      .insert({ ...payload, order_id: orderId })
      .select()
      .single()
    if (err) throw err
    setItems((prev) => [...prev, data as PurchaseOrderItem])
  }, [orderId])

  const removeItem = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('purchase_order_items').delete().eq('id', id)
    if (err) throw err
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  return { items, loading, addItem, removeItem, reload: load }
}
