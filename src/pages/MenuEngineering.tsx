import { useEffect, useMemo, useState } from 'react'
import { Star, TrendingUp, AlertTriangle, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, Panel, StatRow, StatTile, Chip, ChipRow, EmptyState, Notice } from '../components/ui/page'
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
  star:      { label: 'menuEng.star',      color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: Star,          desc: 'menuEng.starDesc' },
  plowhorse: { label: 'menuEng.plowhorse', color: 'text-sky-500',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     icon: TrendingUp,    desc: 'menuEng.plowhorseDesc' },
  puzzle:    { label: 'menuEng.puzzle',    color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: AlertTriangle, desc: 'menuEng.puzzleDesc' },
  dog:       { label: 'menuEng.dog',       color: 'text-red-500',     bg: 'bg-red-500/[0.07]', border: 'border-red-500/20',     icon: Minus,         desc: 'menuEng.dogDesc' },
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
  const [filter, setFilter] = useState<Quadrant | 'all'>('all')

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

        const rows = (data ?? []) as unknown as Row[]

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

  const visible = filter === 'all' ? items : items.filter((i) => i.quadrant === filter)
  // Matrix laid out on the two axes: margin (rows) × popularity (columns)
  const MATRIX: Quadrant[] = ['puzzle', 'star', 'dog', 'plowhorse']

  return (
    <Page>
      <PageHeader title={t('menuEng.title')} subtitle={t('menuEng.subtitle')} eyebrow={t('menuEng.v2.window')} />

      {error && <Notice>{error}</Notice>}

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : items.length === 0 ? (
        <EmptyState icon={Star} title={t('menuEng.empty.title')} body={t('menuEng.empty.description')} />
      ) : (
        <>
          <StatRow>
            <StatTile tone="ink" label={t('menuEng.revenue')} value={`€${fmt(totalRevenue)}`} hint={t('menuEng.v2.window')} />
            <StatTile label={t('menuEng.v2.dishes')} value={items.length} hint={t('menuEng.v2.unitsTotal', { count: items.reduce((s, i) => s + i.units_sold, 0) })} />
            <StatTile label={t('menuEng.star')} value={byQuadrant.get('star')!.length} tone="good" hint={t('menuEng.starDesc')} onClick={() => setFilter('star')} />
            <StatTile label={t('menuEng.dog')} value={byQuadrant.get('dog')!.length} tone={byQuadrant.get('dog')!.length ? 'bad' : 'default'} hint={t('menuEng.dogDesc')} onClick={() => setFilter('dog')} />
          </StatRow>

          {/* ── Matrix ── */}
          <Panel title={t('menuEng.v2.matrix')}>
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <div className="flex items-center justify-center">
                <span className="text-xs font-medium text-white/45 [writing-mode:vertical-rl] rotate-180">{t('menuEng.v2.marginAxis')} →</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MATRIX.map((q) => {
                  const meta = QUADRANT_META[q]
                  const qItems = byQuadrant.get(q)!
                  const Icon = meta.icon
                  const qRevenue = qItems.reduce((s, i) => s + i.revenue, 0)
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setFilter(filter === q ? 'all' : q)}
                      className={cn('flex min-h-[200px] flex-col gap-3 rounded-2xl p-4 text-left transition', meta.bg, filter === q && 'ring-2 ring-brand-orange')}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-5 w-5', meta.color)} />
                        <span className={cn('font-medium', meta.color)}>{t(meta.label)}</span>
                        <span className="ml-auto text-2xl font-medium tabular-nums">{qItems.length}</span>
                      </div>
                      <p className="text-xs text-white/60">{t(`menuEng.${q}Hint`)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {qItems.slice(0, 6).map((item) => (
                          <span key={item.menu_item_id ?? item.name} className="rounded-full bg-bg-card px-2.5 py-1 text-xs font-medium shadow-card">
                            {item.name}
                          </span>
                        ))}
                        {qItems.length > 6 && <span className="px-1 py-1 text-xs text-white/45">+{qItems.length - 6}</span>}
                      </div>
                      {qRevenue > 0 && (
                        <span className="mt-auto text-xs text-white/55 tabular-nums">
                          €{fmt(qRevenue)}{totalRevenue > 0 && ` · ${Math.round((qRevenue / totalRevenue) * 100)}%`}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <span />
              <p className="text-center text-xs font-medium text-white/45">{t('menuEng.v2.popularityAxis')} →</p>
            </div>
          </Panel>

          {/* ── All dishes ── */}
          <Panel
            title={t('menuEng.v2.allDishes')}
            padded={false}
            actions={
              <ChipRow className="pb-0">
                <Chip active={filter === 'all'} onClick={() => setFilter('all')} count={items.length}>{t('recipes.v2.all')}</Chip>
                {QUADRANT_ORDER.map((q) => (
                  <Chip key={q} active={filter === q} onClick={() => setFilter(q)} count={byQuadrant.get(q)!.length}>{t(QUADRANT_META[q].label)}</Chip>
                ))}
              </ChipRow>
            }
          >
            <div className="overflow-x-auto px-2 pb-2">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/50">
                    <th className="px-4 py-3 font-medium">{t('menuEng.item')}</th>
                    <th className="px-4 py-3 font-medium">{t('menuEng.quadrant')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('menuEng.unitsSold')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('menuEng.revenue')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('menuEng.margin')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('menuEng.avgPrice')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {visible.map((item) => {
                    const meta = QUADRANT_META[item.quadrant]
                    const Icon = meta.icon
                    return (
                      <tr key={item.menu_item_id ?? item.name}>
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', meta.bg, meta.color)}>
                            <Icon className="h-3.5 w-3.5" />{t(meta.label)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{item.units_sold}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">€{fmt(item.revenue)}</td>
                        <td className={cn('px-4 py-3 text-right tabular-nums font-medium',
                          item.margin_pct == null ? 'text-white/35'
                            : item.margin_pct >= 70 ? 'text-emerald-500'
                            : item.margin_pct >= 55 ? 'text-amber-500'
                            : 'text-red-500')}
                        >
                          {item.margin_pct != null ? `${item.margin_pct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/60">€{fmt(item.avg_price)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </Page>
  )
}
