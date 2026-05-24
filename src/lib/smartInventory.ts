/**
 * Smart Inventory — pure TypeScript utility functions.
 * Zero React, zero Supabase. All functions are deterministic.
 *
 * Feature 3 — Price-change watchlist (affected recipes + new theoretical cost)
 * Feature 4 — Ordering checklist (what needs to go out today)
 */

import type {
  DeliveryDay,
  IngredientSupplier,
  InventoryItem,
  Supplier,
} from '../types/database.types'

// ── Shared helpers ─────────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3 — Price-change impact: which recipes are affected?
// ─────────────────────────────────────────────────────────────────────────────

export interface RecipeIngredientRow {
  recipe_id: string
  inventory_item_id: string
  quantity: number
  /** Current cost_per_unit from inventory (may be null) */
  cost_per_unit: number | null
  /** Yield %, null = 100% */
  yield_pct: number | null
}

export interface RecipeSummary {
  id: string
  title: string
  selling_price: number | null
  servings: number | null
}

export interface PriceImpactRow {
  recipe_id: string
  recipe_title: string
  servings: number | null
  selling_price: number | null
  /** Total batch cost at old price (null if missing cost data) */
  current_batch_cost: number | null
  /** Total batch cost at new price */
  new_batch_cost: number | null
  /** Per-portion delta (new − old) / servings */
  cost_delta_per_portion: number | null
  /** Gross margin % after price change: (SP − new_cpp) / SP × 100 */
  new_margin_pct: number | null
  /** True if new margin is below the provided threshold */
  margin_alert: boolean
}

/**
 * Returns every recipe affected by an ingredient price change,
 * with old/new costs and the new gross margin per portion.
 *
 * @param changedItemId   inventory.id of the ingredient whose price changed
 * @param oldPrice        previous cost_per_unit
 * @param newPrice        new cost_per_unit
 * @param allIngredients  every recipe_ingredients row joined with cost_per_unit + yield_pct
 * @param recipes         recipe master data (id, title, selling_price, servings)
 * @param marginThreshold alert when new_margin_pct < this value (default 65)
 */
