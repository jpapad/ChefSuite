import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { ImageUpload } from '../ui/ImageUpload'
import { AllergenChips } from './AllergenChips'
import { IngredientsEditor } from './IngredientsEditor'
import { useRecipes } from '../../hooks/useRecipes'
import type {
  InventoryItem,
  Recipe,
  RecipeCategory,
  RecipeDifficulty,
  RecipeIngredientDraft,
} from '../../types/database.types'

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
}

interface RecipeFormProps {
  initial?: Recipe
  initialIngredients?: RecipeIngredientDraft[]
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
  }
}

export function RecipeForm({
  initial,
  initialIngredients,
  prefill,
  inventory,
  submitting,
  onSubmit,
  onCancel,
}: RecipeFormProps) {
  const { t } = useTranslation()
  const { recipes: allRecipes } = useRecipes()
  const otherRecipes = allRecipes.filter((r) => r.id !== initial?.id)
  const [values, setValues] = useState<RecipeFormValues>(() =>
    blank(initial, initialIngredients, prefill),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValues(blank(initial, initialIngredients, prefill))
  }, [initial, initialIngredients, prefill])

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
                  ? 'bg-brand-orange border-brand-orange text-white-fixed'
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

      <Textarea
        name="description"
        label={t('recipes.form.description')}
        placeholder={t('recipes.form.descriptionPlaceholder')}
        rows={2}
        value={values.description ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
      />

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
