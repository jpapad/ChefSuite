import { useEffect, useMemo, useState } from 'react'
import { Check, ChefHat, Loader2, Search, Sparkles, X } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import {
  suggestRecipeDetails,
  searchUnsplash,
  detectAllergensForRecipes,
  estimateNutrition,
  generatePrepBreakdown,
} from '../../lib/gemini'
import { supabase } from '../../lib/supabase'
import type { Recipe, RecipeUpdate, RecipeIngredient, InventoryItem } from '../../types/database.types'

interface Workstation {
  id: string
  name: string
  sort_order: number
}

interface Props {
  open: boolean
  onClose: () => void
  recipes: Recipe[]
  teamId: string
  onUpdate: (id: string, patch: RecipeUpdate) => Promise<Recipe>
  getIngredients: (recipeId: string) => RecipeIngredient[]
  inventory: InventoryItem[]
  initialSelectedIds?: Set<string>
}

interface FillOptions {
  recipeDetails: boolean
  allergens: boolean
  nutrition: boolean
  prepTemplate: boolean
  ingredients: boolean
  image: boolean
}

type PhaseKey = 'details' | 'allergens' | 'nutrition' | 'prep' | 'ingredients' | 'image'
type PhaseStatus = 'pending' | 'running' | 'done' | 'skipped'

interface RecipeStatus {
  id: string
  title: string
  phases: Record<PhaseKey, PhaseStatus>
  done: boolean
  ingredientStats?: { matched: number; total: number }
}

const PHASE_LABELS: Record<PhaseKey, string> = {
  details:     '📖 Στοιχεία',
  allergens:   '⚠️ Αλλεργιογόνα',
  nutrition:   '🔢 Διατροφικά',
  prep:        '🔪 Prep Template',
  ingredients: '🥕 Υλικά',
  image:       '🖼️ Εικόνα',
}

