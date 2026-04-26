import { useEffect, useMemo, useState } from 'react'
import { Plus, ChefHat, Search, X, Sparkles } from 'lucide-react'
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
import { RecipeVersionHistory } from '../components/recipes/RecipeVersionHistory'
import { useRecipes } from '../hooks/useRecipes'
import { useInventory } from '../hooks/useInventory'
import { useRecipeIngredients } from '../hooks/useRecipeIngredients'
import { RECIPE_CATEGORIES } from '../components/recipes/RecipeForm'
import type { ImportedRecipe } from '../lib/gemini'
import type { Recipe, RecipeCategory, RecipeIngredientDraft, RecipeVersion } from '../types/database.types'

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
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [viewing, setViewing] = useState<Recipe | null>(null)
  const [saving, setSaving] = useState(false)
  const [prefill, setPrefill] = useState<Partial<RecipeFormValues> | undefined>()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [versionRecipe, setVersionRecipe] = useState<Recipe | null>(null)

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
    setPrefill(prefillData)
    setDrawerOpen(true)
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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            leftIcon={<Sparkles className="h-5 w-5" />}
            onClick={() => setImportDrawerOpen(true)}
          >
            {t('recipes.importWithAI')}
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
            {t('recipes.newRecipe')}
          </Button>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              ingredients={getIngredients(r.id)}
              inventory={inventory}
              onView={setViewing}
              onEdit={openEdit}
              onDelete={onDelete}
              onConsume={(recipe, portions) => consumeRecipe(recipe.id, portions)}
              onHistory={setVersionRecipe}
            />
          ))}
        </div>
      )}

      <ImportRecipeDrawer
        open={importDrawerOpen}
        onClose={() => setImportDrawerOpen(false)}
        onImported={onImported}
      />

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
