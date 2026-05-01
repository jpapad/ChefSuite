import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator, Search, Check, TrendingUp, Package, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { ErrorState } from '../components/ui/ErrorState'

type Tab = 'ingredients' | 'recipes'

interface CostItem {
  id: string
  name: string
  unit: string
  cost_per_unit: number | null
}

interface RecipeCostRow {
  id: string
  title: string
  cost_per_portion: number | null
  selling_price: number | null
  servings: number | null
}

function fmt(v: number) {
  return v.toLocaleString('el-GR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

function pct(cost: number, price: number): number {
  if (price <= 0) return 0
  return (cost / price) * 100
}

export default function Costing() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const teamId = profile?.team_id

  const [tab, setTab] = useState<Tab>('ingredients')
  const [ingredients, setIngredients] = useState<CostItem[]>([])
  const [recipes, setRecipes] = useState<RecipeCostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)

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

  // Stats
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

  async function saveIngredientCost(id: string) {
    const val = parseFloat(editVal)
    if (isNaN(val) || val < 0) { setEditId(null); return }
    setSaving(true)
    await supabase.from('inventory').update({ cost_per_unit: val }).eq('id', id)
    setIngredients((prev) => prev.map((i) => i.id === id ? { ...i, cost_per_unit: val } : i))
    setEditId(null)
    setSaving(false)
  }

  function startEdit(item: CostItem) {
    setEditId(item.id)
    setEditVal(item.cost_per_unit != null ? String(item.cost_per_unit) : '')
  }

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/15">
          <Calculator className="h-5 w-5 text-brand-orange" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-none">{t('costing.title')}</h1>
          <p className="text-xs text-white/40 mt-0.5">{t('costing.subtitle')}</p>
        </div>
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
            <button
              key={t_}
              type="button"
              onClick={() => { setTab(t_); setSearch(''); setEditId(null) }}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                tab === t_ ? 'bg-brand-orange text-white-fixed' : 'glass text-white/55 hover:text-white/80',
              )}
            >
              {t(`costing.tab${t_.charAt(0).toUpperCase() + t_.slice(1)}`)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('costing.search')}
            className="w-full rounded-xl bg-white-fixed/55 border border-white/50 text-white text-sm pl-9 pr-3 py-2 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/40"
          />
        </div>
      </div>

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
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-2.5 font-medium text-white/90">{item.name}</td>
                      <td className="px-4 py-2.5 text-white/40 text-xs">{item.unit}</td>
                      <td className="px-4 py-2.5 text-right">
                        {editId === item.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-white/40 text-xs">€</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveIngredientCost(item.id)
                                if (e.key === 'Escape') setEditId(null)
                              }}
                              className="w-24 rounded-lg bg-white-fixed/55 border border-brand-orange/50 text-white text-right text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-brand-orange/60"
                            />
                            <button
                              type="button"
                              onClick={() => void saveIngredientCost(item.id)}
                              disabled={saving}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 transition-all"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-lg px-3 py-1 text-sm font-medium transition-all hover:bg-white/8"
                          >
                            {item.cost_per_unit != null
                              ? <span className="text-white/90">{fmt(item.cost_per_unit)}</span>
                              : <span className="text-white/25 group-hover:text-brand-orange/70 transition-colors">{t('costing.noCost')} {t('costing.editCost')}</span>
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // Recipes tab
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
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.map((recipe) => {
                    const hasCost = recipe.cost_per_portion != null
                    const hasPrice = recipe.selling_price != null && recipe.selling_price > 0
                    const foodCostPct = hasCost && hasPrice
                      ? pct(recipe.cost_per_portion!, recipe.selling_price!)
                      : null
                    const margin = hasCost && hasPrice
                      ? recipe.selling_price! - recipe.cost_per_portion!
                      : null
                    const isHighCost = foodCostPct != null && foodCostPct > 35
                    const isLowMargin = margin != null && margin < 5

                    return (
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
                            <span className={cn(
                              'font-semibold',
                              foodCostPct > 35 ? 'text-red-400' : foodCostPct > 28 ? 'text-amber-400' : 'text-green-400',
                            )}>
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
