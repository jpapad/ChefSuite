import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { RecipeSubRecipe, RecipeSubRecipeDraft } from '../types/database.types'

interface State {
  byRecipe: Record<string, RecipeSubRecipe[]>
  loading: boolean
  error: string | null
}

/** Sub-recipe links (bases used inside recipes), grouped by parent recipe. */
export function useRecipeSubRecipes() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [state, setState] = useState<State>({ byRecipe: {}, loading: true, error: null })

  const load = useCallback(async () => {
    if (!teamId) { setState({ byRecipe: {}, loading: false, error: null }); return }
    const { data, error } = await supabase.from('recipe_sub_recipes').select('*').eq('team_id', teamId)
    const map: Record<string, RecipeSubRecipe[]> = {}
    for (const row of (data ?? []) as RecipeSubRecipe[]) (map[row.recipe_id] ??= []).push(row)
    setState({ byRecipe: map, loading: false, error: error?.message ?? null })
  }, [teamId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`recipe_sub_recipes:${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_sub_recipes' }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [teamId, load])

  const save = useCallback(async (recipeId: string, items: RecipeSubRecipeDraft[]) => {
    const { error } = await supabase.rpc('set_recipe_sub_recipes', { p_recipe_id: recipeId, p_items: items })
    if (error) throw error
    await load()
  }, [load])

  const getFor = useCallback(
    (recipeId: string): RecipeSubRecipe[] => state.byRecipe[recipeId] ?? [],
    [state.byRecipe],
  )

  return { ...state, getFor, save, reload: load }
}
