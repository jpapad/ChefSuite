import type { TFunction } from 'i18next'
import type { InventoryItem, Recipe, RecipeIngredient, TrainingQuestion } from '../types/database.types'
import { ALLERGEN_GROUPS, ALLERGEN_META } from '../components/ui/AllergenIcon'

// Builds a multiple-choice quiz from a recipe's real data: quantities per
// portion, allergens and cooking time. Wrong answers are plausible variations
// (×0.5, ×1.5, ×2…) so the cook has to actually know the recipe.

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function fmt(n: number) {
  if (n >= 100) return String(Math.round(n))
  if (n >= 10) return String(Math.round(n * 10) / 10)
  return String(Math.round(n * 100) / 100)
}

function withAnswer(q: string, correct: string, wrong: string[]): TrainingQuestion | null {
  const distinct = [...new Set(wrong.filter((w) => w !== correct))].slice(0, 3)
  if (distinct.length < 2) return null
  const options = shuffle([correct, ...distinct])
  return { q, options, answer: options.indexOf(correct) }
}

export function quizFromRecipe(
  recipe: Recipe,
  ingredients: RecipeIngredient[],
  inventory: InventoryItem[],
  t: TFunction,
  lang: string,
): TrainingQuestion[] {
  const questions: TrainingQuestion[] = []

  // Quantities — the biggest ingredients first, up to 6
  const rows = ingredients
    .map((ing) => ({ ing, item: inventory.find((i) => i.id === ing.inventory_item_id) }))
    .filter((r): r is { ing: RecipeIngredient; item: InventoryItem } => !!r.item && r.ing.quantity > 0)
    .sort((a, b) => b.ing.quantity - a.ing.quantity)
    .slice(0, 6)
  for (const { ing, item } of rows) {
    const q = ing.quantity
    const unit = item.unit
    const opt = (n: number) => `${fmt(n)} ${unit}`
    const made = withAnswer(
      t('training.gen.qty', { item: item.name, recipe: recipe.title }),
      opt(q),
      shuffle([opt(q * 0.5), opt(q * 1.5), opt(q * 2), opt(q * 0.75), opt(q * 3)]),
    )
    if (made) questions.push(made)
  }

  // Allergens
  const eu = ALLERGEN_GROUPS[0]!.keys
  const contains = recipe.allergens.filter((a) => eu.includes(a))
  const label = (k: string) => {
    const m = ALLERGEN_META[k]
    if (!m) return k
    return lang.startsWith('el') ? m.labelEl : lang.startsWith('bg') ? m.labelBg : m.label
  }
  if (contains.length > 0) {
    const correct = contains[Math.floor(Math.random() * contains.length)]!
    const others = shuffle(eu.filter((a) => !recipe.allergens.includes(a))).slice(0, 3)
    const made = withAnswer(t('training.gen.allergen', { recipe: recipe.title }), label(correct), others.map(label))
    if (made) questions.push(made)
  }

  // Cooking time
  if (recipe.cook_time && recipe.cook_time > 0) {
    const m = recipe.cook_time
    const opt = (n: number) => t('training.gen.minutes', { count: Math.max(1, Math.round(n)) })
    const made = withAnswer(t('training.gen.cookTime', { recipe: recipe.title }), opt(m), shuffle([opt(m * 0.5), opt(m * 1.5), opt(m * 2), opt(m + 10)]))
    if (made) questions.push(made)
  }

  // Portions per batch
  if (recipe.servings && recipe.servings > 1) {
    const s = recipe.servings
    const made = withAnswer(t('training.gen.servings', { recipe: recipe.title }), String(s), shuffle([String(s * 2), String(Math.max(1, Math.round(s / 2))), String(s + 2), String(s + 4)]))
    if (made) questions.push(made)
  }

  return questions
}
