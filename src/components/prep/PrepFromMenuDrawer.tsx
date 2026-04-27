import { useEffect, useMemo, useState } from 'react'
import { Minus, Package, Plus, UtensilsCrossed, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { useMenus, useMenuDetail } from '../../hooks/useMenus'
import { supabase } from '../../lib/supabase'
import { generatePrepBreakdown } from '../../lib/gemini'
import type { InventoryItem, MenuItem, Profile, Recipe, RecipeIngredient, Shift, Workstation } from '../../types/database.types'

interface PrepFromMenuDrawerProps {
  open: boolean
  onClose: () => void
  defaultDate: string
  defaultWorkstationId: string | null
  recipes: Recipe[]
  inventory: InventoryItem[]
  workstations: Workstation[]
  members: Profile[]
  onGenerate: (items: GeneratedPrepItem[]) => Promise<void>
  lockedMenuId?: string
}

export interface GeneratedPrepItem {
  title: string
  description: string | null
  recipe_id: string | null
  menu_id: string | null
  quantity: number | null
  workstation_id: string | null
  assignee_id: string | null
  prep_for: string
}

interface ItemAssignment {
  workstation_id: string | null
  assignee_id: string | null
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseSteps(instructions: string | null | undefined): string[] {
  if (!instructions?.trim()) return []
  return instructions
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, '').trim())
    .filter((l) => l.length > 2)
}

