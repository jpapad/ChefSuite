import { useEffect, useMemo, useState } from 'react'
import { Star, TrendingUp, AlertTriangle, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'

type Quadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog'

interface EngineeredItem {
  menu_item_id: string | null
  name: string
  units_sold: number
  revenue: number
  avg_price: number
  cost_per_portion: number | null
  selling_price: number | null
  margin_pct: number | null
  quadrant: Quadrant
}

const QUADRANT_META: Record<Quadrant, { label: string; color: string; bg: string; border: string; icon: typeof Star; desc: string }> = {
  star:      { label: 'menuEng.star',      color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-500/30', icon: Star,          desc: 'menuEng.starDesc' },
  plowhorse: { label: 'menuEng.plowhorse', color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-500/30',    icon: TrendingUp,    desc: 'menuEng.plowhorseDesc' },
  puzzle:    { label: 'menuEng.puzzle',    color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-500/30',   icon: AlertTriangle, desc: 'menuEng.puzzleDesc' },
  dog:       { label: 'menuEng.dog',       color: 'text-white/40',    bg: 'bg-white/5',        border: 'border-white/10',       icon: Minus,         desc: 'menuEng.dogDesc' },
}

const QUADRANT_ORDER: Quadrant[] = ['star', 'plowhorse', 'puzzle', 'dog']

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function thirtyDaysAgo() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}

export default function MenuEngineering() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [items, setItems] = useState<EngineeredItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.team_id) return

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Fetch completed order items with menu_item → recipe linkage
        const { data, error: err } = await supabase
          .from('online_order_items')
          .select(`
            menu_item_id, name, price, quantity,
            online_orders!inner(status, created_at, team_id),
            menu_items(id, recipe_id, recipes(id, cost_per_portion, selling_price))
          `)
          .eq('online_orders.status', 'completed')
          .eq('online_orders.team_id', profile!.team_id)
          .gte('online_orders.created_at', thirtyDaysAgo())

        if (err) throw err

        type Row = {
          menu_item_id: string | null
          name: string
          price: number
          quantity: number
          menu_items: {
            id: string
            recipe_id: string | null
            recipes: { id: string; cost_per_portion: number | null; selling_price: number | null } | null
          } | null
        }

        const rows = (data ?? []) as Row[]

        // Aggregate by menu_item_id (fall back to name)
        const map = new Map<string, {
          menu_item_id: string | null
          name: string
          units: number
          revenue: number
          price_sum: number
          cost_per_portion: number | null
          selling_price: number | null
        }>()

        for (const row of rows) {
          const key = row.menu_item_id ?? row.name
          const existing = map.get(key)
          const recipe = row.menu_items?.recipes
          if (existing) {
            existing.units += row.quantity
            existing.revenue += row.price * row.quantity
            existing.price_sum += row.price
          } else {
            map.set(key, {
              menu_item_id: row.menu_item_id,
              name: row.name,
              units: row.quantity,
              revenue: row.price * row.quantity,
              price_sum: row.price,
              cost_per_portion: recipe?.cost_per_portion ?? null,
              selling_price: recipe?.selling_price ?? null,
            })
          }
        }

        const aggregated = [...map.values()]

        // Median popularity split
        const unitsSorted = [...aggregated].map((i) => i.units).sort((a, b) => a - b)
        const medianUnits = unitsSorted[Math.floor(unitsSorted.length / 2)] ?? 0

        // Margin: use recipe selling price if available, else avg_price from orders
        const withMargin = aggregated.map((item) => {
          const avg_price = item.units > 0 ? item.revenue / item.units : item.price_sum
          const sell = item.selling_price ?? avg_price
          const margin_pct =
            item.cost_per_portion != null && sell > 0
              ? ((sell - item.cost_per_portion) / sell) * 100
              : null
          return { ...item, avg_price, margin_pct }
        })

        // Margin split: items with known margin use 70% gross margin as benchmark (30% food cost);
        // items without use median of known margins
        const knownMargins = withMargin.filter((i) => i.margin_pct != null).map((i) => i.margin_pct!)
        const marginThreshold = knownMargins.length > 0
          ? knownMargins.sort((a, b) => a - b)[Math.floor(knownMargins.length / 2)]
          : 70

        const engineered: EngineeredItem[] = withMargin.map((item) => {
          const highPop = item.units >= medianUnits
          const highMargin = item.margin_pct == null ? true : item.margin_pct >= marginThreshold
          let quadrant: Quadrant
          if (highPop && highMargin) quadrant = 'star'
          else if (highPop && !highMargin) quadrant = 'plowhorse'
          else if (!highPop && highMargin) quadrant = 'puzzle'
          else quadrant = 'dog'

          return {
            menu_item_id: item.menu_item_id,
            name: item.name,
            units_sold: item.units,
            revenue: item.revenue,
            avg_price: item.avg_price,
            cost_per_portion: item.cost_per_portion,
            selling_price: item.selling_price,
            margin_pct: item.margin_pct,
            quadrant,
          }
        })

        // Sort within each quadrant by revenue desc
        engineered.sort((a, b) => {
          const qi = QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant)
          if (qi !== 0) return qi
          return b.revenue - a.revenue
        })

        setItems(engineered)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [profile?.team_id])

  const byQuadrant = useMemo(() => {
    const map = new Map<Quadrant, EngineeredItem[]>()
    for (const q of QUADRANT_ORDER) map.set(q, [])
    for (const item of items) map.get(item.quadrant)!.push(item)
    return map
  }, [items])

  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">{t('menuEng.title')}</h1>
        <p className="text-white/60 mt-1">{t('menuEng.subtitle')}</p>
      </header>

      {error && <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>}

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : items.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <Star className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('menuEng.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('menuEng.empty.description')}</p>
        </GlassCard>
      ) : (
        <>
          {/* 2×2 matrix overview */}
          <div className="grid grid-cols-2 gap-4">
            {QUADRANT_ORDER.map((q) => {
              const meta = QUADRANT_META[q]
              const qItems = byQuadrant.get(q)!
              const Icon = meta.icon
              const qRevenue = qItems.reduce((s, i) => s + i.revenue, 0)
              return (
                <GlassCard key={q} className={cn('border', meta.border, meta.bg)}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', meta.bg)}>
                      <Icon className={cn('h-5 w-5', meta.color)} />
                    </div>
                    <div>
                      <div className={cn('font-semibold', meta.color)}>{t(meta.label)}</div>
                      <div className="text-xs text-white/40">{t(meta.desc)}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-sm font-semibold">{qItems.length}</div>
                      <div className="text-xs text-white/40">{t('menuEng.items')}</div>
                    </div>
                  </div>
                  {qItems.length > 0 && (
                    <ul className="space-y-1 mt-2">
                      {qItems.slice(0, 4).map((item) => (
                        <li key={item.menu_item_id ?? item.name} className="flex items-center justify-between text-sm">
                          <span className="truncate text-white/80 max-w-[60%]">{item.name}</span>
                          <div className="flex items-center gap-2 shrink-0 text-white/50 text-xs">
                            <span>×{item.units_sold}</span>
                            <span className="text-white/30">·</span>
                            <span>€{fmt(item.revenue)}</span>
                          </div>
                        </li>
                      ))}
                      {qItems.length > 4 && (
                        <li className="text-xs text-white/30">+{qItems.length - 4} {t('menuEng.more')}</li>
                      )}
                    </ul>
                  )}
                  {qRevenue > 0 && (
                    <div className={cn('mt-3 pt-3 border-t border-white/10 text-xs', meta.color)}>
                      {t('menuEng.revenue')}: €{fmt(qRevenue)}
                      {totalRevenue > 0 && (
                        <span className="text-white/30 ml-1">({Math.round((qRevenue / totalRevenue) * 100)}%)</span>
                      )}
                    </div>
                  )}
                </GlassCard>
              )
            })}
          </div>

          {/* Full item list */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-xs uppercase tracking-wide text-white/40 border-b border-glass-border">
              <span>{t('menuEng.item')}</span>
              <span>{t('menuEng.quadrant')}</span>
              <span>{t('menuEng.unitsSold')}</span>
              <span>{t('menuEng.revenue')}</span>
              <span>{t('menuEng.margin')}</span>
              <span>{t('menuEng.avgPrice')}</span>
            </div>
            <ul className="divide-y divide-glass-border">
              {items.map((item) => {
                const meta = QUADRANT_META[item.quadrant]
                const Icon = meta.icon
                return (
                  <li key={item.menu_item_id ?? item.name}
                    className="grid gap-2 md:gap-4 px-5 py-3.5 items-center md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]"
                  >
                    <span className="font-medium truncate">{item.name}</span>
                    <span className={cn('flex items-center gap-1.5 text-sm font-medium', meta.color)}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {t(meta.label)}
                    </span>
                    <span className="text-sm text-white/70">×{item.units_sold}</span>
                    <span className="text-sm font-medium">€{fmt(item.revenue)}</span>
                    <span className={cn('text-sm font-medium',
                      item.margin_pct == null ? 'text-white/30'
                        : item.margin_pct >= 70 ? 'text-emerald-400'
                        : item.margin_pct >= 55 ? 'text-amber-400'
                        : 'text-red-400',
                    )}>
                      {item.margin_pct != null ? `${item.margin_pct.toFixed(1)}%` : '—'}
                    </span>
                    <span className="text-sm text-white/60">€{fmt(item.avg_price)}</span>
                  </li>
                )
              })}
            </ul>
          </GlassCard>

          <GlassCard className="text-xs text-white/40 space-y-1">
            <p><span className={cn('font-semibold', QUADRANT_META.star.color)}>{t('menuEng.star')}</span>: {t('menuEng.starHint')}</p>
            <p><span className={cn('font-semibold', QUADRANT_META.plowhorse.color)}>{t('menuEng.plowhorse')}</span>: {t('menuEng.plowhorseHint')}</p>
            <p><span className={cn('font-semibold', QUADRANT_META.puzzle.color)}>{t('menuEng.puzzle')}</span>: {t('menuEng.puzzleHint')}</p>
            <p><span className={cn('font-semibold', QUADRANT_META.dog.color)}>{t('menuEng.dog')}</span>: {t('menuEng.dogHint')}</p>
          </GlassCard>
        </>
      )}
    </div>
  )
}
