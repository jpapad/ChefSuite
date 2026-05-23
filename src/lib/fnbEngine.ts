/**
 * F&B Calculation Engine
 *
 * Pure TypeScript — zero React, zero Supabase.
 * All functions are deterministic and side-effect-free.
 * Companion hook: src/hooks/useFnbEngine.ts
 */

// ── Shared types ───────────────────────────────────────────────────────────────

export interface IngredientWithYield {
  inventory_item_id: string
  /** Net quantity required by the recipe (after portioning — what the dish actually uses) */
  quantity: number
  cost_per_unit: number | null
  /** Usable yield %, e.g. 80 = 80%. null is treated as 100%. */
  yield_pct: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1 — Yield-adjusted cost calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gross purchase cost of one ingredient line.
 *
 * The recipe specifies the NET quantity (what ends up on the plate).
 * We must purchase GROSS = net / yield to account for trim/prep waste.
 *
 * Formula: (netQty × costPerUnit) / (yieldPct / 100)
 */
export function ingredientCostWithYield(
  netQty: number,
  costPerUnit: number,
  yieldPct: number | null,
): number {
  if (netQty <= 0 || costPerUnit < 0) return 0
  // yieldPct must be in (0, 100]; everything else defaults to 100%
  const factor =
    yieldPct != null && yieldPct > 0 && yieldPct <= 100 ? yieldPct / 100 : 1
  return r2((netQty * costPerUnit) / factor)
}

/**
 * Total batch cost for a recipe using yield-adjusted ingredient costs.
 * Returns null when NO ingredient has a known cost_per_unit.
 */
export function calcRecipeCost(ingredients: IngredientWithYield[]): number | null {
  let total = 0
  let counted = 0
  for (const ing of ingredients) {
    if (ing.cost_per_unit == null || ing.cost_per_unit < 0) continue
    total += ingredientCostWithYield(ing.quantity, ing.cost_per_unit, ing.yield_pct)
    counted++
  }
  return counted > 0 ? r2(total) : null
}

/** Gross margin % = (sellingPrice − cost) / sellingPrice × 100 */
export function grossMarginPct(
  sellingPrice: number | null,
  cost: number | null,
): number | null {
  if (sellingPrice == null || sellingPrice <= 0 || cost == null || cost < 0) return null
  return r2(((sellingPrice - cost) / sellingPrice) * 100)
}

/** Food cost % = cost / sellingPrice × 100 */
export function foodCostPct(
  cost: number | null,
  sellingPrice: number | null,
): number | null {
  if (cost == null || cost < 0 || sellingPrice == null || sellingPrice <= 0) return null
  return r2((cost / sellingPrice) * 100)
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2 — Theoretical vs Actual Food Cost Variance
// ─────────────────────────────────────────────────────────────────────────────

export interface SoldItemInput {
  recipe_id: string | null
  units_sold: number
  /** Yield-adjusted cost per portion (as returned by calcRecipeCost / servings) */
  cost_per_portion: number | null
}

export interface TheoreticalActualInput {
  /** All order items (completed orders) within the analysis period */
  soldItems: SoldItemInput[]
  /** Sum of waste_entries.cost for the period (€) */
  wasteCost: number
  /**
   * Cost of unexplained stock losses found during stocktake.
   * = Σ |negative stocktake movement delta| × cost_per_unit
   */
  stocktakeVarianceCost: number
}

export interface TheoreticalActualResult {
  /** Cost of food based purely on what was sold (recipes × covers) */
  theoreticalCost: number
  /** Recorded waste cost for the period */
  wasteCost: number
  /** Cost difference revealed by physical stocktake */
  stocktakeVarianceCost: number
  /** theoreticalCost + wasteCost + stocktakeVarianceCost */
  actualCost: number
  /** actualCost − theoreticalCost (positive = more food used than sold) */
  varianceAbsolute: number
  /** varianceAbsolute / theoreticalCost × 100 (null when no sales data) */
  variancePct: number | null
}

export function calcTheoreticalVsActual(
  input: TheoreticalActualInput,
): TheoreticalActualResult {
  const theoreticalCost = input.soldItems.reduce((sum, item) => {
    if (item.cost_per_portion == null || item.units_sold <= 0) return sum
    return sum + item.units_sold * item.cost_per_portion
  }, 0)

  const waste = Math.max(0, input.wasteCost)
  const stocktake = Math.max(0, input.stocktakeVarianceCost)
  const actualCost = theoreticalCost + waste + stocktake
  const varianceAbsolute = actualCost - theoreticalCost
  const variancePct =
    theoreticalCost > 0 ? r2((varianceAbsolute / theoreticalCost) * 100) : null

  return {
    theoreticalCost: r2(theoreticalCost),
    wasteCost: r2(waste),
    stocktakeVarianceCost: r2(stocktake),
    actualCost: r2(actualCost),
    varianceAbsolute: r2(varianceAbsolute),
    variancePct,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3 — Menu Engineering (Stars / Plowhorses / Puzzles / Dogs)
// ─────────────────────────────────────────────────────────────────────────────

export type MenuEngQuadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog'

export interface MenuEngInput {
  /** menu_item_id or a stable composite key */
  id: string
  name: string
  units_sold: number
  /** Effective selling price (menu item override or recipe.selling_price) */
  selling_price: number | null
  /** Yield-adjusted cost per portion */
  cost_per_portion: number | null
}

export interface MenuEngResult extends MenuEngInput {
  gross_margin_pct: number | null
  /** Absolute gross margin = selling_price − cost_per_portion */
  gross_margin_abs: number | null
  /** Share of total units sold, in % */
  popularity_pct: number
  quadrant: MenuEngQuadrant
}

/**
 * Classifies menu items using the Kasavana & Smith method:
 *   - Popularity axis: median units sold as threshold
 *   - Profitability axis: median gross margin % as threshold
 *
 * Items without a known margin are classified solely on popularity
 * and treated as low-margin (conservative bias).
 */
export function classifyMenuItems(items: MenuEngInput[]): MenuEngResult[] {
  if (items.length === 0) return []

  const totalUnits = items.reduce((s, i) => s + Math.max(0, i.units_sold), 0)
  const popularityThreshold = median(items.map((i) => i.units_sold))

  const knownMargins = items
    .map((i) => grossMarginPct(i.selling_price, i.cost_per_portion))
    .filter((m): m is number => m != null)
  // Fall back to a sensible F&B benchmark when no margins are calculable
  const marginThreshold = knownMargins.length > 0 ? median(knownMargins) : 65

  return items.map((item) => {
    const gmp = grossMarginPct(item.selling_price, item.cost_per_portion)
    const gma =
      item.selling_price != null && item.cost_per_portion != null
        ? r2(item.selling_price - item.cost_per_portion)
        : null
    const popularity_pct =
      totalUnits > 0 ? r2((Math.max(0, item.units_sold) / totalUnits) * 100) : 0

    const isPopular = item.units_sold >= popularityThreshold
    const isHighMargin = gmp != null ? gmp >= marginThreshold : false

    const quadrant: MenuEngQuadrant =
      isPopular  && isHighMargin  ? 'star'      :
      isPopular  && !isHighMargin ? 'plowhorse' :
      !isPopular && isHighMargin  ? 'puzzle'    :
      'dog'

    return { ...item, gross_margin_pct: gmp, gross_margin_abs: gma, popularity_pct, quadrant }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4 — Price-change impact & margin alerts
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceAlertRecipe {
  recipe_id: string
  recipe_title: string
  /** Full ingredient list (used to recalculate total batch cost) */
  all_ingredients: IngredientWithYield[]
  selling_price: number | null
  /** Number of portions per batch — used to derive cost_per_portion */
  servings: number | null
}

export interface PriceAlertMenuItem {
  menu_item_id: string
  menu_item_name: string
  recipe_id: string
  /** Price on the menu item — may override recipe.selling_price */
  menu_item_price: number | null
}

export interface PriceAlertInput {
  changedItemId: string
  oldPrice: number
  newPrice: number
  affectedRecipes: PriceAlertRecipe[]
  menuItems: PriceAlertMenuItem[]
  /** Alert fires when new gross margin falls BELOW this value (e.g. 70 = 70%) */
  marginThreshold: number
}

export interface PriceAlertRecipeResult {
  recipe_id: string
  recipe_title: string
  old_cost_per_portion: number | null
  new_cost_per_portion: number | null
  cost_increase_abs: number | null
  cost_increase_pct: number | null
}

export interface PriceAlertMenuItemResult {
  menu_item_id: string
  menu_item_name: string
  recipe_title: string
  selling_price: number | null
  old_gross_margin_pct: number | null
  new_gross_margin_pct: number | null
  /** How many percentage points the margin has dropped */
  margin_drop: number | null
  threshold: number
}

export interface PriceAlertResult {
  /** % change in the ingredient price */
  priceChangePct: number
  /** Impact on every recipe that uses the changed ingredient */
  affectedRecipes: PriceAlertRecipeResult[]
  /** Menu items whose new gross margin has fallen below the threshold */
  alerts: PriceAlertMenuItemResult[]
}

/**
 * Calculates the downstream impact of an ingredient price change.
 *
 * Flow:
 *  1. For each affected recipe, substitute old/new price and recalculate cost.
 *  2. For each linked menu item, derive the new gross margin.
 *  3. Emit an alert entry for every item whose new margin < marginThreshold.
 */
export function checkPriceAlert(input: PriceAlertInput): PriceAlertResult {
  if (input.oldPrice <= 0) {
    return { priceChangePct: 0, affectedRecipes: [], alerts: [] }
  }

  const priceChangePct = r2(
    ((input.newPrice - input.oldPrice) / input.oldPrice) * 100,
  )

  const recipeResults: PriceAlertRecipeResult[] = input.affectedRecipes.map(
    (recipe) => {
      const servings =
        recipe.servings != null && recipe.servings > 0 ? recipe.servings : 1

      const swap =
        (price: number) =>
          (ing: IngredientWithYield): IngredientWithYield =>
            ing.inventory_item_id === input.changedItemId
              ? { ...ing, cost_per_unit: price }
              : ing

      const oldBatch = calcRecipeCost(recipe.all_ingredients.map(swap(input.oldPrice)))
      const newBatch = calcRecipeCost(recipe.all_ingredients.map(swap(input.newPrice)))
      const old_cost_per_portion = oldBatch != null ? r2(oldBatch / servings) : null
      const new_cost_per_portion = newBatch != null ? r2(newBatch / servings) : null

      const cost_increase_abs =
        old_cost_per_portion != null && new_cost_per_portion != null
          ? r2(new_cost_per_portion - old_cost_per_portion)
          : null
      const cost_increase_pct =
        old_cost_per_portion != null &&
        old_cost_per_portion > 0 &&
        cost_increase_abs != null
          ? r2((cost_increase_abs / old_cost_per_portion) * 100)
          : null

      return {
        recipe_id: recipe.recipe_id,
        recipe_title: recipe.recipe_title,
        old_cost_per_portion,
        new_cost_per_portion,
        cost_increase_abs,
        cost_increase_pct,
      }
    },
  )

  const byRecipeId = new Map(
    recipeResults.map((r) => [r.recipe_id, r] as const),
  )
  const titleByRecipeId = new Map(
    input.affectedRecipes.map((r) => [r.recipe_id, r.recipe_title] as const),
  )
  const sellingPriceByRecipeId = new Map(
    input.affectedRecipes.map((r) => [r.recipe_id, r.selling_price] as const),
  )

  const alerts: PriceAlertMenuItemResult[] = input.menuItems.flatMap((mi) => {
    const result = byRecipeId.get(mi.recipe_id)
    if (!result) return []

    const effectivePrice =
      mi.menu_item_price ?? sellingPriceByRecipeId.get(mi.recipe_id) ?? null
    const new_gm = grossMarginPct(effectivePrice, result.new_cost_per_portion)
    const old_gm = grossMarginPct(effectivePrice, result.old_cost_per_portion)

    // Only emit when the NEW margin is below threshold
    if (new_gm == null || new_gm >= input.marginThreshold) return []

    return [
      {
        menu_item_id: mi.menu_item_id,
        menu_item_name: mi.menu_item_name,
        recipe_title: titleByRecipeId.get(mi.recipe_id) ?? mi.menu_item_name,
        selling_price: effectivePrice,
        old_gross_margin_pct: old_gm,
        new_gross_margin_pct: new_gm,
        margin_drop: old_gm != null ? r2(old_gm - new_gm) : null,
        threshold: input.marginThreshold,
      },
    ]
  })

  return { priceChangePct, affectedRecipes: recipeResults, alerts }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Round to 2 decimal places */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : r2(((sorted[mid - 1]! + sorted[mid]!) / 2))
}
