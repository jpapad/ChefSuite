import type { InventoryItem, Recipe, RecipeIngredient, RecipeSubRecipe } from '../types/database.types'

// Recipes can contain other recipes (bases). These helpers walk that tree.
// All quantities are per portion; a sub-recipe quantity is in portions of the
// base (one portion of a base = one unit of its yield_unit).

const MAX_DEPTH = 10

type IngredientsOf = (recipeId: string) => Pick<RecipeIngredient, 'inventory_item_id' | 'quantity'>[]
type SubsOf = (recipeId: string) => Pick<RecipeSubRecipe, 'sub_recipe_id' | 'quantity'>[]

/**
 * Cost of one portion, including bases. A recipe's manual cost_per_portion
 * wins over the computed one (same rule as the rest of the app).
 * Returns null when any raw ingredient has no price (unless skipUnpriced).
 */
export function recipePortionCost(
  recipeId: string,
  recipes: Pick<Recipe, 'id' | 'cost_per_portion'>[],
  ingredientsOf: IngredientsOf,
  subsOf: SubsOf,
  inventory: Pick<InventoryItem, 'id' | 'cost_per_unit'>[],
  { useOverride = true, skipUnpriced = false }: { useOverride?: boolean; skipUnpriced?: boolean } = {},
): number | null {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const priceById = new Map(inventory.map((i) => [i.id, i.cost_per_unit]))
  const memo = new Map<string, number | null>()

  function cost(id: string, depth: number, override: boolean): number | null {
    if (depth > MAX_DEPTH) return null
    const manual = recipeById.get(id)?.cost_per_portion
    if (override && manual != null) return manual
    if (memo.has(id)) return memo.get(id)!
    const ings = ingredientsOf(id)
    const subs = subsOf(id)
    if (ings.length === 0 && subs.length === 0) { memo.set(id, null); return null }
    let total = 0
    for (const ing of ings) {
      const p = priceById.get(ing.inventory_item_id)
      if (p == null) {
        if (skipUnpriced) continue
        memo.set(id, null); return null
      }
      total += p * ing.quantity
    }
    for (const s of subs) {
      const c = cost(s.sub_recipe_id, depth + 1, true)
      if (c == null) {
        if (skipUnpriced) continue
        memo.set(id, null); return null
      }
      total += c * s.quantity
    }
    memo.set(id, total)
    return total
  }

  return cost(recipeId, 0, useOverride)
}

/** Raw inventory needed for N portions, with bases expanded. */
export function expandedNeeds(
  recipeId: string,
  portions: number,
  ingredientsOf: IngredientsOf,
  subsOf: SubsOf,
): Map<string, number> {
  const needs = new Map<string, number>()
  function walk(id: string, mult: number, depth: number) {
    if (depth > MAX_DEPTH) return
    for (const ing of ingredientsOf(id)) {
      needs.set(ing.inventory_item_id, (needs.get(ing.inventory_item_id) ?? 0) + ing.quantity * mult)
    }
    for (const s of subsOf(id)) walk(s.sub_recipe_id, mult * s.quantity, depth + 1)
  }
  walk(recipeId, portions, 0)
  return needs
}

/** Ids of recipes that (directly or indirectly) use `recipeId` — can't be picked as its sub-recipes. */
export function ancestorsOf(recipeId: string, allSubs: Record<string, Pick<RecipeSubRecipe, 'sub_recipe_id'>[]>): Set<string> {
  const parentsOf = new Map<string, string[]>()
  for (const [parent, subs] of Object.entries(allSubs)) {
    for (const s of subs) parentsOf.set(s.sub_recipe_id, [...(parentsOf.get(s.sub_recipe_id) ?? []), parent])
  }
  const out = new Set<string>([recipeId])
  const stack = [recipeId]
  while (stack.length) {
    for (const p of parentsOf.get(stack.pop()!) ?? []) {
      if (!out.has(p)) { out.add(p); stack.push(p) }
    }
  }
  return out
}

/** Union of allergens of a recipe and every base inside it. */
export function inheritedAllergens(
  recipeId: string,
  recipes: Pick<Recipe, 'id' | 'allergens'>[],
  subsOf: SubsOf,
): string[] {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const out = new Set<string>()
  const seen = new Set<string>()
  function walk(id: string, depth: number) {
    if (depth > MAX_DEPTH || seen.has(id)) return
    seen.add(id)
    byId.get(id)?.allergens.forEach((a) => out.add(a))
    for (const s of subsOf(id)) walk(s.sub_recipe_id, depth + 1)
  }
  walk(recipeId, 0)
  return [...out]
}
