import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { PrepTaskStep } from '../types/database.types'

export function usePrepTaskSteps(taskIds: string[]) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [steps, setSteps] = useState<PrepTaskStep[]>([])
  const taskIdsKey = taskIds.slice().sort().join(',')
  const taskIdsRef = useRef(taskIds)
  taskIdsRef.current = taskIds

  const load = useCallback(async () => {
    if (!teamId || taskIdsRef.current.length === 0) { setSteps([]); return }
    const { data } = await supabase
      .from('prep_task_steps')
      .select('*')
      .in('task_id', taskIdsRef.current)
      .order('position')
    setSteps((data ?? []) as PrepTaskStep[])
  }, [teamId, taskIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!teamId) return
    const ch = supabase
      .channel(`prep_steps:${teamId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'prep_task_steps',
        filter: `team_id=eq.${teamId}`,
      }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [teamId, load])

  const toggle = useCallback(async (stepId: string, done: boolean) => {
    setSteps((s) => s.map((st) => st.id === stepId ? { ...st, done } : st))
    await supabase.from('prep_task_steps').update({ done }).eq('id', stepId)
  }, [])

  const createSteps = useCallback(async (taskId: string, titles: string[]) => {
    if (!teamId || titles.length === 0) return
    const rows = titles.map((title, i) => ({ task_id: taskId, team_id: teamId, title, position: i }))
    const { data } = await supabase.from('prep_task_steps').insert(rows).select('*')
    setSteps((s) => [...s, ...((data ?? []) as PrepTaskStep[])])
  }, [teamId])

  const replaceSteps = useCallback(async (taskId: string, titles: string[]) => {
    if (!teamId) return
    await supabase.from('prep_task_steps').delete().eq('task_id', taskId)
    setSteps((s) => s.filter((st) => st.task_id !== taskId))
    if (titles.length === 0) return
    const rows = titles.map((title, i) => ({ task_id: taskId, team_id: teamId, title, position: i }))
    const { data } = await supabase.from('prep_task_steps').insert(rows).select('*')
    setSteps((s) => [...s, ...((data ?? []) as PrepTaskStep[])])
  }, [teamId])

  const stepsByTaskId = useMemo(() => {
    const map = new Map<string, PrepTaskStep[]>()
    for (const step of steps) {
      if (!map.has(step.task_id)) map.set(step.task_id, [])
      map.get(step.task_id)!.push(step)
    }
    return map
  }, [steps])

  return { steps, stepsByTaskId, toggle, createSteps, replaceSteps, reload: load }
}