export function PrepFromMenuDrawer({
  open,
  onClose,
  defaultDate,
  defaultWorkstationId,
  recipes,
  inventory,
  workstations,
  members,
  onGenerate,
  lockedMenuId,
}: PrepFromMenuDrawerProps) {
  const { t } = useTranslation()
  const { menus } = useMenus()
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(lockedMenuId ?? null)
  const [date, setDate] = useState(defaultDate)
  const [covers, setCovers] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignments, setAssignments] = useState<Record<string, ItemAssignment>>({})
  const [generating, setGenerating] = useState(false)
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([])
  const [shiftsForDate, setShiftsForDate] = useState<Shift[]>([])
  const [smartMode, setSmartMode] = useState(false)

  const { menu, loading: menuLoading } = useMenuDetail(selectedMenuId)

  useEffect(() => {
    if (open) {
      setSelectedMenuId(lockedMenuId ?? null)
      setDate(defaultDate)
      setCovers(10)
      setSelected(new Set())
      setAssignments({})
      setRecipeIngredients([])
    }
  }, [open, defaultDate, lockedMenuId])

  // Load shifts whenever date changes
  useEffect(() => {
    if (!date) return
    supabase
      .from('shifts')
      .select('*')
      .eq('shift_date', date)
      .then(({ data }) => setShiftsForDate((data ?? []) as Shift[]))
  }, [date])

  const itemsWithRecipe = useMemo(() => {
    if (!menu) return []
    const items: MenuItem[] = []
    for (const section of menu.sections) {
      for (const item of section.items) {
        if (item.recipe_id) items.push(item)
      }
    }
    return items
  }, [menu])

  useEffect(() => {
    setSelected(new Set(itemsWithRecipe.map((i) => i.id)))
    // Default assignments
    const defs: Record<string, ItemAssignment> = {}
    for (const item of itemsWithRecipe) {
      defs[item.id] = { workstation_id: defaultWorkstationId, assignee_id: null }
    }
    setAssignments(defs)
  }, [itemsWithRecipe, defaultWorkstationId])

  // Load recipe ingredients when menu items change
  useEffect(() => {
    const recipeIds = itemsWithRecipe.map((i) => i.recipe_id).filter(Boolean) as string[]
    if (recipeIds.length === 0) { setRecipeIngredients([]); return }
    supabase
      .from('recipe_ingredients')
      .select('*')
      .in('recipe_id', recipeIds)
      .then(({ data }) => setRecipeIngredients((data ?? []) as RecipeIngredient[]))
  }, [itemsWithRecipe])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === itemsWithRecipe.length) setSelected(new Set())
    else setSelected(new Set(itemsWithRecipe.map((i) => i.id)))
  }

  function setAssignment(itemId: string, patch: Partial<ItemAssignment>) {
    setAssignments((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }))
  }

  // Members working on this date (from shifts), fallback to all members
  const membersOnShift = useMemo(() => {
    const ids = new Set(shiftsForDate.map((s) => s.member_id))
    const onShift = members.filter((m) => ids.has(m.id))
    return onShift.length > 0 ? onShift : members
  }, [shiftsForDate, members])

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])

  // Ingredient totals for selected items × covers
  const ingredientTotals = useMemo(() => {
    const selectedItems = itemsWithRecipe.filter((i) => selected.has(i.id))
    const totals = new Map<string, { item: InventoryItem; total: number }>()
    for (const menuItem of selectedItems) {
      if (!menuItem.recipe_id) continue
      const ings = recipeIngredients.filter((ri) => ri.recipe_id === menuItem.recipe_id)
      for (const ing of ings) {
        const invItem = inventory.find((iv) => iv.id === ing.inventory_item_id)
        if (!invItem) continue
        const existing = totals.get(ing.inventory_item_id)
        const qty = ing.quantity * covers
        if (existing) existing.total += qty
        else totals.set(ing.inventory_item_id, { item: invItem, total: qty })
      }
    }
    return [...totals.values()].sort((a, b) => a.item.name.localeCompare(b.item.name))
  }, [itemsWithRecipe, selected, recipeIngredients, inventory, covers])

  function matchWorkstation(stationName: string): string | null {
    const lower = stationName.toLowerCase()
    const exact = workstations.find((w) => w.name.toLowerCase() === lower)
    if (exact) return exact.id
    const partial = workstations.find(
      (w) => lower.includes(w.name.toLowerCase()) || w.name.toLowerCase().includes(lower),
    )
    return partial?.id ?? null
  }

  async function handleGenerate() {
    const selectedItems = itemsWithRecipe.filter((i) => selected.has(i.id))
    if (selectedItems.length === 0) return
    setGenerating(true)
    try {
      if (smartMode) {
        // AI Smart Breakdown — one call per recipe, N tasks per station
        const items: GeneratedPrepItem[] = []
        const prepDate = date || todayIso()
        const workstationNames = workstations.map((w) => w.name)

        for (const menuItem of selectedItems) {
          const recipe = menuItem.recipe_id ? recipesById.get(menuItem.recipe_id) : undefined
          if (!recipe) continue

          const scaledIngredients = recipeIngredients
            .filter((ri) => ri.recipe_id === recipe.id)
            .map((ri) => {
              const inv = inventory.find((iv) => iv.id === ri.inventory_item_id)
              return { name: inv?.name ?? '?', quantity: ri.quantity * covers, unit: inv?.unit ?? '' }
            })

          const tasks = await generatePrepBreakdown(recipe, scaledIngredients, workstationNames, covers)

          for (const task of tasks) {
            items.push({
              title: task.title,
              description: task.description,
              recipe_id: recipe.id,
              menu_id: selectedMenuId,
              quantity: covers,
              workstation_id: matchWorkstation(task.station),
              assignee_id: null,
              prep_for: prepDate,
            })
          }
        }

        if (items.length > 0) { await onGenerate(items); onClose() }
      } else {
        // Standard mode — one task per menu item
        const items: GeneratedPrepItem[] = []
        const prepDate = date || todayIso()
        for (const menuItem of selectedItems) {
          const recipe = menuItem.recipe_id ? recipesById.get(menuItem.recipe_id) : undefined
          const steps = parseSteps(recipe?.instructions)
          const base = {
            recipe_id: menuItem.recipe_id,
            menu_id: selectedMenuId,
            quantity: covers,
            workstation_id: assignments[menuItem.id]?.workstation_id ?? null,
            assignee_id: assignments[menuItem.id]?.assignee_id ?? null,
            prep_for: prepDate,
          }
          if (steps.length > 0) {
            for (const step of steps) {
              items.push({ ...base, title: step, description: null })
            }
          } else {
            items.push({ ...base, title: menuItem.name, description: null })
          }
        }
        await onGenerate(items)
        onClose()
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!generating) onClose() }}
      title={t('prep.fromMenu.title')}
    >
      <div className="space-y-5">
        {/* Menu selector — hidden when menu is pre-selected (lockedMenuId) */}
        {!lockedMenuId && (
          <div>
            <span className="mb-2 block text-sm font-medium text-white/80">{t('prep.fromMenu.selectMenu')}</span>
            <div className="glass flex items-center rounded-xl px-4 min-h-[48px] focus-within:ring-2 focus-within:ring-brand-orange">
              <select
                value={selectedMenuId ?? ''}
                onChange={(e) => setSelectedMenuId(e.target.value || null)}
                className="flex-1 bg-transparent outline-none text-sm text-white"
              >
                <option value="" className="bg-[#f5ede0]">— {t('prep.fromMenu.chooseMenu')} —</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#f5ede0]">{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Date */}
        <div>
          <span className="mb-2 block text-sm font-medium text-white/80">{t('prep.form.date')}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-brand-orange"
          />
          {shiftsForDate.length > 0 && (
            <p className="mt-1 text-xs text-emerald-400/70">
              {t('prep.fromMenu.shiftsFound', { count: shiftsForDate.length })}
            </p>
          )}
        </div>

        {/* Covers */}
        {selectedMenuId && (
          <div>
            <span className="mb-2 block text-sm font-medium text-white/80">{t('prep.fromMenu.covers')}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCovers((c) => Math.max(1, c - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition">
                <Minus className="h-4 w-4" />
              </button>
              <input type="number" min={1} value={covers}
                onChange={(e) => setCovers(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 text-center rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand-orange"
              />
              <button type="button" onClick={() => setCovers((c) => c + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition">
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-sm text-white/50">{t('prep.fromMenu.people')}</span>
            </div>
          </div>
        )}

        {/* Smart Breakdown toggle */}
        {selectedMenuId && (
          <button
            type="button"
            onClick={() => setSmartMode((v) => !v)}
            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              smartMode
                ? 'border-brand-orange/60 bg-brand-orange/10 text-brand-orange'
                : 'border-white/20 text-white/60 hover:text-white hover:border-white/40'
            }`}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <div className="flex-1 text-left">
              <p className="font-medium">{t('prep.fromMenu.smartBreakdown')}</p>
              <p className="text-xs opacity-70 font-normal mt-0.5">{t('prep.fromMenu.smartBreakdownHint')}</p>
            </div>
            <div className={`h-5 w-9 rounded-full transition-colors ${smartMode ? 'bg-brand-orange' : 'bg-white/20'}`}>
              <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${smartMode ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
        )}

        {/* Items with per-item assignment — hidden in smart mode */}
        {selectedMenuId && !smartMode && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white/80">{t('prep.fromMenu.items')}</span>
              {itemsWithRecipe.length > 0 && (
                <button type="button" onClick={toggleAll} className="text-xs text-white/50 hover:text-white transition">
                  {selected.size === itemsWithRecipe.length ? t('prep.fromMenu.deselectAll') : t('prep.fromMenu.selectAll')}
                </button>
              )}
            </div>

            {menuLoading ? (
              <p className="text-sm text-white/40">{t('common.loading')}</p>
            ) : itemsWithRecipe.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center">
                <UtensilsCrossed className="h-6 w-6 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">{t('prep.fromMenu.noRecipeItems')}</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {itemsWithRecipe.map((item) => {
                  const recipe = item.recipe_id ? recipesById.get(item.recipe_id) : undefined
                  const isSelected = selected.has(item.id)
                  const assign = assignments[item.id] ?? { workstation_id: null, assignee_id: null }
                  return (
                    <li key={item.id} className={`rounded-xl border transition ${
                      isSelected ? 'border-brand-orange/40 bg-brand-orange/5' : 'border-white/10 bg-white/5 opacity-50'
                    }`}>
                      {/* Item header row */}
                      <button type="button" onClick={() => toggle(item.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          isSelected ? 'bg-brand-orange border-brand-orange' : 'border-white/30'
                        }`}>
                          {isSelected && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{item.name}</p>
                          {recipe && (
                            <p className="text-xs text-white/40 truncate flex items-center gap-1.5">
                              {recipe.title}
                              {(() => {
                                const steps = parseSteps(recipe.instructions)
                                return steps.length > 0
                                  ? <span className="text-brand-orange/70 font-medium">· {steps.length} {t('prep.fromMenu.steps')}</span>
                                  : <span className="text-white/25">· {t('prep.fromMenu.noSteps')}</span>
                              })()}
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Assignment row — shown only when selected */}
                      {isSelected && (
                        <div className="flex gap-2 px-3 pb-3">
                          {/* Workstation */}
                          {workstations.length > 0 && (
                            <div className="flex-1">
                              <span className="text-[10px] text-white/40 uppercase tracking-wide">{t('prep.form.workstation')}</span>
                              <div className="glass flex items-center rounded-lg px-2 mt-1 focus-within:ring-1 focus-within:ring-brand-orange">
                                <select
                                  value={assign.workstation_id ?? ''}
                                  onChange={(e) => setAssignment(item.id, { workstation_id: e.target.value || null })}
                                  className="flex-1 bg-transparent outline-none text-xs text-white py-1.5"
                                >
                                  <option value="" className="bg-[#f5ede0]">—</option>
                                  {workstations.map((w) => (
                                    <option key={w.id} value={w.id} className="bg-[#f5ede0]">{w.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                          {/* Assignee */}
                          <div className="flex-1">
                            <span className="text-[10px] text-white/40 uppercase tracking-wide">
                              {t('prep.form.assignee')}
                              {shiftsForDate.length > 0 && (
                                <span className="ml-1 text-emerald-400/60">{t('prep.fromMenu.onShift')}</span>
                              )}
                            </span>
                            <div className="glass flex items-center rounded-lg px-2 mt-1 focus-within:ring-1 focus-within:ring-brand-orange">
                              <select
                                value={assign.assignee_id ?? ''}
                                onChange={(e) => setAssignment(item.id, { assignee_id: e.target.value || null })}
                                className="flex-1 bg-transparent outline-none text-xs text-white py-1.5"
                              >
                                <option value="" className="bg-[#f5ede0]">—</option>
                                {membersOnShift.map((m) => (
                                  <option key={m.id} value={m.id} className="bg-[#f5ede0]">
                                    {m.full_name ?? m.id}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* Smart mode — recipe list preview */}
        {selectedMenuId && smartMode && itemsWithRecipe.length > 0 && (
          <div>
            <span className="mb-2 block text-sm font-medium text-white/80">{t('prep.fromMenu.items')}</span>
            <ul className="space-y-1.5">
              {itemsWithRecipe.map((item) => {
                const recipe = item.recipe_id ? recipesById.get(item.recipe_id) : undefined
                return (
                  <li key={item.id} className="flex items-center gap-2 rounded-xl border border-brand-orange/20 bg-brand-orange/5 px-3 py-2">
                    <Sparkles className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{item.name}</p>
                      {recipe && <p className="text-xs text-white/40 truncate">{recipe.title}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-white/40">{t('prep.fromMenu.smartBreakdownNote', { count: workstations.length })}</p>
          </div>
        )}

        {/* Ingredient totals */}
        {ingredientTotals.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-white/80 flex items-center gap-2">
              <Package className="h-4 w-4 text-brand-orange" />
              {t('prep.fromMenu.ingredientSummary', { covers })}
            </h4>
            <ul className="rounded-xl border border-glass-border overflow-hidden divide-y divide-glass-border">
              {ingredientTotals.map(({ item, total }) => (
                <li key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-white/80">{item.name}</span>
                  <span className="text-white/60 font-medium tabular-nums">
                    {total % 1 === 0 ? total : total.toFixed(2)} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={generating}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleGenerate} disabled={generating || selected.size === 0 || !selectedMenuId}
            leftIcon={smartMode ? <Sparkles className="h-4 w-4" /> : undefined}>
            {generating
              ? (smartMode ? t('prep.fromMenu.analyzing') : t('prep.fromMenu.generating'))
              : (smartMode ? t('prep.fromMenu.smartGenerate', { count: selected.size }) : t('prep.fromMenu.generate', { count: selected.size }))}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
