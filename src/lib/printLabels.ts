import type { MenuItem, Menu, Recipe } from '../types/database.types'

export type LabelSizePreset = 'small' | 'medium' | 'large'
export type LabelSize = LabelSizePreset | 'custom'

export interface LabelSettings {
  size: LabelSize
  customW: number          // mm – only used when size === 'custom'
  customH: number          // mm – only used when size === 'custom'
  logoUrl: string | null
  logoMaxW: number         // mm
  logoMaxH: number         // mm
  logoAlign: 'left' | 'center' | 'right'
  showDescription: boolean
  showAllergens: boolean
  showTags: boolean
  showPrice: boolean
  language: 'en' | 'el' | 'both'
}

interface Dims { w: number; h: number; namePt: number; descPt: number; gapMm: number }

const PRESET_DIMS: Record<LabelSizePreset, Dims> = {
  small:  { w: 85,  h: 55,  namePt: 13, descPt: 8,  gapMm: 5 },
  medium: { w: 148, h: 105, namePt: 20, descPt: 10, gapMm: 8 },
  large:  { w: 210, h: 100, namePt: 24, descPt: 11, gapMm: 10 },
}

export function getDims(settings: LabelSettings): Dims {
  if (settings.size !== 'custom') return PRESET_DIMS[settings.size]
  const { customW: w, customH: h } = settings
  const f = w / 148
  return {
    w, h,
    namePt: Math.max(9, Math.min(32, Math.round(20 * f))),
    descPt: Math.max(6, Math.min(16, Math.round(10 * f))),
    gapMm:  Math.max(2, Math.min(14, Math.round(8 * f))),
  }
}

const MM_TO_PX = 3.7795275591
const TARGET_W  = 284

export function previewIframeHeight(settings: LabelSettings): number {
  const d = getDims(settings)
  const scale = TARGET_W / (d.w * MM_TO_PX)
  return Math.ceil(d.h * MM_TO_PX * scale) + 20
}

// Kept for any external references
export const SIZE_CSS: Record<LabelSizePreset, { w: string; h: string; nameSize: string; descSize: string; gap: string }> = {
  small:  { w: '85mm',  h: '55mm',  nameSize: '13pt', descSize: '8pt',  gap: '5mm' },
  medium: { w: '148mm', h: '105mm', nameSize: '20pt', descSize: '10pt', gap: '8mm' },
  large:  { w: '210mm', h: '100mm', nameSize: '24pt', descSize: '11pt', gap: '10mm' },
}

const ALLERGEN_SHORT: Record<string, string> = {
  gluten: 'ΓΛΟΥΤ', dairy: 'ΓΑΛΑΚΤ', eggs: 'ΑΥΓΑ', fish: 'ΨΑΡΙ', shellfish: 'ΟΣΤΡΑΚ',
  nuts: 'ΞΗΡΟΙ', peanuts: 'ΦΙΣΤ', soy: 'ΣΟΓ', sesame: 'ΣΗΣΑΜ', celery: 'ΣΕΛΙΝ',
  mustard: 'ΜΟΥΣΤ', sulphites: 'ΘΕΙΩΔ', lupin: 'ΛΟΥΠ', molluscs: 'ΜΑΛΑΚ',
}

const TAG_SYMBOL: Record<string, string> = {
  vegan: '🌱 Vegan', vegetarian: '🥦 Vegetarian', gluten_free: '🌾 Gluten Free',
  spicy: '🌶️ Spicy', chefs_pick: '⭐ Chef\'s Pick',
}

function itemName(item: MenuItem, lang: LabelSettings['language']): string {
  if (lang === 'el') return item.name_el ?? item.name
  if (lang === 'both' && item.name_el) return `${item.name} / ${item.name_el}`
  return item.name
}

function itemDesc(item: MenuItem, lang: LabelSettings['language']): string | null {
  if (lang === 'el') return item.description_el ?? item.description
  if (lang === 'both' && item.description_el) return `${item.description} / ${item.description_el}`
  return item.description
}

