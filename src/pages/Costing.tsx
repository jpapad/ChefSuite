import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calculator, Search, Check, TrendingUp, Package, AlertTriangle,
  ChevronDown, ChevronUp, History, Target, PieChart, CalendarDays, Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { ErrorState } from '../components/ui/ErrorState'
import { costStatus } from '../lib/foodCost'
import { useTeamSettings } from '../hooks/useTeamSettings'
import { EventCostingDrawer } from '../components/costing/EventCostingDrawer'

type Tab = 'ingredients' | 'recipes'

interface CostItem {
  id: string
  name: string
  unit: string
  cost_per_unit: number | null
}

interface AffectedRecipe {
  recipeId: string
  title: string
  qty: number
}

interface RecipeCostRow {
  id: string
  title: string
  cost_per_portion: number | null
  selling_price:    number | null
  servings:         number | null
}

interface BreakdownRow {
  name:  string
  quantity: number
  unit:  string
  total: number
  pct:   number
}

interface PriceHistoryRow {
  id:        string
  old_price: number | null
  new_price: number
  changed_at: string
}

function fmt(v: number) {
  return v.toLocaleString('el-GR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

function pct(cost: number, price: number): number {
  if (price <= 0) return 0
  return (cost / price) * 100
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Costing() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const teamId = profile?.team_id
  const { targetFoodCostPct: target } = useTeamSettings()

  const [tab, setTab]           = useState<Tab>('ingredients')
  const [ingredients, setIngredients] = useState<CostItem[]>([])
  const [recipes, setRecipes]   = useState<RecipeCostRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')

  // Ingredient edit + ripple
  const [editId, setEditId]           = useState<string | null>(null)
  const [editVal, setEditVal]         = useState('')
  const [editOriginalVal, setEditOriginalVal] = useState(0)
  const [saving, setSaving]           = useState(false)
  const [affectedRecipes, setAffectedRecipes] = useState<AffectedRecipe[]>([])
  const [rippleExpanded, setRippleExpanded]   = useState(false)

  // Δ — Price history
  const [historyId, setHistoryId]         = useState<string | null>(null)
  const [priceHistory, setPriceHistory]   = useState<PriceHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Α — Recipe cost breakdown
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null)
  const [breakdown, setBreakdown]               = useState<BreakdownRow[]>([])
  const [loadingBreakdown, setLoadingBreakdown] = useState(false)

  // Β — Bulk price optimizer
  const [bulkOpen, setBulkOpen]         = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving]     = useState(false)

  // Γ — Event costing
  const [eventOpen, setEventOpen] = useState(false)

  function load() {
    if (!teamId) return
    setLoading(true)
    setError(null)
    Promise.all([
      supabase.from('inventory').select('id, name, unit, cost_per_unit').eq('team_id', teamId).order('name'),
      supabase.from('recipes').select('id, title, cost_per_portion, selling_price, servings').eq('team_id', teamId).order('title'),
    ]).then(([{ data: inv, error: e1 }, { data: rec, error: e2 }]) => {
      if (e1 ?? e2) { setError((e1 ?? e2)!.message); setLoading(false); return }
      setIngredients((inv ?? []) as CostItem[])
      setRecipes((rec ?? []) as RecipeCostRow[])
      setLoading(false)
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load data')
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [teamId])

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const withCost = ingredients.filter((i) => i.cost_per_unit != null && i.cost_per_unit > 0)
    if (withCost.length === 0) return null
    const avg = withCost.reduce((s, i) => s + (i.cost_per_unit ?? 0), 0) / withCost.length
    const max = withCost.reduce((a, b) => ((a.cost_per_unit ?? 0) > (b.cost_per_unit ?? 0) ? a : b))
    return { count: withCost.length, avg, max }
  }, [ingredients])

  const filteredIngredients = useMemo(() =>
    search ? ingredients.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) : ingredients,
    [ingredients, search],
  )

  const filteredRecipes = useMemo(() => {
    const list = search
      ? recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
      : recipes
    return [...list].sort((a, b) => {
      const pA = a.cost_per_portion && a.selling_price ? pct(a.cost_per_portion, a.selling_price) : -1
      const pB = b.cost_per_portion && b.selling_price ? pct(b.cost_per_portion, b.selling_price) : -1
      return pB - pA
    })
  }, [recipes, search])

  // Β — above-target recipes
  const aboveTarget = useMemo(() =>
    recipes.filter((r) => {
      if (!r.cost_per_portion || !r.selling_price) return false
      return pct(r.cost_per_portion, r.selling_price) > target
    }),
    [recipes, target],
  )

  // ── Ingredient edit ───────────────────────────────────────────────────────
  async function saveIngredientCost(id: string) {
    const val = parseFloat(editVal)
    if (isNaN(val) || val < 0) { setEditId(null); return }
    setSaving(true)
    // Δ — save price history before updating
    const oldPrice = ingredients.find((i) => i.id === id)?.cost_per_unit ?? null
    void supabase.from('ingredient_price_history').insert({
      inventory_item_id: id, old_price: oldPrice, new_price: val,
    })
    await supabase.from('inventory').update({ cost_per_unit: val }).eq('id', id)
    setIngredients((prev) => prev.map((i) => i.id === id ? { ...i, cost_per_unit: val } : i))
    setEditId(null)
    setAffectedRecipes([])
    setRippleExpanded(false)
    // refresh history if open
    if (historyId === id) void loadHistory(id)
    setSaving(false)
  }

  function startEdit(item: CostItem) {
    setEditId(item.id)
    setEditVal(item.cost_per_unit != null ? String(item.cost_per_unit) : '')
    setEditOriginalVal(item.cost_per_unit ?? 0)
    setRippleExpanded(false)
    setAffectedRecipes([])
    void supabase
      .from('recipe_ingredients')
      .select('quantity, recipe:recipe_id(id, title)')
      .eq('inventory_item_id', item.id)
      .then(({ data }) => {
        type Row = { quantity: number; recipe: { id: string; title: string } | null }
        const rows = (data ?? []) as unknown as Row[]
        setAffectedRecipes(
          rows.filter((r) => r.recipe != null)
              .map((r) => ({ recipeId: r.recipe!.id, title: r.recipe!.title, qty: r.quantity })),
        )
      })
  }

  // Δ — Load price history
  async function loadHistory(itemId: string) {
    if (historyId === itemId) { setHistoryId(null); return }
    setHistoryId(itemId)
    setLoadingHistory(true)
    const { data } = await supabase
      .from('ingredient_price_history')
      .select('id, old_price, new_price, changed_at')
      .eq('inventory_item_id', itemId)
      .order('changed_at', { ascending: false })
      .limit(10)
    setPriceHistory((data ?? []) as PriceHistoryRow[])
    setLoadingHistory(false)
  }

  // Α — Load recipe cost breakdown
  async function loadBreakdown(recipeId: string) {
    if (expandedRecipeId === recipeId) { setExpandedRecipeId(null); return }
    setExpandedRecipeId(recipeId)
    setBreakdown([])
    setLoadingBreakdown(true)
    const { data } = await supabase
      .from('recipe_ingredients')
      .select('quantity, unit, inventory:inventory_item_id(name, cost_per_unit)')
      .eq('recipe_id', recipeId)
    type Row = { quantity: number; unit: string; inventory: { name: string; cost_per_unit: number | null } | null }
    const rows = (data ?? []) as unknown as Row[]
    const items = rows
      .filter((r) => r.inventory?.cost_per_unit != null)
      .map((r) => ({
        name: r.inventory!.name,
        quantity: r.quantity,
        unit: r.unit,
        total: r.quantity * r.inventory!.cost_per_unit!,
        pct: 0,
      }))
      .sort((a, b) => b.total - a.total)
    const totalCost = items.reduce((s, i) => s + i.total, 0)
    setBreakdown(items.map((i) => ({ ...i, pct: totalCost > 0 ? (i.total / totalCost) * 100 : 0 })))
    setLoadingBreakdown(false)
  }

  // Β — Bulk save suggested prices
  async function saveBulkPrices() {
    if (bulkSelected.size === 0) return
    setBulkSaving(true)
    await Promise.all(
      aboveTarget
        .filter((r) => bulkSelected.has(r.id))
        .map((r) => {
          const suggested = Math.round((r.cost_per_portion! / (target / 100)) * 100) / 100
          return supabase.from('recipes').update({ selling_price: suggested }).eq('id', r.id)
        })
    )
    setRecipes((prev) => prev.map((r) => {
      if (!bulkSelected.has(r.id)) return r
      const match = aboveTarget.find((a) => a.id === r.id)
      if (!match?.cost_per_portion) return r
      return { ...r, selling_price: Math.round((match.cost_per_portion / (target / 100)) * 100) / 100 }
    }))
    setBulkOpen(false)
    setBulkSelected(new Set())
    setBulkSaving(false)
  }

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/15">
          <Calculator className="h-5 w-5 text-brand-orange" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold leading-none">{t('costing.title')}</h1>
          <p className="text-xs text-white/40 mt-0.5">{t('costing.subtitle')}</p>
        </div>
        {/* Γ — Event costing button */}
        <button type="button" onClick={() => setEventOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-brand-orange/30 bg-brand-orange/8 px-3 py-2 text-sm font-medium text-brand-orange hover:bg-brand-orange/15 transition">
          <CalendarDays className="h-4 w-4" />
          Εκδήλωση
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('costing.totalItems'), value: String(stats.count), icon: Package, color: 'text-sky-400' },
            { label: t('costing.avgCost'), value: fmt(stats.avg), icon: TrendingUp, color: 'text-brand-orange' },
            { label: t('costing.mostExpensive'), value: `${stats.max.name} · ${fmt(stats.max.cost_per_unit ?? 0)}`, icon: AlertTriangle, color: 'text-red-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass gradient-border rounded-2xl px-4 py-3 flex items-center gap-3">
              <Icon className={cn('h-5 w-5 shrink-0', color)} />
              <div className="min-w-0">
                <p className="text-[10px] text-white/40 uppercase tracking-wider leading-none">{label}</p>
                <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(['ingredients', 'recipes'] as Tab[]).map((t_) => (
            <button key={t_} type="button"
              onClick={() => { setTab(t_); setSearch(''); setEditId(null); setExpandedRecipeId(null); setBulkOpen(false) }}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                tab === t_ ? 'bg-brand-orange text-white-fixed' : 'glass text-white/55 hover:text-white/80',
              )}>
              {t(`costing.tab${t_.charAt(0).toUpperCase() + t_.slice(1)}`)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('costing.search')}
            className="w-full rounded-xl bg-white-fixed/55 border border-white/50 text-white text-sm pl-9 pr-3 py-2 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/40" />
        </div>
        {/* Β — Bulk optimizer button (recipes tab only) */}
        {tab === 'recipes' && aboveTarget.length > 0 && (
          <button type="button" onClick={() => { setBulkOpen((v) => !v); setBulkSelected(new Set()) }}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition',
              bulkOpen
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                : 'border-amber-400/30 bg-amber-400/5 text-amber-400/70 hover:text-amber-300',
            )}>
            <Target className="h-4 w-4" />
            Βελτιστοποίηση ({aboveTarget.length})
          </button>
        )}
      </div>

      {/* Β — Bulk optimizer panel */}
      {tab === 'recipes' && bulkOpen && aboveTarget.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-300">
              {aboveTarget.length} συνταγές πάνω από τον στόχο ({target}%)
            </p>
            <button type="button" onClick={() => {
              const allIds = new Set(aboveTarget.map((r) => r.id))
              setBulkSelected((prev) => prev.size === aboveTarget.length ? new Set() : allIds)
            }} className="text-xs text-amber-400/60 hover:text-amber-300 transition">
              {bulkSelected.size === aboveTarget.length ? 'Καθαρισμός' : 'Επιλογή όλων'}
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {aboveTarget.map((r) => {
              const fp = pct(r.cost_per_portion!, r.selling_price!)
              const suggested = Math.round((r.cost_per_portion! / (target / 100)) * 100) / 100
              const sel = bulkSelected.has(r.id)
              return (
                <button key={r.id} type="button"
                  onClick={() => setBulkSelected((prev) => { const n = new Set(prev); sel ? n.delete(r.id) : n.add(r.id); return n })}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm border transition text-left',
                    sel ? 'border-amber-400/30 bg-amber-400/10' : 'border-white/8 bg-white/3',
                  )}>
                  <div className={cn('h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center',
                    sel ? 'border-amber-400 bg-amber-400' : 'border-white/20')}>
                    {sel && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="flex-1 truncate text-white/80">{r.title}</span>
                  <span className="text-red-400 text-xs tabular-nums shrink-0">{fp.toFixed(1)}%</span>
                  <span className="text-white/40 text-[10px] shrink-0">→</span>
                  <span className="text-emerald-400 text-xs tabular-nums shrink-0">{fmt(suggested)}</span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setBulkOpen(false)}
              className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-white/40 hover:text-white/70 transition">
              Άκυρο
            </button>
            <button type="button" onClick={() => void saveBulkPrices()}
              disabled={bulkSelected.size === 0 || bulkSaving}
              className="flex-1 rounded-xl bg-brand-orange/20 border border-brand-orange/40 py-2 text-sm font-medium text-brand-orange hover:bg-brand-orange/30 transition disabled:opacity-40">
              {bulkSaving
                ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                : `Αποθήκευση ${bulkSelected.size > 0 ? `(${bulkSelected.size})` : ''}`
              }
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="glass gradient-border rounded-2xl overflow-hidden flex-1">
        {loading ? (
          <div className="p-8 space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-10 glass rounded-xl animate-pulse" />)}
          </div>
        ) : tab === 'ingredients' ? (
          filteredIngredients.length === 0 ? (
            <div className="p-12 text-center text-white/40">{t('costing.noIngredients')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">{t('costing.ingredient')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-24">{t('costing.unit')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-48">{t('costing.costPerUnit')}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map((item) => (
                    <>
                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                        <td className="px-4 py-2.5 font-medium text-white/90">{item.name}</td>
                        <td className="px-4 py-2.5 text-white/40 text-xs">{item.unit}</td>
                        <td className="px-4 py-2.5 text-right">
                          {editId === item.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-white/40 text-xs">€</span>
                              <input type="number" step="0.01" min="0" autoFocus
                                value={editVal}
                                onChange={(e) => setEditVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void saveIngredientCost(item.id)
                                  if (e.key === 'Escape') setEditId(null)
                                }}
                                className="w-24 rounded-lg bg-white-fixed/55 border border-brand-orange/50 text-white text-right text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-brand-orange/60"
                              />
                              <button type="button" onClick={() => void saveIngredientCost(item.id)}
                                disabled={saving}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 transition-all">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => startEdit(item)}
                              className="rounded-lg px-3 py-1 text-sm font-medium transition-all hover:bg-white/8">
                              {item.cost_per_unit != null
                                ? <span className="text-white/90">{fmt(item.cost_per_unit)}</span>
                                : <span className="text-white/25 group-hover:text-brand-orange/70 transition-colors">{t('costing.noCost')} {t('costing.editCost')}</span>
                              }
                            </button>
                          )}
                        </td>
                        {/* Δ — history button */}
                        <td className="px-2 py-2.5">
                          <button type="button" onClick={() => void loadHistory(item.id)}
                            title="Ιστορικό τιμών"
                            className={cn(
                              'h-7 w-7 flex items-center justify-center rounded-lg transition',
                              historyId === item.id
                                ? 'bg-sky-400/15 text-sky-400'
                                : 'text-white/20 hover:text-white/50 hover:bg-white/5',
                            )}>
                            <History className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Δ — price history panel */}
                      {historyId === item.id && (
                        <tr key={`${item.id}-history`} className="border-b border-sky-400/10 bg-sky-400/5">
                          <td colSpan={4} className="px-4 py-3">
                            {loadingHistory ? (
                              <div className="flex items-center gap-2 text-xs text-white/40">
                                <Loader2 className="h-3 w-3 animate-spin" />Φόρτωση ιστορικού…
                              </div>
                            ) : priceHistory.length === 0 ? (
                              <p className="text-xs text-white/30">Δεν υπάρχει ιστορικό αλλαγών τιμής ακόμα.</p>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-[10px] text-sky-400/60 uppercase tracking-wider mb-2">Ιστορικό τιμών — {item.name}</p>
                                {priceHistory.map((h) => (
                                  <div key={h.id} className="flex items-center gap-3 text-xs">
                                    <span className="text-white/30 w-28 shrink-0">{fmtDate(h.changed_at)}</span>
                                    {h.old_price != null && (
                                      <>
                                        <span className="text-white/40 tabular-nums">{fmt(h.old_price)}</span>
                                        <span className="text-white/20">→</span>
                                      </>
                                    )}
                                    <span className="text-white/80 font-medium tabular-nums">{fmt(h.new_price)}</span>
                                    {h.old_price != null && (
                                      <span className={cn('tabular-nums', h.new_price > h.old_price ? 'text-red-400' : 'text-emerald-400')}>
                                        {h.new_price > h.old_price ? '▲' : '▼'}
                                        {Math.abs(((h.new_price - h.old_price) / h.old_price) * 100).toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}

                      {/* Ripple effect */}
                      {editId === item.id && affectedRecipes.length > 0 && (() => {
                        const newCost = parseFloat(editVal)
                        const delta   = isNaN(newCost) ? 0 : newCost - editOriginalVal
                        return (
                          <tr key={`${item.id}-ripple`} className="border-b border-brand-orange/10 bg-brand-orange/5">
                            <td colSpan={4} className="px-4 py-2">
                              <button type="button" onClick={() => setRippleExpanded((v) => !v)}
                                className="flex items-center gap-1.5 text-xs text-brand-orange/70 hover:text-brand-orange transition">
                                {rippleExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                Χρησιμοποιείται σε {affectedRecipes.length} συνταγ{affectedRecipes.length === 1 ? 'ή' : 'ές'} — κλικ για λεπτομέρειες
                              </button>
                              {rippleExpanded && (
                                <ul className="mt-1.5 space-y-0.5">
                                  {affectedRecipes.map((r) => {
                                    const d = r.qty * delta
                                    return (
                                      <li key={r.recipeId} className="flex justify-between text-xs text-white/60">
                                        <span>{r.title}</span>
                                        <span className={cn('font-medium tabular-nums',
                                          d > 0 ? 'text-red-400' : d < 0 ? 'text-emerald-400' : 'text-white/40')}>
                                          {d >= 0 ? '+' : ''}{d.toFixed(3)}€/μερίδα
                                        </span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )
                      })()}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // ── Recipes tab ────────────────────────────────────────────────────
          filteredRecipes.length === 0 ? (
            <div className="p-12 text-center text-white/40">{t('costing.noRecipes')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">{t('costing.recipe')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-32">{t('costing.costPerPortion')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-32">{t('costing.sellingPrice')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-28">{t('costing.foodCostPct')}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-32">{t('costing.margin')}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.map((recipe) => {
                    const hasCost  = recipe.cost_per_portion != null
                    const hasPrice = recipe.selling_price != null && recipe.selling_price > 0
                    const foodCostPct = hasCost && hasPrice ? pct(recipe.cost_per_portion!, recipe.selling_price!) : null
                    const margin      = hasCost && hasPrice ? recipe.selling_price! - recipe.cost_per_portion! : null
                    const status      = costStatus(foodCostPct, target)
                    const isHighCost  = status === 'bad'
                    const isLowMargin = margin != null && margin < 5
                    const isExpanded  = expandedRecipeId === recipe.id

                    return (
                      <>
                        <tr key={recipe.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white/90">{recipe.title}</span>
                              {isHighCost && (
                                <span className="text-[10px] bg-red-500/15 text-red-400 rounded px-1.5 py-0.5 font-medium">
                                  {t('costing.warningHigh')}
                                </span>
                              )}
                              {!isHighCost && isLowMargin && (
                                <span className="text-[10px] bg-amber-500/15 text-amber-400 rounded px-1.5 py-0.5 font-medium">
                                  {t('costing.warningLow')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {hasCost ? <span className="text-white/80">{fmt(recipe.cost_per_portion!)}</span>
                              : <span className="text-white/25">{t('costing.noCostData')}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {hasPrice ? <span className="text-white/80">{fmt(recipe.selling_price!)}</span>
                              : <span className="text-white/25">{t('costing.noPrice')}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {foodCostPct != null ? (
                              <span className={cn('font-semibold',
                                status === 'bad' ? 'text-red-400' : status === 'warn' ? 'text-amber-400' : 'text-green-400')}>
                                {foodCostPct.toFixed(1)}%
                              </span>
                            ) : <span className="text-white/25">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {margin != null ? (
                              <span className={cn('font-medium', margin < 5 ? 'text-amber-400' : 'text-white/80')}>
                                {fmt(margin)}
                              </span>
                            ) : <span className="text-white/25">—</span>}
                          </td>
                          {/* Α — breakdown button */}
                          <td className="px-2 py-2.5">
                            <button type="button" onClick={() => void loadBreakdown(recipe.id)}
                              title="Ανάλυση κόστους υλικών"
                              className={cn(
                                'h-7 w-7 flex items-center justify-center rounded-lg transition',
                                isExpanded
                                  ? 'bg-purple-400/15 text-purple-400'
                                  : 'text-white/20 hover:text-white/50 hover:bg-white/5',
                              )}>
                              <PieChart className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>

                        {/* Α — ingredient cost breakdown */}
                        {isExpanded && (
                          <tr key={`${recipe.id}-breakdown`} className="border-b border-purple-400/10 bg-purple-400/5">
                            <td colSpan={6} className="px-4 py-3">
                              {loadingBreakdown ? (
                                <div className="flex items-center gap-2 text-xs text-white/40">
                                  <Loader2 className="h-3 w-3 animate-spin" />Φόρτωση ανάλυσης…
                                </div>
                              ) : breakdown.length === 0 ? (
                                <p className="text-xs text-white/30">
                                  Δεν υπάρχουν υλικά με τιμή για αυτή τη συνταγή.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  <p className="text-[10px] text-purple-400/60 uppercase tracking-wider mb-2">Ανάλυση κόστους — {recipe.title}</p>
                                  {breakdown.map((row) => (
                                    <div key={row.name} className="flex items-center gap-3">
                                      <span className="text-xs text-white/60 w-40 shrink-0 truncate">{row.name}</span>
                                      <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
                                        <div className="h-full rounded-full bg-purple-400/50 transition-all"
                                          style={{ width: `${row.pct}%` }} />
                                      </div>
                                      <span className="text-xs text-white/40 w-8 text-right shrink-0">{row.pct.toFixed(0)}%</span>
                                      <span className="text-xs text-white/70 tabular-nums w-16 text-right shrink-0 font-medium">{fmt(row.total)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between text-xs pt-1 border-t border-white/8 mt-2">
                                    <span className="text-white/40">Σύνολο υλικών</span>
                                    <span className="text-white/80 font-semibold tabular-nums">
                                      {fmt(breakdown.reduce((s, r) => s + r.total, 0))}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Γ — Event costing drawer */}
      {teamId && (
        <EventCostingDrawer open={eventOpen} onClose={() => setEventOpen(false)} teamId={teamId} />
      )}
    </div>
  )
}
