import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface TeamSettingsRow {
  team_id: string
  target_food_cost_pct: number
}

const DEFAULT_TARGET = 30

export function useTeamSettings() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [targetFoodCostPct, setTargetFoodCostPct] = useState(DEFAULT_TARGET)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('team_settings')
      .select('team_id, target_food_cost_pct')
      .eq('team_id', teamId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const row = data as TeamSettingsRow | null
        setTargetFoodCostPct(row?.target_food_cost_pct ?? DEFAULT_TARGET)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [teamId])

  const save = useCallback(async (pct: number) => {
    if (!teamId) return
    const { error } = await supabase
      .from('team_settings')
      .upsert({ team_id: teamId, target_food_cost_pct: pct }, { onConflict: 'team_id' })
    if (error) throw error
    setTargetFoodCostPct(pct)
  }, [teamId])

  return { targetFoodCostPct, loading, save }
}
