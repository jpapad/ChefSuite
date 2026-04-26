import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  RecipeIngredient,
  RecipeIngredientDraft,
} from '../types/database.types'

interface State {
  byRecipe: Record<string, RecipeIngredient[]>
  loading: boolean
  error: string | null
}

export function useRecipeIngredients() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [state, setState] = useState<State>({
    byRecipe: {},
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!teamId) {
      setState({ byRecipe: {}, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('*')
    const map: Record<string, RecipeIngredient[]> = {}
    for (const row of (data ?? []) as RecipeIngredient[]) {
      ;(map[row.recipe_id] ??= []).push(row)
    }
    setState({ byRecipe: map, loading: false, error: error?.message ?? null })
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`recipe_ingredients:${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipe_ingredients' },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [teamId, load])

  const save = useCallback(
    async (recipeId: string, items: RecipeIngredientDraft[]) => {
      const { error } = await supabase.rpc('set_recipe_ingredients', {
        p_recipe_id: recipeId,
        p_items: items,
      })
      if (error) throw error
      await load()
    },
    [load],
  )

  const getFor = useCallback(
    (recipeId: string): RecipeIngredient[] =>
      state.byRecipe[recipeId] ?? [],
    [state.byRecipe],
  )

  return { ...state, getFor, save, reload: load }
}
