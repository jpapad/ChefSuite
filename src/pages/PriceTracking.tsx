import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Search, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Input } from '../components/ui/Input'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'

interface PricePoint {
  date: string
  price: number
  supplier_name: string | null
  order_id: string
}

interface TrackedItem {
  name: string
  unit: string
  points: PricePoint[]
  latest: number
  previous: number | null
  pct_change: number | null
  min: number
  max: number
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ALERT_THRESHOLD = 10 // % increase that triggers a warning

export default function PriceTracking() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [items, setItems] = useState<TrackedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.team_id) return

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await supabase
          .from('purchase_order_items')
          .select(`
            name, unit, unit_price,
            purchase_orders!inner(id, created_at, team_id, status,
              suppliers(name)
            )
          `)
          .not('unit_price', 'is', null)
          .eq('purchase_orders.team_id', profile!.team_id)

        if (err) throw err

        type Row = {
          name: string
          unit: string
          unit_price: number
          purchase_orders: {
            id: string
            created_at: string
            status: string
            suppliers: { name: string } | null
          }
        }

        const rows = (data ?? []) as Row[]

        // Group by normalized item name
        const map = new Map<string, { unit: string; points: PricePoint[] }>()
        for (const row of rows) {
          const key = row.name.toLowerCase().trim()
          const existing = map.get(key)
          const point: PricePoint = {
            date: row.purchase_orders.created_at.slice(0, 10),
            price: row.unit_price,
            supplier_name: row.purchase_orders.suppliers?.name ?? null,
            order_id: row.purchase_orders.id,
          }
          if (existing) {
            existing.points.push(point)
          } else {
            map.set(key, { unit: row.unit, points: [point] })
          }
        }

        const tracked: TrackedItem[] = []
        for (const [, { unit, points }] of map) {
          // Sort by date asc
          points.sort((a, b) => a.date.localeCompare(b.date))
          const latest = points.at(-1)!.price
          const previous = points.length >= 2 ? points.at(-2)!.price : null
          const pct_change =
            previous != null && previous > 0
              ? ((latest - previous) / previous) * 100
              : null
          const prices = points.map((p) => p.price)
          tracked.push({
            name: points[0] ? rows.find((r) => r.name.toLowerCase().trim() === points[0].date || true)?.name ?? points[0].supplier_name ?? '' : '',
            unit,
            points,
            latest,
            previous,
            pct_change,
            min: Math.min(...prices),
            max: Math.max(...prices),
          })
        }

        // Fix name: use original casing from first row per key
        const nameMap = new Map<string, string>()
        for (const row of rows) {
          const key = row.name.toLowerCase().trim()
          if (!nameMap.has(key)) nameMap.set(key, row.name)
        }
        for (const item of tracked) {
          const key = item.points[0] ? [...nameMap.entries()].find(([, v]) => v === item.name)?.[0] : null
          if (key) item.name = nameMap.get(key) ?? item.name
        }
        // Simpler fix: re-derive name from map
        const trackedFixed: TrackedItem[] = []
        for (const [key, { unit, points }] of map) {
          points.sort((a, b) => a.date.localeCompare(b.date))
          const latest = points.at(-1)!.price
          const previous = points.length >= 2 ? points.at(-2)!.price : null
          const pct_change =
            previous != null && previous > 0
              ? ((latest - previous) / previous) * 100
              : null
          const prices = points.map((p) => p.price)
          trackedFixed.push({
            name: nameMap.get(key) ?? key,
            unit,
            points,
            latest,
            previous,
            pct_change,
            min: Math.min(...prices),
            max: Math.max(...prices),
          })
        }

        // Sort: alerts first, then by name
        trackedFixed.sort((a, b) => {
          const aAlert = (a.pct_change ?? 0) >= ALERT_THRESHOLD
          const bAlert = (b.pct_change ?? 0) >= ALERT_THRESHOLD
          if (aAlert !== bAlert) return aAlert ? -1 : 1
          return a.name.localeCompare(b.name)
        })

        setItems(trackedFixed)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [profile?.team_id])

  const allSuppliers = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      for (const p of item.points) {
        if (p.supplier_name) set.add(p.supplier_name)
      }
    }
    return [...set].sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false
      if (supplierFilter && !item.points.some((p) => p.supplier_name === supplierFilter)) return false
      return true
    })
  }, [items, query, supplierFilter])

  const alertCount = items.filter((i) => (i.pct_change ?? 0) >= ALERT_THRESHOLD).length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">{t('priceTracking.title')}</h1>
        <p className="text-white/60 mt-1">{t('priceTracking.subtitle')}</p>
      </header>

      {alertCount > 0 && (
        <GlassCard className="flex items-center gap-3 border border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm">
            {t('priceTracking.alertBanner', { count: alertCount, pct: ALERT_THRESHOLD })}
          </p>
        </GlassCard>
      )}

      {error && <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>}

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            name="search"
            placeholder={t('priceTracking.search')}
            leftIcon={<Search className="h-4 w-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {allSuppliers.length > 0 && (
          <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-transparent outline-none text-sm text-white"
            >
              <option value="" className="bg-[#f5ede0]">{t('priceTracking.allSuppliers')}</option>
              {allSuppliers.map((s) => (
                <option key={s} value={s} className="bg-[#f5ede0]">{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <TrendingUp className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('priceTracking.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('priceTracking.empty.description')}</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isExpanded = expanded === item.name
            const hasAlert = (item.pct_change ?? 0) >= ALERT_THRESHOLD
            const hasDecrease = item.pct_change != null && item.pct_change < -2
            const maxPrice = item.max > 0 ? item.max : 1

            return (
              <GlassCard
                key={item.name}
                className={cn(
                  'space-y-0 transition-all',
                  hasAlert && 'border border-amber-500/30',
                )}
              >
                {/* Header row */}
                <button
                  type="button"
                  className="w-full flex items-center gap-4"
                  onClick={() => setExpanded(isExpanded ? null : item.name)}
                >
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-xs text-white/40">/ {item.unit}</span>
                      {hasAlert && (
                        <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          +{item.pct_change!.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">
                      {t('priceTracking.dataPoints', { count: item.points.length })}
                      {item.points.at(-1)?.supplier_name && ` · ${item.points.at(-1)!.supplier_name}`}
                    </p>
                  </div>

                  {/* Sparkline */}
                  <div className="hidden sm:flex items-end gap-0.5 h-8 w-20 shrink-0">
                    {item.points.slice(-10).map((p, i) => {
                      const h = Math.max(((p.price / maxPrice) * 100), 8)
                      const isLast = i === Math.min(item.points.length, 10) - 1
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex-1 rounded-t-sm transition-all',
                            isLast
                              ? hasAlert ? 'bg-amber-400' : hasDecrease ? 'bg-emerald-400' : 'bg-brand-orange'
                              : 'bg-white/20',
                          )}
                          style={{ height: `${h}%` }}
                        />
                      )
                    })}
                  </div>

                  {/* Price + change */}
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-lg">€{fmt(item.latest)}</div>
                    {item.pct_change != null && (
                      <div className={cn(
                        'flex items-center justify-end gap-1 text-xs',
                        hasAlert ? 'text-amber-400' : hasDecrease ? 'text-emerald-400' : 'text-white/40',
                      )}>
                        {hasAlert
                          ? <TrendingUp className="h-3 w-3" />
                          : hasDecrease
                          ? <TrendingDown className="h-3 w-3" />
                          : <Minus className="h-3 w-3" />}
                        {item.pct_change > 0 ? '+' : ''}{item.pct_change.toFixed(1)}%
                      </div>
                    )}
                  </div>

                  <div className="text-white/30 shrink-0">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded history */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-glass-border">
                    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 text-xs text-white/40 uppercase tracking-wide mb-2 px-1">
                      <span>{t('priceTracking.date')}</span>
                      <span>{t('priceTracking.supplier')}</span>
                      <span>{t('priceTracking.price')}</span>
                      <span>{t('priceTracking.change')}</span>
                    </div>
                    <ul className="space-y-1">
                      {[...item.points].reverse().map((p, i, arr) => {
                        const prev = arr[i + 1]
                        const chg = prev ? ((p.price - prev.price) / prev.price) * 100 : null
                        return (
                          <li key={`${p.date}-${p.price}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center text-sm px-1 py-1.5 rounded-lg hover:bg-white/3 transition">
                            <span className="text-white/60">{new Date(p.date).toLocaleDateString()}</span>
                            <span className="text-white/70 truncate">{p.supplier_name ?? '—'}</span>
                            <span className="font-medium">€{fmt(p.price)}</span>
                            <span className={cn(
                              'text-xs font-medium',
                              chg == null ? 'text-white/20'
                                : chg >= ALERT_THRESHOLD ? 'text-amber-400'
                                : chg < -2 ? 'text-emerald-400'
                                : 'text-white/40',
                            )}>
                              {chg == null ? '—' : `${chg > 0 ? '+' : ''}${chg.toFixed(1)}%`}
                            </span>
                          </li>
                        )
                      })}
                    </ul>

                    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-glass-border text-xs text-white/40">
                      <span>{t('priceTracking.min')}: <span className="text-emerald-400 font-medium">€{fmt(item.min)}</span></span>
                      <span>{t('priceTracking.max')}: <span className="text-red-400 font-medium">€{fmt(item.max)}</span></span>
                      <span>{t('priceTracking.spread')}: <span className="text-white/60 font-medium">
                        {item.max > 0 ? `${(((item.max - item.min) / item.max) * 100).toFixed(1)}%` : '—'}
                      </span></span>
                    </div>
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
