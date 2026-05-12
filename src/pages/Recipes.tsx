import { useEffect, useMemo, useState } from 'react'
import { Plus, ChefHat, Search, X, Sparkles, ScanLine, FileSpreadsheet, CheckSquare, Square, Trash2 } from 'lucide-react'
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
import { RecipeVersionHistory } from '../components/recipes/RecipeVersionHistory'
import { useRecipes } from '../hooks/useRecipes'
import { useInventory } from '../hooks/useInventory'
import { useRecipeIngredients } from '../hooks/useRecipeIngredients'
import { RECIPE_CATEGORIES } from '../components/recipes/RecipeForm'
import type { ImportedRecipe } from '../lib/gemini'
import type { Recipe, RecipeCategory, RecipeDifficulty, RecipeIngredientDraft, RecipeVersion } from '../types/database.types'

export default function Recipes() {
  const { t } = useTranslation()
  const { recipes, loading, error, create, update, remove, consumeRecipe } = useRecipes()
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

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); setSearchParams({}, { replace: true }) }
  }, [searchParams, setSearchParams])
  const [activeAllergens, setActiveAllergens] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<RecipeCategory | null>(null)

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
      return true
    })
  }, [recipes, query, activeAllergens, activeCategory])

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

  async function onBatchImport(imported: ImportedRecipe[]) {
    setSaving(true)
    setBatchImportError(null)
    try {
      for (const item of imported) {
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
      }
    } catch (err) {
      setBatchImportError(err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης συνταγών')
    } finally {
      setSaving(false)
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
          {recipes.length > 0 && (
            <Button
              variant="secondary"
              leftIcon={selectionMode ? <X className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
              onClick={toggleSelectionMode}
            >
              {selectionMode ? 'Ακύρωση' : 'Επιλογή'}
            </Button>
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
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
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

          {allAllergens.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/50">{t('recipes.filterAllergens')}</span>
              {allAllergens.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAllergen(a)}
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
              {(activeAllergens.length > 0 || activeCategory) && (
                <button
                  type="button"
                  onClick={() => { setActiveAllergens([]); setActiveCategory(null) }}
                  className="text-xs text-white/50 hover:text-white underline"
                >
                  {t('recipes.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <GlassCard>
          <p className="text-white/60">{t('recipes.loadingRecipes')}</p>
        </GlassCard>
      ) : filtered.length === 0 && recipes.length > 0 ? (
        <GlassCard>
          <p className="text-white/60">{t('recipes.noMatch')}</p>
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
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <div key={r.id} className="relative">
                {selectionMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(r.id)}
                    className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
                    aria-label={selectedIds.has(r.id) ? 'Αποεπιλογή' : 'Επιλογή'}
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

          {/* ── Bulk-delete action bar ── */}
          {selectionMode && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-white/20 bg-[#1a1d25]/95 backdrop-blur px-3 py-2.5 shadow-2xl">
              <span className="text-sm font-semibold text-white px-2 whitespace-nowrap">
                {selectedIds.size} επιλεγμέν{selectedIds.size === 1 ? 'η' : 'ες'}
              </span>
              <div className="w-px h-5 bg-white/20" />
              <button
                type="button"
                onClick={selectedIds.size === filtered.length ? clearSelection : selectAll}
                className="rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition whitespace-nowrap"
              >
                {selectedIds.size === filtered.length ? 'Αποεπιλογή όλων' : `Επιλογή όλων (${filtered.length})`}
              </button>
              <button
                type="button"
                onClick={() => void bulkDelete()}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 className="h-4 w-4" />
                {bulkDeleting ? 'Διαγραφή…' : `Διαγραφή${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
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
        existingTitles={recipes.map((r) => r.title)}
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
