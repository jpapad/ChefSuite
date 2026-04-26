import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Drawer } from '../ui/Drawer'
import { cn } from '../../lib/cn'
import type { MenuWithSections, Recipe } from '../../types/database.types'

interface IngredientRow {
  recipe_id: string
  quantity: number
  inventory: { cost_per_unit: number | null } | null
}

interface CostRow {
  itemName: string
  sectionName: string
  recipeTitle: string
  cost: number | null
  price: number | null
  foodCostPct: number | null
  margin: number | null
}

function statusColor(pct: number | null): string {
  if (pct === null) return 'text-white/30'
  if (pct <= 35) return 'text-emerald-400'
  if (pct <= 45) return 'text-amber-400'
  return 'text-red-400'
}

function statusBg(pct: number | null): string {
  if (pct === null) return 'bg-white/5'
  if (pct <= 35) return 'bg-emerald-400/10'
  if (pct <= 45) return 'bg-amber-400/10'
  return 'bg-red-500/10'
}

function StatusIcon({ pct }: { pct: number | null }) {
  if (pct === null) return <Info className="h-4 w-4 text-white/20" />
  if (pct <= 35) return <CheckCircle className="h-4 w-4 text-emerald-400" />
  if (pct <= 45) return <AlertTriangle className="h-4 w-4 text-amber-400" />
  return <XCircle className="h-4 w-4 text-red-400" />
}

interface Props {
  open: boolean
  onClose: () => void
  menu: MenuWithSections
  recipes: Recipe[]
}

export function MenuCostAnalysis({ open, onClose, menu, recipes }: Props) {
  const { t } = useTranslation()
  const [autoCosts, setAutoCosts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)

  // Get all linked recipe IDs from menu items
  const linkedRecipeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const section of menu.sections) {
      for (const item of section.items) {
        if (item.recipe_id) ids.add(item.recipe_id)
      }
    }
    return [...ids]
  }, [menu])

  useEffect(() => {
    if (!open || linkedRecipeIds.length === 0) return
    setLoading(true)
    supabase
      .from('recipe_ingredients')
      .select('recipe_id, quantity, inventory:inventory_item_id(cost_per_unit)')
      .in('recipe_id', linkedRecipeIds)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as IngredientRow[]
        const costMap = new Map<string, number>()
        for (const row of rows) {
          const cpu = row.inventory?.cost_per_unit ?? null
          if (cpu == null) continue
          costMap.set(row.recipe_id, (costMap.get(row.recipe_id) ?? 0) + row.quantity * cpu)
        }
        setAutoCosts(costMap)
        setLoading(false)
      })
  }, [open, linkedRecipeIds.join(',')])

  const rows: CostRow[] = useMemo(() => {
    const result: CostRow[] = []
    for (const section of menu.sections) {
      for (const item of section.items) {
        if (!item.recipe_id) continue
        const recipe = recipes.find((r) => r.id === item.recipe_id)
        if (!recipe) continue
        const autoCost = autoCosts.get(recipe.id) ?? null
        const cost = recipe.cost_per_portion ?? (autoCost != null ? Math.round(autoCost * 100) / 100 : null)
        const price = item.price
        const foodCostPct = cost != null && price != null && price > 0
          ? Math.round((cost / price) * 1000) / 10
          : null
        const margin = cost != null && price != null ? Math.round((price - cost) * 100) / 100 : null
        result.push({
          itemName: item.name,
          sectionName: section.name,
          recipeTitle: recipe.title,
          cost,
          price,
          foodCostPct,
          margin,
        })
      }
    }
    return result
  }, [menu, recipes, autoCosts])

  const summary = useMemo(() => {
    const withCost = rows.filter((r) => r.cost != null)
    const withPrice = rows.filter((r) => r.price != null)
    const withPct = rows.filter((r) => r.foodCostPct != null)
    const avgPct = withPct.length
      ? Math.round(withPct.reduce((s, r) => s + r.foodCostPct!, 0) / withPct.length * 10) / 10
      : null
    return { total: rows.length, withCost: withCost.length, withPrice: withPrice.length, avgPct }
  }, [rows])

  return (
    <Drawer open={open} onClose={onClose} title={t('menus.cost.drawerTitle')}>
      <div className="space-y-5">
        {loading ? (
          <p className="text-white/50 text-sm">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <TrendingUp className="h-10 w-10 text-white/20" />
            <p className="text-white/50 text-sm">{t('menus.cost.noCostData')}</p>
            <p className="text-white/30 text-xs max-w-xs">{t('menus.cost.noCostHint')}</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 border border-glass-border p-3 space-y-0.5">
                <p className="text-xs text-white/50">{t('menus.cost.totalItems')}</p>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-white/40">{summary.withCost} {t('menus.cost.itemsWithCost').toLowerCase()}</p>
              </div>
              <div className={cn(
                'rounded-xl border border-glass-border p-3 space-y-0.5',
                summary.avgPct != null ? statusBg(summary.avgPct) : 'bg-white/5',
              )}>
                <p className="text-xs text-white/50">{t('menus.cost.avgFoodCost')}</p>
                <p className={cn('text-2xl font-bold', statusColor(summary.avgPct))}>
                  {summary.avgPct != null ? `${summary.avgPct}%` : '—'}
                </p>
                <p className="text-xs text-white/40">{t('menus.cost.targetHint')}</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> ≤35%</span>
              <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> 35–45%</span>
              <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-400" /> &gt;45%</span>
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className={cn(
                  'rounded-xl border border-glass-border p-3 space-y-1.5',
                  statusBg(row.foodCostPct),
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{row.itemName}</p>
                      <p className="text-xs text-white/40">{row.sectionName} · {row.recipeTitle}</p>
                    </div>
                    <StatusIcon pct={row.foodCostPct} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-white/40">{t('menus.cost.cost')}</p>
                      <p className="font-semibold">
                        {row.cost != null ? `€${row.cost.toFixed(2)}` : <span className="text-white/30">{t('menus.cost.noCost')}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">{t('menus.cost.price')}</p>
                      <p className="font-semibold">
                        {row.price != null ? `€${row.price.toFixed(2)}` : <span className="text-white/30">{t('menus.cost.noPrice')}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">{t('menus.cost.foodCostPct')}</p>
                      <p className={cn('font-semibold', statusColor(row.foodCostPct))}>
                        {row.foodCostPct != null ? `${row.foodCostPct}%` : '—'}
                      </p>
                    </div>
                  </div>
                  {row.margin != null && (
                    <p className="text-xs text-white/40">
                      {t('menus.cost.margin')}: <span className="text-white/70 font-medium">€{row.margin.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
