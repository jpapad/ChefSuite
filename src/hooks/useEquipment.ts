import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Equipment, EquipmentDraft, EquipmentLog, EquipmentLogDraft } from '../types/database.types'

/** Next service date (ISO yyyy-mm-dd) from last service / purchase + interval. */
export function nextServiceOn(e: Pick<Equipment, 'service_interval_days' | 'last_service_on' | 'purchased_on'>): string | null {
  const base = e.last_service_on ?? e.purchased_on
  if (!e.service_interval_days || !base) return null
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + e.service_interval_days)
  return d.toISOString().slice(0, 10)
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86400000)
}

export function useEquipment() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [logs, setLogs] = useState<EquipmentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setEquipment([]); setLogs([]); setLoading(false); return }
    setLoading(true)
    const [eq, lg] = await Promise.all([
      supabase.from('equipment').select('*').eq('team_id', teamId).order('name'),
      supabase.from('equipment_logs').select('*').eq('team_id', teamId).order('performed_on', { ascending: false }).order('created_at', { ascending: false }).limit(500),
    ])
    setEquipment((eq.data ?? []) as Equipment[])
    setLogs((lg.data ?? []) as EquipmentLog[])
    setError(eq.error?.message ?? lg.error?.message ?? null)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const saveEquipment = useCallback(async (draft: EquipmentDraft, id?: string) => {
    if (!teamId) throw new Error('No team')
    const { error: err } = id
      ? await supabase.from('equipment').update(draft).eq('id', id)
      : await supabase.from('equipment').insert({ ...draft, team_id: teamId })
    if (err) throw err
    await load()
  }, [teamId, load])

  const removeEquipment = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('equipment').delete().eq('id', id)
    if (err) throw err
    await load()
  }, [load])

  const addLog = useCallback(async (draft: EquipmentLogDraft) => {
    if (!teamId) throw new Error('No team')
    const { error: err } = await supabase.from('equipment_logs').insert({
      ...draft, team_id: teamId, created_by: userId, resolved_at: draft.resolved ? new Date().toISOString() : null,
    })
    if (err) throw err
    await load()
  }, [teamId, userId, load])

  const resolveLog = useCallback(async (log: EquipmentLog) => {
    const { error: err } = await supabase.from('equipment_logs').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', log.id)
    if (err) throw err
    // Back to OK when this was the last open issue
    const stillOpen = logs.some((l) => l.id !== log.id && l.equipment_id === log.equipment_id && !l.resolved)
    if (!stillOpen) await supabase.from('equipment').update({ status: 'ok' }).eq('id', log.equipment_id).eq('status', 'attention')
    await load()
  }, [logs, load])

  const setStatus = useCallback(async (id: string, status: Equipment['status']) => {
    const { error: err } = await supabase.from('equipment').update({ status }).eq('id', id)
    if (err) throw err
    await load()
  }, [load])

  return { equipment, logs, loading, error, reload: load, saveEquipment, removeEquipment, addLog, resolveLog, setStatus }
}