export function BatchRecipeProcessorDrawer({
  open, onClose, recipes, teamId, onUpdate, getIngredients, inventory, initialSelectedIds,
}: Props) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    initialSelectedIds ?? new Set(recipes.map((r) => r.id))
  )
  const [onlyEmpty, setOnlyEmpty] = useState(true)
  const [fillOptions, setFillOptions] = useState<FillOptions>({
    recipeDetails: true,
    allergens:     true,
    nutrition:     true,
    prepTemplate:  true,
    ingredients:   true,
    image:         true,
  })
  const [workstations, setWorkstations] = useState<Workstation[]>([])

  const [running, setRunning] = useState(false)
  const [statuses, setStatuses] = useState<RecipeStatus[]>([])
  const [currentIdx, setCurrentIdx] = useState<number>(-1)
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!open || !teamId) return
    supabase
      .from('workstations')
      .select('id, name, sort_order')
      .eq('team_id', teamId)
      .order('sort_order')
      .then(({ data }) => setWorkstations((data ?? []) as Workstation[]))
  }, [open, teamId])

  useEffect(() => {
    if (initialSelectedIds) setSelectedIds(new Set(initialSelectedIds))
  }, [initialSelectedIds])

  const filtered = useMemo(() =>
    recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase())),
    [recipes, search],
  )

  function toggleRecipe(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === recipes.length ? new Set() : new Set(recipes.map((r) => r.id))
    )
  }

  function setPhase(idx: number, phase: PhaseKey, status: PhaseStatus) {
    setStatuses((prev) => {
      const next = [...prev]
      if (next[idx]) {
        next[idx] = { ...next[idx]!, phases: { ...next[idx]!.phases, [phase]: status } }
      }
      return next
    })
  }

  function markDone(idx: number) {
    setStatuses((prev) => {
      const next = [...prev]
      if (next[idx]) next[idx] = { ...next[idx]!, done: true }
      return next
    })
  }

  async function handleRun() {
    const selected = recipes.filter((r) => selectedIds.has(r.id))
    if (selected.length === 0) return

    const initial: RecipeStatus[] = selected.map((r) => ({
      id: r.id,
      title: r.title,
      done: false,
      phases: {
        details:     fillOptions.recipeDetails ? 'pending' : 'skipped',
        allergens:   fillOptions.allergens && !fillOptions.recipeDetails ? 'pending' : 'skipped',
        nutrition:   fillOptions.nutrition   ? 'pending' : 'skipped',
        prep:        fillOptions.prepTemplate ? 'pending' : 'skipped',
        ingredients: fillOptions.ingredients  ? 'pending' : 'skipped',
        image:       fillOptions.image        ? 'pending' : 'skipped',
      },
    }))
    setStatuses(initial)
    setRunning(true)
    setFinished(false)
    setError(null)

    const workstationNames = workstations.map((w) => w.name)
    const workstationMap = Object.fromEntries(workstations.map((w) => [w.name.toLowerCase(), w.id]))

    try {
      for (let idx = 0; idx < selected.length; idx++) {
        const recipe = selected[idx]!
        setCurrentIdx(idx)

        const patch: RecipeUpdate = {}
        let updatedInstructions = recipe.instructions

        // ── Recipe details ─────────────────────────────────────────────────
        if (fillOptions.recipeDetails) {
          const needsFill = !onlyEmpty || (
            !recipe.description || !recipe.instructions ||
            !recipe.category || !recipe.difficulty
          )
          if (needsFill) {
            setPhase(idx, 'details', 'running')
            const inventoryForAI = inventory.map((i) => ({ id: i.id, name: i.name }))
            const suggestion = await suggestRecipeDetails(recipe.title, inventoryForAI)
            if (!onlyEmpty || !recipe.description)   patch.description   = suggestion.description   ?? undefined
            if (!onlyEmpty || !recipe.instructions)  patch.instructions  = suggestion.instructions  ?? undefined
            if (!onlyEmpty || !recipe.category)      patch.category      = (suggestion.category as Recipe['category'])  ?? undefined
            if (!onlyEmpty || !recipe.difficulty)    patch.difficulty    = (suggestion.difficulty as Recipe['difficulty']) ?? undefined
            if (!onlyEmpty || !recipe.prep_time)     patch.prep_time     = suggestion.prep_time  ?? undefined
            if (!onlyEmpty || !recipe.cook_time)     patch.cook_time     = suggestion.cook_time  ?? undefined
            if (!onlyEmpty || !recipe.servings)      patch.servings      = suggestion.servings   ?? undefined
            if (fillOptions.allergens) {
              const existing = recipe.allergens.filter((a) => a.startsWith('no_') || ['vegan','vegetarian','spicy'].includes(a))
              patch.allergens = [...new Set([...existing, ...suggestion.allergens])]
              setPhase(idx, 'allergens', 'done')
            }
            if (suggestion.instructions) updatedInstructions = suggestion.instructions
            // pick up image and ingredients from the details call if those options are active
            if (fillOptions.image && suggestion.image_url) {
              patch.image_url = suggestion.image_url
              setPhase(idx, 'image', 'done')
            }
            if (fillOptions.ingredients && suggestion.suggested_ingredients.length > 0) {
              const matched = suggestion.suggested_ingredients.filter((i) => i.inventory_item_id)
              const total   = suggestion.suggested_ingredients.length
              if (matched.length > 0) {
                const existingIds = new Set(getIngredients(recipe.id).map((i) => i.inventory_item_id))
                const toInsert = matched
                  .filter((i) => !existingIds.has(i.inventory_item_id!))
                  .map((i) => ({
                    recipe_id:         recipe.id,
                    inventory_item_id: i.inventory_item_id!,
                    quantity:          i.quantity,
                    unit:              i.unit,
                    notes:             null,
                  }))
                if (toInsert.length > 0) {
                  const { error: ingErr } = await supabase.from('recipe_ingredients').insert(toInsert)
                  if (ingErr) throw ingErr
                }
              }
              setStatuses((prev) => {
                const next = [...prev]
                if (next[idx]) next[idx] = { ...next[idx]!, ingredientStats: { matched: matched.length, total } }
                return next
              })
              setPhase(idx, 'ingredients', 'done')
            }
            setPhase(idx, 'details', 'done')
          } else {
            setPhase(idx, 'details', 'skipped')
            if (fillOptions.allergens) setPhase(idx, 'allergens', 'skipped')
          }
        }

        // ── Allergens only (if recipeDetails is off) ───────────────────────
        if (fillOptions.allergens && !fillOptions.recipeDetails) {
          const needsFill = !onlyEmpty || recipe.allergens.filter((a) => !a.startsWith('no_')).length === 0
          if (needsFill) {
            setPhase(idx, 'allergens', 'running')
            const [detected] = await detectAllergensForRecipes([{
              title: recipe.title,
              description: recipe.description,
              instructions: recipe.instructions,
            }])
            const existing = recipe.allergens.filter((a) => a.startsWith('no_') || ['vegan','vegetarian','spicy'].includes(a))
            patch.allergens = [...new Set([...existing, ...(detected ?? [])])]
            setPhase(idx, 'allergens', 'done')
          } else {
            setPhase(idx, 'allergens', 'skipped')
          }
        }

        // ── Nutrition ─────────────────────────────────────────────────────
        if (fillOptions.nutrition) {
          const needsFill = !onlyEmpty || recipe.calories == null
          if (needsFill) {
            setPhase(idx, 'nutrition', 'running')
            const ings = getIngredients(recipe.id).map((ing) => {
              const item = inventory.find((i) => i.id === ing.inventory_item_id)
              return { name: item?.name ?? 'ingredient', quantity: ing.quantity, unit: item?.unit ?? '' }
            })
            const nutrition = await estimateNutrition(
              recipe.title,
              ings,
              recipe.servings ?? 4,
            )
            patch.calories   = nutrition.calories
            patch.protein_g  = nutrition.protein_g
            patch.carbs_g    = nutrition.carbs_g
            patch.fat_g      = nutrition.fat_g
            patch.fiber_g    = nutrition.fiber_g
            patch.sodium_mg  = nutrition.sodium_mg
            setPhase(idx, 'nutrition', 'done')
          } else {
            setPhase(idx, 'nutrition', 'skipped')
          }
        }

        // ── Save recipe patch ─────────────────────────────────────────────
        if (Object.keys(patch).length > 0) {
          await onUpdate(recipe.id, patch)
        }

        // ── Prep template ─────────────────────────────────────────────────
        if (fillOptions.prepTemplate) {
          setPhase(idx, 'prep', 'running')
          const recipeForBreakdown = {
            title: recipe.title,
            instructions: updatedInstructions,
          }
          const ings = getIngredients(recipe.id).map((ing) => {
            const item = inventory.find((i) => i.id === ing.inventory_item_id)
            return { name: item?.name ?? 'ingredient', quantity: ing.quantity, unit: item?.unit ?? '' }
          })
          const tasks = await generatePrepBreakdown(
            recipeForBreakdown,
            ings,
            workstationNames,
            recipe.servings ?? 4,
          )
          if (tasks.length > 0) {
            const { data: tmpl, error: tmplErr } = await supabase
              .from('prep_templates')
              .insert({ name: `${recipe.title} — Prep`, team_id: teamId })
              .select('id')
              .single()
            if (tmplErr) throw tmplErr
            const templateId = (tmpl as { id: string }).id
            const items = tasks.map((task, i) => ({
              template_id: templateId,
              title: task.title,
              description: task.description,
              recipe_id: recipe.id,
              workstation_id: workstationMap[task.station.toLowerCase()] ?? null,
              quantity: null,
              sort_order: i,
            }))
            const { error: itemsErr } = await supabase.from('prep_template_items').insert(items)
            if (itemsErr) throw itemsErr
          }
          setPhase(idx, 'prep', 'done')
        }

        // ── Ingredients (standalone — only when recipeDetails is OFF) ────────
        if (fillOptions.ingredients && !fillOptions.recipeDetails) {
          const needsFill = !onlyEmpty || getIngredients(recipe.id).length === 0
          if (needsFill) {
            setPhase(idx, 'ingredients', 'running')
            const inventoryForAI = inventory.map((i) => ({ id: i.id, name: i.name }))
            const suggestion = await suggestRecipeDetails(recipe.title, inventoryForAI)
            const matched = suggestion.suggested_ingredients.filter((i) => i.inventory_item_id)
            const total   = suggestion.suggested_ingredients.length
            if (matched.length > 0) {
              const existingIds = new Set(getIngredients(recipe.id).map((i) => i.inventory_item_id))
              const toInsert = matched
                .filter((i) => !existingIds.has(i.inventory_item_id!))
                .map((i) => ({
                  recipe_id:         recipe.id,
                  inventory_item_id: i.inventory_item_id!,
                  quantity:          i.quantity,
                  unit:              i.unit,
                  notes:             null,
                }))
              if (toInsert.length > 0) {
                const { error: ingErr } = await supabase.from('recipe_ingredients').insert(toInsert)
                if (ingErr) throw ingErr
              }
            }
            if (fillOptions.image && suggestion.image_url && (!onlyEmpty || !recipe.image_url)) {
              patch.image_url = suggestion.image_url
              setPhase(idx, 'image', 'done')
            }
            setStatuses((prev) => {
              const next = [...prev]
              if (next[idx]) next[idx] = { ...next[idx]!, ingredientStats: { matched: matched.length, total } }
              return next
            })
            setPhase(idx, 'ingredients', 'done')
            if (Object.keys(patch).length > 0) await onUpdate(recipe.id, patch)
          } else {
            setPhase(idx, 'ingredients', 'skipped')
          }
        }

        // ── Image (standalone — only when neither details nor ingredients fetched it) ──
        if (fillOptions.image && !fillOptions.recipeDetails && !fillOptions.ingredients) {
          const needsFill = !onlyEmpty || !recipe.image_url
          if (needsFill) {
            setPhase(idx, 'image', 'running')
            const url = await searchUnsplash(recipe.title)
            if (url) {
              await onUpdate(recipe.id, { image_url: url })
            }
            setPhase(idx, 'image', 'done')
          } else {
            setPhase(idx, 'image', 'skipped')
          }
        }

        markDone(idx)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία — έλεγξε τη σύνδεση')
    } finally {
      setRunning(false)
      setCurrentIdx(-1)
      setFinished(true)
    }
  }

  function handleClose() {
    if (running) return
    setSearch('')
    setStatuses([])
    setCurrentIdx(-1)
    setError(null)
    setFinished(false)
    onClose()
  }

  const selectedCount = selectedIds.size
  const activePhaseCount = Object.values(fillOptions).filter(Boolean).length
  const doneCount = statuses.filter((s) => s.done).length

  return (
    <Drawer open={open} onClose={handleClose} title="🤖 Batch AI — Συνταγές & Prep">
      <div className="space-y-5">

        {!running && !finished && (
          <>
            {/* Fill options */}
            <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 space-y-3">
              <p className="text-xs font-semibold text-brand-orange/70 uppercase tracking-wider">Τι να κάνει το AI</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'recipeDetails' as const, label: '📖 Στοιχεία συνταγής', sub: 'Περιγραφή, οδηγίες, κατηγορία, χρόνοι' },
                  { key: 'allergens'     as const, label: '⚠️ Αλλεργιογόνα',      sub: 'Αυτόματη ανίχνευση' },
                  { key: 'nutrition'     as const, label: '🔢 Διατροφικά',         sub: 'Θερμίδες, πρωτεΐνες, υδ/κες' },
                  { key: 'prepTemplate'  as const, label: '🔪 Prep Template',       sub: 'Ανά σταθμό εργασίας' },
                  { key: 'ingredients'   as const, label: '🥕 Υλικά',              sub: 'Αντιστοίχιση με αποθήκη' },
                  { key: 'image'         as const, label: '🖼️ Εικόνα',             sub: 'Φωτογραφία από Unsplash' },
                ] as { key: keyof FillOptions; label: string; sub: string }[]).map(({ key, label, sub }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFillOptions((p) => ({ ...p, [key]: !p[key] }))}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition text-left',
                      fillOptions[key]
                        ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-orange'
                        : 'border-white/10 text-white/40 hover:text-white/60',
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center',
                      fillOptions[key] ? 'border-brand-orange bg-brand-orange' : 'border-white/30',
                    )}>
                      {fillOptions[key] && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <div>
                      <div>{label}</div>
                      <div className={cn('text-[10px] font-normal mt-0.5', fillOptions[key] ? 'text-brand-orange/60' : 'text-white/25')}>{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOnlyEmpty((v) => !v)}
                className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition"
              >
                <div className={cn(
                  'h-4 w-4 rounded border-2 flex items-center justify-center transition',
                  onlyEmpty ? 'border-emerald-400 bg-emerald-400' : 'border-white/30',
                )}>
                  {onlyEmpty && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                Μόνο κενά πεδία (μην αντικαταστήσεις υπάρχοντα)
              </button>
            </div>

            {/* Recipe list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/80">{selectedCount} / {recipes.length} συνταγές</p>
                <button type="button" onClick={toggleAll} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
                  {selectedIds.size === recipes.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Αναζήτηση συνταγής…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <ul className="glass rounded-xl divide-y divide-glass-border max-h-56 overflow-y-auto">
                {filtered.map((r) => {
                  const sel = selectedIds.has(r.id)
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => toggleRecipe(r.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition',
                          sel ? 'bg-emerald-500/5' : 'opacity-40',
                        )}
                      >
                        <div className={cn(
                          'h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition',
                          sel ? 'border-emerald-400 bg-emerald-400' : 'border-white/30',
                        )}>
                          {sel && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                        <span className="flex-1 text-sm text-white truncate">{r.title}</span>
                        <div className="flex gap-1 shrink-0 text-[10px]">
                          {r.instructions && <span className="text-sky-400/60">📖</span>}
                          {r.calories != null && <span className="text-emerald-400/60">🔢</span>}
                          {r.allergens.length > 0 && <span className="text-amber-400/60">⚠</span>}
                        </div>
                      </button>
                    </li>
                  )
                })}
                {filtered.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-white/30">Δεν βρέθηκαν συνταγές</li>
                )}
              </ul>
            </div>
          </>
        )}

        {/* ── Progress UI ─────────────────────────────────────────────── */}
        {(running || finished) && statuses.length > 0 && (
          <div className="space-y-4">
            {/* Overall bar */}
            <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-orange">
                  {running ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
                  {running
                    ? `Επεξεργασία ${doneCount + 1} / ${statuses.length}`
                    : `Ολοκληρώθηκε — ${doneCount} συνταγές`
                  }
                </div>
                <span className="text-xs text-brand-orange/60">
                  {Math.round((doneCount / statuses.length) * 100)}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-orange to-amber-400 transition-all duration-500"
                  style={{ width: `${statuses.length > 0 ? (doneCount / statuses.length) * 100 : 0}%` }}
                />
              </div>
              {running && currentIdx >= 0 && statuses[currentIdx] && (
                <p className="text-xs text-white/60 truncate">
                  <ChefHat className="inline h-3.5 w-3.5 mr-1 text-brand-orange/70" />
                  {statuses[currentIdx]!.title}
                </p>
              )}
            </div>

            {/* Per-recipe log */}
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {statuses.map((s, idx) => (
                <li key={s.id} className={cn(
                  'rounded-xl border px-3 py-2.5 transition-all',
                  s.done
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : idx === currentIdx
                      ? 'border-brand-orange/40 bg-brand-orange/8'
                      : 'border-white/8 bg-white/3 opacity-50',
                )}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {s.done
                      ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      : idx === currentIdx
                        ? <Loader2 className="h-3.5 w-3.5 text-brand-orange animate-spin shrink-0" />
                        : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" />
                    }
                    <span className="text-sm font-medium text-white truncate">{s.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-5">
                    {(Object.entries(s.phases) as [PhaseKey, PhaseStatus][])
                      .filter(([, st]) => st !== 'skipped')
                      .map(([phase, status]) => (
                        <span
                          key={phase}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium',
                            status === 'done'    && 'bg-emerald-500/15 text-emerald-300',
                            status === 'running' && 'bg-brand-orange/15 text-brand-orange',
                            status === 'pending' && 'bg-white/8 text-white/30',
                          )}
                        >
                          {status === 'done'    && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                          {status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                          {PHASE_LABELS[phase]}
                          {phase === 'ingredients' && status === 'done' && s.ingredientStats && (
                            <span className="opacity-70">
                              {s.ingredientStats.matched}/{s.ingredientStats.total}
                            </span>
                          )}
                        </span>
                      ))
                    }
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Actions */}
        {!running && (
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
              {finished ? 'Κλείσιμο' : 'Άκυρο'}
            </Button>
            {!finished && (
              <Button
                type="button"
                className="flex-1"
                disabled={selectedCount === 0 || activePhaseCount === 0}
                onClick={() => void handleRun()}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Εκκίνηση ({selectedCount})
              </Button>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
