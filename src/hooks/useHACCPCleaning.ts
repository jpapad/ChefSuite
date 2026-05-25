import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  HACCPCleaningTask, HACCPCleaningTaskInsert,
  HACCPCleaningLogWithUser,
} from '../types/database.types'

function weekStartIso(dateIso: string): string {
  const d = new Date(dateIso)
  const day = d.getDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function useHACCPCleaning(dateIso: string) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null

  const [tasks, setTasks]           = useState<HACCPCleaningTask[]>([])
  const [logs, setLogs]             = useState<HACCPCleaningLogWithUser[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingLogs, setLoadingLogs]   = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    if (!teamId) { setTasks([]); setLoadingTasks(false); return }
    const { data, error: err } = await supabase
      .from('haccp_cleaning_tasks')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order')
      .order('task_name')
    setTasks((data ?? []) as HACCPCleaningTask[])
    if (err) setError(err.message)
    setLoadingTasks(false)
  }, [teamId])

  const loadLogs = useCallback(async () => {
    if (!teamId) { setLogs([]); setLoadingLogs(false); return }
    setLoadingLogs(true)
    // Fetch logs from week start to today (covers daily + weekly)
    const weekStart = weekStartIso(dateIso)
    const { data, error: err } = await supabase
      .from('haccp_cleaning_logs')
      .select('*, profiles:user_id(full_name)')
      .eq('team_id', teamId)
      .gte('logged_date', weekStart)
      .lte('logged_date', dateIso)
      .order('logged_date', { ascending: false })
    type Row = { id: string; team_id: string; task_id: string; user_id: string | null; logged_date: string; created_at: string; profiles: { full_name: string | null } | null }
    const rows = (data ?? []) as Row[]
    setLogs(rows.map((r) => ({ ...r, user_name: r.profiles?.full_name ?? null })))
    if (err) setError(err.message)
    setLoadingLogs(false)
  }, [teamId, dateIso])

  useEffect(() => { void loadTasks() }, [loadTasks])
  useEffect(() => { void loadLogs() }, [loadLogs])

  const logTask = useCallback(async (taskId: string): Promise<HACCPCleaningLogWithUser> => {
    if (!teamId) throw new Error('No team')
    const { data, error: err } = await supabase
      .from('haccp_cleaning_logs')
      .insert({ team_id: teamId, task_id: taskId, user_id: userId, logged_date: dateIso })
      .select('*, profiles:user_id(full_name)')
      .single()
    if (err) throw err
    type Row = { id: string; team_id: string; task_id: string; user_id: string | null; logged_date: string; created_at: string; profiles: { full_name: string | null } | null }
    const r = data as Row
    const row: HACCPCleaningLogWithUser = { ...r, user_name: r.profiles?.full_name ?? null }
    setLogs((prev) => [row, ...prev])
    return row
  }, [teamId, userId, dateIso])

  const unlogTask = useCallback(async (logId: string) => {
    const { error: err } = await supabase.from('haccp_cleaning_logs').delete().eq('id', logId)
    if (err) throw err
    setLogs((prev) => prev.filter((l) => l.id !== logId))
  }, [])

  const createTask = useCallback(async (insert: HACCPCleaningTaskInsert): Promise<HACCPCleaningTask> => {
    if (!teamId) throw new Error('No team')
    const { data, error: err } = await supabase
      .from('haccp_cleaning_tasks')
      .insert({ ...insert, team_id: teamId })
      .select('*')
      .single()
    if (err) throw err
    const row = data as HACCPCleaningTask
    setTasks((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order || a.task_name.localeCompare(b.task_name)))
    return row
  }, [teamId])

  const deleteTask = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('haccp_cleaning_tasks').delete().eq('id', id)
    if (err) throw err
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // isDoneToday: true if logged on exactly dateIso
  const getDoneLog = (taskId: string): HACCPCleaningLogWithUser | undefined =>
    logs.find((l) => l.task_id === taskId && l.logged_date === dateIso)

  // isDoneThisWeek: for weekly tasks — any log within week
  const getDoneWeekLog = (taskId: string): HACCPCleaningLogWithUser | undefined =>
    logs.find((l) => l.task_id === taskId)

  const isDone = (task: HACCPCleaningTask): boolean => {
    if (task.frequency === 'daily')  return !!getDoneLog(task.id)
    if (task.frequency === 'weekly') return !!getDoneWeekLog(task.id)
    return false
  }

  return {
    tasks, logs, loadingTasks, loadingLogs, error,
    reloadTasks: loadTasks, reloadLogs: loadLogs,
    logTask, unlogTask,
    createTask, deleteTask,
    getDoneLog, getDoneWeekLog, isDone,
  }
}
