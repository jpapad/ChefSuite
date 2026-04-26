import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Euro, AlertTriangle, PackageCheck, PackageX, UtensilsCrossed, History, ChefHat, Clock, Users } from 'lucide-react'
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
  easy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  hard: 'bg-red-500/20 text-red-300 border-red-500/30',
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
      className="group relative overflow-hidden rounded-2xl cursor-pointer h-64 bg-white/5"
      onClick={() => onView(recipe)}
    >
      {/* Background image */}
      {recipe.image_url ? (
        <img
          src={recipe.image_url}
          alt={recipe.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10">
          <ChefHat className="h-16 w-16 text-white/10" />
        </div>
      )}

      {/* Top actions */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button type="button" onClick={(e) => { e.stopPropagation(); onHistory(recipe) }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-white-fixed backdrop-blur-sm transition hover:bg-black/90">
          <History className="h-4 w-4" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(recipe) }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-white-fixed backdrop-blur-sm transition hover:bg-black/90">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(recipe) }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-white-fixed backdrop-blur-sm transition hover:text-red-400 hover:bg-black/90">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom content — solid dark panel for guaranteed readability */}
      <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-sm p-4 space-y-1.5">
        {/* Category */}
        {recipe.category && (
          <span className="inline-block rounded-md px-2 py-0.5 text-xs font-medium text-white-fixed" style={{ background: 'rgba(255,255,255,0.15)' }}>
            {t(`recipes.categories.${recipe.category}`)}
          </span>
        )}

        {/* Title */}
        <h3 style={{ color: '#ffffff' }} className="text-base font-bold leading-snug line-clamp-2">
          {translatedTitle ?? recipe.title}
        </h3>

        {/* Time / servings / difficulty row */}
        {(totalTime || recipe.servings || recipe.difficulty) && (
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {totalTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />{fmtMin(totalTime)}
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />{recipe.servings}
              </span>
            )}
            {recipe.difficulty && (
              <span className={`rounded-md border px-1.5 py-0.5 font-medium ${DIFFICULTY_STYLE[recipe.difficulty]}`}>
                {t(`recipes.form.difficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`)}
              </span>
            )}
          </div>
        )}

        {/* Cost / stock / make row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {stock && (
              <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${
                stock.canMake ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                              : 'border-amber-500/40 bg-amber-500/20 text-amber-300'}`}>
                {stock.canMake ? <PackageCheck className="h-3 w-3" /> : <PackageX className="h-3 w-3" />}
                {stock.canMake ? t('recipes.detail.inStock')
                  : stock.missing.slice(0, 1).join(', ') + (stock.missing.length > 1 ? ` +${stock.missing.length - 1}` : '')}
              </span>
            )}
            {cost != null && (
              <span className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <Euro className="h-3 w-3" />{cost.toFixed(2)}{partial && <span className="text-amber-300">*</span>}
              </span>
            )}
            {foodCostPct != null && (
              <span className={`font-medium ${foodCostPct <= 30 ? 'text-emerald-400' : foodCostPct <= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                FC {foodCostPct.toFixed(0)}%
              </span>
            )}
            {recipe.allergens.length > 0 && (
              <span className="flex items-center gap-1 text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                {recipe.allergens.slice(0, 2).join(', ')}
                {recipe.allergens.length > 2 && ` +${recipe.allergens.length - 2}`}
              </span>
            )}
          </div>

          {ingredients.length > 0 && (
            <button
              type="button"
              onClick={handleMake}
              disabled={consuming || (stock ? !stock.canMake : false)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-orange px-3 py-1.5 text-xs font-medium text-white-fixed disabled:opacity-40 hover:bg-brand-orange/90 transition"
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
