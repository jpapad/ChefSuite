import { useEffect, useState, useMemo } from 'react'
import { Search, Check, Loader2, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import { supabase } from '../../lib/supabase'
import { costStatus } from '../../lib/foodCost'
import { useTeamSettings } from '../../hooks/useTeamSettings'

interface Props {
  open: boolean
  onClose: () => void
  teamId: string
}

interface EventRecipe {
  id: string
  title: string
  servings: number | null
  cost_per_portion: number | null
  selling_price: number | null
}

interface RecipeResult {
  id: string
  title: string
  batches: number
  cost: number
  revenue: number | null
  autoCost: boolean
}

interface IngRow {
  recipe_id: string
  quantity: number
  inventory: { cost_per_unit: number | null } | null
}

function fmt(v: number) {
  return v.toLocaleString('el-GR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

export function EventCostingDrawer({ open, onClose, teamId }: Props) {
  const { targetFoodCostPct: target } = useTeamSettings()
  const [recipes, setRecipes]       = useState<EventRecipe[]>([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [persons, setPersons]       = useState(20)
  const [computing, setComputing]   = useState(false)
  const [results, setResults]       = useState<RecipeResult[] | null>(null)
  const [expanded, setExpanded]     = useState(false)

  useEffect(() => {
    if (!open || !teamId) return
    setLoading(true)
    void supabase
      .from('recipes')
      .select('id, title, servings, cost_per_portion, selling_price')
      .eq('team_id', teamId)
      .order('title')
      .then(({ data }) => {
        setRecipes((data ?? []) as EventRecipe[])
        setLoading(false)
      })
  }, [open, teamId])

  const filtered = useMemo(() =>
    search ? recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase())) : recipes,
    [recipes, search],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setResults(null)
  }

  async function compute() {
    if (selected.size === 0 || persons <= 0) return
    setComputing(true)
    setResults(null)

    const ids = Array.from(selected)
    const { data: ingData } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, quantity, inventory:inventory_item_id(cost_per_unit)')
      .in('recipe_id', ids)

    const rows = (ingData ?? []) as unknown as IngRow[]

    // Sum auto cost per recipe from ingredients
    const autoMap = new Map<string, number>()
    for (const row of rows) {
      const cpu = row.inventory?.cost_per_unit ?? null
      if (cpu == null) continue
      autoMap.set(row.recipe_id, (autoMap.get(row.recipe_id) ?? 0) + row.quantity * cpu)
    }

    const selectedRecipes = recipes.filter((r) => selected.has(r.id))
    const res: RecipeResult[] = selectedRecipes.map((r) => {
      const servings   = r.servings ?? 4
      const batches    = persons / servings
      const autoCostPer = autoMap.get(r.id) ?? null
      const costPer     = r.cost_per_portion ?? (autoCostPer != null ? autoCostPer / servings : null)
      const cost        = costPer != null ? costPer * persons : 0
      const revenue     = r.selling_price != null ? r.selling_price * persons : null
      return {
        id: r.id, title: r.title, batches,
        cost, revenue,
        autoCost: r.cost_per_portion == null && autoCostPer != null,
      }
    })

    setResults(res)
    setExpanded(true)
    setComputing(false)
  }

  const summary = useMemo(() => {
    if (!results) return null
    const totalCost    = results.reduce((s, r) => s + r.cost, 0)
    const totalRevenue = results.every((r) => r.revenue != null)
      ? results.reduce((s, r) => s + (r.revenue ?? 0), 0) : null
    const fc = totalRevenue != null && totalRevenue > 0
      ? (totalCost / totalRevenue) * 100 : null
    return { totalCost, totalRevenue, fc }
  }, [results])

  const status = summary ? costStatus(summary.fc, target) : null

  return (
    <Drawer open={open} onClose={onClose} title="📅 Κοστολόγηση Εκδήλωσης">
      <div className="space-y-4">

        {/* Persons */}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <Users className="h-4 w-4 text-brand-orange shrink-0" />
          <span className="text-sm text-white/70 flex-1">Αριθμός ατόμων</span>
          <input
            type="number" min={1} value={persons}
            onChange={(e) => { setPersons(Math.max(1, Number(e.target.value))); setResults(null) }}
            className="w-20 rounded-lg bg-white/10 border border-white/15 text-white text-center text-sm px-2 py-1 outline-none focus:border-brand-orange/50"
          />
        </div>

        {/* Recipe picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40 uppercase tracking-wider">Συνταγές</p>
            {selected.size > 0 && (
              <button type="button" onClick={() => { setSelected(new Set()); setResults(null) }}
                className="text-[11px] text-white/30 hover:text-white/60 transition">
                Καθαρισμός ({selected.size})
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση συνταγής…"
              className="w-full rounded-xl bg-white/5 border border-white/10 text-sm text-white pl-9 pr-3 py-2 placeholder:text-white/20 outline-none focus:border-white/25" />
          </div>
          <div className="rounded-xl border border-white/8 overflow-hidden max-h-52 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin text-white/30 mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-white/30 text-center">Δεν βρέθηκαν συνταγές</p>
            ) : filtered.map((r) => {
              const sel = selected.has(r.id)
              return (
                <button key={r.id} type="button" onClick={() => toggle(r.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-sm border-b border-white/5 last:border-0 transition text-left',
                    sel ? 'bg-brand-orange/8 text-white' : 'text-white/60 hover:bg-white/4 hover:text-white/80',
                  )}>
                  <div className={cn('h-4 w-4 shrink-0 rounded border flex items-center justify-center transition',
                    sel ? 'border-brand-orange bg-brand-orange' : 'border-white/20')}>
                    {sel && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="text-[10px] text-white/25 shrink-0">{r.servings ?? 4} μερ.</span>
                </button>
              )
            })}
          </div>
        </div>

        <Button type="button" className="w-full" disabled={selected.size === 0 || computing}
          onClick={() => void compute()}>
          {computing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Υπολογισμός για {persons} άτομα ({selected.size} συνταγές)
        </Button>

        {/* Results */}
        {summary && (
          <div className="space-y-3">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Κόστος Υλικών</p>
                <p className="text-base font-bold text-white mt-1">{fmt(summary.totalCost)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Εκτ. Έσοδα</p>
                <p className="text-base font-bold text-white mt-1">
                  {summary.totalRevenue != null ? fmt(summary.totalRevenue) : <span className="text-white/25 text-sm">—</span>}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Food Cost %</p>
                <p className={cn('text-base font-bold mt-1',
                  status === 'good' ? 'text-emerald-400'
                  : status === 'warn' ? 'text-amber-400'
                  : status === 'bad' ? 'text-red-400'
                  : 'text-white/40')}>
                  {summary.fc != null ? `${summary.fc.toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>

            {/* Per-recipe breakdown */}
            <button type="button" onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition w-full">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Ανάλυση ανά συνταγή
            </button>
            {expanded && (
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left px-3 py-2 text-white/30 font-medium">Συνταγή</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">Παρτ.</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">Κόστος</th>
                      <th className="text-right px-3 py-2 text-white/30 font-medium">Έσοδα</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results!.map((r) => (
                      <tr key={r.id} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 text-white/80">
                          {r.title}
                          {r.autoCost && <span className="ml-1 text-[9px] text-white/30">auto</span>}
                          {r.cost === 0 && <span className="ml-1 text-[9px] text-amber-400/60">χωρίς κόστος</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-white/50 tabular-nums">{r.batches.toFixed(1)}×</td>
                        <td className="px-3 py-2 text-right text-white/80 tabular-nums font-medium">
                          {r.cost > 0 ? fmt(r.cost) : <span className="text-white/25">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-white/60 tabular-nums">
                          {r.revenue != null ? fmt(r.revenue) : <span className="text-white/25">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
