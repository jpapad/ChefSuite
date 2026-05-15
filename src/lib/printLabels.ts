import type { MenuItem, Menu, Recipe } from '../types/database.types'

export type LabelSizePreset = 'small' | 'medium' | 'large'
export type LabelSize = LabelSizePreset | 'custom'

export interface LabelSettings {
  size: LabelSize
  customW: number          // value in customUnit – only used when size === 'custom'
  customH: number          // value in customUnit – only used when size === 'custom'
  customUnit: 'mm' | 'cm' // unit for customW / customH
  fontFamily: string
  logoUrl: string | null
  logoMaxW: number         // mm
  logoMaxH: number         // mm
  logoAlign: 'left' | 'center' | 'right'
  nameAlign: 'left' | 'center' | 'right'
  showDescription: boolean
  showAllergens: boolean
  showTags: boolean
  showPrice: boolean
  language: 'en' | 'el' | 'bg' | 'both'
  langBothLines: Array<'source' | 'en' | 'bg'>
  allergenLang: 'en' | 'el' | 'bg' | 'both'
  allergenIconSet: 'default' | 'custom'
  allergenSize: 'small' | 'medium' | 'large'
  showAllergenLegend: boolean
  showQr: boolean
  qrSizeMm: number
  qrBorder: boolean
  qrBorderColor: string
  qrBorderWidth: number
  qrBorderRadius: number
  qrBorderPadding: number
  qrLabel: string
  qrLabelPos: 'above' | 'below'
  qrLabelSize: number
  qrLabelColor: string
  qrLabelAlign: 'left' | 'center' | 'right'
  labelsPerRow: 1 | 2 | 3 | 4
  descSizeScale: number
  langStyles: Record<'source' | 'en' | 'bg', { bold: boolean; italic: boolean; sizeScale: number }>
}