function labelCss(settings: LabelSettings, d: Dims): string {
  const sm = d.w <= 100
  return `
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: 'Georgia', serif; background: white }
    .label {
      border: 1px solid #333; border-radius: 3mm;
      padding: ${sm ? '3mm' : '6mm'};
      display: flex; flex-direction: column;
      gap: ${sm ? '2mm' : '4mm'};
      break-inside: avoid; page-break-inside: avoid;
      overflow: hidden;
    }
    .label-header {
      display: flex; align-items: flex-start;
      justify-content: space-between; gap: 3mm;
    }
    .label-header-center {
      position: relative;
      display: flex; justify-content: center; width: 100%;
    }
    .allergens-overlay {
      position: absolute; right: 0; top: 0;
      display: flex; flex-wrap: wrap; gap: 1.5mm;
      justify-content: flex-end; max-width: 60%;
    }
    .logo { max-width: ${settings.logoMaxW}mm; max-height: ${settings.logoMaxH}mm; object-fit: contain; }
    .logo-placeholder { width: 1px }
    .allergens { display: flex; flex-wrap: wrap; gap: 1.5mm; justify-content: flex-end }
    .allergen {
      background: #fee2e2; color: #991b1b;
      border: 0.5px solid #fca5a5; border-radius: 1.5mm;
      padding: 0.5mm 1.5mm;
      font-size: ${sm ? '5.5pt' : '7pt'};
      font-family: Arial, sans-serif; font-weight: bold; letter-spacing: 0.03em;
    }
    .label-name {
      font-weight: bold; line-height: 1.15; color: #111;
      flex: 1; display: flex; align-items: center;
      justify-content: space-between; gap: 3mm;
      font-size: ${d.namePt}pt;
    }
    .price { font-size: 0.7em; color: #555; white-space: nowrap; }
    .label-desc {
      color: #444; font-style: italic; line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: ${sm ? 2 : 3};
      -webkit-box-orient: vertical; overflow: hidden;
      font-size: ${d.descPt}pt;
    }
    .tags { font-size: ${sm ? '6pt' : '8pt'}; color: #555; font-family: Arial, sans-serif; margin-top: auto; }
  `
}

function labelHtml(item: MenuItem, recipe: Recipe | undefined, settings: LabelSettings, d: Dims): string {
  const allergenBadges = settings.showAllergens && recipe?.allergens?.length
    ? recipe.allergens.map((a) => `<span class="allergen">${ALLERGEN_SHORT[a.toLowerCase()] ?? a.toUpperCase()}</span>`).join('')
    : ''

  const tags = settings.showTags && item.tags?.length
    ? `<div class="tags">${item.tags.map((t) => TAG_SYMBOL[t] ?? t).join('  ')}</div>`
    : ''

  const desc  = settings.showDescription ? itemDesc(item, settings.language) : null
  const price = settings.showPrice && item.price != null
    ? `<span class="price">€${item.price.toFixed(2)}</span>` : ''

  const logoEl = settings.logoUrl
    ? `<img src="${settings.logoUrl}" class="logo" alt="logo" />`
    : '<div class="logo-placeholder"></div>'

  let headerHtml: string
  if (settings.logoAlign === 'center') {
    headerHtml = `<div class="label-header-center"><div class="allergens-overlay">${allergenBadges}</div>${logoEl}</div>`
  } else if (settings.logoAlign === 'right') {
    headerHtml = `<div class="label-header"><div class="allergens">${allergenBadges}</div>${logoEl}</div>`
  } else {
    headerHtml = `<div class="label-header">${logoEl}<div class="allergens">${allergenBadges}</div></div>`
  }

  return `
<div class="label" style="width:${d.w}mm;height:${d.h}mm">
  ${headerHtml}
  <div class="label-name">${itemName(item, settings.language)}${price}</div>
  ${desc ? `<div class="label-desc">${desc}</div>` : ''}
  ${tags}
</div>`
}

export function buildPreviewHtml(item: MenuItem, recipe: Recipe | undefined, settings: LabelSettings): string {
  const d = getDims(settings)
  const scale = TARGET_W / (d.w * MM_TO_PX)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${labelCss(settings, d)}
    body { padding: 8px; zoom: ${scale.toFixed(4)}; background: #f0f0f0 }
  </style>
</head>
<body>
  ${labelHtml(item, recipe, settings, d)}
</body>
</html>`
}

export function printLabels(items: MenuItem[], menu: Menu, recipes: Recipe[], settings: LabelSettings): void {
  const d = getDims(settings)
  const recipeMap = new Map(recipes.map((r) => [r.id, r]))
  const labelsHtml = items
    .map((item) => labelHtml(item, item.recipe_id ? recipeMap.get(item.recipe_id) : undefined, settings, d))
    .join('\n')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${menu.name} — Labels</title>
  <style>
    ${labelCss(settings, d)}
    @page { size: A4; margin: 10mm }
    .grid { display: flex; flex-wrap: wrap; gap: ${d.gapMm}mm }
  </style>
</head>
<body>
  <div class="grid">${labelsHtml}</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}
