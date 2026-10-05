import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { CateringEvent, CateringEventDraft, EventItem, EventItemDraft } from '../types/database.types'

export function useEvents() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null
  const [events, setEvents] = useState<CateringEvent[]>([])
  const [items, setItems] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setEvents([]); setItems([]); setLoading(false); return }
    setLoading(true)
    const [e, i] = await Promise.all([
      supabase.from('events').select('*').eq('team_id', teamId).order('event_date', { ascending: true, nullsFirst: false }),
      supabase.from('event_items').select('*').eq('team_id', teamId).order('sort_order'),
    ])
    setEvents((e.data ?? []) as CateringEvent[])
    setItems((i.data ?? []) as EventItem[])
    setError(e.error?.message ?? i.error?.message ?? null)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const saveEvent = useCallback(async (draft: CateringEventDraft, id?: string): Promise<string> => {
    if (!teamId) throw new Error('No team')
    if (id) {
      const { error: err } = await supabase.from('events').update({ ...draft, updated_at: new Date().toISOString() }).eq('id', id)
      if (err) throw err
      await load()
      return id
    }
    const { data, error: err } = await supabase.from('events').insert({ ...draft, team_id: teamId, created_by: userId }).select('id').single()
    if (err) throw err
    await load()
    return (data as { id: string }).id
  }, [teamId, userId, load])

  const patchEvent = useCallback(async (id: string, patch: Partial<CateringEventDraft>) => {
    const { error: err } = await supabase.from('events').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) throw err
    setEvents((es) => es.map((e) => e.id === id ? { ...e, ...patch } : e))
  }, [])

  const removeEvent = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('events').delete().eq('id', id)
    if (err) throw err
    await load()
  }, [load])

  /** Replace the event's menu. */
  const saveItems = useCallback(async (eventId: string, drafts: EventItemDraft[]) => {
    if (!teamId) throw new Error('No team')
    const { error: delErr } = await supabase.from('event_items').delete().eq('event_id', eventId)
    if (delErr) throw delErr
    if (drafts.length > 0) {
      const { error: err } = await supabase.from('event_items').insert(
        drafts.map((d, i) => ({ ...d, team_id: teamId, event_id: eventId, sort_order: i })),
      )
      if (err) throw err
    }
    await load()
  }, [teamId, load])

  const itemsOf = useCallback((eventId: string) => items.filter((i) => i.event_id === eventId), [items])

  return { events, items, loading, error, reload: load, saveEvent, patchEvent, removeEvent, saveItems, itemsOf }
}
