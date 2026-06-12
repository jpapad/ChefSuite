import { useEffect, useMemo, useState } from 'react'
import { Plus, ChefHat, Search, X, Sparkles, ScanLine, FileSpreadsheet, CheckSquare, Square, Trash2, Layers, ShieldAlert, ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Input } from '../components/ui/Input'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { RecipeCard } from '../components/recipes/RecipeCard'
import { RecipeDetail } from '../components/recipes/RecipeDetail'
import {
  RecipeForm,
  type RecipeFormValues,
} from '../components/recipes/RecipeForm'
import { ImportRecipeDrawer } from '../components/recipes/ImportRecipeDrawer'
import { ScanRecipeDrawer } from '../components/recipes/ScanRecipeDrawer'
import { ImportExcelMenuDrawer } from '../components/recipes/ImportExcelMenuDrawer'
import { BulkAIUpdateDrawer } from '../components/recipes/BulkAIUpdateDrawer'
import { BatchRecipeProcessorDrawer } from '../components/recipes/BatchRecipeProcessorDrawer'
import { RecipeVersionHistory } from '../components/recipes/RecipeVersionHistory'
import { useRecipes } from '../hooks/useRecipes'
import { useInventory } from '../hooks/useInventory'
import { useRecipeIngredients } from '../hooks/useRecipeIngredients'
import { useMenus } from '../hooks/useMenus'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { RECIPE_CATEGORIES } from '../components/recipes/RecipeForm'
import type { ImportedRecipe } from '../lib/gemini'
import type { ExcelMenuRow } from '../lib/excelMenu'
import type { Recipe, RecipeCategory, RecipeDifficulty, RecipeIngredientDraft, RecipeVersion } from '../types/database.types'

const CATEGORY_META: Record<RecipeCategory, { emoji: string; label: string }> = {
  appetizer: { emoji: '🥗', label: 'Ορεκτικά' },
  soup:      { emoji: '🍜', label: 'Σούπες' },
  salad:     { emoji: '🥙', label: 'Σαλάτες' },
  main:      { emoji: '🍖', label: 'Κύρια Πιάτα' },
  side:      { emoji: '🥦', label: 'Συνοδευτικά' },
  sauce:     { emoji: '🫙', label: 'Σάλτσες' },
  bread:     { emoji: '🍞', label: 'Ψωμιά' },
  dessert:   { emoji: '🍰', label: 'Γλυκά' },
  beverage:  { emoji: '🥤', label: 'Ποτά' },
  other:     { emoji: '🍽️', label: 'Άλλα' },
}

