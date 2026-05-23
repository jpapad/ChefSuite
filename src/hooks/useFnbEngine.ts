import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Recipe } from '../types/database.types'
import {
  calcRecipeCost,
  calcTheoreticalVsActual,
  classifyMenuItems,
  checkPriceAlert,
  type IngredientWithYield,
  type TheoreticalActualResult,
  type MenuEngResult,
  type PriceAlertResult,
  type PriceAlertRecipe,
  type PriceAlertMenuItem,
} from '../lib/fnbEngine'

// ── Internal query row types ───────────────────────────────────────────────────

type IngRow = {
  recipe_id: string
  inventory_item_id: string
  quantity: number
  inventory: { cost_per_unit: number | null; yield_pct: number | null } | null
}

type OrderRow = {
  menu_item_id: string | null
  name: string
  price: number
  quantity: number
  menu_items: {
    recipe_id: string | null
    recipes: { selling_price: number | null } | null
  } | null
}

type WasteRow = { cost: number | null }

type StocktakeRow = {
  delta: number
  inventory: { cost_per_unit: number | null } | null
}

type MenuItemRow = {
  id: string
  name: string
  recipe_id: string | null
  price: number | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface FnbEngineReturn {
  /** Yield-adjusted cost per portion, keyed by recipe_id */
  yieldAdjustedCosts: Map<string, number | null>
  /** Full ingredient lists with yield_pct, keyed by recipe_id */
  ingredientsByRecipe: Map<string, IngredientWithYield[]>
  /** True while the initial ingredient load is in progress */
  loading: boolean
  /** Feature 2 — Theoretical vs Actual variance for a date range */
  calcVariance: (range: { from: string; to: string }) => Promise<TheoreticalActualResult>
  /** Feature 3 — Kasavana & Smith menu classification for a date range */
  classifyMenuForPeriod: (range: { from: string; to: string }) => Promise<MenuEngResult[]>
  /**
   * Feature 4 — React to an ingredient price change.
   * Fires only when |price change| > 10%.
   * Inserts one `notifications` row per menu item whose margin falls below threshold.
   */
  onIngredientPriceUpdate: (params: {
    itemId: string
    itemName: string
    oldPrice: number
    newPrice: number
    userId: string
    marginThreshold?: number
  }) => Promise<PriceAlertResult | null>
}

export function useFnbEngine(recipes: Recipe[]): FnbEngineReturn {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [ingredientsByRecipe, setIngredientsByRecipe] = useState<Map<string, IngredientWithYield[]>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState(true)

  // ── Feature 1 — load ingredients + yield_pct on mount ─────────────────────

  useEffect(() => {
    if (!teamId) {
      setLoading(false)
      return
    }

    async function loadIngredients() {
      setLoading(true)

      const { data } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, inventory_item_id, quantity, inventory:inventory_item_id(cost_per_unit, yield_pct)')

      const rows = (data ?? []) as unknown as IngRow[]
      const map = new Map<string, IngredientWithYield[]>()

      for (const row of rows) {
        const ing: IngredientWithYield = {
          inventory_item_id: row.inventory_item_id,
          quantity: row.quantity,
          cost_per_unit: row.inventory?.cost_per_unit ?? null,
          yield_pct: row.inventory?.yield_pct ?? null,
        }
        const arr = map.get(row.recipe_id) ?? []
        arr.push(ing)
        map.set(row.recipe_id, arr)
      }

      setIngredientsByRecipe(map)
      setLoading(false)
    }

    void loadIngredients()
  }, [teamId])

  // ── Feature 1 — derived: yield-adjusted cost per portion ──────────────────

  const yieldAdjustedCosts = useMemo<Map<string, number | null>>(() => {
    const result = new Map<string, number | null>()
    for (const recipe of recipes) {
      const ings = ingredientsByRecipe.get(recipe.id) ?? []
      const batchCost = calcRecipeCost(ings)
      const servings = recipe.servings != null && recipe.servings > 0 ? recipe.servings : 1
      result.set(
        recipe.id,
        batchCost != null ? Math.round((batchCost / servings) * 100) / 100 : null,
      )
    }
    return result
  }, [ingredientsByRecipe, recipes])

  // ── Feature 2 — Theoretical vs Actual variance ────────────────────────────

  const calcVariance = useCallback(
    async ({ from, to }: { from: string; to: string }): Promise<TheoreticalActualResult> => {
      if (!teamId) throw new Error('No team')

      // Sales: completed orders within date range, with recipe linkage
      const { data: orderData, error: orderErr } = await supabase
        .from('online_order_items')
        .select(`
          quantity, menu_item_id,
          menu_items(recipe_id),
          online_orders!inner(status, team_id, created_at)
        `)
        .eq('online_orders.status', 'completed')
        .eq('online_orders.team_id', teamId)
        .gte('online_orders.created_at', from)
        .lte('online_orders.created_at', to)

      if (orderErr) throw orderErr

      const orderRows = (orderData ?? []) as unknown as (OrderRow & {
        online_orders: { status: string; team_id: string; created_at: string }
      })[]

      // Aggregate units sold per recipe_id
      const unitsByRecipe = new Map<string, number>()
      for (const row of orderRows) {
        const recipeId = row.menu_items?.recipe_id
        if (!recipeId) continue
        unitsByRecipe.set(recipeId, (unitsByRecipe.get(recipeId) ?? 0) + row.quantity)
      }

      const soldItems = [...unitsByRecipe.entries()].map(([recipe_id, units_sold]) => ({
        recipe_id,
        units_sold,
        cost_per_portion: yieldAdjustedCosts.get(recipe_id) ?? null,
      }))

      // Waste: sum cost for the period
      const { data: wasteData, error: wasteErr } = await supabase
        .from('waste_entries')
        .select('cost')
        .eq('team_id', teamId)
        .gte('wasted_at', from.slice(0, 10))
        .lte('wasted_at', to.slice(0, 10))

      if (wasteErr) throw wasteErr

      const wasteCost = ((wasteData ?? []) as unknown as WasteRow[]).reduce(
        (sum, row) => sum + (row.cost ?? 0),
        0,
      )

      // Stocktake variance: negative movements with reason='stocktake'
      const { data: stockData, error: stockErr } = await supabase
        .from('inventory_movements')
        .select('delta, inventory:item_id(cost_per_unit)')
        .eq('team_id', teamId)
        .eq('reason', 'stocktake')
        .lt('delta', 0)
        .gte('created_at', from)
        .lte('created_at', to)

      if (stockErr) throw stockErr

      const stocktakeVarianceCost = ((stockData ?? []) as unknown as StocktakeRow[]).reduce(
        (sum, row) => {
          const cpu = row.inventory?.cost_per_unit ?? null
          if (cpu == null) return sum
          return sum + Math.abs(row.delta) * cpu
        },
        0,
      )

      return calcTheoreticalVsActual({ soldItems, wasteCost, stocktakeVarianceCost })
    },
    [teamId, yieldAdjustedCosts],
  )

  // ── Feature 3 — Menu Engineering classification ───────────────────────────

  const classifyMenuForPeriod = useCallback(
    async ({ from, to }: { from: string; to: string }): Promise<MenuEngResult[]> => {
      if (!teamId) throw new Error('No team')

      const { data, error } = await supabase
        .from('online_order_items')
        .select(`
          menu_item_id, name, price, quantity,
          menu_items(recipe_id, recipes(selling_price)),
          online_orders!inner(status, team_id, created_at)
        `)
        .eq('online_orders.status', 'completed')
        .eq('online_orders.team_id', teamId)
        .gte('online_orders.created_at', from)
        .lte('online_orders.created_at', to)

      if (error) throw error

      const rows = (data ?? []) as unknown as OrderRow[]

      // Aggregate by menu_item_id (fall back to name)
      const agg = new Map<
        string,
        { name: string; units: number; revenue: number; recipe_id: string | null; selling_price: number | null }
      >()

      for (const row of rows) {
        const key = row.menu_item_id ?? row.name
        const existing = agg.get(key)
        if (existing) {
          existing.units += row.quantity
          existing.revenue += row.price * row.quantity
        } else {
          agg.set(key, {
            name: row.name,
            units: row.quantity,
            revenue: row.price * row.quantity,
            recipe_id: row.menu_items?.recipe_id ?? null,
            selling_price: row.menu_items?.recipes?.selling_price ?? null,
          })
        }
      }

      const inputs = [...agg.entries()].map(([id, item]) => ({
        id,
        name: item.name,
        units_sold: item.units,
        selling_price:
          item.selling_price ??
          (item.units > 0 ? Math.round((item.revenue / item.units) * 100) / 100 : null),
        cost_per_portion:
          item.recipe_id != null ? (yieldAdjustedCosts.get(item.recipe_id) ?? null) : null,
      }))

      return classifyMenuItems(inputs)
    },
    [teamId, yieldAdjustedCosts],
  )

  // ── Feature 4 — Ingredient price alert + notification insert ─────────────

  const onIngredientPriceUpdate = useCallback(
    async ({
      itemId,
      itemName,
      oldPrice,
      newPrice,
      userId,
      marginThreshold = 70,
    }: {
      itemId: string
      itemName: string
      oldPrice: number
      newPrice: number
      userId: string
      marginThreshold?: number
    }): Promise<PriceAlertResult | null> => {
      if (!teamId || oldPrice <= 0) return null

      // Only fire when price change exceeds ±10%
      const changePct = Math.abs(((newPrice - oldPrice) / oldPrice) * 100)
      if (changePct <= 10) return null

      // Find recipe IDs that contain this ingredient
      const affectedRecipeIds = [...ingredientsByRecipe.entries()]
        .filter(([, ings]) => ings.some((ing) => ing.inventory_item_id === itemId))
        .map(([id]) => id)

      if (affectedRecipeIds.length === 0) {
        return { priceChangePct: 0, affectedRecipes: [], alerts: [] }
      }

      // Build PriceAlertRecipe[] from the in-memory ingredient map + recipes prop
      const recipeById = new Map(recipes.map((r) => [r.id, r]))
      const affectedRecipes: PriceAlertRecipe[] = affectedRecipeIds.flatMap((id) => {
        const recipe = recipeById.get(id)
        if (!recipe) return []
        return [
          {
            recipe_id: id,
            recipe_title: recipe.title,
            all_ingredients: ingredientsByRecipe.get(id) ?? [],
            selling_price: recipe.selling_price,
            servings: recipe.servings,
          },
        ]
      })

      // Fetch menu items linked to affected recipes
      const { data: miData, error: miErr } = await supabase
        .from('menu_items')
        .select('id, name, recipe_id, price')
        .in('recipe_id', affectedRecipeIds)

      if (miErr) throw miErr

      const menuItems: PriceAlertMenuItem[] = ((miData ?? []) as unknown as MenuItemRow[]).map(
        (mi) => ({
          menu_item_id: mi.id,
          menu_item_name: mi.name,
          recipe_id: mi.recipe_id ?? '',
          menu_item_price: mi.price,
        }),
      )

      const result = checkPriceAlert({
        changedItemId: itemId,
        oldPrice,
        newPrice,
        affectedRecipes,
        menuItems,
        marginThreshold,
      })

      // Insert one notification per alert
      if (result.alerts.length > 0 && teamId && userId) {
        const notifications = result.alerts.map((alert) => ({
          team_id: teamId,
          user_id: userId,
          type: 'margin_alert',
          title: `Margin alert: ${alert.menu_item_name}`,
          body: `${itemName} price changed ${result.priceChangePct > 0 ? '+' : ''}${result.priceChangePct}%. Margin dropped to ${alert.new_gross_margin_pct}% (threshold: ${alert.threshold}%).`,
          data: {
            menu_item_id: alert.menu_item_id,
            ingredient_id: itemId,
            ingredient_name: itemName,
            price_change_pct: result.priceChangePct,
            old_gross_margin_pct: alert.old_gross_margin_pct,
            new_gross_margin_pct: alert.new_gross_margin_pct,
            threshold: alert.threshold,
          } as Record<string, unknown>,
          read: false,
        }))

        await supabase.from('notifications').insert(notifications)
      }

      return result
    },
    [teamId, ingredientsByRecipe, recipes],
  )

  return {
    yieldAdjustedCosts,
    ingredientsByRecipe,
    loading,
    calcVariance,
    classifyMenuForPeriod,
    onIngredientPriceUpdate,
  }
}
