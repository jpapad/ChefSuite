import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Euro, PackageCheck, PackageX, UtensilsCrossed, History, ChefHat, Clock, Users } from 'lucide-react'
import { AllergenDot } from '../ui/AllergenIcon'
import type { InventoryItem, Recipe, RecipeIngredient } from '../../types/database.types'
import { useAutoTranslate } from '../../hooks/useAutoTranslate'

interface RecipeCardProps {
  recipe: Recipe
  ingredients: RecipeIngredient[]
  inventory: InventoryItem[]
  onView: (recipe: Recipe) => void
  onEdit: (recipe: Recipe) => void
  onDelete: (recipe: Recipe) => void
  onConsume: (recipe: Recipe, portions: number) => Promise<void>
  onHistory: (recipe: Recipe) => void
}

function computeCost(recipe: Recipe, ingredients: RecipeIngredient[], inventory: InventoryItem[]) {
  if (recipe.cost_per_portion != null) return { cost: recipe.cost_per_portion, partial: false }
  if (ingredients.length === 0) return { cost: null, partial: false }
  let total = 0; let partial = false
  for (const ing of ingredients) {
    const item = inventory.find((i) => i.id === ing.inventory_item_id)
    if (item?.cost_per_unit == null) { partial = true; continue }
    total += item.cost_per_unit * ing.quantity
  }
  return { cost: total, partial }
}

function computeStock(ingredients: RecipeIngredient[], inventory: InventoryItem[]) {
  if (ingredients.length === 0) return null
  const missing: string[] = []
  for (const ing of ingredients) {
    const item = inventory.find((i) => i.id === ing.inventory_item_id)
    if (!item || item.quantity < ing.quantity) missing.push(item?.name ?? '?')
  }
  return { canMake: missing.length === 0, missing }
}

function fmtMin(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60); const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

const DIFFICULTY_STYLE = {
  easy: 'bg-emerald-500/10 text-emerald-500 border-transparent',
  medium: 'bg-amber-500/12 text-amber-500 border-transparent',
  hard: 'bg-red-500/10 text-red-500 border-transparent',
}

export function RecipeCard({ recipe, ingredients, inventory, onView, onEdit, onDelete, onConsume, onHistory }: RecipeCardProps) {
  const { t } = useTranslation()
  const { cost, partial } = computeCost(recipe, ingredients, inventory)
  const stock = computeStock(ingredients, inventory)
  const [consuming, setConsuming] = useState(false)
  const translatedTitle = useAutoTranslate(recipe.title)

  const foodCostPct = cost != null && recipe.selling_price != null && recipe.selling_price > 0
    ? (cost / recipe.selling_price) * 100 : null

  const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0) || null

  async function handleMake(e: React.MouseEvent) {
    e.stopPropagation()
    const input = window.prompt(t('recipes.detail.makePrompt', { title: recipe.title }), String(recipe.servings ?? 1))
    if (input === null) return
    const p = parseFloat(input)
    if (isNaN(p) || p <= 0) { window.alert(t('recipes.detail.makeInvalid')); return }
    setConsuming(true)
    try { await onConsume(recipe, p) } finally { setConsuming(false) }
  }

  return (
    <div
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl bg-bg-card p-2 shadow-card transition-transform hover:-translate-y-0.5"
      onClick={() => onView(recipe)}
    >
      {/* Photo */}
      <div className="relative h-44 overflow-hidden rounded-[18px] bg-white/[0.05]">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ChefHat className="h-12 w-12 text-white/15" />
          </div>
        )}
        {foodCostPct != null && (
          <span className={`absolute left-3 top-3 rounded-full bg-white-fixed px-2.5 py-1 text-xs font-semibold tabular-nums ${foodCostPct <= 30 ? 'text-emerald-700' : foodCostPct <= 40 ? 'text-amber-700' : 'text-red-700'}`}>
            FC {foodCostPct.toFixed(0)}%
          </span>
        )}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {[
            { icon: History, label: t('recipes.versions.title', 'History'), on: () => onHistory(recipe), cls: '' },
            { icon: Pencil, label: t('common.edit', 'Edit'), on: () => onEdit(recipe), cls: '' },
            { icon: Trash2, label: t('common.delete', 'Delete'), on: () => onDelete(recipe), cls: 'hover:text-red-600' },
          ].map(({ icon: Icon, label, on, cls }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onClick={(e) => { e.stopPropagation(); on() }}
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-white-fixed text-ink shadow transition ${cls}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 px-3 pb-2 pt-3">
        <div className="flex items-center gap-2 text-xs text-white/55">
          {recipe.is_base && (
            <span className="rounded-full bg-lime px-2 py-0.5 font-semibold text-ink">
              {t('recipes.sub.baseTag')}{recipe.yield_unit ? ` · ${recipe.yield_unit}` : ''}
            </span>
          )}
          {recipe.category && <span>{t(`recipes.categories.${recipe.category}`)}</span>}
          {totalTime && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtMin(totalTime)}</span>}
          {recipe.servings && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{recipe.servings}</span>}
          {recipe.difficulty && (
            <span className={`ml-auto rounded-full border px-2 py-0.5 font-medium ${DIFFICULTY_STYLE[recipe.difficulty]}`}>
              {t(`recipes.form.difficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`)}
            </span>
          )}
        </div>

        <h3 className="text-base font-medium leading-snug line-clamp-2">
          {translatedTitle ?? recipe.title}
        </h3>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
            {cost != null && (
              <span className="flex items-center gap-0.5 tabular-nums text-white/70">
                <Euro className="h-3 w-3" />{cost.toFixed(2)}{partial && <span className="text-amber-500">*</span>}
                {recipe.selling_price != null && <span className="text-white/40"> / {recipe.selling_price.toFixed(2)}</span>}
              </span>
            )}
            {stock && (
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${stock.canMake ? 'bg-emerald-500/12 text-emerald-500' : 'bg-amber-500/12 text-amber-500'}`}>
                {stock.canMake ? <PackageCheck className="h-3 w-3" /> : <PackageX className="h-3 w-3" />}
                {stock.canMake ? t('recipes.detail.inStock')
                  : stock.missing.slice(0, 1).join(', ') + (stock.missing.length > 1 ? ` +${stock.missing.length - 1}` : '')}
              </span>
            )}
            {recipe.allergens.length > 0 && (
              <span className="flex items-center gap-0.5">
                {recipe.allergens.slice(0, 4).map((a) => <AllergenDot key={a} allergen={a} />)}
                {recipe.allergens.length > 4 && <span className="ml-0.5 text-[10px] text-white/45">+{recipe.allergens.length - 4}</span>}
              </span>
            )}
          </div>

          {ingredients.length > 0 && (
            <button
              type="button"
              onClick={handleMake}
              disabled={consuming || (stock ? !stock.canMake : false)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-2 text-xs font-medium text-on-accent transition hover:bg-brand-orange/85 disabled:opacity-40"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              {consuming ? '…' : t('recipes.detail.make')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
