import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { InventoryItem, InventoryInsert, InventoryUpdate } from '../types/database.types'

interface InventoryContextValue {
  items: InventoryItem[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (payload: Omit<InventoryInsert, 'team_id'>) => Promise<InventoryItem>
  update: (id: string, patch: InventoryUpdate, movementReason?: string) => Promise<InventoryItem>
  remove: (id: string) => Promise<void>
}

export function isLowStock(item: InventoryItem): boolean {
  return item.quantity <= item.min_stock_level
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setItems([]); setLoading(false); return }
    setLoading(true); setError(null)
    const { data, error: err } = await supabase
      .from('inventory').select('*').order('name', { ascending: true })
    setItems((data ?? []) as InventoryItem[])
    setError(err?.message ?? null)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`inventory:${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `team_id=eq.${teamId}` },
        (payload) => {
          setItems((s) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as InventoryItem
              if (s.some((i) => i.id === row.id)) return s
              return [...s, row].sort((a, b) => a.name.localeCompare(b.name))
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as InventoryItem
              return s.map((i) => (i.id === row.id ? row : i)).sort((a, b) => a.name.localeCompare(b.name))
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id?: string }
              return old.id ? s.filter((i) => i.id !== old.id) : s
            }
            return s
          })
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [teamId])

  const create = useCallback(async (payload: Omit<InventoryInsert, 'team_id'>) => {
    if (!teamId) throw new Error('No team')
    const { data, error: err } = await supabase.from('inventory')
      .insert({ ...payload, team_id: teamId }).select('*').single()
    if (err) throw err
    const row = data as InventoryItem
    setItems((s) => [...s, row].sort((a, b) => a.name.localeCompare(b.name)))
    return row
  }, [teamId])

  const update = useCallback(async (id: string, patch: InventoryUpdate, movementReason?: string) => {
    const { data, error: err } = await supabase.from('inventory')
      .update(patch).eq('id', id).select('*').single()
    if (err) throw err
    const row = data as InventoryItem
    setItems((s) => {
      const prev = s.find((i) => i.id === id)
      if (prev && patch.quantity != null && patch.quantity !== prev.quantity && teamId) {
        void supabase.from('inventory_movements').insert({
          item_id: id,
          team_id: teamId,
          delta: patch.quantity - prev.quantity,
          reason: movementReason ?? 'manual',
          user_id: null,
        })
      }
      return s.map((i) => (i.id === id ? row : i)).sort((a, b) => a.name.localeCompare(b.name))
    })
    return row
  }, [teamId])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('inventory').delete().eq('id', id)
    if (err) throw err
    setItems((s) => s.filter((i) => i.id !== id))
  }, [])

  const value = useMemo<InventoryContextValue>(
    () => ({ items, loading, error, reload: load, create, update, remove }),
    [items, loading, error, load, create, update, remove],
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used inside <InventoryProvider>')
  return ctx
}
