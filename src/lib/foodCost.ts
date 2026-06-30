import { supabase } from './supabase'

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
  quantity: number
  inventory: { cost_per_unit: number | null } | null
}

/** Sums recipe_ingredients.quantity × inventory.cost_per_unit per recipe. */
export async function computeAutoCosts(recipeIds: string[]): Promise<Map<string, number>> {
  const costMap = new Map<string, number>()
  if (recipeIds.length === 0) return costMap
  const { data } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, quantity, inventory:inventory_item_id(cost_per_unit)')
    .in('recipe_id', recipeIds)
  const rows = (data ?? []) as unknown as IngredientCostRow[]
  for (const row of rows) {
    const cpu = row.inventory?.cost_per_unit ?? null
    if (cpu == null) continue
    costMap.set(row.recipe_id, (costMap.get(row.recipe_id) ?? 0) + row.quantity * cpu)
  }
  return costMap
}
