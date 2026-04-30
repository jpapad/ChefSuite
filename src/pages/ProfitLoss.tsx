import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Euro, ShoppingBag, Trash2, Percent } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'

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
  const [period, setPeriod] = useState<Period>('30d')
  const [revenue, setRevenue] = useState(0)
  const [purchases, setPurchases] = useState(0)
  const [waste, setWaste] = useState(0)
  const [weeks, setWeeks] = useState<WeekRow[]>([])
  const [loading, setLoading] = useState(true)

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
          .select('price, quantity, online_orders!inner(created_at, status, team_id)')
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

      type RevRow = { price: number; quantity: number; online_orders: { created_at: string } }
      type PurRow = { unit_price: number; quantity: number; purchase_orders: { received_at: string } }
      type WasteRow = { cost: number; wasted_at: string }
      type PosRow = { amount: number; transacted_at: string }

      const revRows = (revRes.data ?? []) as RevRow[]
      const purRows = (purRes.data ?? []) as PurRow[]
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

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('pl.title')}</h1>
          <p className="text-white/60 mt-1">{t('pl.subtitle')}</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                period === p.key
                  ? 'bg-brand-orange text-white-fixed'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: t('pl.revenue'),
            value: `€${fmt(revenue)}`,
            sub: t('pl.fromOnlineOrders'),
            icon: ShoppingBag,
            color: 'text-emerald-400',
            bg: 'bg-emerald-400/15',
          },
          {
            label: t('pl.purchases'),
            value: `€${fmt(purchases)}`,
            sub: t('pl.receivedOrders'),
            icon: Euro,
            color: 'text-blue-400',
            bg: 'bg-blue-400/15',
          },
          {
            label: t('pl.waste'),
            value: `€${fmt2(waste)}`,
            sub: t('pl.wastedIngredients'),
            icon: Trash2,
            color: 'text-amber-400',
            bg: 'bg-amber-400/15',
          },
          {
            label: t('pl.grossProfit'),
            value: `€${fmt(grossProfit)}`,
            sub: t('pl.revenueMinusCosts'),
            icon: grossProfit >= 0 ? TrendingUp : TrendingDown,
            color: grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400',
            bg: grossProfit >= 0 ? 'bg-emerald-400/15' : 'bg-red-400/15',
          },
          {
            label: t('pl.gpPct'),
            value: gpPct != null ? `${gpPct.toFixed(1)}%` : '—',
            sub: t('pl.gpBenchmark'),
            icon: Percent,
            color: gpPct == null ? 'text-white/40' : gpPct >= 60 ? 'text-emerald-400' : gpPct >= 40 ? 'text-amber-400' : 'text-red-400',
            bg: gpPct == null ? 'bg-white/10' : gpPct >= 60 ? 'bg-emerald-400/15' : gpPct >= 40 ? 'bg-amber-400/15' : 'bg-red-400/15',
          },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <GlassCard key={label} className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white/60">{label}</div>
              <div className={cn('text-2xl font-semibold mt-0.5', loading ? 'text-white/20' : color === 'text-emerald-400' || color === 'text-blue-400' || color === 'text-amber-400' ? '' : color)}>
                {loading ? '…' : value}
              </div>
              <div className="text-xs text-white/40 mt-1">{sub}</div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Weekly trend chart */}
      {!loading && weeks.length > 0 && (
        <GlassCard>
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-orange" />
            {t('pl.weeklyTrend')}
          </h2>
          <p className="text-xs text-white/40 mb-5">{t('pl.weeklyTrendHint')}</p>
          <div className="flex items-end gap-3">
            {weeks.map((w) => {
              const revH = (w.revenue / maxBar) * 100
              const costH = ((w.purchases + w.waste) / maxBar) * 100
              const profitPositive = w.profit >= 0
              return (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="w-full flex items-end gap-0.5 h-28 justify-center">
                    {/* Revenue bar */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className="w-full rounded-t-sm bg-emerald-400/70 transition-all"
                        style={{ height: `${Math.max(revH, w.revenue > 0 ? 4 : 0)}%` }}
                        title={`Revenue: €${fmt2(w.revenue)}`}
                      />
                    </div>
                    {/* Cost bar */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div
                        className="w-full rounded-t-sm bg-red-400/50 transition-all"
                        style={{ height: `${Math.max(costH, w.purchases + w.waste > 0 ? 4 : 0)}%` }}
                        title={`Costs: €${fmt2(w.purchases + w.waste)}`}
                      />
                    </div>
                  </div>
                  <div className={cn('text-[10px] font-medium', profitPositive ? 'text-emerald-400' : 'text-red-400')}>
                    {profitPositive ? '+' : ''}€{fmt(w.profit)}
                  </div>
                  <div className="text-[10px] text-white/40 text-center truncate w-full">{w.label}</div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-white/50">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/70 inline-block" />{t('pl.revenue')}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400/50 inline-block" />{t('pl.costs')}</span>
          </div>
        </GlassCard>
      )}

      {/* Cost breakdown */}
      {!loading && (purchases > 0 || waste > 0) && (
        <GlassCard>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Euro className="h-5 w-5 text-blue-400" />
            {t('pl.costBreakdown')}
          </h2>
          <div className="space-y-4">
            {[
              { label: t('pl.purchases'), value: purchases, color: 'bg-blue-400', text: 'text-blue-400' },
              { label: t('pl.waste'),     value: waste,     color: 'bg-amber-400', text: 'text-amber-400' },
            ].map(({ label, value, color, text }) => {
              const total = purchases + waste
              const pct = total > 0 ? (value / total) * 100 : 0
              const ofRev = revenue > 0 ? (value / revenue) * 100 : null
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="text-white/70">{label}</span>
                    <div className="flex items-center gap-3">
                      {ofRev != null && (
                        <span className="text-white/40 text-xs">{ofRev.toFixed(1)}% {t('pl.ofRevenue')}</span>
                      )}
                      <span className={cn('font-semibold', text)}>€{fmt2(value)}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div className={cn('h-2 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      )}

      {!loading && revenue === 0 && purchases === 0 && waste === 0 && (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <TrendingUp className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('pl.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('pl.empty.description')}</p>
        </GlassCard>
      )}
    </div>
  )
}
