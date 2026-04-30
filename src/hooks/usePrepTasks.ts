import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  PrepTask,
  PrepTaskInsert,
  PrepTaskStatus,
  PrepTaskUpdate,
} from '../types/database.types'

const STATUS_CYCLE: Record<PrepTaskStatus, PrepTaskStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'pending',
}

interface State {
  tasks: PrepTask[]
  loading: boolean
  error: string | null
}

export function usePrepTasks(prepFor: string) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null
  const [state, setState] = useState<State>({
    tasks: [],
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!teamId) {
      setState({ tasks: [], loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('prep_tasks')
      .select('*')
      .eq('prep_for', prepFor)
      .order('created_at', { ascending: true })
    setState({
      tasks: (data ?? []) as PrepTask[],
      loading: false,
      error: error?.message ?? null,
    })
  }, [teamId, prepFor])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`prep_tasks:${teamId}:${prepFor}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prep_tasks',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          setState((s) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as PrepTask
              if (row.prep_for !== prepFor) return s
              if (s.tasks.some((t) => t.id === row.id)) return s
              return { ...s, tasks: [...s.tasks, row] }
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as PrepTask
              const exists = s.tasks.some((t) => t.id === row.id)
              if (row.prep_for !== prepFor) {
                return exists
                  ? { ...s, tasks: s.tasks.filter((t) => t.id !== row.id) }
                  : s
              }
              if (!exists) return { ...s, tasks: [...s.tasks, row] }
              return {
                ...s,
                tasks: s.tasks.map((t) => (t.id === row.id ? row : t)),
              }
            }
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as { id?: string }
              if (!oldRow.id) return s
              return {
                ...s,
                tasks: s.tasks.filter((t) => t.id !== oldRow.id),
              }
            }
            return s
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [teamId, prepFor])

  const create = useCallback(
    async (
      payload: Omit<PrepTaskInsert, 'team_id' | 'created_by'>,
    ) => {
      if (!teamId || !userId) throw new Error('No team')
      const { data, error } = await supabase
        .from('prep_tasks')
        .insert({ ...payload, team_id: teamId, created_by: userId })
        .select('*')
        .single()
      if (error) throw error
      const row = data as PrepTask
      if (row.prep_for === prepFor) {
        setState((s) =>
          s.tasks.some((t) => t.id === row.id)
            ? s
            : { ...s, tasks: [...s.tasks, row] },
        )
      }
      return row
    },
    [teamId, userId, prepFor],
  )

  const update = useCallback(async (id: string, patch: PrepTaskUpdate) => {
    const { data, error } = await supabase
      .from('prep_tasks')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    const row = data as PrepTask
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? row : t)),
    }))
    return row
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('prep_tasks').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
  }, [])

  const removeMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const { error } = await supabase.from('prep_tasks').delete().in('id', ids)
    if (error) throw error
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => !ids.includes(t.id)) }))
  }, [])

  const cycleStatus = useCallback(
    async (task: PrepTask) => {
      const nextStatus = STATUS_CYCLE[task.status]
      const nextDoneAt =
        nextStatus === 'done' ? new Date().toISOString() : null
      return update(task.id, { status: nextStatus, done_at: nextDoneAt })
    },
    [update],
  )

  // Legacy toggle for backward-compat (used from MenuDetail prep generation)
  const toggleDone = useCallback(
    async (task: PrepTask) => {
      const nextDoneAt = task.done_at ? null : new Date().toISOString()
      const nextStatus: PrepTaskStatus = nextDoneAt ? 'done' : 'pending'
      return update(task.id, { done_at: nextDoneAt, status: nextStatus })
    },
    [update],
  )

  return { ...state, reload: load, create, update, remove, removeMany, cycleStatus, toggleDone }
}
