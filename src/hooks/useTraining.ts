import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TrainingCompletion, TrainingModule, TrainingModuleDraft } from '../types/database.types'

export function useTraining() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null
  const [modules, setModules] = useState<TrainingModule[]>([])
  const [completions, setCompletions] = useState<TrainingCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setModules([]); setCompletions([]); setLoading(false); return }
    setLoading(true)
    const [m, c] = await Promise.all([
      supabase.from('training_modules').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('training_completions').select('*').eq('team_id', teamId).order('completed_at', { ascending: false }),
    ])
    setModules((m.data ?? []) as TrainingModule[])
    setCompletions((c.data ?? []) as TrainingCompletion[])
    setError(m.error?.message ?? c.error?.message ?? null)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const saveModule = useCallback(async (draft: TrainingModuleDraft, id?: string) => {
    if (!teamId) throw new Error('No team')
    const { error: err } = id
      ? await supabase.from('training_modules').update({ ...draft, updated_at: new Date().toISOString() }).eq('id', id)
      : await supabase.from('training_modules').insert({ ...draft, team_id: teamId, created_by: userId })
    if (err) throw err
    await load()
  }, [teamId, userId, load])

  const removeModule = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('training_modules').delete().eq('id', id)
    if (err) throw err
    await load()
  }, [load])

  const complete = useCallback(async (moduleId: string, result: { score: number | null; passed: boolean; answers: number[] | null }) => {
    if (!teamId || !userId) throw new Error('No team')
    const { error: err } = await supabase.from('training_completions').insert({ ...result, module_id: moduleId, team_id: teamId, user_id: userId })
    if (err) throw err
    await load()
  }, [teamId, userId, load])

  /** Best result of a person on a module (passed beats failed, then higher score). */
  const bestOf = useCallback((moduleId: string, uid: string) => {
    return completions
      .filter((c) => c.module_id === moduleId && c.user_id === uid)
      .sort((a, b) => Number(b.passed) - Number(a.passed) || (b.score ?? 100) - (a.score ?? 100))[0]
  }, [completions])

  return { modules, completions, loading, error, reload: load, saveModule, removeModule, complete, bestOf }
}
