import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, PackageCheck, PackageX, UtensilsCrossed, History, Clock, Users } from 'lucide-react'
import { AllergenDot } from '../ui/AllergenIcon'
import { cn } from '../../lib/cn'
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
  /** Show the photo in black/orange duotone. */
  duotone?: boolean
}

/** Food cost above this share of the selling price is flagged. */
const FC_TARGET = 30

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
  if (min < 60) return `${min}′`
  const h = Math.floor(min / 60); const m = min % 60
  return m ? `${h}h ${m}′` : `${h}h`
}

const money = (n: number) => n.toFixed(2).replace('.', ',')

export function RecipeCard({ recipe, ingredients, inventory, onView, onEdit, onDelete, onConsume, onHistory, duotone = true }: RecipeCardProps) {
  const { t } = useTranslation()
  const { cost, partial } = computeCost(recipe, ingredients, inventory)
  const stock = computeStock(ingredients, inventory)
  const [consuming, setConsuming] = useState(false)
  const translatedTitle = useAutoTranslate(recipe.title)
  const title = translatedTitle ?? recipe.title

  const foodCostPct = cost != null && recipe.selling_price != null && recipe.selling_price > 0
    ? (cost / recipe.selling_price) * 100 : null
  const overTarget = foodCostPct != null && foodCostPct > FC_TARGET

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
      role="button"
      tabIndex={0}
      onClick={() => onView(recipe)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(recipe) } }}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded bg-bg-card shadow-card transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-4 focus-visible:ring-signal/60"
    >
      {/* Photo — or a big initial when there isn't one */}
      <div className={cn('relative h-48 overflow-hidden border-b-2 border-inv-border', recipe.image_url ? (duotone ? 'sb-duo' : 'bg-white/[0.05]') : 'bg-ink')}>
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <span aria-hidden="true" className="absolute -bottom-6 left-3 font-display text-[200px] font-extrabold uppercase leading-[0.8] text-signal">
            {title.charAt(0)}
          </span>
        )}
        {foodCostPct != null && (
          <span className={cn('sb-label absolute left-2.5 top-2.5 rounded-sm px-2 py-1.5', overTarget ? 'bg-signal text-ink' : 'bg-white-fixed text-ink')}>
            FC {foodCostPct.toFixed(0)}%
          </span>
        )}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {[
            { icon: History, label: t('recipes.versions.title', 'History'), on: () => onHistory(recipe), cls: '' },
            { icon: Pencil, label: t('common.edit', 'Edit'), on: () => onEdit(recipe), cls: '' },
            { icon: Trash2, label: t('common.delete', 'Delete'), on: () => onDelete(recipe), cls: 'hover:bg-[#FF3B30] hover:text-white-fixed' },
          ].map(({ icon: Icon, label, on, cls }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onClick={(e) => { e.stopPropagation(); on() }}
              className={cn('flex h-10 w-10 items-center justify-center rounded-sm bg-white-fixed text-ink transition', cls)}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3 pt-3">
        <div className="sb-label flex flex-wrap items-center gap-x-3 gap-y-1 text-white/60">
          {recipe.is_base && (
            <span className="rounded-sm bg-signal px-1.5 py-0.5 text-ink">
              {t('recipes.sub.baseTag')}{recipe.yield_unit ? ` · ${recipe.yield_unit}` : ''}
            </span>
          )}
          {recipe.category && <span>{t(`recipes.categories.${recipe.category}`)}</span>}
          {totalTime && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtMin(totalTime)}</span>}
          {recipe.servings && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{recipe.servings}</span>}
          {recipe.difficulty && (
            <span className="ml-auto">
              {t(`recipes.form.difficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`)}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 font-display text-[28px] font-extrabold uppercase leading-[0.95] group-hover:underline group-hover:decoration-signal group-hover:decoration-4 group-hover:underline-offset-4">
          {title}
        </h3>

        {(stock || recipe.allergens.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {stock && (
              <span className={cn('sb-label flex items-center gap-1', stock.canMake ? 'text-emerald-500' : 'text-amber-500')}>
                {stock.canMake ? <PackageCheck className="h-4 w-4" /> : <PackageX className="h-4 w-4" />}
                {stock.canMake ? t('recipes.detail.inStock')
                  : stock.missing.slice(0, 1).join(', ') + (stock.missing.length > 1 ? ` +${stock.missing.length - 1}` : '')}
              </span>
            )}
            {recipe.allergens.length > 0 && (
              <span className="flex items-center gap-0.5">
                {recipe.allergens.slice(0, 4).map((a) => <AllergenDot key={a} allergen={a} />)}
                {recipe.allergens.length > 4 && <span className="ml-0.5 text-white/60">+{recipe.allergens.length - 4}</span>}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center gap-3 border-t-2 border-inv-border pt-2.5">
          {recipe.selling_price != null ? (
            <span className="font-mono text-[24px] font-bold tracking-[-0.03em] tabular-nums">€{money(recipe.selling_price)}</span>
          ) : cost != null ? (
            <span className="font-mono text-[24px] font-bold tracking-[-0.03em] tabular-nums">€{money(cost)}</span>
          ) : null}
          {cost != null && recipe.selling_price != null && (
            <span className="font-mono text-[13px] text-white/60 tabular-nums">
              {t('station.costShort', 'cost')} €{money(cost)}{partial && <span className="text-amber-500">*</span>}
            </span>
          )}
          <span className="flex-1" />
          {foodCostPct != null && (
            <span className="h-2.5 w-16 bg-white/15" aria-hidden="true">
              <span className={cn('block h-full', overTarget ? 'bg-signal' : 'bg-white')} style={{ width: `${Math.min(100, (foodCostPct / 40) * 100)}%` }} />
            </span>
          )}
          {ingredients.length > 0 && (
            <button
              type="button"
              onClick={handleMake}
              disabled={consuming || (stock ? !stock.canMake : false)}
              className="sb-label flex h-10 shrink-0 items-center gap-1.5 rounded-sm bg-brand-orange px-3 text-on-accent transition hover:bg-brand-orange/85 disabled:opacity-40"
            >
              <UtensilsCrossed className="h-4 w-4" />
              {consuming ? '…' : t('recipes.detail.make')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
