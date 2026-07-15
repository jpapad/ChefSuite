import { useState } from 'react'
import { Check, Loader2, Sparkles, Tag, AlertCircle, Languages, ChevronLeft, ChevronDown, ChevronUp, ImageIcon, FolderOpen, ExternalLink } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import {
  suggestRecipeDetails,
  detectAllergensForRecipes,
  estimateNutrition,
  translateMenuItems,
} from '../../lib/gemini'
import { BuffetLabelsDrawer } from '../menus/BuffetLabelsDrawer'
import { supabase } from '../../lib/supabase'
import type { InventoryItem, MenuWithSections, MenuItem, Recipe } from '../../types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  teamId: string
  inventory: InventoryItem[]
  onRecipesCreated: () => void
  onViewRecipe?: (recipeId: string) => void
}

interface FillOptions {
  allergens:   boolean
  ingredients: boolean
  image:       boolean
  translation: boolean
  nutrition:   boolean
}

type RecipeStatus = 'pending' | 'running' | 'done' | 'error'

interface RecipeEntry {
  name:             string
  status:           RecipeStatus
  loaded?:          boolean   // true = found in DB, skipped AI
  recipeId?:        string
  description?:     string | null
  allergens?:       string[]
  image_url?:       string | null
  ingredientStats?: { matched: number; total: number }
  errorMsg?:        string
  name_el?:         string | null
  description_el?:  string | null
  name_bg?:         string | null
  description_bg?:  string | null
}

const ALLERGEN_EMOJI: Record<string, string> = {
  gluten: '🌾', dairy: '🥛', eggs: '🥚', fish: '🐟', shellfish: '🦐',
  nuts: '🥜', peanuts: '🥜', soy: '🫘', sesame: '🌿', celery: '🌿',
  mustard: '🌻', sulphites: '🍷', lupin: '🌱', molluscs: '🦑',
}

const ALLERGEN_LABEL: Record<string, string> = {
  gluten: 'Γλουτένη', dairy: 'Γαλακτ.', eggs: 'Αυγά', fish: 'Ψάρι',
  shellfish: 'Οστρακ.', nuts: 'Ξηροί', peanuts: 'Φιστ.', soy: 'Σόγια',
  sesame: 'Σουσάμι', celery: 'Σέλινο', mustard: 'Μουστ.', sulphites: 'Θειώδη',
  lupin: 'Λούπινο', molluscs: 'Μαλάκια',
}

const ALL_ALLERGENS = [
  'gluten', 'dairy', 'eggs', 'nuts', 'peanuts', 'fish',
  'shellfish', 'molluscs', 'soy', 'sesame', 'celery', 'mustard', 'sulphites', 'lupin',
]

function buildVirtualMenu(
  teamId: string,
  entries: RecipeEntry[],
  selectedIds: Set<string>,
  recipes: Recipe[],
): MenuWithSections {
  const now       = new Date().toISOString()
  const menuId    = 'quick-list'
  const sectionId = 'quick-section'
  const recipeMap = new Map(recipes.map((r) => [r.id, r]))

  return {
    id: menuId, team_id: teamId, name: 'Γρήγορη Λίστα', type: 'buffet',
    description: null, price_per_person: null, active: true, show_prices: false,
    valid_from: null, valid_to: null, print_template: 'classic',
    logo_url: null, custom_footer: null, created_at: now, updated_at: now,
    sections: [{
      id: sectionId, menu_id: menuId, name: 'Συνταγές', sort_order: 0, created_at: now,
      items: entries
        .filter((e) => e.status === 'done' && e.recipeId && selectedIds.has(e.recipeId))
        .map((e, i): MenuItem => {
          const r = e.recipeId ? recipeMap.get(e.recipeId) : undefined
          return {
            id: e.recipeId!, section_id: sectionId, recipe_id: e.recipeId!,
            name: e.name, description: e.description ?? r?.description ?? null,
            name_el: e.name_el ?? null, description_el: e.description_el ?? null,
            name_bg: e.name_bg ?? null, description_bg: e.description_bg ?? null,
            name_ro: null, name_sl: null, name_uk: null, name_tr: null,
            name_sr: null, name_sk: null, name_pl: null, name_cs: null, name_md: null,
            descriptions_extra: null, price: null, available: true, portions: 1,
            tags: [], sort_order: i, created_at: now,
          }
        }),
    }],
  }
}

