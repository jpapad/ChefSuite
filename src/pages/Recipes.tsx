import { useEffect, useMemo, useState } from 'react'
import { Plus, ChefHat, Search, X, Sparkles, ScanLine, FileSpreadsheet, CheckSquare, Square, Trash2, Layers, ShieldAlert, ListPlus, LayoutGrid } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, PillButton, ActionMenu, StatRow, StatTile, SearchField, Segmented, Chip, ChipRow, Panel, EmptyState, Notice } from '../components/ui/page'
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
import { QuickRecipeCreatorDrawer } from '../components/recipes/QuickRecipeCreatorDrawer'
import { RecipeVersionHistory } from '../components/recipes/RecipeVersionHistory'
import { useRecipes } from '../hooks/useRecipes'
import { useInventory } from '../hooks/useInventory'
import { useRecipeIngredients } from '../hooks/useRecipeIngredients'
import { useRecipeSubRecipes } from '../hooks/useRecipeSubRecipes'
import { useMenus } from '../hooks/useMenus'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { RECIPE_CATEGORIES } from '../components/recipes/RecipeForm'
import type { ImportedRecipe } from '../lib/gemini'
import type { ExcelMenuRow } from '../lib/excelMenu'
import type { Recipe, RecipeCategory, RecipeDifficulty, RecipeIngredientDraft, RecipeSubRecipeDraft, RecipeVersion } from '../types/database.types'

