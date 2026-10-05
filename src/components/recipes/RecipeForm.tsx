import { useEffect, useState, type FormEvent } from 'react'
import { cn } from '../../lib/cn'
import { useTranslation } from 'react-i18next'
import { Loader2, Sparkles, Plus } from 'lucide-react'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { ImageUpload } from '../ui/ImageUpload'
import { AllergenChips } from './AllergenChips'
import { IngredientsEditor } from './IngredientsEditor'
import { useRecipes } from '../../hooks/useRecipes'
import { useTeamSettings } from '../../hooks/useTeamSettings'
import { useInventory } from '../../hooks/useInventory'
import { suggestRecipeDetails, type SuggestedIngredient } from '../../lib/gemini'
import type {
  InventoryItem,
  Recipe,
  RecipeCategory,
  RecipeDifficulty,
  RecipeIngredientDraft,
  RecipeSubRecipe,
  RecipeSubRecipeDraft,
} from '../../types/database.types'
import { ancestorsOf } from '../../lib/recipeTree'
import { Layers, X } from 'lucide-react'

export const RECIPE_CATEGORIES: RecipeCategory[] = [
  'appetizer', 'soup', 'salad', 'main', 'side',
  'sauce', 'bread', 'dessert', 'beverage', 'other',
]

export const DIFFICULTIES: RecipeDifficulty[] = ['easy', 'medium', 'hard']

export interface RecipeFormValues {
  title: string
  description: string | null
  instructions: string | null
  cost_per_portion: number | null
  selling_price: number | null
  allergens: string[]
  category: RecipeCategory | null
  image_url: string | null
  ingredients: RecipeIngredientDraft[]
  prep_time: number | null
  cook_time: number | null
  servings: number | null
  difficulty: RecipeDifficulty | null
  parent_recipe_id: string | null
  variation_label: string | null
  name_el: string | null
  description_el: string | null
  name_bg: string | null
  description_bg: string | null
  is_base: boolean
  yield_unit: string | null
  sub_recipes: RecipeSubRecipeDraft[]
}

interface RecipeFormProps {
  initial?: Recipe
  initialIngredients?: RecipeIngredientDraft[]
  initialSubRecipes?: RecipeSubRecipeDraft[]
  /** All sub-recipe links of the team, to prevent circular bases */
  subsByRecipe?: Record<string, RecipeSubRecipe[]>
  prefill?: Partial<RecipeFormValues>
  inventory: InventoryItem[]
  submitting?: boolean
  onSubmit: (values: RecipeFormValues) => void | Promise<void>
  onCancel: () => void
}

function blank(
  initial?: Recipe,
  initialIngredients?: RecipeIngredientDraft[],
  prefill?: Partial<RecipeFormValues>,
  initialSubRecipes?: RecipeSubRecipeDraft[],
): RecipeFormValues {
  return {
    title: initial?.title ?? prefill?.title ?? '',
    description: initial?.description ?? prefill?.description ?? '',
    instructions: initial?.instructions ?? prefill?.instructions ?? '',
    cost_per_portion: initial?.cost_per_portion ?? prefill?.cost_per_portion ?? null,
    selling_price: initial?.selling_price ?? prefill?.selling_price ?? null,
    allergens: initial?.allergens ?? prefill?.allergens ?? [],
    category: initial?.category ?? prefill?.category ?? null,
    image_url: initial?.image_url ?? prefill?.image_url ?? null,
    ingredients: initialIngredients ?? prefill?.ingredients ?? [],
    prep_time: initial?.prep_time ?? prefill?.prep_time ?? null,
    cook_time: initial?.cook_time ?? prefill?.cook_time ?? null,
    servings: initial?.servings ?? prefill?.servings ?? null,
    difficulty: initial?.difficulty ?? prefill?.difficulty ?? null,
    parent_recipe_id: initial?.parent_recipe_id ?? prefill?.parent_recipe_id ?? null,
    variation_label: initial?.variation_label ?? prefill?.variation_label ?? null,
    name_el: initial?.name_el ?? prefill?.name_el ?? null,
    description_el: initial?.description_el ?? prefill?.description_el ?? null,
    name_bg: initial?.name_bg ?? prefill?.name_bg ?? null,
    description_bg: initial?.description_bg ?? prefill?.description_bg ?? null,
    is_base: initial?.is_base ?? prefill?.is_base ?? false,
    yield_unit: initial?.yield_unit ?? prefill?.yield_unit ?? null,
    sub_recipes: initialSubRecipes ?? prefill?.sub_recipes ?? [],
  }
}