export const LABEL_FONTS: { label: string; value: string }[] = [
  { label: 'Georgia (default)',  value: 'Georgia, serif' },
  { label: 'Times New Roman',   value: '"Times New Roman", Times, serif' },
  { label: 'Palatino',          value: 'Palatino, "Palatino Linotype", serif' },
  { label: 'Arial',             value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana',           value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS',      value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Courier New',       value: '"Courier New", Courier, monospace' },
]

interface Dims { w: number; h: number; namePt: number; descPt: number; gapMm: number }

const PRESET_DIMS: Record<LabelSizePreset, Dims> = {
  small:  { w: 85,  h: 55,  namePt: 13, descPt: 8,  gapMm: 5 },
  medium: { w: 148, h: 105, namePt: 20, descPt: 10, gapMm: 8 },
  large:  { w: 210, h: 100, namePt: 24, descPt: 11, gapMm: 10 },
}

export function getDims(settings: LabelSettings): Dims {
  if (settings.size !== 'custom') return PRESET_DIMS[settings.size]
  const factor = settings.customUnit === 'cm' ? 10 : 1
  const w = settings.customW * factor
  const h = settings.customH * factor
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

const ALLERGEN_EN: Record<string, string> = {
  gluten: 'Gluten', dairy: 'Dairy', eggs: 'Eggs', fish: 'Fish', shellfish: 'Shellfish',
  nuts: 'Nuts', peanuts: 'Peanuts', soy: 'Soy', sesame: 'Sesame', celery: 'Celery',
  mustard: 'Mustard', sulphites: 'Sulphites', lupin: 'Lupin', molluscs: 'Molluscs',
  vegan: 'Vegan', vegetarian: 'Vegetarian', local: 'Local Dish',
  no_lactose: 'No Lactose', spicy: 'Spicy',
}

const ALLERGEN_EL: Record<string, string> = {
  gluten: 'Γλουτένη', dairy: 'Γαλακτοκομικά', eggs: 'Αυγά', fish: 'Ψάρι', shellfish: 'Οστρακοειδή',
  nuts: 'Ξηροί Καρποί', peanuts: 'Φιστίκια', soy: 'Σόγια', sesame: 'Σησάμι', celery: 'Σέλινο',
  mustard: 'Μουστάρδα', sulphites: 'Θειώδη', lupin: 'Λούπινο', molluscs: 'Μαλάκια',
  vegan: 'Vegan', vegetarian: 'Χορτοφαγικό', local: 'Τοπικό Πιάτο',
  no_lactose: 'Χωρίς Λακτόζη', spicy: 'Καυτερό',
}

const ALLERGEN_BG: Record<string, string> = {
  gluten: 'Глутен', dairy: 'Млечни', eggs: 'Яйца', fish: 'Риба', shellfish: 'Ракообразни',
  nuts: 'Ядки', peanuts: 'Фъстъци', soy: 'Соя', sesame: 'Сусам', celery: 'Целина',
  mustard: 'Горчица', sulphites: 'Сулфити', lupin: 'Лупина', molluscs: 'Мекотели',
  vegan: 'Веган', vegetarian: 'Вегетарианско', local: 'Местно Ястие',
  no_lactose: 'Без Лактоза', spicy: 'Лютиво',
}

const ALL_ALLERGEN_KEYS = Object.keys(ALLERGEN_EN)

// Custom PNG icon filenames (served from /allergen-icons/)
const CUSTOM_ALLERGEN_IMG: Partial<Record<string, string>> = {
  gluten:      'gluten.png',
  nuts:        'nuts.png',
  shellfish:   'crustacean.png',
  molluscs:    'molluscs.png',
  vegan:       'vegan.png',
  vegetarian:  'vegetarian.png',
  local:       'local.png',
  no_lactose:  'no-milk.png',
}

// Inline SVG paths for each allergen (viewBox 0 0 24 24)
const ALLERGEN_SVG_PATH: Record<string, string> = {
  gluten:    `<rect x="11.3" y="8" width="1.4" height="13" rx="0.7"/><ellipse cx="12" cy="5.5" rx="2.5" ry="3.5"/><ellipse cx="8.5" cy="11" rx="2" ry="3" transform="rotate(-30 8.5 11)"/><ellipse cx="15.5" cy="11" rx="2" ry="3" transform="rotate(30 15.5 11)"/><ellipse cx="9" cy="15.5" rx="1.8" ry="2.5" transform="rotate(-20 9 15.5)"/><ellipse cx="15" cy="15.5" rx="1.8" ry="2.5" transform="rotate(20 15 15.5)"/>`,
  dairy:     `<path d="M8 6 L7 20 Q7 22 12 22 Q17 22 17 20 L16 6 Z"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M16 9 Q20 9 20 13 Q20 17 16 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  eggs:      `<path d="M12 2 C7.5 2 4 7.5 4 13.5 C4 18.5 7.6 22 12 22 C16.4 22 20 18.5 20 13.5 C20 7.5 16.5 2 12 2 Z"/>`,
  fish:      `<path d="M3 6 L8 12 L3 18 Z"/><ellipse cx="15" cy="12" rx="8" ry="5.5"/><circle cx="19.5" cy="10.5" r="1.2" fill="white"/><circle cx="19.5" cy="10.5" r="0.5"/>`,
  peanuts:   `<ellipse cx="12" cy="7.5" rx="4.5" ry="5"/><ellipse cx="12" cy="16.5" rx="4.5" ry="5"/><rect x="10" y="11.5" width="4" height="2"/><rect x="9.5" y="11.8" width="5" height="1.4" rx="0.7" fill="white"/>`,
  soy:       `<path d="M5 19 C5 19 5 5 12 3 C19 5 19 19 19 19 Q16 22 12 22 Q8 22 5 19 Z"/><ellipse cx="12" cy="8.5" rx="2" ry="2.5" fill="white" opacity="0.6"/><ellipse cx="12" cy="13.5" rx="2" ry="2.5" fill="white" opacity="0.6"/><ellipse cx="12" cy="18" rx="2" ry="2" fill="white" opacity="0.6"/>`,
  nuts:      `<ellipse cx="12" cy="14" rx="7.5" ry="7"/><path d="M4.5 13 C4.5 13 5 6 12 5 C19 6 19.5 13 19.5 13 Z"/><rect x="11.3" y="2" width="1.4" height="4" rx="0.7"/>`,
  shellfish: `<path d="M17 4 C20 6 21 9 19 12 C17 15 14 16 13 18 C12 20 13 22 11 22 C9 22 9 20 10 18 C8 17 6 15 5 12 C4 9 5 6 8 5 C11 4 14 6 17 4 Z"/>`,
  sesame:    `<rect x="11.3" y="13" width="1.4" height="9" rx="0.7"/><ellipse cx="12" cy="11" rx="2.8" ry="2"/><ellipse cx="12" cy="7.5" rx="2.5" ry="1.8"/><ellipse cx="8" cy="10.5" rx="2.2" ry="1.5" transform="rotate(-25 8 10.5)"/><ellipse cx="16" cy="10.5" rx="2.2" ry="1.5" transform="rotate(25 16 10.5)"/>`,
  celery:    `<path d="M12 22 C12 22 6 18 5 10 C5 7 7 5 9 6 C9 6 8 10 10 14 C11 17 12 22 12 22 Z"/><path d="M12 22 C12 22 9 17 10 10 C10.5 6 12 4 12 4 C12 4 13.5 6 14 10 C15 17 12 22 12 22 Z"/><path d="M12 22 C12 22 13 17 14 14 C16 10 15 6 15 6 C17 5 19 7 19 10 C18 18 12 22 12 22 Z"/>`,
  mustard:   `<ellipse cx="12" cy="6.5" rx="3" ry="4.5"/><ellipse cx="17.5" cy="12" rx="4.5" ry="3"/><ellipse cx="12" cy="17.5" rx="3" ry="4.5"/><ellipse cx="6.5" cy="12" rx="4.5" ry="3"/><circle cx="12" cy="12" r="3.5" fill="white"/><circle cx="12" cy="12" r="2.5"/>`,
  sulphites: `<path d="M7 3 L17 3 L15 12 Q14 15 12 15 Q10 15 9 12 Z"/><rect x="11.3" y="15" width="1.4" height="5" rx="0.7"/><rect x="8" y="20" width="8" height="1.5" rx="0.75"/>`,
  lupin:     `<path d="M7 19 C5 17 5 7 12 3 C19 7 19 17 17 19 Q14.5 22 12 22 Q9.5 22 7 19 Z"/><circle cx="12" cy="7.5" r="2.2" fill="white" opacity="0.65"/><circle cx="12" cy="12.5" r="2.2" fill="white" opacity="0.65"/><circle cx="12" cy="17.5" r="2" fill="white" opacity="0.65"/>`,
  molluscs:  `<path d="M12 21 C12 21 4 17 3 10 C2.5 6 5 3 9 3 C11 3 12 4 12 4 C12 4 13 3 15 3 C19 3 21.5 6 21 10 C20 17 12 21 12 21 Z"/>`,
  // Extended dietary indicators
  vegan:      `<path d="M5 21 C5 21 8 14 13 11 C18 8 21 8 21 8 C21 8 19 13 15 17 C11 20 7 21 5 21 Z"/><path d="M5 21 C5 21 8 17 9 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  vegetarian: `<path d="M12 3 C12 3 16 8 16 13 C16 18 14 22 12 22 C10 22 8 18 8 13 C8 8 12 3 12 3 Z"/><path d="M12 3 L10 0.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 3 L14 0.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 3 L12 0.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  local:      `<path d="M12 2 C7.5 2 4 5.5 4 10 C4 16 12 22 12 22 C12 22 20 16 20 10 C20 5.5 16.5 2 12 2 Z"/><circle cx="12" cy="10" r="3.5" fill="white" opacity="0.65"/>`,
  spicy:      `<path d="M13 2 C15 2 16 4 15 6 C14 8 13 9 13 12 C13 16 14 18 14 20 C14 21.5 13 22 11.5 22 C10 22 9 21 9 20 C9 18 10 16 10 12 C10 9 9 7 10 5 C11 3 12 2 13 2 Z"/><path d="M15 3.5 C17 2.5 19 3.5 19 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  no_lactose: `<path d="M8 6 L7 20 Q7 22 12 22 Q17 22 17 20 L16 6 Z"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="6" y1="5" x2="18" y2="21" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
}

function allergenLabel(key: string, lang: 'en' | 'el' | 'bg' | 'both'): string {
  const k  = key.toLowerCase()
  const en = ALLERGEN_EN[k] ?? key
  const el = ALLERGEN_EL[k] ?? key
  const bg = ALLERGEN_BG[k] ?? key
  if (lang === 'en')   return en
  if (lang === 'el')   return el
  if (lang === 'bg')   return bg
  return `${en} / ${el}`
}

function allergenIconEl(key: string, size: string, useCustom = false): string {
  const k = key.toLowerCase()
  if (useCustom) {
    const filename = CUSTOM_ALLERGEN_IMG[k]
    if (filename) {
      const origin = window.location.origin
      return `<img src="${origin}/allergen-icons/${filename}" width="${size}" height="${size}" style="display:inline-block;vertical-align:middle;flex-shrink:0;object-fit:contain" alt="" />`
    }
  }
  const path = ALLERGEN_SVG_PATH[k]
  if (!path) return ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}" style="display:inline-block;vertical-align:middle;flex-shrink:0">${path}</svg>`
}

const ALLERGEN_SIZE_MAP = {
  small:  { icon: '13px', font: '7pt'  },
  medium: { icon: '18px', font: '9pt'  },
  large:  { icon: '24px', font: '12pt' },
}

function allergenBadgeHtml(
  key: string,
  sm: boolean,
  lang: 'en' | 'el' | 'bg' | 'both',
  useCustomIcons = false,
  sizeOverride?: 'small' | 'medium' | 'large',
): string {
  const label    = allergenLabel(key, lang)
  const sizes    = sizeOverride
    ? ALLERGEN_SIZE_MAP[sizeOverride]
    : sm ? ALLERGEN_SIZE_MAP.small : ALLERGEN_SIZE_MAP.medium
  return `<span class="allergen">${allergenIconEl(key, sizes.icon, useCustomIcons)}<span style="font-size:${sizes.font}">${label}</span></span>`
}

function buildAllergenLegendHtml(lang: 'en' | 'el' | 'bg' | 'both', presentKeys: string[], useCustomIcons = false): string {
  const title =
    lang === 'en' ? 'Allergen Information' :
    lang === 'el' ? 'Αλλεργιογόνα' :
    lang === 'bg' ? 'Информация за Алергени' :
    'Allergen Information / Αλλεργιογόνα'

  const iconHeader =
    lang === 'el' ? 'Εικονίδιο' :
    lang === 'bg' ? 'Икона' :
    lang === 'en' ? 'Icon' :
    'Icon / Εικονίδιο'

  const colEn = lang === 'en' || lang === 'both'
    ? `<th style="padding:3mm 4mm;text-align:left;border-bottom:0.5px solid #ccc;font-size:9pt;color:#555">English</th>` : ''
  const colEl = lang === 'el' || lang === 'both'
    ? `<th style="padding:3mm 4mm;text-align:left;border-bottom:0.5px solid #ccc;font-size:9pt;color:#555">Ελληνικά</th>` : ''
  const colBg = lang === 'bg'
    ? `<th style="padding:3mm 4mm;text-align:left;border-bottom:0.5px solid #ccc;font-size:9pt;color:#555">Български</th>` : ''

  const rows = ALL_ALLERGEN_KEYS.map((k) => {
    const isPresent = presentKeys.map((p) => p.toLowerCase()).includes(k)
    const rowBg     = isPresent ? '#fff7ed' : 'white'
    const border    = isPresent ? 'border-left:3px solid #c2410c' : 'border-left:3px solid transparent'
    const icon      = allergenIconEl(k, '18px', useCustomIcons)
    const enCell = lang === 'en' || lang === 'both'
      ? `<td style="padding:2.5mm 4mm;font-size:9pt;color:#222">${ALLERGEN_EN[k]}</td>` : ''
    const elCell = lang === 'el' || lang === 'both'
      ? `<td style="padding:2.5mm 4mm;font-size:9pt;color:#222">${ALLERGEN_EL[k]}</td>` : ''
    const bgCell = lang === 'bg'
      ? `<td style="padding:2.5mm 4mm;font-size:9pt;color:#222">${ALLERGEN_BG[k]}</td>` : ''
    return `<tr style="background:${rowBg};${border}">
      <td style="padding:2.5mm 4mm;text-align:center">${icon}</td>
      ${enCell}${elCell}${bgCell}
    </tr>`
  }).join('\n')

  const noteText =
    lang === 'el' ? '★ Σκιασμένες γραμμές: αλλεργιογόνα παρόντα στο μενού' :
    lang === 'bg' ? '★ Засенчените редове: алергени в менюто' :
    lang === 'en' ? '★ Shaded rows: allergens present in this menu' :
    '★ Shaded rows / Σκιασμένες γραμμές: allergens present in this menu / αλλεργιογόνα παρόντα στο μενού'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: Arial, sans-serif; background: white; padding: 12mm }
    @page { size: A4; margin: 10mm }
    h1 { font-size: 14pt; font-weight: bold; color: #111; margin-bottom: 6mm; border-bottom: 1px solid #333; padding-bottom: 3mm }
    table { width: 100%; border-collapse: collapse; border: 0.5px solid #ddd; border-radius: 2mm; overflow: hidden }
    tr:not(:last-child) td, tr:not(:last-child) th { border-bottom: 0.5px solid #eee }
    .note { margin-top: 6mm; font-size: 7.5pt; color: #888; font-style: italic }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:3mm 4mm;text-align:center;border-bottom:0.5px solid #ccc;font-size:9pt;color:#555;width:14mm">${iconHeader}</th>
        ${colEn}${colEl}${colBg}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="note">${noteText}</p>
</body>
</html>`
}

const TAG_SYMBOL: Record<string, string> = {
  vegan: '🌱 Vegan', vegetarian: '🥦 Vegetarian', gluten_free: '🌾 Gluten Free',
  spicy: '🌶️ Spicy', chefs_pick: '⭐ Chef\'s Pick',
}

function itemName(item: MenuItem, lang: LabelSettings['language'], recipe?: Recipe): string {
  const nameEl = item.name_el ?? recipe?.name_el ?? null
  const nameBg = item.name_bg ?? recipe?.name_bg ?? null
  if (lang === 'en') return nameEl ?? item.name
  if (lang === 'bg') return nameBg ?? item.name
  if (lang === 'both') {
    const parts = [item.name]
    if (nameEl) parts.push(nameEl)
    if (nameBg) parts.push(nameBg)
    return parts.join(' / ')
  }
  return item.name
}

function itemDesc(item: MenuItem, lang: LabelSettings['language'], recipe?: Recipe): string | null {
  const descEl = item.description_el ?? recipe?.description_el ?? null
  const descBg = item.description_bg ?? recipe?.description_bg ?? null
  if (lang === 'en') return descEl ?? item.description
  if (lang === 'bg') return descBg ?? item.description
  if (lang === 'both') {
    const parts = [item.description].filter(Boolean)
    if (descEl) parts.push(descEl)
    if (descBg) parts.push(descBg)
    return parts.join(' / ') || null
  }
  return item.description
}

function labelCss(settings: LabelSettings, d: Dims): string {
  const sm = d.w <= 100
  return `
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: ${settings.fontFamily || 'Georgia, serif'}; background: white }
    .label {
      position: relative;
      border: 1px solid #333; border-radius: 0;
      padding: ${sm ? '3mm' : '6mm'};
      display: flex; flex-direction: column;
      gap: ${sm ? '2mm' : '4mm'};
      break-inside: avoid; page-break-inside: avoid;
      overflow: hidden;
    }
    .label-qr-wrap {
      position: absolute;
      bottom: ${sm ? '2mm' : '3mm'};
      right: ${sm ? '2mm' : '3mm'};
      display: flex; flex-direction: column; align-items: center;
      ${settings.qrBorder ? `
        border: ${settings.qrBorderWidth ?? 1}px solid ${settings.qrBorderColor ?? '#333'};
        border-radius: ${settings.qrBorderRadius ?? 2}mm;
        padding: ${settings.qrBorderPadding ?? 2}mm;
      ` : ''}
    }
    .label-qr {
      width: ${settings.qrSizeMm ?? 35}mm;
      height: ${settings.qrSizeMm ?? 35}mm;
      image-rendering: crisp-edges;
      opacity: 0.9;
      display: block;
    }
    .label-qr-msg {
      font-size: ${settings.qrLabelSize ?? 7}pt;
      color: ${settings.qrLabelColor ?? '#555'};
      text-align: ${settings.qrLabelAlign ?? 'center'};
      font-family: ${settings.fontFamily || 'Georgia, serif'};
      width: ${settings.qrSizeMm ?? 35}mm;
      padding: 1mm 0;
      line-height: 1.2;
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
    .logo { width: ${settings.logoMaxW}mm; max-height: ${settings.logoMaxH}mm; object-fit: contain; object-position: left center; }
    .logo-placeholder { width: 1px }
    .allergens { display: flex; flex-wrap: wrap; gap: 1.5mm; justify-content: flex-end }
    .allergen {
      background: #fee2e2; color: #991b1b;
      border: 0.5px solid #fca5a5; border-radius: 1.5mm;
      padding: 0.5mm 1.5mm;
      font-family: Arial, sans-serif; font-weight: bold; letter-spacing: 0.03em;
      display: inline-flex; align-items: center; gap: 1mm;
    }
    .label-name {
      font-weight: bold; line-height: 1.15; color: #111;
      flex: 1; display: flex; align-items: center;
      justify-content: ${settings.nameAlign === 'center' ? 'center' : settings.nameAlign === 'right' ? 'flex-end' : 'space-between'}; gap: 3mm;
      text-align: ${settings.nameAlign};
      font-size: ${d.namePt}pt;
      word-break: break-word; overflow-wrap: break-word;
      ${settings.showQr ? `padding-right: ${(settings.qrSizeMm ?? 35) + 4}mm;` : ''}
    }
    .label-name-both {
      flex: 1; display: flex; align-items: flex-start;
      justify-content: space-between; gap: 3mm;
      ${settings.showQr ? `padding-right: ${(settings.qrSizeMm ?? 35) + 4}mm;` : ''}
    }
    .label-name-lines {
      display: flex; flex-direction: column;
      gap: ${sm ? '0.5mm' : '1mm'}; flex: 1; min-width: 0;
      text-align: ${settings.nameAlign};
      word-break: break-word; overflow-wrap: break-word;
    }
    .label-name-primary {
      font-weight: bold; line-height: 1.2; color: #111;
      font-size: ${d.namePt}pt;
    }
    .label-name-tr {
      font-weight: normal; line-height: 1.2; color: #555;
      font-style: italic; font-size: ${Math.round(d.namePt * 0.8)}pt;
    }
    .price { font-size: 0.7em; color: #555; white-space: nowrap; }
    .label-desc {
      color: #444; font-style: italic; line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: ${sm ? 2 : 3};
      -webkit-box-orient: vertical; overflow: hidden;
      font-size: ${Math.round(d.descPt * (settings.descSizeScale ?? 1))}pt;
      ${settings.showQr ? `padding-right: ${(settings.qrSizeMm ?? 35) + 4}mm;` : ''}
    }
    .tags { font-size: ${sm ? '6pt' : '8pt'}; color: #555; font-family: Arial, sans-serif; margin-top: auto; ${settings.showQr ? `padding-right: ${(settings.qrSizeMm ?? 35) + 4}mm;` : ''} }
  `
}

function labelHtml(item: MenuItem, recipe: Recipe | undefined, settings: LabelSettings, d: Dims, qrDataUrl?: string): string {
  const allergenBadges = settings.showAllergens && recipe?.allergens?.length
    ? recipe.allergens.map((a) => allergenBadgeHtml(a, d.w <= 100, settings.allergenLang, settings.allergenIconSet === 'custom', settings.allergenSize)).join('')
    : ''

  const tags = settings.showTags && item.tags?.length
    ? `<div class="tags">${item.tags.map((t) => TAG_SYMBOL[t] ?? t).join('  ')}</div>`
    : ''

  const desc  = settings.showDescription ? itemDesc(item, settings.language, recipe) : null
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

  const qrEl = settings.showQr && qrDataUrl
    ? (() => {
        const msgEl = settings.qrLabel
          ? `<div class="label-qr-msg">${settings.qrLabel}</div>`
          : ''
        return `<div class="label-qr-wrap">
  ${settings.qrLabelPos === 'above' ? msgEl : ''}
  <img src="${qrDataUrl}" class="label-qr" alt="" />
  ${settings.qrLabelPos !== 'above' ? msgEl : ''}
</div>`
      })()
    : ''

  const nameHtml = settings.language === 'both'
    ? (() => {
        type LK = 'source' | 'en' | 'bg'
        const keys = (settings.langBothLines?.length ? settings.langBothLines : ['en', 'source']) as LK[]
        const lines = keys
          .map((k) => ({
            k,
            text: k === 'source' ? item.name : k === 'en' ? (item.name_el ?? recipe?.name_el ?? null) : (item.name_bg ?? recipe?.name_bg ?? null),
          }))
          .filter((l): l is { k: LK; text: string } => !!l.text)
        if (lines.length === 0) lines.push({ k: 'source', text: item.name })
        const defaultStyles: LabelSettings['langStyles'] = {
          source: { bold: true,  italic: false, sizeScale: 1.0 },
          en:     { bold: true,  italic: false, sizeScale: 1.0 },
          bg:     { bold: false, italic: true,  sizeScale: 0.8 },
        }
        const stylesMap = settings.langStyles ?? defaultStyles
        return `<div class="label-name-both">
  <div class="label-name-lines">
    ${lines.map((l) => {
      const st = stylesMap[l.k] ?? defaultStyles[l.k]
      const fw  = st.bold   ? 'bold'   : 'normal'
      const fs  = st.italic ? 'italic' : 'normal'
      const sz  = Math.round(d.namePt * st.sizeScale)
      const col = '#111'
      return `<div style="font-weight:${fw};font-style:${fs};font-size:${sz}pt;line-height:1.2;color:${col}">${l.text}</div>`
    }).join('')}
  </div>
  ${price}
</div>`
      })()
    : `<div class="label-name">${itemName(item, settings.language, recipe)}${price}</div>`

  return `
<div class="label" style="width:${d.w}mm;height:${d.h}mm">
  ${headerHtml}
  ${nameHtml}
  ${desc ? `<div class="label-desc">${desc}</div>` : ''}
  ${tags}
  ${qrEl}
</div>`
}

export function buildPreviewHtml(item: MenuItem, recipe: Recipe | undefined, settings: LabelSettings, qrDataUrl?: string): string {
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
  ${labelHtml(item, recipe, settings, d, qrDataUrl)}
</body>
</html>`
}

export function printLabels(items: MenuItem[], menu: Menu, recipes: Recipe[], settings: LabelSettings, qrMap?: Map<string, string>): void {
  const d = getDims(settings)
  const recipeMap = new Map(recipes.map((r) => [r.id, r]))
  const labelsHtml = items
    .map((item) => labelHtml(item, item.recipe_id ? recipeMap.get(item.recipe_id) : undefined, settings, d, qrMap?.get(item.id)))
    .join('\n')

  // Collect all unique allergen keys present in selected items
  const presentKeys = [...new Set(
    items.flatMap((item) => {
      const recipe = item.recipe_id ? recipeMap.get(item.recipe_id) : undefined
      return recipe?.allergens ?? []
    })
  )]

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${menu.name} — Labels</title>
  <style>
    ${labelCss(settings, d)}
    @page { size: A4; margin: 10mm }
    .grid { display: grid; grid-template-columns: repeat(${settings.labelsPerRow ?? 3}, 1fr); gap: 5mm }
    .label { width: 100% !important; height: auto !important; min-height: ${d.h}mm; }
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

  if (settings.showAllergenLegend) {
    // Open legend in a second tab that auto-prints after labels
    const legendWin = window.open('', '_blank', 'width=900,height=700')
    if (legendWin) {
      legendWin.document.write(buildAllergenLegendHtml(settings.allergenLang, presentKeys, settings.allergenIconSet === 'custom'))
      legendWin.document.close()
      legendWin.focus()
      setTimeout(() => legendWin.print(), 500)
    }
  }

  win.focus()
  setTimeout(() => win.print(), 400)
}
