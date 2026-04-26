import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Recipe, RecipeVersion } from '../types/database.types'

export function useRecipeVersions() {
  const [versions, setVersions] = useState<RecipeVersion[]>([])
  const [loading, setLoading] = useState(false)

  const loadVersions = useCallback(async (recipeId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('recipe_versions')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: false })
    setVersions((data ?? []) as RecipeVersion[])
    setLoading(false)
  }, [])

  const saveVersion = useCallback(async (recipe: Recipe) => {
    const { error: err } = await supabase.from('recipe_versions').insert({
      recipe_id: recipe.id,
      team_id: recipe.team_id,
      title: recipe.title,
      description: recipe.description,
      instructions: recipe.instructions,
      cost_per_portion: recipe.cost_per_portion,
      selling_price: recipe.selling_price,
      allergens: recipe.allergens,
      category: recipe.category,
    })
    if (err) console.warn('Failed to save recipe version:', err.message)
  }, [])

  return { versions, loading, loadVersions, saveVersion }
}
