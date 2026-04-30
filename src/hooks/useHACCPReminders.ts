import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { HACCPReminderWithAssignee, HACCPReminderInsert, HACCPReminderUpdate } from '../types/database.types'

interface State {
  reminders: HACCPReminderWithAssignee[]
  loading: boolean
  error: string | null
}

export function useHACCPReminders() {
  const { profile } = useAuth()
  const [state, setState] = useState<State>({ reminders: [], loading: false, error: null })

  const load = useCallback(async () => {
    if (!profile?.team_id) return
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('haccp_reminders')
      .select('*, assignee:assignee_id(full_name)')
      .eq('team_id', profile.team_id)
      .order('next_due', { ascending: true })
    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }))
      return
    }
    const reminders: HACCPReminderWithAssignee[] = (data ?? []).map((row) => ({
      id: row.id,
      team_id: row.team_id,
      location: row.location,
      label: row.label,
      frequency_h: row.frequency_h,
      next_due: row.next_due,
      assignee_id: row.assignee_id,
      active: row.active,
      created_at: row.created_at,
      assignee_name: (row.assignee as { full_name?: string } | null)?.full_name ?? null,
    }))
    setState({ reminders, loading: false, error: null })
  }, [profile?.team_id])

  useEffect(() => { void load() }, [load])

  const createReminder = useCallback(async (insert: Omit<HACCPReminderInsert, 'team_id'>) => {
    if (!profile?.team_id) return
    const { data, error } = await supabase
      .from('haccp_reminders')
      .insert({ ...insert, team_id: profile.team_id })
      .select('*, assignee:assignee_id(full_name)')
      .single()
    if (error) throw error
    const r: HACCPReminderWithAssignee = {
      ...data,
      assignee_name: (data.assignee as { full_name?: string } | null)?.full_name ?? null,
    }
    setState((s) => ({ ...s, reminders: [...s.reminders, r].sort((a, b) => a.next_due.localeCompare(b.next_due)) }))
  }, [profile?.team_id])

  const updateReminder = useCallback(async (id: string, upd: HACCPReminderUpdate) => {
    const { data, error } = await supabase
      .from('haccp_reminders')
      .update(upd)
      .eq('id', id)
      .select('*, assignee:assignee_id(full_name)')
      .single()
    if (error) throw error
    const updated: HACCPReminderWithAssignee = {
      ...data,
      assignee_name: (data.assignee as { full_name?: string } | null)?.full_name ?? null,
    }
    setState((s) => ({
      ...s,
      reminders: s.reminders
        .map((r) => r.id === id ? updated : r)
        .sort((a, b) => a.next_due.localeCompare(b.next_due)),
    }))
  }, [])

  const deleteReminder = useCallback(async (id: string) => {
    const { error } = await supabase.from('haccp_reminders').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }))
  }, [])

  const markChecked = useCallback(async (id: string, frequencyH: number) => {
    const nextDue = new Date(Date.now() + frequencyH * 3600 * 1000).toISOString()
    await updateReminder(id, { next_due: nextDue })
  }, [updateReminder])

  return { ...state, createReminder, updateReminder, deleteReminder, markChecked, reload: load }
}