export function calcPriceImpact(
  changedItemId: string,
  oldPrice: number,
  newPrice: number,
  allIngredients: RecipeIngredientRow[],
  recipes: RecipeSummary[],
  marginThreshold = 65,
): PriceImpactRow[] {
  // Recipes that contain this ingredient
  const affectedIds = new Set(
    allIngredients
      .filter((r) => r.inventory_item_id === changedItemId)
      .map((r) => r.recipe_id),
  )
  if (affectedIds.size === 0) return []

  // Group all ingredients by recipe
  const byRecipe = new Map<string, RecipeIngredientRow[]>()
  for (const row of allIngredients) {
    if (!affectedIds.has(row.recipe_id)) continue
    const arr = byRecipe.get(row.recipe_id) ?? []
    arr.push(row)
    byRecipe.set(row.recipe_id, arr)
  }

  const recipeById = new Map(recipes.map((r) => [r.id, r]))

  return [...affectedIds].flatMap((recipeId) => {
    const recipe = recipeById.get(recipeId)
    if (!recipe) return []
    const ings = byRecipe.get(recipeId) ?? []

    let currentBatch = 0
    let newBatch = 0
    let hasData = false

    for (const ing of ings) {
      const cpu = ing.inventory_item_id === changedItemId ? oldPrice : (ing.cost_per_unit ?? null)
      const cpuNew = ing.inventory_item_id === changedItemId ? newPrice : (ing.cost_per_unit ?? null)
      const factor = ing.yield_pct != null && ing.yield_pct > 0 && ing.yield_pct <= 100
        ? ing.yield_pct / 100
        : 1

      if (cpu != null)    { currentBatch += (ing.quantity * cpu)    / factor; hasData = true }
      if (cpuNew != null) { newBatch     += (ing.quantity * cpuNew) / factor }
    }

    if (!hasData) return []

    const servings = recipe.servings != null && recipe.servings > 0 ? recipe.servings : 1
    const currentCpp = r2(currentBatch / servings)
    const newCpp     = r2(newBatch / servings)
    const sp         = recipe.selling_price

    const newMarginPct =
      sp != null && sp > 0 ? r2(((sp - newCpp) / sp) * 100) : null

    return [{
      recipe_id:              recipe.id,
      recipe_title:           recipe.title,
      servings:               recipe.servings,
      selling_price:          sp,
      current_batch_cost:     r2(currentBatch),
      new_batch_cost:         r2(newBatch),
      cost_delta_per_portion: r2(newCpp - currentCpp),
      new_margin_pct:         newMarginPct,
      margin_alert:           newMarginPct != null ? newMarginPct < marginThreshold : false,
    }]
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4 — Daily ordering checklist
// ─────────────────────────────────────────────────────────────────────────────

const DAY_ORDER: DeliveryDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_LABELS: Record<DeliveryDay, string> = {
  sun: 'Κυριακή', mon: 'Δευτέρα', tue: 'Τρίτη',
  wed: 'Τετάρτη', thu: 'Πέμπτη', fri: 'Παρασκευή', sat: 'Σάββατο',
}

export type OrderUrgency = 'overdue' | 'today' | 'tomorrow' | 'later'

export interface SupplierOrderSlot {
  supplier: Supplier
  /** Next scheduled delivery day name */
  nextDeliveryDay: DeliveryDay | null
  /** Calendar days until next delivery */
  daysUntilDelivery: number | null
  /** When the order deadline falls */
  urgency: OrderUrgency
  /** ISO date string of the order deadline (date order must be placed) */
  orderDeadlineDate: string | null
  /** True if the cutoff time today has already passed */
  cutoffPassed: boolean
  /** Low-stock items linked to this supplier (via ingredient_suppliers) */
  lowStockItems: InventoryItem[]
}

/**
 * Builds today's ordering checklist.
 *
 * An order "needs to go out today" when:
 *   today_date >= delivery_date − order_cutoff_days
 *
 * Items are only included when quantity ≤ min_stock_level.
 */
export function getOrderingChecklist(
  suppliers: Supplier[],
  inventoryItems: InventoryItem[],
  ingredientSuppliers: IngredientSupplier[],
  now: Date = new Date(),
): SupplierOrderSlot[] {
  const todayDayIdx = now.getDay()           // 0=Sun … 6=Sat
  const todayKey = DAY_ORDER[todayDayIdx]!
  const currentTimeStr = now.toTimeString().slice(0, 8) // "HH:MM:SS"

  // Low-stock item set
  const lowStockSet = new Set(
    inventoryItems
      .filter((i) => i.quantity <= i.min_stock_level)
      .map((i) => i.id),
  )

  // Preferred supplier map: inventory_item_id → supplier_id
  const preferredSupplierMap = new Map<string, string>()
  for (const link of ingredientSuppliers) {
    if (link.is_preferred) preferredSupplierMap.set(link.inventory_item_id, link.supplier_id)
  }

  // Group low-stock items by their preferred supplier
  const itemsBySupplier = new Map<string, InventoryItem[]>()
  for (const item of inventoryItems) {
    if (!lowStockSet.has(item.id)) continue
    const suppId = preferredSupplierMap.get(item.id)
    if (!suppId) continue
    const arr = itemsBySupplier.get(suppId) ?? []
    arr.push(item)
    itemsBySupplier.set(suppId, arr)
  }

  const result: SupplierOrderSlot[] = []

  for (const supplier of suppliers) {
    const items = itemsBySupplier.get(supplier.id)
    if (!items || items.length === 0) continue

    // Find next delivery day
    if (supplier.delivery_days.length === 0) {
      result.push({
        supplier,
        nextDeliveryDay: null,
        daysUntilDelivery: null,
        urgency: 'later',
        orderDeadlineDate: null,
        cutoffPassed: false,
        lowStockItems: items,
      })
      continue
    }

    let minDelta = Infinity
    let nextDay: DeliveryDay | null = null

    for (const d of supplier.delivery_days) {
      const dIdx = DAY_ORDER.indexOf(d)
      let delta = dIdx - todayDayIdx
      if (delta <= 0) delta += 7 // wrap to next week
      if (delta < minDelta) { minDelta = delta; nextDay = d }
    }

    // Is today itself a delivery day? If so, next delivery is next week
    if (minDelta === 0) minDelta = 7

    const cutoffDelta = minDelta - supplier.order_cutoff_days  // days from today to order deadline
    const cutoffPassed = cutoffDelta === 0 && currentTimeStr >= supplier.order_cutoff_time

    let urgency: OrderUrgency
    if (cutoffDelta < 0)      urgency = 'overdue'
    else if (cutoffDelta === 0) urgency = cutoffPassed ? 'overdue' : 'today'
    else if (cutoffDelta === 1) urgency = 'tomorrow'
    else                        urgency = 'later'

    // Compute absolute deadline date
    const deadline = new Date(now)
    deadline.setDate(deadline.getDate() + cutoffDelta)
    const orderDeadlineDate = deadline.toISOString().slice(0, 10)

    result.push({
      supplier,
      nextDeliveryDay: nextDay,
      daysUntilDelivery: minDelta,
      urgency,
      orderDeadlineDate,
      cutoffPassed,
      lowStockItems: items,
    })
  }

  // Sort: overdue → today → tomorrow → later
  const URGENCY_ORDER: OrderUrgency[] = ['overdue', 'today', 'tomorrow', 'later']
  result.sort((a, b) => URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency))

  return result
}

// ── Exported helpers ───────────────────────────────────────────────────────────

export { DAY_LABELS, DAY_ORDER }