export default function Recipes() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? ''
  const { recipes, loading, error, create, update, remove, consumeRecipe, reload } = useRecipes()
  const { create: createMenu } = useMenus()
  const { items: inventory } = useInventory()
  const {
    getFor: getIngredients,
    save: saveIngredients,
  } = useRecipeIngredients()
  const { byRecipe: subsByRecipe, getFor: getSubs, save: saveSubs } = useRecipeSubRecipes()

  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  const [scanDrawerOpen, setScanDrawerOpen] = useState(false)
  const [excelMenuDrawerOpen, setExcelMenuDrawerOpen] = useState(false)
  const [bulkAIUpdateOpen, setBulkAIUpdateOpen] = useState(false)
  const [allergenScanOpen, setAllergenScanOpen] = useState(false)
  const [batchProcessorOpen, setBatchProcessorOpen] = useState(false)
  const [batchProcessorInitial, setBatchProcessorInitial] = useState<Set<string> | undefined>()
  const [quickCreatorOpen, setQuickCreatorOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewing = viewingId ? (recipes.find((r) => r.id === viewingId) ?? null) : null
  const [saving, setSaving] = useState(false)
  const [batchImportError, setBatchImportError] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Partial<RecipeFormValues> | undefined>()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [versionRecipe, setVersionRecipe] = useState<Recipe | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [groupedView, setGroupedView] = useState(false)
  const [filterUncategorized, setFilterUncategorized] = useState(false)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); setSearchParams({}, { replace: true }) }
  }, [searchParams, setSearchParams])
  const [activeAllergens, setActiveAllergens] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<RecipeCategory | null>(null)
  const [filterAllergenFree, setFilterAllergenFree] = useState(false)
  const [filterBases, setFilterBases] = useState(false)

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
      if (filterBases && !r.is_base) return false
      return true
    })
  }, [recipes, query, activeAllergens, activeCategory, filterUncategorized, filterAllergenFree, filterBases])

  const categoryCounts = useMemo(() => {
    const counts = new Map<RecipeCategory | '_none', number>()
    for (const r of recipes) {
      const key = r.category ?? '_none'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [recipes])

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
      const { ingredients, sub_recipes, ...fields } = values
      // Only send base fields when used, so saving works before migration 0084
      const { is_base, yield_unit, ...rest } = fields
      const usesBases = is_base || !!yield_unit || !!editing?.is_base
      const recipeFields = usesBases ? fields : rest
      let recipeId: string
      if (editing) {
        const row = await update(editing.id, recipeFields)
        recipeId = row.id
      } else {
        const row = await create(recipeFields)
        recipeId = row.id
      }
      await saveIngredients(recipeId, ingredients)
      if (sub_recipes.length > 0 || getSubs(recipeId).length > 0) {
        await saveSubs(recipeId, sub_recipes.filter((s) => s.quantity > 0))
      }
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

  // Memoized: the form resets itself whenever these identities change
  const editingIngredients = editing ? getIngredients(editing.id) : null
  const ingKey = editingIngredients?.length ? editingIngredients : null
  const initialIngredients: RecipeIngredientDraft[] = useMemo(
    () => (ingKey ?? []).map((i) => ({ inventory_item_id: i.inventory_item_id, quantity: i.quantity })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ingKey, editing?.id],
  )
  const editingSubs = editing ? subsByRecipe[editing.id] : undefined
  const initialSubRecipes: RecipeSubRecipeDraft[] = useMemo(
    () => (editingSubs ?? []).map((s) => ({ sub_recipe_id: s.sub_recipe_id, quantity: s.quantity })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingSubs, editing?.id],
  )

  // ── Overview numbers ──
  const priced = recipes.filter((r) => r.cost_per_portion != null && (r.selling_price ?? 0) > 0)
  const fcOf = (r: Recipe) => ((r.cost_per_portion ?? 0) / (r.selling_price ?? 1)) * 100
  const avgFc = priced.length ? priced.reduce((s, r) => s + fcOf(r), 0) / priced.length : null
  const overTarget = priced.filter((r) => fcOf(r) > 30).length
  const incomplete = recipes.filter((r) => !r.description || !r.category || !r.instructions)

  const hasFilters = activeAllergens.length > 0 || !!activeCategory || filterAllergenFree || filterUncategorized || filterBases || !!query.trim()
  const baseCount = recipes.filter((r) => r.is_base).length
  function clearFilters() {
    setActiveAllergens([]); setActiveCategory(null); setFilterAllergenFree(false); setFilterUncategorized(false); setFilterBases(false); setQuery('')
  }

  function renderCard(r: Recipe) {
    const selected = selectedIds.has(r.id)
    return (
      <div key={r.id} className="relative">
        {selectionMode && (
          <button
            type="button"
            onClick={() => toggleSelect(r.id)}
            className="absolute inset-0 z-10 rounded-3xl focus:outline-none"
            aria-label={selected ? t('common.deselect') : t('common.select')}
          >
            <span className={[
              'absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-full border-2 transition',
              selected ? 'border-lime bg-lime text-ink' : 'border-white-fixed/70 bg-black/40 text-transparent',
            ].join(' ')}>
              {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-white-fixed/60" />}
            </span>
          </button>
        )}
        <div className={selectionMode ? (selected ? 'ring-2 ring-lime ring-offset-2 ring-offset-bg-surface rounded-3xl' : 'opacity-60') : ''}>
          <RecipeCard
            recipe={r}
            ingredients={getIngredients(r.id)}
            inventory={inventory}
            onView={selectionMode ? () => {} : (rec) => setViewingId(rec.id)}
            onEdit={selectionMode ? () => {} : openEdit}
            onDelete={selectionMode ? () => {} : onDelete}
            onConsume={selectionMode ? async () => {} : (recipe, portions) => consumeRecipe(recipe.id, portions)}
            onHistory={selectionMode ? () => {} : setVersionRecipe}
          />
        </div>
      </div>
    )
  }

  return (
    <Page>
      <PageHeader
        title={t('recipes.title')}
        subtitle={t('recipes.subtitle')}
        actions={selectionMode ? (
          <PillButton icon={X} onClick={toggleSelectionMode}>{t('common.cancel')}</PillButton>
        ) : (
          <>
            <ActionMenu
              label={t('recipes.v2.import')}
              icon={FileSpreadsheet}
              actions={[
                { label: t('recipes.importWithAI'), hint: t('recipes.v2.importHint'), icon: Sparkles, onClick: () => setImportDrawerOpen(true) },
                { label: t('recipes.scan.button'), hint: t('recipes.v2.scanHint'), icon: ScanLine, onClick: () => setScanDrawerOpen(true) },
                { label: t('recipes.v2.excel'), hint: t('recipes.v2.excelHint'), icon: FileSpreadsheet, onClick: () => setExcelMenuDrawerOpen(true) },
                { label: t('recipes.v2.quick'), hint: t('recipes.v2.quickHint'), icon: ListPlus, onClick: () => setQuickCreatorOpen(true), hidden: recipes.length === 0 },
              ]}
            />
            <ActionMenu
              label={t('recipes.v2.aiTools')}
              icon={Sparkles}
              variant="ai"
              actions={[
                { label: t('recipes.v2.batch'), hint: t('recipes.v2.batchHint'), icon: ChefHat, onClick: () => { setBatchProcessorInitial(undefined); setBatchProcessorOpen(true) } },
                { label: t('recipes.allergenScan'), hint: t('recipes.v2.allergenHint'), icon: ShieldAlert, onClick: () => setAllergenScanOpen(true) },
                { label: t('recipes.v2.bulkAi'), hint: t('recipes.v2.bulkHint'), icon: Sparkles, onClick: () => setBulkAIUpdateOpen(true) },
              ].map((a) => ({ ...a, hidden: recipes.length === 0 }))}
            />
            {recipes.length > 0 && (
              <PillButton icon={CheckSquare} onClick={toggleSelectionMode}>{t('recipes.selectMode')}</PillButton>
            )}
            <PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('recipes.newRecipe')}</PillButton>
          </>
        )}
      />

      {error && <Notice>{error}</Notice>}

      {recipes.length > 0 && (
        <StatRow>
          <StatTile tone="ink" label={t('recipes.v2.total')} value={recipes.length} hint={t('recipes.v2.totalHint', { count: usedCategories.length })} />
          <StatTile
            label={t('recipes.v2.avgFc')}
            value={avgFc != null ? `${avgFc.toFixed(1)}%` : '—'}
            tone={avgFc != null && avgFc > 30 ? 'warn' : 'default'}
            hint={t('recipes.v2.avgFcHint', { count: priced.length })}
            to="/costing"
          />
          <StatTile label={t('recipes.v2.overTarget')} value={overTarget} tone={overTarget > 0 ? 'warn' : 'good'} hint={t('recipes.v2.overTargetHint')} to="/menu-engineering" />
          <StatTile
            tone="lime"
            label={t('recipes.v2.incomplete')}
            value={incomplete.length}
            hint={incomplete.length ? t('recipes.v2.incompleteHint') : undefined}
            onClick={incomplete.length ? () => { setBatchProcessorInitial(new Set(incomplete.map((r) => r.id))); setBatchProcessorOpen(true) } : undefined}
          />
        </StatRow>
      )}

      {recipes.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchField value={query} onChange={setQuery} placeholder={t('recipes.searchPlaceholder')} className="flex-1 max-w-md" />
            <Segmented
              value={groupedView ? 'groups' : 'grid'}
              onChange={(v) => setGroupedView(v === 'groups')}
              options={[
                { value: 'grid', label: t('recipes.v2.grid'), icon: LayoutGrid },
                { value: 'groups', label: t('recipes.v2.groups'), icon: Layers },
              ]}
            />
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="text-sm text-white/55 hover:text-white underline-offset-4 hover:underline">
                {t('recipes.clearFilters')}
              </button>
            )}
          </div>

          <ChipRow>
            <Chip active={!activeCategory && !filterUncategorized} onClick={() => { setActiveCategory(null); setFilterUncategorized(false) }} count={recipes.length}>
              {t('recipes.v2.all')}
            </Chip>
            {usedCategories.map((cat) => (
              <Chip
                key={cat}
                active={activeCategory === cat}
                count={categoryCounts.get(cat) ?? 0}
                onClick={() => { setFilterUncategorized(false); setActiveCategory((prev) => (prev === cat ? null : cat)) }}
              >
                {t(`recipes.categories.${cat}`)}
              </Chip>
            ))}
            {(categoryCounts.get('_none') ?? 0) > 0 && (
              <Chip
                active={filterUncategorized}
                count={categoryCounts.get('_none')}
                onClick={() => { setActiveCategory(null); setFilterUncategorized((v) => !v) }}
              >
                {t('categories.none')}
              </Chip>
            )}
            {baseCount > 0 && (
              <Chip active={filterBases} count={baseCount} onClick={() => setFilterBases((v) => !v)}>
                {t('recipes.sub.bases')}
              </Chip>
            )}
          </ChipRow>

          {allAllergens.some((a) => !a.startsWith('no_')) && (
            <ChipRow>
              <span className="shrink-0 pr-1 text-[13px] text-white/50">{t('recipes.v2.allergens')}</span>
              <Chip tone="good" active={filterAllergenFree} onClick={() => { setFilterAllergenFree((v) => !v); setActiveAllergens([]) }}>
                {t('recipes.allergenFree')}
              </Chip>
              {allAllergens.filter((a) => !a.startsWith('no_')).map((a) => (
                <Chip key={a} active={activeAllergens.includes(a)} onClick={() => { toggleAllergen(a); setFilterAllergenFree(false) }}>
                  {a}
                </Chip>
              ))}
            </ChipRow>
          )}
        </div>
      )}

      {loading ? (
        <Panel><p className="text-white/55">{t('recipes.loadingRecipes')}</p></Panel>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title={t('recipes.empty.title')}
          body={t('recipes.empty.description')}
          action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('recipes.empty.cta')}</PillButton>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title={t('recipes.noMatch')} action={<PillButton onClick={clearFilters}>{t('recipes.clearFilters')}</PillButton>} />
      ) : (
        <>
          <p className="text-sm text-white/55">{t('recipes.v2.showing', { count: filtered.length, total: recipes.length })}</p>
          {groupedView && groupedRecipes ? (
            <div className="flex flex-col gap-8">
              {groupedRecipes.map((group) => (
                <section key={group.category ?? '_none'} className="flex flex-col gap-3">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-xl font-medium">{group.label}</h2>
                    <span className="text-sm text-white/45 tabular-nums">{group.items.length}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {group.items.map(renderCard)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map(renderCard)}
            </div>
          )}

          {/* ── Selection action bar ── */}
          {selectionMode && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-ink px-3 py-2 text-white-fixed shadow-2xl">
              <span className="px-3 text-sm font-medium whitespace-nowrap">
                {selectedIds.size} {t('recipes.selected')}
              </span>
              <button
                type="button"
                onClick={selectedIds.size === filtered.length ? clearSelection : selectAll}
                className="rounded-full bg-white-fixed/10 px-4 py-2 text-sm font-medium hover:bg-white-fixed/20 whitespace-nowrap"
              >
                {selectedIds.size === filtered.length ? t('common.deselectAll') : t('common.selectAll', { count: filtered.length })}
              </button>
              <button
                type="button"
                onClick={() => { setBatchProcessorInitial(new Set(selectedIds)); setBatchProcessorOpen(true) }}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-sm font-medium text-ink disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                {t('recipes.v2.batch')}
              </button>
              <button
                type="button"
                onClick={() => void bulkDelete()}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white-fixed disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
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

      <QuickRecipeCreatorDrawer
        open={quickCreatorOpen}
        onClose={() => setQuickCreatorOpen(false)}
        teamId={teamId}
        inventory={inventory}
        onRecipesCreated={() => void reload()}
        onViewRecipe={(id) => { setQuickCreatorOpen(false); setViewingId(id) }}
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
        subRecipes={viewing ? getSubs(viewing.id) : []}
        getIngredients={getIngredients}
        getSubRecipes={getSubs}
        inventory={inventory}
        onClose={() => setViewingId(null)}
        onEdit={(r) => { setViewingId(null); openEdit(r) }}
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
          initialSubRecipes={initialSubRecipes}
          subsByRecipe={subsByRecipe}
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
    </Page>
  )
}
