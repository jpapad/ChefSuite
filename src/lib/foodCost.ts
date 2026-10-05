import { supabase } from './supabase'
import { recipePortionCost } from './recipeTree'

export type CostStatus = 'good' | 'warn' | 'bad'

/** good: pct <= target, warn: pct <= target + 10, bad: pct > target + 10 */
export function costStatus(pct: number | null, target: number): CostStatus | null {
  if (pct === null) return null
  if (pct <= target) return 'good'
  if (pct <= target + 10) return 'warn'
  return 'bad'
}

interface IngredientCostRow {
  recipe_id: string
  inventory_item_id: string
  quantity: number
  inventory: { cost_per_unit: number | null } | null
}

/**
 * Computed cost per portion for each recipe: raw ingredients × unit cost,
 * plus any bases (sub-recipes) at their own cost. Recipes whose cost can't be
 * fully priced are left out of the map.
 */
export async function computeAutoCosts(recipeIds: string[]): Promise<Map<string, number>> {
  const costMap = new Map<string, number>()
  if (recipeIds.length === 0) return costMap
  const [ingRes, subRes, recRes] = await Promise.all([
    supabase.from('recipe_ingredients').select('recipe_id, inventory_item_id, quantity, inventory:inventory_item_id(cost_per_unit)'),
    supabase.from('recipe_sub_recipes').select('recipe_id, sub_recipe_id, quantity'),
    supabase.from('recipes').select('id, cost_per_portion'),
  ])
  const rows = (ingRes.data ?? []) as unknown as IngredientCostRow[]
  // recipe_sub_recipes may not exist yet (migration 0084) — treat as no bases
  const subs = (subRes.error ? [] : subRes.data ?? []) as { recipe_id: string; sub_recipe_id: string; quantity: number }[]
  const ingBy = new Map<string, IngredientCostRow[]>()
  for (const r of rows) ingBy.set(r.recipe_id, [...(ingBy.get(r.recipe_id) ?? []), r])
  const subBy = new Map<string, typeof subs>()
  for (const s of subs) subBy.set(s.recipe_id, [...(subBy.get(s.recipe_id) ?? []), s])
  const inventory = rows.map((r) => ({ id: r.inventory_item_id, cost_per_unit: r.inventory?.cost_per_unit ?? null }))
  const recipes = (recRes.data ?? []) as { id: string; cost_per_portion: number | null }[]

  for (const id of recipeIds) {
    const c = recipePortionCost(id, recipes, (rid) => ingBy.get(rid) ?? [], (rid) => subBy.get(rid) ?? [], inventory, { useOverride: false, skipUnpriced: true })
    if (c != null) costMap.set(id, c)
  }
  return costMap
}
