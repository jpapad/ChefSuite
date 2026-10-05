import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  Package,
  ChefHat,
  ClipboardList,
  Euro,
  TrendingDown,
  Percent,
  ShoppingBag,
  Sparkles,
  Loader2,
  CalendarClock,
  AlertTriangle,
  Mail,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Page, PageHeader, PillButton, StatRow, StatTile } from '../components/ui/page'
import { useInventory, isLowStock } from '../hooks/useInventory'
import { useRecipes } from '../hooks/useRecipes'
import { useFoodCost } from '../hooks/useFoodCost'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { EmailReportsDrawer } from '../components/reports/EmailReportsDrawer'

interface DayStats {
  date: string
  label: string
  total: number
  done: number
}

interface SalesDay {
  date: string
  label: string
  revenue: number
  orders: number
}

interface TopItem {
  name: string
  revenue: number
  qty: number
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

function shortLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%'
}

function foodCostColor(pct: number): string {
  if (pct <= 30) return 'text-emerald-400'
  if (pct <= 40) return 'text-amber-400'
  return 'text-red-400'
}

function foodCostBarColor(pct: number): string {
  if (pct <= 30) return 'bg-emerald-400'
  if (pct <= 40) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function Analytics() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { items } = useInventory()
  const { recipes } = useRecipes()
  const [prepStats, setPrepStats] = useState<DayStats[]>([])
  const [prepLoading, setPrepLoading] = useState(true)

  const [salesDays, setSalesDays] = useState<SalesDay[]>([])
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [salesLoading, setSalesLoading] = useState(true)

  const { recipeCosts, weeklyConsumption, totalConsumption30d, avgFoodCostPct, loading: fcLoading } =
    useFoodCost(recipes)

  const totalItems = items.length
  const lowStockCount = items.filter(isLowStock).length
  const inventoryValue = items.reduce((sum, i) => sum + (i.cost_per_unit ?? 0) * i.quantity, 0)
  const valuedItems = items.filter((i) => i.cost_per_unit != null).length

  const withCost = recipes.filter((r) => r.cost_per_portion != null)
  const avgCost = withCost.length
    ? withCost.reduce((s, r) => s + r.cost_per_portion!, 0) / withCost.length
    : null
  const topRecipes = [...withCost]
    .sort((a, b) => b.cost_per_portion! - a.cost_per_portion!)
    .slice(0, 5)

  useEffect(() => {
    if (!profile?.team_id) return
    const days = getLast7Days()

    async function load() {
      setPrepLoading(true)
      const { data } = await supabase
        .from('prep_tasks')
        .select('prep_for, done_at')
        .gte('prep_for', days[0])
        .lte('prep_for', days[days.length - 1])

      const rows = (data ?? []) as { prep_for: string; done_at: string | null }[]
      const stats: DayStats[] = days.map((date) => {
        const dayRows = rows.filter((r) => r.prep_for === date)
        return {
          date,
          label: shortLabel(date),
          total: dayRows.length,
          done: dayRows.filter((r) => r.done_at).length,
        }
      })
      setPrepStats(stats)
      setPrepLoading(false)
    }
    void load()
  }, [profile?.team_id])

  useEffect(() => {
    if (!profile?.team_id) return
    const days = getLast7Days()
    const thirtyDaysAgo = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 29)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()

    async function load() {
      setSalesLoading(true)
      const { data } = await supabase
        .from('online_orders')
        .select('id, created_at, online_order_items(price, quantity, name)')
        .eq('team_id', profile!.team_id)
        .eq('status', 'completed')
        .gte('created_at', thirtyDaysAgo)

      const rows = (data ?? []) as Array<{
        id: string
        created_at: string
        online_order_items: Array<{ price: number; quantity: number; name: string }>
      }>

      // Per-day revenue for last 7 days
      const daySales: SalesDay[] = days.map((date) => {
        const dayOrders = rows.filter((r) => r.created_at.slice(0, 10) === date)
        const revenue = dayOrders.reduce(
          (sum, o) => sum + o.online_order_items.reduce((s, i) => s + i.price * i.quantity, 0),
          0,
        )
        return { date, label: shortLabel(date), revenue, orders: dayOrders.length }
      })
      setSalesDays(daySales)

      // Top items by revenue (30d)
      const itemMap = new Map<string, { revenue: number; qty: number }>()
      for (const order of rows) {
        for (const item of order.online_order_items) {
          const existing = itemMap.get(item.name) ?? { revenue: 0, qty: 0 }
          itemMap.set(item.name, {
            revenue: existing.revenue + item.price * item.quantity,
            qty: existing.qty + item.quantity,
          })
        }
      }
      const top = [...itemMap.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
      setTopItems(top)
      setSalesLoading(false)
    }
    void load()
  }, [profile?.team_id])

  const revenue7d = useMemo(() => salesDays.reduce((s, d) => s + d.revenue, 0), [salesDays])
  const orders7d = useMemo(() => salesDays.reduce((s, d) => s + d.orders, 0), [salesDays])
  const revenueToday = salesDays.at(-1)?.revenue ?? 0
  const maxRevenue = Math.max(...salesDays.map((d) => d.revenue), 1)

  // Inventory Forecast
  const [forecastData, setForecastData] = useState<Array<{
    id: string; name: string; unit: string; current: number; dailyUsage: number; daysLeft: number | null
  }>>([])
  const [forecastLoading, setForecastLoading] = useState(true)

  useEffect(() => {
    if (!profile?.team_id || items.length === 0) return
    async function loadForecast() {
      setForecastLoading(true)
      const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString()
      const { data } = await supabase
        .from('inventory_movements')
        .select('item_id, delta')
        .eq('team_id', profile!.team_id)
        .lt('delta', 0)
        .gte('created_at', thirtyAgo)

      const usageMap = new Map<string, number>()
      for (const row of (data ?? []) as { item_id: string; delta: number }[]) {
        usageMap.set(row.item_id, (usageMap.get(row.item_id) ?? 0) + Math.abs(row.delta))
      }

      const forecast = items
        .filter((i) => usageMap.has(i.id))
        .map((i) => {
          const totalUsed = usageMap.get(i.id) ?? 0
          const dailyUsage = totalUsed / 30
          const daysLeft = dailyUsage > 0 ? Math.floor(i.quantity / dailyUsage) : null
          return { id: i.id, name: i.name, unit: i.unit, current: i.quantity, dailyUsage, daysLeft }
        })
        .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
        .slice(0, 10)

      setForecastData(forecast)
      setForecastLoading(false)
    }
    void loadForecast()
  }, [profile?.team_id, items])

  // Profitability AI
  const [aiSuggestions, setAiSuggestions] = useState<Array<{title:string;current_price:number;suggested_price:number;suggested_food_cost_pct:number;reasoning:string}>>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string|null>(null)

  async function runProfitabilityAI() {
    const eligible = recipeCosts.filter((r) => r.food_cost_pct != null && r.selling_price != null && r.selling_price > 0)
    if (eligible.length === 0) { setAiError(t('analytics.aiNoPricedRecipes')); return }
    setAiLoading(true); setAiError(null); setAiSuggestions([])
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('profitability-ai', {
        body: {
          recipes: eligible.map((r) => ({
            title: r.title,
            current_cost: r.manual_cost ?? r.auto_cost ?? 0,
            current_price: r.selling_price!,
            food_cost_pct: r.food_cost_pct!,
          })),
          avg_market_increase_pct: 8,
        },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error)
      setAiSuggestions(Array.isArray(data) ? data : [])
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAiLoading(false)
    }
  }

  const [reportsOpen, setReportsOpen] = useState(false)

  const maxTotal = Math.max(...prepStats.map((d) => d.total), 1)
  const totalTasks7d = prepStats.reduce((s, d) => s + d.total, 0)
  const doneTasks7d = prepStats.reduce((s, d) => s + d.done, 0)
  const completionRate = totalTasks7d > 0 ? Math.round((doneTasks7d / totalTasks7d) * 100) : null

  const recipesWithPct = recipeCosts
    .filter((r) => r.food_cost_pct != null)
    .sort((a, b) => b.food_cost_pct! - a.food_cost_pct!)
    .slice(0, 6)

  const maxConsumption = Math.max(...weeklyConsumption.map((w) => w.cost), 1)

  return (
    <Page>
      <PageHeader
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
        actions={<PillButton icon={Mail} onClick={() => setReportsOpen(true)}>{t('reports.emailReport')}</PillButton>}
      />

      {/* ── Sales bento ── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-5 rounded-3xl bg-ink p-6 text-white-fixed sm:col-span-2 lg:row-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[#C9CEC8]">{t('analytics.revenue7d')}</p>
              <p className="mt-1 text-5xl font-medium tracking-[-0.04em] tabular-nums text-lime">{salesLoading ? '…' : `€${fmt(revenue7d)}`}</p>
              <p className="mt-1 text-sm text-[#C9CEC8]">{t('analytics.ordersCount', { count: orders7d })}</p>
            </div>
            <ShoppingBag className="h-5 w-5 text-[#C9CEC8]" />
          </div>
          {!salesLoading && revenue7d > 0 ? (
            <div className="mt-auto flex h-36 items-end gap-2">
              {salesDays.map((d, i) => {
                const heightPct = (d.revenue / maxRevenue) * 100
                const isLast = i === salesDays.length - 1
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className={cn('w-full rounded-t-lg', isLast ? 'bg-lime' : 'bg-white-fixed/15')}
                      style={{ height: `${Math.max(heightPct, d.revenue > 0 ? 6 : 2)}%` }}
                      title={`€${fmt(d.revenue)}`}
                    />
                    <span className="text-[11px] text-[#A7ADA6]">{d.label}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-auto text-sm text-[#A7ADA6]">{salesLoading ? t('common.loading') : t('analytics.noSalesData')}</p>
          )}
        </div>
        <StatTile label={t('analytics.revenueToday')} value={salesLoading ? '…' : `€${fmt(revenueToday)}`} hint={t('analytics.completedOrders', { count: salesDays.at(-1)?.orders ?? 0 })} />
        <StatTile label={t('analytics.avgOrderValue')} value={salesLoading || orders7d === 0 ? '—' : `€${fmt(revenue7d / orders7d)}`} hint={t('analytics.last7days')} />
        <StatTile
          label={t('analytics.avgFoodCostPct')}
          value={fcLoading ? '…' : avgFoodCostPct != null ? fmtPct(avgFoodCostPct) : '—'}
          tone={avgFoodCostPct == null ? 'default' : avgFoodCostPct <= 30 ? 'good' : avgFoodCostPct <= 40 ? 'warn' : 'bad'}
          hint={`${t('analytics.targetFoodCost')} ≤ 30%`}
        />
        <StatTile tone="lime" label={t('analytics.prepRate7d')} value={completionRate != null ? `${completionRate}%` : '—'} hint={prepLoading ? t('common.loading') : t('analytics.tasksDone', { done: doneTasks7d, total: totalTasks7d })} to="/prep" />
      </section>

      <StatRow>
        <StatTile label={t('analytics.inventoryValue')} value={valuedItems > 0 ? `€${fmt(inventoryValue)}` : '—'} icon={Package}
          hint={valuedItems < totalItems ? t('analytics.itemsMissingCost', { count: totalItems - valuedItems }) : t('analytics.itemsTotal', { count: totalItems })} />
        <StatTile label={t('analytics.lowStockItems')} value={lowStockCount} tone={lowStockCount > 0 ? 'warn' : 'good'} icon={Package}
          hint={lowStockCount > 0 ? t('analytics.needRestocking') : t('analytics.allLevelsOK')} to="/inventory" />
        <StatTile label={t('analytics.avgRecipeCost')} value={avgCost != null ? `€${fmt(avgCost)}` : '—'} icon={ChefHat}
          hint={t('analytics.recipesPriced', { with: withCost.length, total: recipes.length })} />
        <StatTile label={t('analytics.consumptionCost30d')} value={fcLoading ? '…' : `€${fmt(totalConsumption30d)}`} icon={Euro}
          hint={t('analytics.trackedMovementsOnly')} />
      </StatRow>

      <div className="grid gap-6">
        <GlassCard>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-orange" />
            {t('analytics.topSellingItems')}
          </h2>
          {salesLoading ? (
            <p className="text-white/50 text-sm">{t('common.loading')}</p>
          ) : topItems.length === 0 ? (
            <p className="text-white/50 text-sm">{t('analytics.noSalesData')}</p>
          ) : (
            <ul className="space-y-3">
              {topItems.map((item, i) => {
                const maxRev = topItems[0].revenue
                return (
                  <li key={item.name}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-white/40 w-4 shrink-0">#{i + 1}</span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-white/40 text-xs">×{item.qty}</span>
                        <span className="font-medium tabular-nums">€{fmt(item.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-ink"
                        style={{ width: `${(item.revenue / maxRev) * 100}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-emerald-400" />
          {t('analytics.consumptionTrend')}
        </h2>
        {fcLoading ? (
          <p className="text-white/50 text-sm">{t('common.loading')}</p>
        ) : weeklyConsumption.length === 0 ? (
          <p className="text-white/50 text-sm">{t('analytics.noConsumptionData')}</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {weeklyConsumption.map((w) => {
              const heightPct = (w.cost / maxConsumption) * 100
              return (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-white/50">€{w.cost < 100 ? fmt(w.cost) : Math.round(w.cost)}</div>
                  <div
                    className="w-full rounded-t-lg bg-ink transition-all"
                    style={{ height: `${Math.max(heightPct, 6)}%` }}
                  />
                  <div className="text-[10px] text-white/50 text-center">{w.label}</div>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-amber-400" />
          {t('analytics.prepCompletion')}
        </h2>
        {prepLoading ? (
          <p className="text-white/50 text-sm">{t('common.loading')}</p>
        ) : (
          <div className="flex items-end gap-2 h-36">
            {prepStats.map((d) => {
              const heightPct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0
              const donePct = d.total > 0 ? (d.done / d.total) * 100 : 0
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-white/50">
                    {d.total > 0 ? `${d.done}/${d.total}` : ''}
                  </div>
                  <div
                    className="w-full rounded-t-lg overflow-hidden bg-white/10 flex flex-col justify-end"
                    style={{ height: `${Math.max(heightPct, 8)}%`, minHeight: '8px' }}
                  >
                    <div
                      className="w-full bg-amber-400 rounded-t-lg transition-all"
                      style={{ height: `${donePct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-white/50 text-center leading-tight">
                    {d.label}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Percent className="h-5 w-5 text-amber-400" />
            {t('analytics.foodCostByRecipe')}
          </h2>
          <p className="text-xs text-white/40 mb-4">{t('analytics.foodCostHint')}</p>
          {fcLoading ? (
            <p className="text-white/50 text-sm">{t('common.loading')}</p>
          ) : recipesWithPct.length === 0 ? (
            <p className="text-white/50 text-sm">{t('analytics.noRecipesWithSellingPrice')}</p>
          ) : (
            <ul className="space-y-3">
              {recipesWithPct.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="truncate text-white/80">{r.title}</span>
                    <span className={cn('font-semibold shrink-0 ml-2', foodCostColor(r.food_cost_pct!))}>
                      {fmtPct(r.food_cost_pct!)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', foodCostBarColor(r.food_cost_pct!))}
                      style={{ width: `${Math.min(r.food_cost_pct!, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/40 mt-0.5">
                    <span>Cost: €{fmt(r.manual_cost ?? r.auto_cost ?? 0)}</span>
                    <span>Sell: €{fmt(r.selling_price!)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <div className="space-y-6">
          <GlassCard>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Euro className="h-5 w-5 text-brand-orange" />
              {t('analytics.topRecipesByCost')}
            </h2>
            {topRecipes.length === 0 ? (
              <p className="text-white/50 text-sm">{t('analytics.noRecipesWithCost')}</p>
            ) : (
              <ul className="space-y-3">
                {topRecipes.map((r, i) => {
                  const maxCost = topRecipes[0].cost_per_portion!
                  const pct = (r.cost_per_portion! / maxCost) * 100
                  return (
                    <li key={r.id}>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-white/40 w-4 shrink-0">#{i + 1}</span>
                          <span className="truncate">{r.title}</span>
                        </span>
                        <span className="text-brand-orange font-medium shrink-0 ml-2">
                          €{fmt(r.cost_per_portion!)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/10">
                        <div
                          className="h-1.5 rounded-full bg-brand-orange"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </GlassCard>

          <GlassCard>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              {t('analytics.topInventoryByValue')}
            </h2>
            {items.length === 0 ? (
              <p className="text-white/50 text-sm">{t('analytics.noInventoryItems')}</p>
            ) : (
              (() => {
                const valued = items
                  .filter((i) => i.cost_per_unit != null)
                  .map((i) => ({ ...i, totalValue: i.cost_per_unit! * i.quantity }))
                  .sort((a, b) => b.totalValue - a.totalValue)
                  .slice(0, 5)
                const maxVal = valued[0]?.totalValue ?? 1
                return valued.length === 0 ? (
                  <p className="text-white/50 text-sm">{t('analytics.noItemsWithCost')}</p>
                ) : (
                  <ul className="space-y-3">
                    {valued.map((item, i) => (
                      <li key={item.id}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-white/40 w-4 shrink-0">#{i + 1}</span>
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="text-blue-400 font-medium shrink-0 ml-2">
                            €{fmt(item.totalValue)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                          <div
                            className="h-1.5 rounded-full bg-blue-400"
                            style={{ width: `${(item.totalValue / maxVal) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              })()
            )}
          </GlassCard>
        </div>
      </div>

      {/* Inventory Forecast */}
      <GlassCard>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-purple-400" />
          {t('analytics.inventoryForecast')}
        </h2>
        <p className="text-xs text-white/40 mb-4">{t('analytics.inventoryForecastHint')}</p>
        {forecastLoading ? (
          <p className="text-white/50 text-sm">{t('common.loading')}</p>
        ) : forecastData.length === 0 ? (
          <p className="text-white/50 text-sm">{t('analytics.forecastNoData')}</p>
        ) : (
          <div className="space-y-2">
            {forecastData.map((row) => {
              const urgent = row.daysLeft !== null && row.daysLeft <= 3
              const warning = row.daysLeft !== null && row.daysLeft <= 7 && !urgent
              return (
                <div key={row.id} className={cn('flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm', urgent ? 'border-red-500/30 bg-red-500/5' : warning ? 'border-amber-500/30 bg-amber-500/5' : 'border-glass-border')}>
                  {urgent && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
                  {warning && <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />}
                  {!urgent && !warning && <Package className="h-4 w-4 text-white/20 shrink-0" />}
                  <span className="flex-1 truncate text-white/80">{row.name}</span>
                  <span className="text-white/40 text-xs shrink-0">{row.current.toFixed(1)} {row.unit}</span>
                  <span className={cn('shrink-0 font-medium tabular-nums', urgent ? 'text-red-400' : warning ? 'text-amber-400' : 'text-white/60')}>
                    {row.daysLeft !== null ? t('analytics.daysLeft', { count: row.daysLeft }) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      {/* Profitability AI */}
      <GlassCard>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-orange" />
            {t('analytics.profitabilityAI')}
          </h2>
          <button type="button" onClick={() => void runProfitabilityAI()} disabled={aiLoading}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-brand-orange/15 text-brand-orange hover:bg-brand-orange/25 transition disabled:opacity-50">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? t('analytics.aiAnalysing') : t('analytics.aiAnalyse')}
          </button>
        </div>
        <p className="text-xs text-white/40 mb-4">{t('analytics.profitabilityAIHint')}</p>

        {aiError && <p className="text-sm text-red-400">{aiError}</p>}

        {aiSuggestions.length > 0 && (
          <ul className="space-y-3">
            {aiSuggestions.map((s) => {
              const changed = s.suggested_price !== s.current_price
              return (
                <li key={s.title} className={cn('rounded-xl border px-4 py-3', changed ? 'border-brand-orange/30 bg-brand-orange/5' : 'border-glass-border')}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">{s.reasoning}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {changed ? (
                        <div>
                          <span className="text-white/40 line-through text-sm mr-2">€{fmt(s.current_price)}</span>
                          <span className="text-brand-orange font-bold">€{fmt(s.suggested_price)}</span>
                        </div>
                      ) : (
                        <span className="text-emerald-400 text-sm">€{fmt(s.current_price)} ✓</span>
                      )}
                      <p className="text-xs text-white/40 mt-0.5">{t('analytics.aiFoodCost')}: {s.suggested_food_cost_pct.toFixed(1)}%</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!aiLoading && aiSuggestions.length === 0 && !aiError && (
          <p className="text-sm text-white/40">{t('analytics.aiClickToAnalyse')}</p>
        )}
      </GlassCard>

      <EmailReportsDrawer open={reportsOpen} onClose={() => setReportsOpen(false)} />
    </Page>
  )
}