type Phase = 'input' | 'processing' | 'preview' | 'labels'

export function QuickRecipeCreatorDrawer({
  open, onClose, teamId, inventory, onRecipesCreated, onViewRecipe,
}: Props) {
  const [phase, setPhase]           = useState<Phase>('input')
  const [namesText, setNamesText]   = useState('')
  const [fillOptions, setFillOptions] = useState<FillOptions>({
    allergens: true, ingredients: true, image: true, translation: true, nutrition: false,
  })

  const [running, setRunning]         = useState(false)
  const [translating, setTranslating] = useState(false)
  const [entries, setEntries]         = useState<RecipeEntry[]>([])
  const [currentIdx, setCurrentIdx]   = useState(-1)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [selectedForLabels, setSelectedForLabels] = useState<Set<string>>(new Set())
  const [labelsRecipes, setLabelsRecipes]         = useState<Recipe[]>([])
  const [loadingLabels, setLoadingLabels]         = useState(false)

  const parsedNames = namesText
    .split('\n').map((n) => n.trim()).filter(Boolean)
    .filter((n, i, arr) => arr.indexOf(n) === i)

  async function handleCreate() {
    if (parsedNames.length === 0) return
    setRunning(true)
    setPhase('processing')

    // local copy — update it directly and sync to React state each time
    const local: RecipeEntry[] = parsedNames.map((name) => ({ name, status: 'pending' as RecipeStatus }))
    setEntries([...local])

    // ── Step 0: lookup existing recipes by title (case-insensitive, client-side) ──
    const { data: allTeamRecipes } = await supabase
      .from('recipes')
      .select('id, title, description, allergens, image_url, name_el, description_el, name_bg, description_bg')
      .eq('team_id', teamId)
    const existingMap = new Map<string, Recipe>()
    for (const r of (allTeamRecipes ?? [])) {
      existingMap.set((r as Recipe).title.toLowerCase(), r as Recipe)
    }

    const inventoryForAI = inventory.map((i) => ({ id: i.id, name: i.name }))

    // ── Phase 1: create each recipe sequentially ─────────────────────────────
    for (let i = 0; i < parsedNames.length; i++) {
      const name = parsedNames[i]!
      setCurrentIdx(i)
      local[i] = { ...local[i]!, status: 'running' }
      setEntries([...local])

      // check if recipe already exists
      const existing = existingMap.get(name.toLowerCase())
      if (existing) {
        local[i] = {
          ...local[i]!,
          status: 'done', loaded: true,
          recipeId: existing.id,
          description: existing.description,
          allergens: (existing.allergens as string[] | null) ?? [],
          image_url: existing.image_url ?? null,
          name_el: existing.name_el ?? null,
          description_el: existing.description_el ?? null,
          name_bg: existing.name_bg ?? null,
          description_bg: existing.description_bg ?? null,
        }
        setEntries([...local])
        continue
      }

      try {
        const s = await suggestRecipeDetails(name, fillOptions.ingredients ? inventoryForAI : [])

        let finalAllergens = s.allergens
        if (fillOptions.allergens) {
          const ingredientCtx = s.suggested_ingredients.length > 0
            ? 'Υλικά: ' + s.suggested_ingredients.map((ing) => ing.name).join(', ')
            : ''
          const [detected] = await detectAllergensForRecipes([{
            title: name,
            description: [s.description, ingredientCtx].filter(Boolean).join('\n'),
            instructions: s.instructions,
          }])
          finalAllergens = [...new Set([...s.allergens, ...(detected ?? [])])]
        }

        const { data: recipe, error: createErr } = await supabase
          .from('recipes')
          .insert({
            team_id: teamId, title: name,
            description: s.description, instructions: s.instructions,
            allergens: finalAllergens, category: s.category, difficulty: s.difficulty,
            prep_time: s.prep_time, cook_time: s.cook_time, servings: s.servings,
            image_url: fillOptions.image ? s.image_url : null,
          })
          .select('*').single()
        if (createErr || !recipe) throw createErr ?? new Error('Create failed')
        const recipeId = (recipe as Recipe).id

        let matched = 0
        const total = s.suggested_ingredients.length
        if (fillOptions.ingredients && total > 0) {
          const matchedIngs = s.suggested_ingredients.filter((ing) => ing.inventory_item_id)
          matched = matchedIngs.length
          if (matchedIngs.length > 0) {
            await supabase.from('recipe_ingredients').insert(
              matchedIngs.map((ing) => ({
                recipe_id: recipeId, inventory_item_id: ing.inventory_item_id!,
                quantity: ing.quantity, unit: ing.unit, notes: null,
              }))
            )
            void Promise.all(
              matchedIngs
                .filter((ing) => ing.suggested_cost_per_unit != null)
                .filter((ing) => {
                  const item = inventory.find((inv) => inv.id === ing.inventory_item_id)
                  return item && item.cost_per_unit == null
                })
                .map((ing) => supabase.from('inventory')
                  .update({ cost_per_unit: ing.suggested_cost_per_unit }).eq('id', ing.inventory_item_id!))
            )
          }
        }

        if (fillOptions.nutrition) {
          try {
            const ings = s.suggested_ingredients
              .filter((ing) => ing.inventory_item_id)
              .map((ing) => {
                const item = inventory.find((inv) => inv.id === ing.inventory_item_id)
                return { name: item?.name ?? ing.name, quantity: ing.quantity, unit: ing.unit }
              })
            const nutrition = await estimateNutrition(name, ings, s.servings ?? 4)
            await supabase.from('recipes').update(nutrition).eq('id', recipeId)
          } catch { /* non-fatal */ }
        }

        local[i] = {
          ...local[i]!,
          status: 'done', recipeId,
          description: s.description,
          allergens: finalAllergens,
          image_url: fillOptions.image ? s.image_url : null,
          ingredientStats: total > 0 ? { matched, total } : undefined,
        }
        setEntries([...local])
      } catch (err) {
        local[i] = { ...local[i]!, status: 'error', errorMsg: err instanceof Error ? err.message : 'Αποτυχία' }
        setEntries([...local])
      }
    }

    setRunning(false)
    setCurrentIdx(-1)

    // ── Phase 2: batch translation ─────────────────────────────────────────────
    const toTranslate = local.filter((e) => e.status === 'done' && e.recipeId && !e.loaded)

    if (fillOptions.translation && toTranslate.length > 0) {
      setTranslating(true)
      try {
        const translations = await translateMenuItems(
          toTranslate.map((e) => ({ name: e.name, description: e.description ?? null }))
        )
        await Promise.all(
          toTranslate.map(async (e, ti) => {
            const t = translations[ti]
            if (!t || !e.recipeId) return
            await supabase.from('recipes').update({
              name_el: t.name_el, description_el: t.description_el,
              name_bg: t.name_bg, description_bg: t.description_bg,
            }).eq('id', e.recipeId)
            const idx = local.findIndex((fe) => fe.recipeId === e.recipeId)
            if (idx >= 0) {
              local[idx] = { ...local[idx]!, name_el: t.name_el, description_el: t.description_el, name_bg: t.name_bg, description_bg: t.description_bg }
            }
          })
        )
        setEntries([...local])
      } catch { /* non-fatal */ }
      setTranslating(false)
    }

    onRecipesCreated()

    // Move to preview
    const doneIds = new Set(local.filter((e) => e.status === 'done' && e.recipeId).map((e) => e.recipeId!))
    setEntries([...local])
    setSelectedForLabels(doneIds)
    setPhase('preview')
  }

  async function handleGoToLabels() {
    const ids = entries
      .filter((e) => e.status === 'done' && e.recipeId && selectedForLabels.has(e.recipeId))
      .map((e) => e.recipeId!)
    if (ids.length === 0) return

    setLoadingLabels(true)
    const { data } = await supabase.from('recipes').select('*').in('id', ids)
    setLabelsRecipes((data ?? []) as Recipe[])
    setLoadingLabels(false)
    setPhase('labels')
  }

  function toggleLabelSelect(id: string) {
    setSelectedForLabels((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllergen(recipeId: string, allergen: string) {
    const entry = entries.find((e) => e.recipeId === recipeId)
    if (!entry) return
    const current = entry.allergens ?? []
    const next = current.includes(allergen)
      ? current.filter((a) => a !== allergen)
      : [...current, allergen]
    setEntries((prev) => prev.map((e) => e.recipeId === recipeId ? { ...e, allergens: next } : e))
    void supabase.from('recipes').update({ allergens: next }).eq('id', recipeId)
  }

  function handleClose() {
    if (running || translating) return
    setNamesText('')
    setEntries([])
    setCurrentIdx(-1)
    setPhase('input')
    onClose()
  }

  const doneEntries  = entries.filter((e) => e.status === 'done')
  const errorCount   = entries.filter((e) => e.status === 'error').length
  const totalCount   = entries.length
  const selectedCount = selectedForLabels.size

  // ── Labels phase: render BuffetLabelsDrawer on top ────────────────────────
  if (phase === 'labels') {
    const virtualMenu = buildVirtualMenu(teamId, entries, selectedForLabels, labelsRecipes)
    return (
      <BuffetLabelsDrawer
        open
        onClose={() => setPhase('preview')}
        menu={virtualMenu}
        recipes={labelsRecipes}
      />
    )
  }

  return (
    <Drawer open={open} onClose={handleClose} title="✨ Γρήγορη Δημιουργία Συνταγών">
      <div className="space-y-5">

        {/* ── INPUT ──────────────────────────────────────────────────────── */}
        {phase === 'input' && (
          <>
            <div className="space-y-2">
              <p className="text-sm text-white/60">Γράψε ή κάνε paste τα ονόματα — ένα ανά γραμμή:</p>
              <textarea
                value={namesText}
                onChange={(e) => setNamesText(e.target.value)}
                placeholder={'Μουσακάς\nΤζατζίκι\nΚοτόσουπα\nΣπαγγέτι Μπολονέζ\n...'}
                rows={8}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 resize-none leading-relaxed"
              />
              {parsedNames.length > 0 && (
                <p className="text-xs text-emerald-400/70">
                  {parsedNames.length} {parsedNames.length === 1 ? 'συνταγή' : 'συνταγές'} έτοιμες
                </p>
              )}
            </div>

            <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 space-y-3">
              <p className="text-xs font-semibold text-brand-orange/70 uppercase tracking-wider">Τι να φέρει το AI</p>
              <div className="space-y-2">
                {([
                  { key: 'allergens'   as const, label: '⚠️ Αλλεργιογόνα',     sub: '2 ανεξάρτητα AI περάσματα — μέγιστη ακρίβεια' },
                  { key: 'ingredients' as const, label: '🥕 Υλικά + Τιμές',    sub: 'Αντιστοίχιση & κόστος από αποθήκη' },
                  { key: 'image'       as const, label: '🖼️ Εικόνα',            sub: 'Φωτογραφία από Unsplash' },
                  { key: 'translation' as const, label: '🌐 Αγγλική Μετάφραση', sub: 'Επαγγελματική μετάφραση ονόματος & περιγραφής' },
                  { key: 'nutrition'   as const, label: '🔢 Θρεπτικά',          sub: 'Θερμίδες, πρωτεΐνες, υδατάνθρακες' },
                ] as { key: keyof FillOptions; label: string; sub: string }[]).map(({ key, label, sub }) => (
                  <button key={key} type="button"
                    onClick={() => setFillOptions((p) => ({ ...p, [key]: !p[key] }))}
                    className={cn(
                      'flex items-center gap-3 w-full rounded-lg border px-3 py-2 text-xs font-medium transition text-left',
                      fillOptions[key]
                        ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-orange'
                        : 'border-white/10 text-white/40 hover:text-white/60',
                    )}
                  >
                    <div className={cn('h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center',
                      fillOptions[key] ? 'border-brand-orange bg-brand-orange' : 'border-white/30')}>
                      {fillOptions[key] && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <div>
                      <div>{label}</div>
                      <div className={cn('text-[10px] font-normal', fillOptions[key] ? 'text-brand-orange/60' : 'text-white/25')}>{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/30">📖 Περιγραφή, οδηγίες, κατηγορία & χρόνοι περιλαμβάνονται πάντα</p>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">Άκυρο</Button>
              <Button type="button" className="flex-1" disabled={parsedNames.length === 0}
                onClick={() => void handleCreate()}>
                <Sparkles className="h-4 w-4 mr-2" />
                Δημιουργία ({parsedNames.length})
              </Button>
            </div>
          </>
        )}

        {/* ── PROCESSING ─────────────────────────────────────────────────── */}
        {phase === 'processing' && (
          <>
            <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-orange">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  {translating
                    ? 'Μετάφραση στα Αγγλικά…'
                    : `Δημιουργία ${doneEntries.length + errorCount + (running ? 1 : 0)} / ${totalCount}`
                  }
                </div>
                <span className="text-xs text-brand-orange/60">
                  {Math.round(((doneEntries.length + errorCount) / Math.max(totalCount, 1)) * 100)}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-orange to-amber-400 transition-all duration-500"
                  style={{ width: `${((doneEntries.length + errorCount) / Math.max(totalCount, 1)) * 100}%` }} />
              </div>
              {running && currentIdx >= 0 && entries[currentIdx] && (
                <p className="text-xs text-white/60 truncate">
                  <Sparkles className="inline h-3.5 w-3.5 mr-1 text-brand-orange/70" />
                  {entries[currentIdx]!.name}
                </p>
              )}
              {translating && (
                <p className="text-xs text-white/60">
                  <Languages className="inline h-3.5 w-3.5 mr-1 text-brand-orange/70" />
                  Μεταφράζω {doneEntries.length} συνταγές στα Αγγλικά…
                </p>
              )}
            </div>

            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {entries.map((entry, i) => (
                <li key={entry.name + i} className={cn(
                  'rounded-xl border px-3 py-2.5 transition-all',
                  entry.status === 'done'   ? 'border-emerald-500/20 bg-emerald-500/5'
                  : entry.status === 'error' ? 'border-red-500/20 bg-red-500/5'
                  : i === currentIdx         ? 'border-brand-orange/40 bg-brand-orange/8'
                  : 'border-white/8 bg-white/3 opacity-40',
                )}>
                  <div className="flex items-center gap-2">
                    {entry.status === 'done' && entry.loaded  ? <FolderOpen className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                    : entry.status === 'done'                 ? <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : entry.status === 'error'                ? <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    : i === currentIdx                        ? <Loader2 className="h-3.5 w-3.5 text-brand-orange animate-spin shrink-0" />
                    : <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" />}
                    <span className="flex-1 text-sm text-white truncate">{entry.name}</span>
                    <div className="flex gap-1.5 shrink-0 text-[10px]">
                      {entry.status === 'done' && entry.name_el && <span className="text-sky-400/60">🌐</span>}
                      {entry.status === 'done' && entry.allergens && entry.allergens.length > 0 && <span className="text-amber-400/60">⚠️</span>}
                      {entry.status === 'done' && entry.image_url && <span className="text-purple-400/60">🖼️</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ── PREVIEW ────────────────────────────────────────────────────── */}
        {phase === 'preview' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {doneEntries.filter((e) => !e.loaded).length > 0 && (
                    <span className="text-emerald-400">{doneEntries.filter((e) => !e.loaded).length} νέες</span>
                  )}
                  {doneEntries.filter((e) => !e.loaded).length > 0 && doneEntries.filter((e) => e.loaded).length > 0 && (
                    <span className="text-white/30"> · </span>
                  )}
                  {doneEntries.filter((e) => e.loaded).length > 0 && (
                    <span className="text-sky-400">{doneEntries.filter((e) => e.loaded).length} υπάρχουσες</span>
                  )}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  Επέλεξε ποιες θες στα ταμπελάκια και πάτα Εκτύπωση
                </p>
              </div>
              <button type="button" onClick={() => setPhase('processing')}
                className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 transition">
                <ChevronLeft className="h-3.5 w-3.5" />Log
              </button>
            </div>

            <ul className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {doneEntries.map((entry) => {
                if (!entry.recipeId) return null
                const recipeId = entry.recipeId
                const selected  = selectedForLabels.has(recipeId)
                const expanded  = expandedId === recipeId
                const allergens = entry.allergens ?? []

                if (expanded) {
                  return (
                    <li key={recipeId}>
                      <div className={cn(
                        'rounded-2xl border overflow-hidden transition-all',
                        selected ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/15 bg-white/3',
                      )}>
                        {/* Top bar */}
                        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                          <button type="button" onClick={() => setExpandedId(null)}
                            className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition">
                            <ChevronUp className="h-3.5 w-3.5" />Σύμπτυξη
                          </button>
                          <button type="button" onClick={() => toggleLabelSelect(recipeId)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium border transition',
                              selected
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                : 'border-white/15 text-white/40 hover:text-white/60',
                            )}>
                            <div className={cn('h-3 w-3 rounded-full border-2 flex items-center justify-center',
                              selected ? 'border-emerald-400 bg-emerald-400' : 'border-white/30')}>
                              {selected && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                            </div>
                            {selected ? 'Στα ταμπελάκια' : 'Προσθήκη'}
                          </button>
                        </div>

                        {/* Image */}
                        <div className="mx-3 h-32 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                          {entry.image_url
                            ? <img src={entry.image_url} alt={entry.name} className="w-full h-full object-cover" />
                            : <ImageIcon className="h-8 w-8 text-white/15" />
                          }
                        </div>

                        <div className="p-3 space-y-3">
                          {/* Title */}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-white">{entry.name}</p>
                              {entry.loaded && (
                                <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold bg-sky-400/10 text-sky-400 border border-sky-400/20">
                                  Υπάρχουσα
                                </span>
                              )}
                            </div>
                            {entry.name_el && <p className="text-xs text-sky-300/60 mt-0.5">{entry.name_el}</p>}
                          </div>

                          {/* Description */}
                          {entry.description && (
                            <p className="text-[11px] text-white/45 leading-relaxed">{entry.description}</p>
                          )}

                          {/* Allergen toggles */}
                          <div>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Αλλεργιογόνα — πάτα για αλλαγή</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ALL_ALLERGENS.map((a) => {
                                const active = allergens.includes(a)
                                return (
                                  <button key={a} type="button" onClick={() => toggleAllergen(recipeId, a)}
                                    className={cn(
                                      'rounded-lg border px-2 py-1 text-[10px] font-medium transition',
                                      active
                                        ? 'bg-amber-400/15 border-amber-400/30 text-amber-300'
                                        : 'border-white/10 text-white/25 hover:text-white/50 hover:border-white/20',
                                    )}>
                                    {ALLERGEN_EMOJI[a]} {ALLERGEN_LABEL[a] ?? a}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Open recipe */}
                          {onViewRecipe && (
                            <button type="button" onClick={() => { onViewRecipe(recipeId); setExpandedId(null) }}
                              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition">
                              <ExternalLink className="h-3 w-3" />Άνοιγμα πλήρους συνταγής
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                }

                // ── Collapsed card ──────────────────────────────────────────
                return (
                  <li key={recipeId}>
                    <div className={cn(
                      'rounded-2xl border overflow-hidden transition-all',
                      selected ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/10 bg-white/3 opacity-60',
                    )}>
                      <div className="flex gap-3">
                        {/* Image */}
                        <div className="w-20 h-20 shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                          {entry.image_url
                            ? <img src={entry.image_url} alt={entry.name} className="w-full h-full object-cover" />
                            : <ImageIcon className="h-6 w-6 text-white/20" />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 py-2.5 pr-3 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{entry.name}</p>
                                {entry.loaded && (
                                  <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold bg-sky-400/10 text-sky-400 border border-sky-400/20">
                                    Υπάρχουσα
                                  </span>
                                )}
                              </div>
                              {entry.name_el && <p className="text-xs text-sky-300/60 truncate">{entry.name_el}</p>}
                            </div>
                            {/* Selection checkbox */}
                            <button type="button" onClick={() => toggleLabelSelect(recipeId)}
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition',
                                selected ? 'border-emerald-400 bg-emerald-400' : 'border-white/30',
                              )}>
                              {selected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                            </button>
                          </div>

                          {entry.allergens && allergens.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {allergens.slice(0, 4).map((a) => (
                                <span key={a} className="inline-flex items-center gap-0.5 rounded-md bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 text-[9px] text-amber-300/80 font-medium">
                                  {ALLERGEN_EMOJI[a] ?? '⚠️'} {ALLERGEN_LABEL[a] ?? a}
                                </span>
                              ))}
                              {allergens.length > 4 && (
                                <span className="text-[9px] text-white/30 self-center">+{allergens.length - 4}</span>
                              )}
                            </div>
                          )}

                          {/* Expand button */}
                          <button type="button" onClick={() => setExpandedId(recipeId)}
                            className="flex items-center gap-1 mt-1.5 text-[10px] text-white/25 hover:text-white/50 transition">
                            <ChevronDown className="h-3 w-3" />Προεπισκόπηση & επεξεργασία
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">Κλείσιμο</Button>
              <Button type="button" className="flex-1" disabled={selectedCount === 0 || loadingLabels}
                onClick={() => void handleGoToLabels()}>
                {loadingLabels
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Tag className="h-4 w-4 mr-2" />
                }
                Ταμπελάκια ({selectedCount})
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
