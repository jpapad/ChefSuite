import type { InventoryItem, Recipe, RecipeIngredient } from '../types/database.types'

function fmtMin(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60); const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function printRecipe(recipe: Recipe, ingredients: RecipeIngredient[], inventory: InventoryItem[]) {
  const steps = recipe.instructions
    ? recipe.instructions.split(/\n+/).map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean)
    : []

  const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0) || null

  const ingRows = ingredients.map((ing) => {
    const item = inventory.find((i) => i.id === ing.inventory_item_id)
    return `<tr><td>${item?.name ?? '?'}</td><td>${ing.quantity} ${item?.unit ?? ''}</td></tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${recipe.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: Georgia, serif; color: #111; max-width: 720px; margin: 0 auto; padding: 40px 32px }
    h1 { font-size: 2rem; margin-bottom: 8px }
    .meta { display: flex; flex-wrap: wrap; gap: 16px; color: #555; font-size: 0.9rem; margin-bottom: 20px }
    .meta span::before { margin-right: 4px }
    .description { font-style: italic; color: #444; margin-bottom: 24px; line-height: 1.6 }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0 }
    h2 { font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 12px }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px }
    td { padding: 6px 0; border-bottom: 1px solid #eee; font-size: 0.95rem }
    td:last-child { text-align: right; color: #555 }
    ol { padding-left: 1.4rem }
    ol li { margin-bottom: 12px; line-height: 1.65; font-size: 0.97rem }
    .allergens { margin-top: 24px; font-size: 0.85rem; color: #b45309 }
    img { width: 100%; max-height: 320px; object-fit: cover; border-radius: 8px; margin-bottom: 20px }
    @media print { body { padding: 20px } }
  </style>
</head>
<body>
  ${recipe.image_url ? `<img src="${recipe.image_url}" alt="">` : ''}
  <h1>${recipe.title}</h1>
  <div class="meta">
    ${recipe.category ? `<span>📁 ${recipe.category}</span>` : ''}
    ${recipe.prep_time ? `<span>🔪 Prep ${fmtMin(recipe.prep_time)}</span>` : ''}
    ${recipe.cook_time ? `<span>🔥 Cook ${fmtMin(recipe.cook_time)}</span>` : ''}
    ${totalTime ? `<span>⏱ Total ${fmtMin(totalTime)}</span>` : ''}
    ${recipe.servings ? `<span>👤 ${recipe.servings} servings</span>` : ''}
    ${recipe.difficulty ? `<span>⭐ ${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}</span>` : ''}
    ${recipe.cost_per_portion != null ? `<span>€${recipe.cost_per_portion.toFixed(2)} / portion</span>` : ''}
  </div>
  ${recipe.description ? `<p class="description">${recipe.description}</p>` : ''}

  ${ingredients.length > 0 ? `<hr><h2>Ingredients</h2><table>${ingRows}</table>` : ''}

  ${steps.length > 0 ? `<hr><h2>Instructions</h2><ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : ''}

  ${recipe.allergens.length > 0 ? `<p class="allergens">⚠ Allergens: ${recipe.allergens.join(', ')}</p>` : ''}
</body>
</html>`

  const win = window.open('', '_blank', 'width=800,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
