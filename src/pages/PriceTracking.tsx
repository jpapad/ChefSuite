import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, StatRow, StatTile, SearchField, Panel, EmptyState, Notice } from '../components/ui/page'
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

        const rows = (data ?? []) as unknown as Row[]

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

  const selected = filtered.find((i) => i.name === expanded) ?? filtered.find((i) => (i.pct_change ?? 0) >= ALERT_THRESHOLD) ?? filtered[0]
  const decreases = filtered.filter((i) => i.pct_change != null && i.pct_change < -2).length
  const changes = filtered.filter((i) => i.pct_change != null).map((i) => i.pct_change!)
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null
  const changeTone = (pct: number | null) =>
    pct == null ? 'text-white/40' : pct >= ALERT_THRESHOLD ? 'text-amber-500' : pct < -2 ? 'text-emerald-500' : 'text-white/55'

  return (
    <Page>
      <PageHeader title={t('priceTracking.title')} subtitle={t('priceTracking.subtitle')} />

      {error && <Notice>{error}</Notice>}

      {!loading && filtered.length > 0 && (
        <StatRow>
          <StatTile tone="ink" label={t('priceTracking.v2.tracked')} value={filtered.length} hint={t('priceTracking.v2.trackedHint')} />
          <StatTile label={t('priceTracking.v2.alerts')} value={alertCount} tone={alertCount ? 'warn' : 'good'} hint={t('priceTracking.v2.alertsHint', { pct: ALERT_THRESHOLD })} />
          <StatTile label={t('priceTracking.v2.cheaper')} value={decreases} tone={decreases ? 'good' : 'default'} hint={t('priceTracking.v2.cheaperHint')} />
          <StatTile label={t('priceTracking.v2.avgChange')} value={avgChange != null ? `${avgChange > 0 ? '+' : ''}${avgChange.toFixed(1)}%` : '—'} tone={avgChange != null && avgChange > 5 ? 'warn' : 'default'} hint={t('priceTracking.v2.avgChangeHint')} />
        </StatRow>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchField value={query} onChange={setQuery} placeholder={t('priceTracking.search')} className="flex-1 max-w-md" />
        {allSuppliers.length > 0 && (
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            aria-label={t('priceTracking.supplier')}
            className="h-11 rounded-full bg-bg-card px-4 text-sm shadow-card outline-none focus:ring-2 focus:ring-brand-orange/40"
          >
            <option value="">{t('priceTracking.allSuppliers')}</option>
            {allSuppliers.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : filtered.length === 0 ? (
        <EmptyState icon={TrendingUp} title={t('priceTracking.empty.title')} body={t('priceTracking.empty.description')} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── Item list ── */}
          <Panel padded={false}>
            <ul className="flex flex-col p-2">
              {filtered.map((item) => {
                const hasAlert = (item.pct_change ?? 0) >= ALERT_THRESHOLD
                const hasDecrease = item.pct_change != null && item.pct_change < -2
                const maxPrice = item.max > 0 ? item.max : 1
                const isSel = selected?.name === item.name
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      aria-pressed={isSel}
                      onClick={() => setExpanded(item.name)}
                      className={cn('flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition', isSel ? 'bg-ink text-white-fixed' : 'hover:bg-white/[0.04]')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          <span className={cn('text-xs', isSel ? 'text-white-fixed/50' : 'text-white/45')}>/ {item.unit}</span>
                          {hasAlert && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        </div>
                        <p className={cn('text-xs', isSel ? 'text-white-fixed/55' : 'text-white/45')}>
                          {item.points.at(-1)?.supplier_name ?? t('priceTracking.dataPoints', { count: item.points.length })}
                        </p>
                      </div>
                      <div className="hidden sm:flex h-8 w-20 shrink-0 items-end gap-0.5">
                        {item.points.slice(-10).map((p, i) => {
                          const isLast = i === Math.min(item.points.length, 10) - 1
                          return (
                            <div
                              key={i}
                              className={cn('flex-1 rounded-t-sm',
                                isLast ? (hasAlert ? 'bg-amber-500' : hasDecrease ? 'bg-emerald-500' : isSel ? 'bg-lime' : 'bg-white/70')
                                  : isSel ? 'bg-white-fixed/25' : 'bg-white/15')}
                              style={{ height: `${Math.max((p.price / maxPrice) * 100, 8)}%` }}
                            />
                          )
                        })}
                      </div>
                      <div className="w-24 shrink-0 text-right">
                        <div className="font-medium tabular-nums">€{fmt(item.latest)}</div>
                        {item.pct_change != null && (
                          <div className={cn('flex items-center justify-end gap-1 text-xs tabular-nums', isSel && !hasAlert && !hasDecrease ? 'text-white-fixed/55' : changeTone(item.pct_change))}>
                            {hasAlert ? <TrendingUp className="h-3 w-3" /> : hasDecrease ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {item.pct_change > 0 ? '+' : ''}{item.pct_change.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          {/* ── Detail ── */}
          {selected && (
            <Panel className="lg:sticky lg:top-24">
              <div>
                <p className="text-sm text-white/55">{selected.name} / {selected.unit}</p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-4xl font-medium tracking-[-0.03em] tabular-nums">€{fmt(selected.latest)}</span>
                  {selected.pct_change != null && (
                    <span className={cn('text-sm font-medium tabular-nums', changeTone(selected.pct_change))}>
                      {selected.pct_change > 0 ? '+' : ''}{selected.pct_change.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex h-36 items-end gap-1.5">
                {selected.points.slice(-16).map((p, i, arr) => (
                  <div
                    key={`${p.date}-${i}`}
                    title={`${new Date(p.date).toLocaleDateString()} · €${fmt(p.price)}`}
                    className={cn('flex-1 rounded-t-lg', i === arr.length - 1 ? 'bg-ink' : 'bg-white/[0.1]')}
                    style={{ height: `${Math.max((p.price / (selected.max || 1)) * 100, 6)}%` }}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/[0.04] p-3">
                  <p className="text-xs text-white/50">{t('priceTracking.min')}</p>
                  <p className="font-medium tabular-nums text-emerald-500">€{fmt(selected.min)}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-3">
                  <p className="text-xs text-white/50">{t('priceTracking.max')}</p>
                  <p className="font-medium tabular-nums text-red-500">€{fmt(selected.max)}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-3">
                  <p className="text-xs text-white/50">{t('priceTracking.spread')}</p>
                  <p className="font-medium tabular-nums">{selected.max > 0 ? `${(((selected.max - selected.min) / selected.max) * 100).toFixed(1)}%` : '—'}</p>
                </div>
              </div>

              <ul className="max-h-72 divide-y divide-white/[0.06] overflow-y-auto">
                {[...selected.points].reverse().map((p, i, arr) => {
                  const prev = arr[i + 1]
                  const chg = prev ? ((p.price - prev.price) / prev.price) * 100 : null
                  return (
                    <li key={`${p.date}-${p.price}-${i}`} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-2 text-sm">
                      <span className="tabular-nums text-white/55">{new Date(p.date).toLocaleDateString()}</span>
                      <span className="truncate text-white/70">{p.supplier_name ?? '—'}</span>
                      <span className="font-medium tabular-nums">€{fmt(p.price)}</span>
                      <span className={cn('w-14 text-right text-xs font-medium tabular-nums', changeTone(chg))}>
                        {chg == null ? '—' : `${chg > 0 ? '+' : ''}${chg.toFixed(1)}%`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </Page>
  )
}
