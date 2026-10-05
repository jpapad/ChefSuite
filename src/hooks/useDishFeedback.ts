import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { DishFeedback } from '../types/database.types'

export interface DishRating {
  key: string
  menu_item_id: string | null
  recipe_id: string | null
  name: string
  count: number
  avg: number
  dist: [number, number, number, number, number]
  comments: number
}

/** Guest ratings from the QR menu for the last `days` days, with per-dish stats. */
export function useDishFeedback(days = 30) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [feedback, setFeedback] = useState<DishFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) { setFeedback([]); setLoading(false); return }
    setLoading(true)
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data, error: err } = await supabase
      .from('dish_feedback')
      .select('*')
      .eq('team_id', teamId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000)
    setFeedback((data ?? []) as DishFeedback[])
    setError(err?.message ?? null)
    setLoading(false)
  }, [teamId, days])

  useEffect(() => { void load() }, [load])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('dish_feedback').delete().eq('id', id)
    if (err) throw err
    setFeedback((f) => f.filter((x) => x.id !== id))
  }, [])

  const byDish = useMemo(() => {
    const map = new Map<string, DishRating>()
    for (const f of feedback) {
      const key = f.menu_item_id ?? f.recipe_id ?? f.item_name
      const d = map.get(key) ?? { key, menu_item_id: f.menu_item_id, recipe_id: f.recipe_id, name: f.item_name, count: 0, avg: 0, dist: [0, 0, 0, 0, 0] as DishRating['dist'], comments: 0 }
      d.avg = (d.avg * d.count + f.rating) / (d.count + 1)
      d.count += 1
      d.dist[f.rating - 1] += 1
      if (f.comment) d.comments += 1
      map.set(key, d)
    }
    return [...map.values()]
  }, [feedback])

  return { feedback, byDish, loading, error, reload: load, remove }
}
