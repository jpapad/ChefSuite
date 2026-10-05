import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Euro, ShoppingBag, Trash2, Scale, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, Panel, Segmented, EmptyState } from '../components/ui/page'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { computeAutoCosts, costStatus } from '../lib/foodCost'
import { useTeamSettings } from '../hooks/useTeamSettings'

type Period = '7d' | '30d' | '90d' | 'mtd' | 'ytd'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function periodStart(p: Period): string {
  const now = new Date()
  if (p === '7d') { const d = new Date(now); d.setDate(d.getDate() - 6); return isoDate(d) }
  if (p === '30d') { const d = new Date(now); d.setDate(d.getDate() - 29); return isoDate(d) }
  if (p === '90d') { const d = new Date(now); d.setDate(d.getDate() - 89); return isoDate(d) }
  if (p === 'mtd') { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01` }
  if (p === 'ytd') { return `${now.getFullYear()}-01-01` }
  return isoDate(now)
}

function weekKey(iso: string): string {
  const d = new Date(iso)
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 1 - day) // Monday
  return isoDate(d)
}

function shortWeek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmt2(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface WeekRow {
  week: string
  label: string
  revenue: number
  purchases: number
  waste: number
  profit: number
}

export default function ProfitLoss() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { targetFoodCostPct: target } = useTeamSettings()
  const [period, setPeriod] = useState<Period>('30d')
  const [revenue, setRevenue] = useState(0)
  const [purchases, setPurchases] = useState(0)
  const [waste, setWaste] = useState(0)
  const [weeks, setWeeks] = useState<WeekRow[]>([])
  const [loading, setLoading] = useState(true)
  const [idealFoodCost, setIdealFoodCost] = useState(0)
  const [actualFoodCost, setActualFoodCost] = useState(0)

  useEffect(() => {
    if (!profile?.team_id) return
    const from = periodStart(period)

    async function load() {
      setLoading(true)
      const teamId = profile!.team_id

      const [revRes, purRes, wasteRes, posRes] = await Promise.all([
        // Revenue: completed online orders
        supabase
          .from('online_order_items')
          .select('price, quantity, menu_item_id, online_orders!inner(created_at, status, team_id)')
          .eq('online_orders.status', 'completed')
          .eq('online_orders.team_id', teamId)
          .gte('online_orders.created_at', from),

        // Purchases: received purchase orders
        supabase
          .from('purchase_order_items')
          .select('unit_price, quantity, purchase_orders!inner(received_at, status, team_id)')
          .eq('purchase_orders.status', 'received')
          .eq('purchase_orders.team_id', teamId)
          .gte('purchase_orders.received_at', from),

        // Waste cost
        supabase
          .from('waste_entries')
          .select('cost, wasted_at')
          .eq('team_id', teamId)
          .gte('wasted_at', from)
          .not('cost', 'is', null),

        // POS transactions (Viva / Square)
        supabase
          .from('pos_transactions')
          .select('amount, transacted_at')
          .eq('team_id', teamId)
          .eq('status', 'completed')
          .gte('transacted_at', from),
      ])

      type RevRow = { price: number; quantity: number; menu_item_id: string | null; online_orders: { created_at: string } }
      type PurRow = { unit_price: number; quantity: number; purchase_orders: { received_at: string } }
      type WasteRow = { cost: number; wasted_at: string }
      type PosRow = { amount: number; transacted_at: string }

      const revRows = (revRes.data ?? []) as unknown as RevRow[]
      const purRows = (purRes.data ?? []) as unknown as PurRow[]
      const wasteRows = (wasteRes.data ?? []) as WasteRow[]
      const posRows = (posRes.data ?? []) as PosRow[]

      const totalOnlineRev = revRows.reduce((s, r) => s + r.price * r.quantity, 0)
      const totalPosRev = posRows.reduce((s, r) => s + r.amount, 0)
      const totalPur = purRows.reduce((s, r) => s + (r.unit_price ?? 0) * r.quantity, 0)
      const totalWaste = wasteRows.reduce((s, r) => s + (r.cost ?? 0), 0)

      setRevenue(totalOnlineRev + totalPosRev)
      setPurchases(totalPur)
      setWaste(totalWaste)

      // Weekly breakdown
      const weekMap = new Map<string, { revenue: number; purchases: number; waste: number }>()
      const ensure = (k: string) => {
        if (!weekMap.has(k)) weekMap.set(k, { revenue: 0, purchases: 0, waste: 0 })
        return weekMap.get(k)!
      }
      for (const r of revRows) { const k = weekKey(r.online_orders.created_at.slice(0, 10)); ensure(k).revenue += r.price * r.quantity }
      for (const r of posRows) { const k = weekKey(r.transacted_at.slice(0, 10)); ensure(k).revenue += r.amount }
      for (const r of purRows) { const k = weekKey(r.purchase_orders.received_at?.slice(0, 10) ?? from); ensure(k).purchases += (r.unit_price ?? 0) * r.quantity }
      for (const r of wasteRows) { const k = weekKey(r.wasted_at); ensure(k).waste += r.cost ?? 0 }

      const weekRows: WeekRow[] = [...weekMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, v]) => ({
          week,
          label: shortWeek(week),
          ...v,
          profit: v.revenue - v.purchases - v.waste,
        }))

      setWeeks(weekRows)

      // ── Ideal vs Actual food cost ──────────────────────────────────────────
      const soldMenuItemIds = [...new Set(revRows.map((r) => r.menu_item_id).filter(Boolean) as string[])]
      if (soldMenuItemIds.length > 0 && totalOnlineRev > 0) {
        const { data: menuItemsData } = await supabase
          .from('menu_items')
          .select('id, recipe_id, portions')
          .in('id', soldMenuItemIds)

        type MenuItemRow = { id: string; recipe_id: string | null; portions: number }
        const menuItemsRows = (menuItemsData ?? []) as MenuItemRow[]
        const menuItemMap = new Map(menuItemsRows.map((m) => [m.id, m]))

        const recipeIds = [...new Set(menuItemsRows.map((m) => m.recipe_id).filter(Boolean) as string[])]
        const autoCosts = recipeIds.length > 0 ? await computeAutoCosts(recipeIds) : new Map<string, number>()

        let idealCost = 0
        for (const row of revRows) {
          if (!row.menu_item_id) continue
          const mi = menuItemMap.get(row.menu_item_id)
          if (!mi?.recipe_id) continue
          const recipeCost = autoCosts.get(mi.recipe_id)
          if (recipeCost == null) continue
          idealCost += row.quantity * (mi.portions ?? 1) * recipeCost
        }
        setIdealFoodCost(Math.round(idealCost * 100) / 100)

        type MvRow = { delta: number; inventory: { cost_per_unit: number | null } | null }
        const { data: mvData } = await supabase
          .from('inventory_movements')
          .select('delta, inventory:item_id(cost_per_unit)')
          .eq('team_id', teamId)
          .lt('delta', 0)
          .gte('created_at', from)
        const mvRows = (mvData ?? []) as unknown as MvRow[]
        const actualCost = mvRows.reduce((sum, mv) => {
          const cpu = mv.inventory?.cost_per_unit ?? null
          return cpu != null ? sum + Math.abs(mv.delta) * cpu : sum
        }, 0)
        setActualFoodCost(Math.round(actualCost * 100) / 100)
      } else {
        setIdealFoodCost(0)
        setActualFoodCost(0)
      }

      setLoading(false)
    }

    void load()
  }, [profile?.team_id, period])

  const grossProfit = revenue - purchases - waste
  const gpPct = revenue > 0 ? (grossProfit / revenue) * 100 : null

  const maxWeekRev = useMemo(() => Math.max(...weeks.map((w) => w.revenue), 1), [weeks])
  const maxWeekCost = useMemo(() => Math.max(...weeks.map((w) => w.purchases + w.waste), 1), [weeks])
  const maxBar = Math.max(maxWeekRev, maxWeekCost, 1)

  const PERIODS: { key: Period; label: string }[] = [
    { key: '7d',  label: t('pl.period7d') },
    { key: '30d', label: t('pl.period30d') },
    { key: '90d', label: t('pl.period90d') },
    { key: 'mtd', label: t('pl.periodMtd') },
    { key: 'ytd', label: t('pl.periodYtd') },
  ]

  const gpTone = gpPct == null ? 'text-white/40' : gpPct >= 60 ? 'text-emerald-500' : gpPct >= 40 ? 'text-amber-500' : 'text-red-500'
  const lines = [
    { label: t('pl.revenue'), sub: t('pl.fromOnlineOrders'), value: revenue, sign: '', icon: ShoppingBag, bar: 'bg-ink' },
    { label: t('pl.purchases'), sub: t('pl.receivedOrders'), value: purchases, sign: '−', icon: Euro, bar: 'bg-sky-500' },
    { label: t('pl.waste'), sub: t('pl.wastedIngredients'), value: waste, sign: '−', icon: Trash2, bar: 'bg-amber-500' },
  ]
  const lineMax = Math.max(revenue, purchases, waste, 1)

  return (
    <Page>
      <PageHeader
        title={t('pl.title')}
        subtitle={t('pl.subtitle')}
        actions={<Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />}
      />

      {!loading && revenue === 0 && purchases === 0 && waste === 0 ? (
        <EmptyState icon={TrendingUp} title={t('pl.empty.title')} body={t('pl.empty.description')} />
      ) : (
        <>
          {/* ── Statement ── */}
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="flex flex-col justify-between gap-6 rounded-3xl bg-ink p-6 sm:p-7 text-white-fixed">
              <div className="flex items-center justify-between text-sm text-[#C9CEC8]">
                {t('pl.grossProfit')}
                {grossProfit >= 0 ? <TrendingUp className="h-5 w-5 text-lime" /> : <TrendingDown className="h-5 w-5 text-red-400" />}
              </div>
              <p className={cn('text-6xl font-medium tracking-[-0.04em] tabular-nums', grossProfit >= 0 ? 'text-lime' : 'text-red-400')}>
                {loading ? '…' : `€${fmt(grossProfit)}`}
              </p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-[#C9CEC8]">{t('pl.gpPct')}</p>
                  <p className="text-3xl font-medium tabular-nums">{gpPct != null ? `${gpPct.toFixed(1)}%` : '—'}</p>
                </div>
                <p className="max-w-[12rem] text-right text-xs text-[#A7ADA6]">{t('pl.gpBenchmark')}</p>
              </div>
            </div>

            <Panel title={t('pl.v2.statement')}>
              <ul className="flex flex-col gap-4">
                {lines.map(({ label, sub, value, sign, icon: Icon, bar }) => (
                  <li key={label} className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]"><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{label}</p>
                        <p className="text-xs text-white/50">{sub}</p>
                      </div>
                      <span className="text-xl font-medium tabular-nums">{loading ? '…' : `${sign}€${fmt2(value)}`}</span>
                    </div>
                    <div className="ml-[52px] h-2 rounded-full bg-white/[0.06]">
                      <div className={cn('h-2 rounded-full transition-all', bar)} style={{ width: `${(value / lineMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t border-white/[0.08] pt-4">
                  <span className="font-medium">{t('pl.grossProfit')}</span>
                  <span className={cn('text-2xl font-medium tabular-nums', grossProfit >= 0 ? '' : 'text-red-500')}>€{fmt(grossProfit)}</span>
                </li>
                {gpPct != null && <li className={cn('-mt-2 text-right text-sm font-medium', gpTone)}>{gpPct.toFixed(1)}% {t('pl.gpPct')}</li>}
              </ul>
            </Panel>
          </section>

          {/* ── Weekly trend ── */}
          {!loading && weeks.length > 0 && (
            <Panel
              title={t('pl.weeklyTrend')}
              actions={
                <div className="flex items-center gap-4 text-xs text-white/55">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" />{t('pl.revenue')}</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500/60" />{t('pl.costs')}</span>
                </div>
              }
            >
              <p className="-mt-2 text-xs text-white/50">{t('pl.weeklyTrendHint')}</p>
              <div className="flex items-end gap-3">
                {weeks.map((w) => {
                  const revH = (w.revenue / maxBar) * 100
                  const costH = ((w.purchases + w.waste) / maxBar) * 100
                  return (
                    <div key={w.week} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-40 w-full items-end justify-center gap-1">
                        <div className="flex flex-1 flex-col justify-end">
                          <div className="w-full rounded-t-lg bg-ink" style={{ height: `${Math.max(revH, w.revenue > 0 ? 4 : 0)}%` }} title={`${t('pl.revenue')}: €${fmt2(w.revenue)}`} />
                        </div>
                        <div className="flex flex-1 flex-col justify-end">
                          <div className="w-full rounded-t-lg bg-red-500/60" style={{ height: `${Math.max(costH, w.purchases + w.waste > 0 ? 4 : 0)}%` }} title={`${t('pl.costs')}: €${fmt2(w.purchases + w.waste)}`} />
                        </div>
                      </div>
                      <span className={cn('text-xs font-medium tabular-nums', w.profit >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                        {w.profit >= 0 ? '+' : ''}€{fmt(w.profit)}
                      </span>
                      <span className="w-full truncate text-center text-[11px] text-white/45">{w.label}</span>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* ── Ideal vs actual food cost ── */}
          {!loading && revenue > 0 && (idealFoodCost > 0 || actualFoodCost > 0) && (() => {
            const idealPct = revenue > 0 ? (idealFoodCost / revenue) * 100 : null
            const actualPct = revenue > 0 ? (actualFoodCost / revenue) * 100 : null
            const variance = idealPct != null && actualPct != null ? actualPct - idealPct : null
            const toneFor = (st: ReturnType<typeof costStatus>) => st === 'good' ? 'text-emerald-500' : st === 'warn' ? 'text-amber-500' : st === 'bad' ? 'text-red-500' : 'text-white/40'
            const varianceTone = variance == null ? 'text-white/40' : variance > 3 ? 'text-red-500' : variance > 0 ? 'text-amber-500' : 'text-emerald-500'
            return (
              <Panel
                title={<span className="flex items-center gap-2"><Scale className="h-5 w-5" />{t('pl.v2.idealVsActual')}</span>}
                actions={<span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/55"><Info className="h-3.5 w-3.5" />{t('pl.v2.idealOnlineOnly')}</span>}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/[0.04] p-4">
                    <p className="text-sm text-white/55">{t('pl.v2.ideal')}</p>
                    <p className={cn('text-3xl font-medium tabular-nums', toneFor(costStatus(idealPct, target)))}>{idealPct != null ? `${idealPct.toFixed(1)}%` : '—'}</p>
                    <p className="text-xs text-white/45 tabular-nums">€{fmt2(idealFoodCost)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] p-4">
                    <p className="text-sm text-white/55">{t('pl.v2.actual')}</p>
                    <p className={cn('text-3xl font-medium tabular-nums', toneFor(costStatus(actualPct, target)))}>{actualPct != null ? `${actualPct.toFixed(1)}%` : '—'}</p>
                    <p className="text-xs text-white/45 tabular-nums">€{fmt2(actualFoodCost)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] p-4">
                    <p className="text-sm text-white/55">{t('pl.v2.variance')}</p>
                    <p className={cn('text-3xl font-medium tabular-nums', varianceTone)}>{variance != null ? `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%` : '—'}</p>
                    {variance != null && (
                      <p className="text-xs text-white/45">{variance > 0 ? t('pl.v2.overuse') : variance < 0 ? t('pl.v2.belowIdeal') : t('pl.v2.onTarget')}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-white/45">{t('pl.v2.idealExplain')}</p>
              </Panel>
            )
          })()}
        </>
      )}
    </Page>
  )
}