const YIELD_UNITS = ['L', 'ml', 'kg', 'g', 'τεμ']

export function RecipeForm({
  initial,
  initialIngredients,
  initialSubRecipes,
  subsByRecipe = {},
  prefill,
  inventory,
  submitting,
  onSubmit,
  onCancel,
}: RecipeFormProps) {
  const { t } = useTranslation()
  const { recipes: allRecipes } = useRecipes()
  const { targetFoodCostPct } = useTeamSettings()
  const { create: createInventoryItem, update: updateInventoryItem } = useInventory()
  const otherRecipes = allRecipes.filter((r) => r.id !== initial?.id)
  const [values, setValues] = useState<RecipeFormValues>(() =>
    blank(initial, initialIngredients, prefill, initialSubRecipes),
  )
  const [error, setError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestDone, setSuggestDone] = useState(false)
  const [suggestMatchInfo, setSuggestMatchInfo] = useState<{ matched: number; total: number } | null>(null)
  const [pendingIngredients, setPendingIngredients] = useState<SuggestedIngredient[]>([])
  const [addingToInventory, setAddingToInventory] = useState<string | null>(null)
  const [langTab, setLangTab] = useState<'en' | 'bg'>('en')

  async function handleAddToInventory(ing: SuggestedIngredient) {
    setAddingToInventory(ing.name)
    try {
      const newItem = await createInventoryItem({
        name: ing.name,
        quantity: 0,
        unit: ing.unit,
        min_stock_level: 0,
        cost_per_unit: ing.suggested_cost_per_unit ?? null,
        location_id: null,
      })
      setValues((v) => ({
        ...v,
        ingredients: [...v.ingredients, { inventory_item_id: newItem.id, quantity: ing.quantity }],
      }))
      setPendingIngredients((prev) => prev.filter((p) => p.name !== ing.name))
    } catch {
      // silently ignore — user can add manually
    } finally {
      setAddingToInventory(null)
    }
  }

  function calcCostPerPortion(drafts: RecipeIngredientDraft[], servings: number | null): number | null {
    if (drafts.length === 0 || !servings || servings <= 0) return null
    const total = drafts.reduce((sum, d) => {
      const item = inventory.find((i) => i.id === d.inventory_item_id)
      return sum + d.quantity * (item?.cost_per_unit ?? 0)
    }, 0)
    return total > 0 ? Math.round((total / servings) * 100) / 100 : null
  }

  async function handleAISuggest() {
    const title = values.title.trim()
    if (!title) return
    setSuggesting(true)
    setSuggestDone(false)
    setSuggestMatchInfo(null)
    setError(null)
    try {
      const s = await suggestRecipeDetails(title, inventory.map((i) => ({ id: i.id, name: i.name })))
      const matchedSuggestions = s.suggested_ingredients.filter((i) => i.inventory_item_id !== null)
      const matched: RecipeIngredientDraft[] = matchedSuggestions.map((i) => ({ inventory_item_id: i.inventory_item_id!, quantity: i.quantity }))
      // silently fill cost_per_unit for matched inventory items that have none
      void Promise.all(
        matchedSuggestions
          .filter((i) => i.suggested_cost_per_unit != null)
          .filter((i) => {
            const item = inventory.find((inv) => inv.id === i.inventory_item_id)
            return item && item.cost_per_unit == null
          })
          .map((i) => updateInventoryItem(i.inventory_item_id!, { cost_per_unit: i.suggested_cost_per_unit }))
      )
      const newServings = values.servings ?? s.servings
      const cost = matched.length > 0
        ? calcCostPerPortion(matched, newServings)
        : null
      const unmatched = s.suggested_ingredients.filter((i) => i.inventory_item_id === null)
      if (s.suggested_ingredients.length > 0) {
        setSuggestMatchInfo({ matched: matched.length, total: s.suggested_ingredients.length })
        setPendingIngredients(unmatched)
      }
      setValues((v) => ({
        ...v,
        description:      !v.description?.trim()  ? (s.description  ?? v.description)  : v.description,
        instructions:     !v.instructions?.trim() ? (s.instructions ?? v.instructions) : v.instructions,
        allergens:        v.allergens.length === 0 ? s.allergens                        : v.allergens,
        category:         v.category   == null     ? (s.category as RecipeCategory | null)    : v.category,
        difficulty:       v.difficulty == null     ? (s.difficulty as RecipeDifficulty | null) : v.difficulty,
        prep_time:        v.prep_time  == null     ? s.prep_time                        : v.prep_time,
        cook_time:        v.cook_time  == null     ? s.cook_time                        : v.cook_time,
        servings:         v.servings   == null     ? s.servings                         : v.servings,
        image_url:        !v.image_url             ? (s.image_url ?? v.image_url)       : v.image_url,
        ingredients:      v.ingredients.length === 0 && matched.length > 0 ? matched   : v.ingredients,
        cost_per_portion: v.cost_per_portion == null && cost != null ? cost             : v.cost_per_portion,
      }))
      setSuggestDone(true)
      setTimeout(() => { setSuggestDone(false); setSuggestMatchInfo(null) }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI suggestion failed.')
    } finally {
      setSuggesting(false)
    }
  }

  useEffect(() => {
    setValues(blank(initial, initialIngredients, prefill, initialSubRecipes))
  }, [initial, initialIngredients, prefill, initialSubRecipes])

  // Bases that can go into this recipe: anything that doesn't already use it
  const blocked = initial ? ancestorsOf(initial.id, subsByRecipe) : new Set<string>()
  const baseCandidates = allRecipes
    .filter((r) => !blocked.has(r.id) && !values.sub_recipes.some((s) => s.sub_recipe_id === r.id))
    .sort((a, b) => Number(b.is_base) - Number(a.is_base) || a.title.localeCompare(b.title))
  const [baseToAdd, setBaseToAdd] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!values.title.trim()) {
      setError(t('recipes.form.titleRequired'))
      return
    }
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        instructions: values.instructions?.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ImageUpload
        value={values.image_url}
        onChange={(url) => setValues((v) => ({ ...v, image_url: url }))}
        bucket="recipe-images"
        label={t('recipes.form.image')}
        aspectClass="h-44"
      />

      <Input
        name="title"
        label={t('recipes.form.title')}
        placeholder={t('recipes.form.titlePlaceholder')}
        required
        value={values.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
      />

      {/* AI Autofill */}
      {values.title.trim().length >= 2 && (
        <button
          type="button"
          onClick={() => void handleAISuggest()}
          disabled={suggesting}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-orange/40 bg-brand-orange/5 px-4 py-2.5 text-sm font-medium text-brand-orange transition hover:border-brand-orange hover:bg-brand-orange/10 disabled:opacity-60 disabled:pointer-events-none"
        >
          {suggesting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              AI ανάλυση «{values.title.trim()}»…
            </>
          ) : suggestDone ? (
            <>
              <Sparkles className="h-4 w-4" />
              Συμπληρώθηκε!
              {suggestMatchInfo && (
                <span className="text-white/60 font-normal">
                  · {suggestMatchInfo.matched}/{suggestMatchInfo.total} υλικά αντιστοιχίστηκαν
                </span>
              )}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              AI Αυτόματη Συμπλήρωση
            </>
          )}
        </button>
      )}

      {/* Category */}
      <div>
        <span className="mb-2 block text-sm font-medium text-white/80">
          {t('recipes.form.category')}
        </span>
        <div className="flex flex-wrap gap-2">
          {RECIPE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setValues((v) => ({ ...v, category: v.category === cat ? null : cat }))}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                values.category === cat
                  ? 'bg-brand-orange border-brand-orange text-on-accent'
                  : 'border-white/20 text-white/60 hover:text-white hover:border-white/40'
              }`}
            >
              {t(`recipes.categories.${cat}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Times + servings + difficulty */}
      <div className="grid grid-cols-3 gap-3">
        <Input
          type="number"
          name="prep_time"
          label={t('recipes.form.prepTime')}
          placeholder="20"
          min={0}
          value={values.prep_time ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, prep_time: e.target.value === '' ? null : Number(e.target.value) }))}
        />
        <Input
          type="number"
          name="cook_time"
          label={t('recipes.form.cookTime')}
          placeholder="45"
          min={0}
          value={values.cook_time ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, cook_time: e.target.value === '' ? null : Number(e.target.value) }))}
        />
        <Input
          type="number"
          name="servings"
          label={t('recipes.form.servings')}
          placeholder="4"
          min={1}
          value={values.servings ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, servings: e.target.value === '' ? null : Number(e.target.value) }))}
        />
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-white/80">{t('recipes.form.difficulty')}</span>
        <div className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setValues((v) => ({ ...v, difficulty: v.difficulty === d ? null : d }))}
              className={`rounded-xl border px-4 py-1.5 text-xs font-medium transition ${
                values.difficulty === d
                  ? d === 'easy' ? 'bg-emerald-500 border-emerald-500 text-white'
                    : d === 'medium' ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-red-500 border-red-500 text-white'
                  : 'border-white/20 text-white/60 hover:text-white hover:border-white/40'
              }`}
            >
              {t(`recipes.form.difficulty${d.charAt(0).toUpperCase() + d.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Base (sub-recipe) settings */}
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-input p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={values.is_base}
            onChange={(e) => setValues((v) => ({ ...v, is_base: e.target.checked }))}
            className="mt-1 h-4 w-4 accent-[#0F1210]" />
          <span>
            <span className="block text-sm font-medium">{t('recipes.sub.isBase')}</span>
            <span className="block text-xs text-white/55">{t('recipes.sub.isBaseHint')}</span>
          </span>
        </label>
        {values.is_base && (
          <div className="flex flex-wrap items-center gap-2 pl-7">
            <span className="text-xs text-white/55">{t('recipes.sub.yieldUnit')}</span>
            {[null, ...YIELD_UNITS].map((u) => (
              <button key={u ?? 'portion'} type="button" onClick={() => setValues((v) => ({ ...v, yield_unit: u }))}
                className={cn('h-8 rounded-full px-3 text-xs font-medium transition',
                  values.yield_unit === u ? 'bg-ink text-white-fixed' : 'bg-bg-card text-white/65 hover:text-white')}>
                {u ?? t('recipes.sub.portion')}
              </button>
            ))}
          </div>
        )}
      </div>

      <Textarea
        name="description"
        label={t('recipes.form.description')}
        placeholder={t('recipes.form.descriptionPlaceholder')}
        rows={2}
        value={values.description ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
      />

      {/* Translations */}
      <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">🌍 Μεταφράσεις</p>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(['en', 'bg'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLangTab(lang)}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition',
                  langTab === lang ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70',
                )}
              >
                {lang === 'en' ? '🇬🇧 EN' : '🇧🇬 BG'}
              </button>
            ))}
          </div>
        </div>

        {langTab === 'en' ? (
          <div className="space-y-2">
            <Input name="name_el" label="Όνομα (Αγγλικά)"
              placeholder="English name…"
              value={values.name_el ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, name_el: e.target.value || null }))} />
            <Textarea name="description_el" label="Περιγραφή (Αγγλικά)" rows={2}
              placeholder="English description…"
              value={values.description_el ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, description_el: e.target.value || null }))} />
          </div>
        ) : (
          <div className="space-y-2">
            <Input name="name_bg" label="Όνομα (Βουλγαρικά)"
              placeholder="Βουλγαρικό όνομα…"
              value={values.name_bg ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, name_bg: e.target.value || null }))} />
            <Textarea name="description_bg" label="Περιγραφή (Βουλγαρικά)" rows={2}
              placeholder="Βουλγαρική περιγραφή…"
              value={values.description_bg ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, description_bg: e.target.value || null }))} />
          </div>
        )}
      </div>

      <Textarea
        name="instructions"
        label={t('recipes.form.instructions')}
        placeholder={t('recipes.form.instructionsPlaceholder')}
        rows={8}
        value={values.instructions ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, instructions: e.target.value }))}
      />

      <IngredientsEditor
        value={values.ingredients}
        onChange={(next) => setValues((v) => ({ ...v, ingredients: next }))}
        inventory={inventory}
      />

      {/* Sub-recipes (bases) */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-white/80">
          <Layers className="h-4 w-4" />{t('recipes.sub.title')}
        </span>
        <p className="-mt-1 text-xs text-white/50">{t('recipes.sub.hint')}</p>
        {values.sub_recipes.map((sr, idx) => {
          const base = allRecipes.find((r) => r.id === sr.sub_recipe_id)
          return (
            <div key={sr.sub_recipe_id} className="flex items-center gap-2 rounded-2xl bg-bg-input p-2 pl-4">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{base?.title ?? '—'}</span>
              <input type="number" min={0} step="0.01" value={sr.quantity}
                onChange={(e) => {
                  const q = Number(e.target.value)
                  setValues((v) => ({ ...v, sub_recipes: v.sub_recipes.map((x, i) => i === idx ? { ...x, quantity: q } : x) }))
                }}
                className="h-9 w-20 rounded-xl bg-bg-card px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-brand-orange/40" />
              <span className="w-14 shrink-0 text-xs text-white/55">{base?.yield_unit ?? t('recipes.sub.portionShort')}</span>
              <button type="button" aria-label={t('common.delete')}
                onClick={() => setValues((v) => ({ ...v, sub_recipes: v.sub_recipes.filter((_, i) => i !== idx) }))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 hover:bg-bg-card hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
        {baseCandidates.length > 0 && (
          <div className="flex gap-2">
            <select value={baseToAdd} onChange={(e) => setBaseToAdd(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-inv-border bg-bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange/40">
              <option value="">{t('recipes.sub.pick')}</option>
              {baseCandidates.map((r) => (
                <option key={r.id} value={r.id}>{r.is_base ? '◆ ' : ''}{r.title}{r.yield_unit ? ` (${r.yield_unit})` : ''}</option>
              ))}
            </select>
            <button type="button" disabled={!baseToAdd}
              onClick={() => {
                setValues((v) => ({ ...v, sub_recipes: [...v.sub_recipes, { sub_recipe_id: baseToAdd, quantity: 1 }] }))
                setBaseToAdd('')
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-white-fixed disabled:opacity-40">
              <Plus className="h-4 w-4" />{t('common.add')}
            </button>
          </div>
        )}
      </div>

      {pendingIngredients.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-300/80 uppercase tracking-wide">
            Υλικά που δεν βρέθηκαν στο Inventory ({pendingIngredients.length})
          </p>
          <ul className="space-y-1.5">
            {pendingIngredients.map((ing) => (
              <li key={ing.name} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-white/70 truncate">
                  {ing.name}
                  <span className="text-white/35 ml-1">{ing.quantity} {ing.unit}</span>
                  {ing.suggested_cost_per_unit != null && (
                    <span className="text-emerald-400/60 ml-1.5 text-xs">~{ing.suggested_cost_per_unit.toFixed(ing.suggested_cost_per_unit < 0.1 ? 4 : 2)}€/{ing.unit}</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={addingToInventory === ing.name}
                  onClick={() => void handleAddToInventory(ing)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-400/20 transition disabled:opacity-50"
                >
                  {addingToInventory === ing.name
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Plus className="h-3 w-3" />}
                  Inventory
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Input
        type="number"
        name="cost_per_portion"
        label={t('recipes.form.costOverride')}
        placeholder={t('recipes.form.costOverridePlaceholder')}
        step="0.01"
        min={0}
        hint={t('recipes.form.costOverrideHint')}
        value={values.cost_per_portion ?? ''}
        onChange={(e) =>
          setValues((v) => ({
            ...v,
            cost_per_portion: e.target.value === '' ? null : Number(e.target.value),
          }))
        }
      />

      <Input
        type="number"
        name="selling_price"
        label={t('recipes.form.sellingPrice')}
        placeholder="12.00"
        step="0.01"
        min={0}
        hint={t('recipes.form.sellingPriceHint')}
        value={values.selling_price ?? ''}
        onChange={(e) =>
          setValues((v) => ({
            ...v,
            selling_price: e.target.value === '' ? null : Number(e.target.value),
          }))
        }
      />

      {values.cost_per_portion != null && values.cost_per_portion > 0 && (
        <p className="text-xs text-brand-orange/80 -mt-2">
          Για στόχο {targetFoodCostPct}% food cost, προτεινόμενη τιμή:{' '}
          <span className="font-semibold">{(values.cost_per_portion / (targetFoodCostPct / 100)).toFixed(2)}€</span>
        </p>
      )}

      <AllergenChips
        value={values.allergens}
        onChange={(next) => setValues((v) => ({ ...v, allergens: next }))}
      />

      {/* Variation of another recipe */}
      {otherRecipes.length > 0 && (
        <div>
          <span className="mb-2 block text-sm font-medium text-white/80">{t('recipes.form.variationOf')}</span>
          <div className="flex gap-2">
            <select
              value={values.parent_recipe_id ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, parent_recipe_id: e.target.value || null }))}
              className="flex-1 rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-brand-orange"
            >
              <option value="">{t('recipes.form.variationNone')}</option>
              {otherRecipes.map((r) => (
                <option key={r.id} value={r.id} className="bg-chef-dark">{r.title}</option>
              ))}
            </select>
            {values.parent_recipe_id && (
              <Input
                name="variation_label"
                placeholder={t('recipes.form.variationLabelPlaceholder')}
                value={values.variation_label ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, variation_label: e.target.value || null }))}
                className="w-36"
              />
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t('common.saving') : initial ? t('common.save') : t('recipes.form.create')}
        </Button>
      </div>
    </form>
  )
}