export default function Recipes() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? ''
  const { recipes, loading, error, create, update, remove, consumeRecipe } = useRecipes()
  const { create: createMenu } = useMenus()
  const { items: inventory } = useInventory()
  const {
    getFor: getIngredients,
    save: saveIngredients,
  } = useRecipeIngredients()

  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  const [scanDrawerOpen, setScanDrawerOpen] = useState(false)
  const [excelMenuDrawerOpen, setExcelMenuDrawerOpen] = useState(false)
  const [bulkAIUpdateOpen, setBulkAIUpdateOpen] = useState(false)
  const [allergenScanOpen, setAllergenScanOpen] = useState(false)
  const [batchProcessorOpen, setBatchProcessorOpen] = useState(false)
  const [batchProcessorInitial, setBatchProcessorInitial] = useState<Set<string> | undefined>()
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [viewing, setViewing] = useState<Recipe | null>(null)
  const [saving, setSaving] = useState(false)
  const [batchImportError, setBatchImportError] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Partial<RecipeFormValues> | undefined>()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [versionRecipe, setVersionRecipe] = useState<Recipe | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [groupedView, setGroupedView] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [filterUncategorized, setFilterUncategorized] = useState(false)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); setSearchParams({}, { replace: true }) }
  }, [searchParams, setSearchParams])
  const [activeAllergens, setActiveAllergens] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<RecipeCategory | null>(null)
  const [filterAllergenFree, setFilterAllergenFree] = useState(false)

  const allAllergens = useMemo(() => {
    const set = new Set<string>()
    for (const r of recipes) r.allergens.forEach((a) => set.add(a))
    return [...set].sort()
  }, [recipes])

  const usedCategories = useMemo(() => {
    const set = new Set<RecipeCategory>()
    for (const r of recipes) if (r.category) set.add(r.category)
    return RECIPE_CATEGORIES.filter((c) => set.has(c))
  }, [recipes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipes.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false
      if (activeAllergens.length && !activeAllergens.every((a) => r.allergens.includes(a))) return false
      if (activeCategory && r.category !== activeCategory) return false
      if (filterUncategorized && r.category !== null) return false
      if (filterAllergenFree && r.allergens.filter(a => !a.startsWith('no_')).length > 0) return false
      return true
    })
  }, [recipes, query, activeAllergens, activeCategory, filterUncategorized, filterAllergenFree])

  const categoryCounts = useMemo(() => {
    const counts = new Map<RecipeCategory | '_none', number>()
    for (const r of recipes) {
      const key = r.category ?? '_none'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [recipes])

  const showCategoryBrowser = !showAll && !activeCategory && !filterUncategorized && !query.trim() && !loading && recipes.length > 0

  const groupedRecipes = useMemo(() => {
    if (!groupedView) return null
    const groups: { category: RecipeCategory | null; label: string; items: typeof filtered }[] = []
    for (const cat of RECIPE_CATEGORIES) {
      const items = filtered.filter((r) => r.category === cat)
      if (items.length > 0) groups.push({ category: cat, label: t(`recipes.categories.${cat}`), items })
    }
    const uncategorized = filtered.filter((r) => !r.category)
    if (uncategorized.length > 0) groups.push({ category: null, label: t('categories.none'), items: uncategorized })
    return groups
  }, [filtered, groupedView, t])

  function toggleAllergen(a: string) {
    setActiveAllergens((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    )
  }

  function openCreate() {
    setEditing(null)
    setPrefill(undefined)
    setDrawerOpen(true)
  }

  function openEdit(recipe: Recipe) {
    setEditing(recipe)
    setPrefill(undefined)
    setDrawerOpen(true)
  }

  function onImported(imported: ImportedRecipe) {
    const { extractedIngredients: _, ...prefillData } = imported
    setImportDrawerOpen(false)
    setEditing(null)
    setPrefill(prefillData as Partial<RecipeFormValues>)
    setDrawerOpen(true)
  }

  async function onBatchUpdate(imported: ImportedRecipe[], onProgress: (done: number, total: number) => void): Promise<{ updated: number; notFound: number }> {
    let updated = 0
    let notFound = 0
    for (let i = 0; i < imported.length; i++) {
      const item = imported[i]
      const existing = recipes.find((r) => r.title.trim().toLowerCase() === item.title.trim().toLowerCase())
      if (existing) {
        await update(existing.id, {
          ...(item.description            ? { description:    item.description }    : {}),
          ...(item.name_el                ? { name_el:        item.name_el }        : {}),
          ...(item.description_el         ? { description_el: item.description_el } : {}),
          ...(item.name_bg                ? { name_bg:        item.name_bg }        : {}),
          ...(item.description_bg         ? { description_bg: item.description_bg } : {}),
          ...(item.allergens.length > 0   ? { allergens:      item.allergens }      : {}),
        })
        updated++
      } else {
        notFound++
      }
      onProgress(i + 1, imported.length)
    }
    return { updated, notFound }
  }

  async function onBatchImport(imported: ImportedRecipe[], onProgress: (done: number, total: number) => void) {
    setSaving(true)
    setBatchImportError(null)
    try {
      for (let i = 0; i < imported.length; i++) {
        const item = imported[i]
        await create({
          title: item.title,
          description: item.description ?? null,
          instructions: item.instructions ?? null,
          allergens: item.allergens,
          cost_per_portion: item.cost_per_portion ?? null,
          selling_price: null,
          category: (item.category as RecipeCategory | null) ?? null,
          image_url: null,
          prep_time: item.prep_time ?? null,
          cook_time: item.cook_time ?? null,
          servings: item.servings ?? null,
          difficulty: (item.difficulty as RecipeDifficulty | null) ?? null,
          parent_recipe_id: null,
          variation_label: null,
          name_el: item.name_el ?? null,
          description_el: item.description_el ?? null,
          name_bg: item.name_bg ?? null,
          description_bg: item.description_bg ?? null,
        })
        onProgress(i + 1, imported.length)
      }
    } catch (err) {
      setBatchImportError(err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης συνταγών')
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function onCreateMenu(menuName: string, rows: ExcelMenuRow[]) {
    const menu = await createMenu({
      name: menuName, type: 'a_la_carte', active: true, show_prices: true,
      description: null, price_per_person: null, valid_from: null, valid_to: null,
      print_template: 'classic', logo_url: null, custom_footer: null,
    })

    // Look up just-created recipe IDs by title
    const { data: freshRecipes } = await supabase.from('recipes').select('id, title')
    const recipeMap = new Map<string, string>(
      (freshRecipes ?? []).map((r: { id: string; title: string }) => [r.title.trim().toLowerCase(), r.id])
    )

    // Group rows by category → sections
    const sectionMap = new Map<string, ExcelMenuRow[]>()
    for (const row of rows) {
      const sec = row.category?.trim() || 'Μενού'
      if (!sectionMap.has(sec)) sectionMap.set(sec, [])
      sectionMap.get(sec)!.push(row)
    }

    let si = 0
    for (const [sectionName, sectionRows] of sectionMap) {
      const { data: sec } = await supabase
        .from('menu_sections')
        .insert({ menu_id: menu.id, name: sectionName, sort_order: si++ })
        .select()
        .single()
      if (!sec) continue
      const items = sectionRows.map((row, i) => ({
        section_id: sec.id,
        name: row.name,
        description: row.description ?? null,
        name_el: row.name_el ?? null,
        description_el: row.description_el ?? null,
        name_bg: row.name_bg ?? null,
        description_bg: row.description_bg ?? null,
        price: row.price ?? null,
        available: true,
        tags: [] as string[],
        sort_order: i,
        recipe_id: recipeMap.get(row.name.trim().toLowerCase()) ?? null,
      }))
      if (items.length > 0) {
        await supabase.from('menu_items').insert(items)
      }
    }
  }

  async function onSubmit(values: RecipeFormValues) {
    setSaving(true)
    try {
      const { ingredients, ...recipeFields } = values
      let recipeId: string
      if (editing) {
        const row = await update(editing.id, recipeFields)
        recipeId = row.id
      } else {
        const row = await create(recipeFields)
        recipeId = row.id
      }
      await saveIngredients(recipeId, ingredients)
      setDrawerOpen(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function onRestoreVersion(version: RecipeVersion) {
    if (!window.confirm(t('recipes.versions.restoreConfirm'))) return
    setSaving(true)
    try {
      await update(version.recipe_id, {
        title: version.title,
        description: version.description,
        instructions: version.instructions,
        cost_per_portion: version.cost_per_portion,
        selling_price: version.selling_price,
        allergens: version.allergens,
        category: version.category,
      })
      setVersionRecipe(null)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(recipe: Recipe) {
    const ok = window.confirm(t('recipes.deleteConfirm', { title: recipe.title }))
    if (!ok) return
    await remove(recipe.id)
  }

  function toggleSelectionMode() {
    setSelectionMode((v) => !v)
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map((r) => r.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function bulkDelete() {
    const count = selectedIds.size
    const ok = window.confirm(`Διαγραφή ${count} συνταγ${count === 1 ? 'ής' : 'ών'}; Η ενέργεια δεν αναιρείται.`)
    if (!ok) return
    setBulkDeleting(true)
    try {
      for (const id of selectedIds) await remove(id)
      setSelectedIds(new Set())
      setSelectionMode(false)
    } finally {
      setBulkDeleting(false)
    }
  }

  const initialIngredients: RecipeIngredientDraft[] = editing
    ? getIngredients(editing.id).map((i) => ({
        inventory_item_id: i.inventory_item_id,
        quantity: i.quantity,
      }))
    : []

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('recipes.title')}</h1>
          <p className="text-white/60 mt-1">{t('recipes.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {recipes.length > 0 && !showCategoryBrowser && (
            <>
              <Button
                variant="secondary"
                leftIcon={<Layers className="h-5 w-5" />}
                onClick={() => setGroupedView((v) => !v)}
                className={groupedView ? 'border-brand-orange/60 text-brand-orange' : ''}
              >
                {groupedView ? t('recipes.grouped') : t('recipes.groupBy')}
              </Button>
              <Button
                variant="secondary"
                leftIcon={selectionMode ? <X className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
                onClick={toggleSelectionMode}
              >
                {selectionMode ? t('common.cancel') : t('recipes.selectMode')}
              </Button>
            </>
          )}
          {!selectionMode && (
            <>
              <Button
                variant="secondary"
                leftIcon={<Sparkles className="h-5 w-5" />}
                onClick={() => setImportDrawerOpen(true)}
              >
                {t('recipes.importWithAI')}
              </Button>
              <Button
                variant="secondary"
                leftIcon={<ScanLine className="h-5 w-5" />}
                onClick={() => setScanDrawerOpen(true)}
              >
                {t('recipes.scan.button')}
              </Button>
              <Button
                variant="secondary"
                leftIcon={<FileSpreadsheet className="h-5 w-5" />}
                onClick={() => setExcelMenuDrawerOpen(true)}
              >
                Import Excel Menu
              </Button>
              {recipes.length > 0 && (
                <>
                  <Button
                    variant="secondary"
                    leftIcon={<ShieldAlert className="h-5 w-5" />}
                    onClick={() => setAllergenScanOpen(true)}
                  >
                    {t('recipes.allergenScan')}
                  </Button>
                  <Button
                    variant="secondary"
                    leftIcon={<Sparkles className="h-5 w-5" />}
                    onClick={() => setBulkAIUpdateOpen(true)}
                  >
                    Bulk AI Update
                  </Button>
                  <Button
                    variant="secondary"
                    leftIcon={<ChefHat className="h-5 w-5" />}
                    onClick={() => { setBatchProcessorInitial(undefined); setBatchProcessorOpen(true) }}
                  >
                    AI Συμπλήρωση & Prep
                  </Button>
                </>
              )}
              <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
                {t('recipes.newRecipe')}
              </Button>
            </>
          )}
        </div>
      </header>

      {error && (
        <GlassCard className="border border-red-500/40 text-red-300">
          {error}
        </GlassCard>
      )}

      {recipes.length > 0 && (
        <div className="space-y-3">
          <div className="flex-1 min-w-[220px] max-w-md">
            <Input
              name="search"
              placeholder={t('recipes.searchPlaceholder')}
              leftIcon={<Search className="h-5 w-5" />}
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (e.target.value) setShowAll(true) }}
            />
          </div>

          {!showCategoryBrowser && (
            <>
              {usedCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/50">{t('recipes.filterCategory')}</span>
                  {usedCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory((prev) => prev === cat ? null : cat)}
                      className={
                        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ' +
                        (activeCategory === cat
                          ? 'bg-brand-orange border-brand-orange text-white-fixed'
                          : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5')
                      }
                    >
                      {t(`recipes.categories.${cat}`)}
                      {activeCategory === cat && <X className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setFilterAllergenFree((v) => !v); setActiveAllergens([]) }}
                  className={
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ' +
                    (filterAllergenFree
                      ? 'bg-green-500/20 border-green-500/50 text-green-300'
                      : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5')
                  }
                >
                  <span className="text-base leading-none">✓</span>
                  {t('recipes.allergenFree')}
                  {filterAllergenFree && <X className="h-3 w-3" />}
                </button>

                {allAllergens.filter(a => !a.startsWith('no_')).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { toggleAllergen(a); setFilterAllergenFree(false) }}
                    className={
                      'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ' +
                      (activeAllergens.includes(a)
                        ? 'bg-brand-orange border-brand-orange text-white-fixed'
                        : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5')
                    }
                  >
                    {a}
                    {activeAllergens.includes(a) && <X className="h-3 w-3" />}
                  </button>
                ))}
                {(activeAllergens.length > 0 || activeCategory || filterAllergenFree || filterUncategorized) && (
                  <button
                    type="button"
                    onClick={() => { setActiveAllergens([]); setActiveCategory(null); setFilterAllergenFree(false); setFilterUncategorized(false) }}
                    className="text-xs text-white/50 hover:text-white underline"
                  >
                    {t('recipes.clearFilters')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <GlassCard>
          <p className="text-white/60">{t('recipes.loadingRecipes')}</p>
        </GlassCard>
      ) : recipes.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <ChefHat className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('recipes.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('recipes.empty.description')}</p>
          <Button
            leftIcon={<Plus className="h-5 w-5" />}
            onClick={openCreate}
            className="mt-2"
          >
            {t('recipes.empty.cta')}
          </Button>
        </GlassCard>
      ) : showCategoryBrowser ? (
        /* ── Category Browser ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {/* All Recipes tile */}
          <button
            type="button"
            onClick={() => { setShowAll(true); setFilterUncategorized(false); setActiveCategory(null) }}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 py-6 px-3 text-center"
          >
            <span className="text-3xl leading-none">🍽️</span>
            <p className="font-semibold text-sm text-white leading-tight">{t('categories.allRecipes')}</p>
            <p className="text-white/40 text-xs">{recipes.length}</p>
          </button>

          {/* Per-category tiles */}
          {RECIPE_CATEGORIES.filter((cat) => (categoryCounts.get(cat) ?? 0) > 0).map((cat) => {
            const meta = CATEGORY_META[cat]
            const count = categoryCounts.get(cat) ?? 0
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { setActiveCategory(cat); setShowAll(false); setFilterUncategorized(false) }}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-brand-orange/10 hover:border-brand-orange/30 transition-all active:scale-95 py-6 px-3 text-center"
              >
                <span className="text-3xl leading-none">{meta.emoji}</span>
                <p className="font-semibold text-sm text-white leading-tight">{t(`categories.${cat}`)}</p>
                <p className="text-white/40 text-xs">{count}</p>
              </button>
            )
          })}

          {/* Uncategorized tile */}
          {(categoryCounts.get('_none') ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => { setActiveCategory(null); setFilterUncategorized(true); setShowAll(false) }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 py-6 px-3 text-center"
            >
              <span className="text-3xl leading-none">📋</span>
              <p className="font-semibold text-sm text-white leading-tight">{t('categories.none')}</p>
              <p className="text-white/40 text-xs">{categoryCounts.get('_none')}</p>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Back to browser breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setActiveCategory(null); setShowAll(false); setFilterUncategorized(false); setQuery(''); setActiveAllergens([]); setFilterAllergenFree(false); setGroupedView(false) }}
              className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('categories.browserTitle')}
            </button>
            {activeCategory && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-sm font-medium text-white">
                  {CATEGORY_META[activeCategory]?.emoji} {t(`categories.${activeCategory}`)}
                </span>
              </>
            )}
            {filterUncategorized && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-sm font-medium text-white">{'📋 ' + t('categories.none')}</span>
              </>
            )}
            {showAll && !activeCategory && !filterUncategorized && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-sm font-medium text-white">{t('categories.allRecipes')}</span>
              </>
            )}
            {query.trim() && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-sm font-medium text-white">"{query.trim()}"</span>
              </>
            )}
          </div>

          {filtered.length === 0 && (
            <GlassCard>
              <p className="text-white/60">{t('recipes.noMatch')}</p>
            </GlassCard>
          )}

          {groupedView && groupedRecipes ? (
            <div className="space-y-8">
              {groupedRecipes.map((group) => (
                <div key={group.category ?? '_none'}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest whitespace-nowrap">
                      {group.label}
                    </h2>
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs text-white/30">{group.items.length}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((r) => (
                      <div key={r.id} className="relative">
                        {selectionMode && (
                          <button type="button" onClick={() => toggleSelect(r.id)} className="absolute inset-0 z-10 rounded-2xl focus:outline-none" aria-label={selectedIds.has(r.id) ? t('common.deselect') : t('common.select')}>
                            <span className={['absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition', selectedIds.has(r.id) ? 'border-red-400 bg-red-400 text-white' : 'border-white/40 bg-black/40 text-transparent'].join(' ')}>
                              {selectedIds.has(r.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-white/50" />}
                            </span>
                          </button>
                        )}
                        <div className={selectionMode ? (selectedIds.has(r.id) ? 'ring-2 ring-red-400 rounded-2xl' : 'opacity-60') : ''}>
                          <RecipeCard recipe={r} ingredients={getIngredients(r.id)} inventory={inventory} onView={selectionMode ? () => {} : setViewing} onEdit={selectionMode ? () => {} : openEdit} onDelete={selectionMode ? () => {} : onDelete} onConsume={selectionMode ? async () => {} : (recipe, portions) => consumeRecipe(recipe.id, portions)} onHistory={selectionMode ? () => {} : setVersionRecipe} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r) => (
                <div key={r.id} className="relative">
                  {selectionMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(r.id)}
                      className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
                      aria-label={selectedIds.has(r.id) ? t('common.deselect') : t('common.select')}
                    >
                      <span className={[
                        'absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition',
                        selectedIds.has(r.id)
                          ? 'border-red-400 bg-red-400 text-white'
                          : 'border-white/40 bg-black/40 text-transparent',
                      ].join(' ')}>
                        {selectedIds.has(r.id)
                          ? <CheckSquare className="h-4 w-4" />
                          : <Square className="h-4 w-4 text-white/50" />}
                      </span>
                    </button>
                  )}
                  <div className={selectionMode ? (selectedIds.has(r.id) ? 'ring-2 ring-red-400 rounded-2xl' : 'opacity-60') : ''}>
                    <RecipeCard
                      recipe={r}
                      ingredients={getIngredients(r.id)}
                      inventory={inventory}
                      onView={selectionMode ? () => {} : setViewing}
                      onEdit={selectionMode ? () => {} : openEdit}
                      onDelete={selectionMode ? () => {} : onDelete}
                      onConsume={selectionMode ? async () => {} : (recipe, portions) => consumeRecipe(recipe.id, portions)}
                      onHistory={selectionMode ? () => {} : setVersionRecipe}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Bulk-delete action bar ── */}
          {selectionMode && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-white/20 bg-[#1a1d25]/95 backdrop-blur px-3 py-2.5 shadow-2xl">
              <span className="text-sm font-semibold text-white px-2 whitespace-nowrap">
                {selectedIds.size} {t('recipes.selected')}
              </span>
              <div className="w-px h-5 bg-white/20" />
              <button
                type="button"
                onClick={selectedIds.size === filtered.length ? clearSelection : selectAll}
                className="rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition whitespace-nowrap"
              >
                {selectedIds.size === filtered.length ? t('common.deselectAll') : t('common.selectAll', { count: filtered.length })}
              </button>
              <button
                type="button"
                onClick={() => { setBatchProcessorInitial(new Set(selectedIds)); setBatchProcessorOpen(true) }}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-orange/80 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Sparkles className="h-4 w-4" />
                AI Συμπλήρωση & Prep
              </button>
              <button
                type="button"
                onClick={() => void bulkDelete()}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 className="h-4 w-4" />
                {bulkDeleting ? t('recipes.bulkDeleting') : t('recipes.bulkDelete', { count: selectedIds.size })}
              </button>
            </div>
          )}
        </>
      )}

      <ImportRecipeDrawer
        open={importDrawerOpen}
        onClose={() => setImportDrawerOpen(false)}
        onImported={onImported}
      />

      <ScanRecipeDrawer
        open={scanDrawerOpen}
        onClose={() => setScanDrawerOpen(false)}
        onImported={onImported}
      />

      <ImportExcelMenuDrawer
        open={excelMenuDrawerOpen}
        onClose={() => { setExcelMenuDrawerOpen(false); setBatchImportError(null) }}
        onBatchImport={onBatchImport}
        onBatchUpdate={onBatchUpdate}
        onCreateMenu={onCreateMenu}
        existingTitles={recipes.map((r) => r.title)}
      />

      <BulkAIUpdateDrawer
        open={bulkAIUpdateOpen}
        onClose={() => setBulkAIUpdateOpen(false)}
        recipes={recipes}
        onUpdate={update}
      />

      <BulkAIUpdateDrawer
        open={allergenScanOpen}
        onClose={() => setAllergenScanOpen(false)}
        recipes={recipes}
        onUpdate={update}
        initialFillOptions={{ nameEl: false, nameBg: false, descriptionEl: false, allergens: true }}
        initialOnlyEmpty={false}
      />

      <BatchRecipeProcessorDrawer
        open={batchProcessorOpen}
        onClose={() => setBatchProcessorOpen(false)}
        recipes={recipes}
        teamId={teamId}
        onUpdate={update}
        getIngredients={getIngredients}
        inventory={inventory}
        initialSelectedIds={batchProcessorInitial}
      />

      {batchImportError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm text-red-300 shadow-2xl backdrop-blur max-w-md">
          <span className="shrink-0">⚠️</span>
          <span className="flex-1">{batchImportError}</span>
          <button type="button" onClick={() => setBatchImportError(null)} className="shrink-0 text-red-300/60 hover:text-red-300">✕</button>
        </div>
      )}

      {versionRecipe && (
        <RecipeVersionHistory
          recipe={versionRecipe}
          open={!!versionRecipe}
          onClose={() => setVersionRecipe(null)}
          onRestore={onRestoreVersion}
        />
      )}

      <RecipeDetail
        recipe={viewing}
        ingredients={viewing ? getIngredients(viewing.id) : []}
        inventory={inventory}
        onClose={() => setViewing(null)}
        onEdit={(r) => { setViewing(null); openEdit(r) }}
        onConsume={(r, portions) => consumeRecipe(r.id, portions)}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => {
          if (!saving) {
            setDrawerOpen(false)
            setEditing(null)
          }
        }}
        title={editing ? t('recipes.editRecipe') : t('recipes.newRecipeDrawer')}
      >
        <RecipeForm
          initial={editing ?? undefined}
          initialIngredients={initialIngredients}
          prefill={prefill}
          inventory={inventory}
          submitting={saving}
          onSubmit={onSubmit}
          onCancel={() => {
            setDrawerOpen(false)
            setEditing(null)
            setPrefill(undefined)
          }}
        />
      </Drawer>
    </div>
  )
}
