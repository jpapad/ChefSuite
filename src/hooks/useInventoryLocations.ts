import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { InventoryLocation } from '../types/database.types'

export function useInventoryLocations() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [locations, setLocations] = useState<InventoryLocation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!teamId) { setLocations([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('inventory_locations')
      .select('*')
      .order('name', { ascending: true })
    setLocations((data ?? []) as InventoryLocation[])
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const create = useCallback(async (name: string) => {
    if (!teamId) throw new Error('No team')
    const { data, error } = await supabase
      .from('inventory_locations')
      .insert({ team_id: teamId, name: name.trim() })
      .select('*')
      .single()
    if (error) throw error
    const row = data as InventoryLocation
    setLocations((s) => [...s, row].sort((a, b) => a.name.localeCompare(b.name)))
    return row
  }, [teamId])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('inventory_locations').delete().eq('id', id)
    if (error) throw error
    setLocations((s) => s.filter((l) => l.id !== id))
  }, [])

  return { locations, loading, create, remove, reload: load }
}
