import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Recipe } from '../types/database.types'

export interface RecipeCostRow {
  id: string
  title: string
  auto_cost: number | null
  manual_cost: number | null
  selling_price: number | null
  food_cost_pct: number | null
}

export interface WeeklyConsumption {
  week: string   // YYYY-Www
  label: string  // e.g. "Apr 14"
  cost: number
}

interface FoodCostData {
  recipeCosts: RecipeCostRow[]
  weeklyConsumption: WeeklyConsumption[]
  totalConsumption30d: number
  potentialRevenue: number
  avgFoodCostPct: number | null
  loading: boolean
}

type IngredientRow = {
  recipe_id: string
  quantity: number
  inventory: { cost_per_unit: number | null } | null
}

type MovementRow = {
  delta: number
  created_at: string
  inventory: { cost_per_unit: number | null } | null
}

function isoWeekLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function weekKey(iso: string): string {
  const d = new Date(iso)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const diff = (d.getTime() - jan4.getTime()) / 86400000
  const week = Math.ceil((diff + jan4.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function useFoodCost(recipes: Recipe[]): FoodCostData {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [recipeCosts, setRecipeCosts] = useState<RecipeCostRow[]>([])
  const [weeklyConsumption, setWeeklyConsumption] = useState<WeeklyConsumption[]>([])
  const [totalConsumption30d, setTotalConsumption30d] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId || recipes.length === 0) {
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)

      // 1. Recipe ingredient costs
      const { data: ingData } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, quantity, inventory:inventory_item_id(cost_per_unit)')

      const ingredients = (ingData ?? []) as unknown as IngredientRow[]

      // Group by recipe_id → sum cost
      const autoCostMap = new Map<string, number>()
      for (const row of ingredients) {
        const cpu = row.inventory?.cost_per_unit ?? null
        if (cpu == null) continue
        const prev = autoCostMap.get(row.recipe_id) ?? 0
        autoCostMap.set(row.recipe_id, prev + row.quantity * cpu)
      }

      const rows: RecipeCostRow[] = recipes.map((r) => {
        const auto = autoCostMap.get(r.id) ?? null
        const cost = r.cost_per_portion ?? auto
        const sp = r.selling_price
        const pct = cost != null && sp != null && sp > 0 ? (cost / sp) * 100 : null
        return {
          id: r.id,
          title: r.title,
          auto_cost: auto != null ? Math.round(auto * 100) / 100 : null,
          manual_cost: r.cost_per_portion,
          selling_price: sp,
          food_cost_pct: pct != null ? Math.round(pct * 10) / 10 : null,
        }
      })
      setRecipeCosts(rows)

      // 2. Consumption movements last 30 days
      const since = new Date()
      since.setDate(since.getDate() - 30)

      const { data: mvData } = await supabase
        .from('inventory_movements')
        .select('delta, created_at, inventory:item_id(cost_per_unit)')
        .lt('delta', 0)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true })

      const movements = (mvData ?? []) as unknown as MovementRow[]

      // Group by ISO week
      const weekMap = new Map<string, { cost: number; firstDate: string }>()
      let total = 0
      for (const mv of movements) {
        const cpu = mv.inventory?.cost_per_unit ?? null
        if (cpu == null) continue
        const cost = Math.abs(mv.delta) * cpu
        total += cost
        const key = weekKey(mv.created_at)
        const entry = weekMap.get(key)
        if (entry) {
          entry.cost += cost
        } else {
          weekMap.set(key, { cost, firstDate: mv.created_at })
        }
      }

      const weekly: WeeklyConsumption[] = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, { cost, firstDate }]) => ({
          week,
          label: isoWeekLabel(firstDate),
          cost: Math.round(cost * 100) / 100,
        }))

      setWeeklyConsumption(weekly)
      setTotalConsumption30d(Math.round(total * 100) / 100)
      setLoading(false)
    }

    void load()
  }, [teamId, recipes])

  const withPct = recipeCosts.filter((r) => r.food_cost_pct != null)
  const avgFoodCostPct = withPct.length
    ? Math.round((withPct.reduce((s, r) => s + r.food_cost_pct!, 0) / withPct.length) * 10) / 10
    : null

  const potentialRevenue = recipes.reduce((s, r) => s + (r.selling_price ?? 0), 0)

  return { recipeCosts, weeklyConsumption, totalConsumption30d, potentialRevenue, avgFoodCostPct, loading }
}
