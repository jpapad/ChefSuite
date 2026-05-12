import * as XLSX from 'xlsx'
import { supabase } from './supabase'

// Loaded once, lazily, the first time parseExcelFile is called
let cptableLoaded = false
async function ensureCptable() {
  if (cptableLoaded) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await (import(/* @vite-ignore */ 'xlsx/dist/cpexcel.full.mjs' as string) as Promise<any>)
    // xlsx only needs cptable.utils.decode/encode/hascp — extract it regardless of how
    // Vite wraps the module (named export → mod.utils, default-wrapped → mod.default.utils)
    const utils = mod.utils ?? mod.default?.utils
    if (utils?.decode) {
      XLSX.set_cptable({ utils })
      cptableLoaded = true
    }
  } catch {
    // Codepage loading failed — .xls files with non-ASCII will show "?"
    // but the app will continue to work normally
  }
}

export interface ColumnMapping {
  name: string | null
  description: string | null
  category: string | null
  price: string | null
  allergens: string | null
  ingredients: string | null
}

export interface ExcelMenuRow {
  name: string
  description: string | null
  category: string | null
  price: number | null
  allergens: string[]
  ingredients: string | null
  difficulty: string | null
  prep_time: number | null
  cook_time: number | null
  servings: number | null
  instructions: string | null
}

export interface ParsedExcelData {
  headers: string[]
  rows: Record<string, string>[]
  sheetName: string
  sheetNames: string[]
}

export async function parseExcelFile(file: File, targetSheet?: string): Promise<ParsedExcelData> {
  await ensureCptable()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetNames = workbook.SheetNames
        const sheetName =
          targetSheet && sheetNames.includes(targetSheet) ? targetSheet : sheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        // Normalise all values to strings
        const rows = jsonData.map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k), String(v ?? '')]))
        )
        const headers = rows.length > 0 ? Object.keys(rows[0]) : []
        resolve({ headers, rows, sheetName, sheetNames })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export async function suggestColumnMapping(
  headers: string[],
  sampleRows: Record<string, string>[],
): Promise<ColumnMapping> {
  const headerLine = headers.join(' | ')
  const sampleLines = sampleRows
    .slice(0, 3)
    .map((r) => headers.map((h) => r[h] ?? '').join(' | '))
    .join('\n')

  const prompt = `You are analyzing a restaurant menu Excel file. Here are the column headers and first rows:

Headers: ${headerLine}
${sampleLines}

Identify which column header corresponds to each field below. Return ONLY a valid JSON object — no markdown, no explanation:
{
  "name": "exact header string for dish name, or null",
  "description": "exact header string for dish description, or null",
  "category": "exact header string for section/category, or null",
  "price": "exact header string for price, or null",
  "allergens": "exact header string for allergens, or null",
  "ingredients": "exact header string for ingredients list, or null"
}

Use null when no column clearly matches. Use the EXACT header string.`

  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      },
    })
    if (error) throw error

    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    const validKey = (k: unknown): string | null => {
      if (typeof k === 'string' && headers.includes(k)) return k
      return null
    }

    return {
      name: validKey(parsed.name),
      description: validKey(parsed.description),
      category: validKey(parsed.category),
      price: validKey(parsed.price),
      allergens: validKey(parsed.allergens),
      ingredients: validKey(parsed.ingredients),
    }
  } catch {
    // Fallback: first column as name
    return {
      name: headers[0] ?? null,
      description: null,
      category: null,
      price: null,
      allergens: null,
      ingredients: null,
    }
  }
}

// Strip diacritics so "ΓΛΟΥΤΕΝΗ" / "Γλουτένη" / "γλουτενη" all normalise to "γλουτενη"
function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// EU regulation numeric codes 1-14
const ALLERGEN_NUMERIC: Record<string, string> = {
  '1': 'gluten', '2': 'shellfish', '3': 'eggs', '4': 'fish', '5': 'peanuts',
  '6': 'soy', '7': 'dairy', '8': 'nuts', '9': 'celery', '10': 'mustard',
  '11': 'sesame', '12': 'sulphites', '13': 'lupin', '14': 'molluscs',
}

// Keys are already deaccented & lowercase
const ALLERGEN_ALIASES: Record<string, string> = {
  // English
  gluten: 'gluten', wheat: 'gluten', glouten: 'gluten',
  dairy: 'dairy', milk: 'dairy', lactose: 'dairy', lactos: 'dairy',
  eggs: 'eggs', egg: 'eggs',
  fish: 'fish',
  shellfish: 'shellfish', crustacean: 'shellfish', crustaceans: 'shellfish',
  nuts: 'nuts', treenuts: 'nuts',
  peanuts: 'peanuts', peanut: 'peanuts', arachis: 'peanuts',
  soy: 'soy', soya: 'soy', soybeans: 'soy',
  sesame: 'sesame',
  celery: 'celery',
  mustard: 'mustard',
  sulphites: 'sulphites', sulfites: 'sulphites', sulphite: 'sulphites', sulfite: 'sulphites',
  lupin: 'lupin', lupine: 'lupin',
  molluscs: 'molluscs', mollusks: 'molluscs',
  // Greek (deaccented)
  γλουτενη: 'gluten', σιταρι: 'gluten',
  γαλακτοκομικα: 'dairy', γαλα: 'dairy',
  αυγα: 'eggs', αυγο: 'eggs',
  ψαρι: 'fish', ψαρια: 'fish',
  οστρακοειδη: 'shellfish', καρκινοειδη: 'shellfish', οστρακα: 'shellfish',
  ξηροικαρποι: 'nuts', καρυδια: 'nuts', ξηροι: 'nuts',
  φιστικια: 'peanuts', αραχιδα: 'peanuts',
  σογια: 'soy',
  σησαμι: 'sesame',
  σελινο: 'celery',
  μουσταρδα: 'mustard',
  θειωδη: 'sulphites', θειικα: 'sulphites',
  λουπινο: 'lupin',
  μαλακια: 'molluscs',
  // Extended dietary indicators
  vegan: 'vegan', χορτοφαγος: 'vegan', ολικηχορτοφαγια: 'vegan',
  vegetarian: 'vegetarian', χορτοφαγικο: 'vegetarian', χορτοφαγικη: 'vegetarian',
  local: 'local', τοπικο: 'local', τοπικοπιατο: 'local', τοπικη: 'local',
  spicy: 'spicy', καυτερο: 'spicy', καυτερη: 'spicy', πικαντικο: 'spicy', hot: 'spicy',
  nolactose: 'no_lactose', lactosefree: 'no_lactose', χωρισλακτοζη: 'no_lactose',
  χωρισγαλα: 'no_lactose', nomilk: 'no_lactose', dairyfree: 'no_lactose',
  'no_lactose': 'no_lactose',
}

export const ALLERGEN_KEYS = [
  'gluten','dairy','eggs','fish','shellfish','nuts','peanuts',
  'soy','sesame','celery','mustard','sulphites','lupin','molluscs',
  // extended dietary indicators (have custom PNG icons)
  'vegan','vegetarian','local','no_lactose','spicy',
] as const

export const ALLERGEN_LABEL_EL: Record<string, string> = {
  gluten: 'Γλουτένη', dairy: 'Γαλακτοκομικά', eggs: 'Αυγά', fish: 'Ψάρι',
  shellfish: 'Οστρακοειδή', nuts: 'Ξηροί Καρποί', peanuts: 'Φιστίκια',
  soy: 'Σόγια', sesame: 'Σησάμι', celery: 'Σέλινο', mustard: 'Μουστάρδα',
  sulphites: 'Θειώδη', lupin: 'Λούπινο', molluscs: 'Μαλάκια',
  vegan: 'Vegan', vegetarian: 'Χορτοφαγικό', local: 'Τοπικό Πιάτο',
  no_lactose: 'Χωρίς Λακτόζη', spicy: 'Καυτερό',
}

// Returns the canonical allergen key for a raw token, or null if unrecognised
export function resolveAllergenToken(s: string): string | null {
  const num = ALLERGEN_NUMERIC[s.trim()]
  if (num) return num
  const norm = deaccent(s)
  const direct = ALLERGEN_ALIASES[norm]
  if (direct) return direct
  const match = Object.entries(ALLERGEN_ALIASES).find(([alias]) => norm.includes(alias) || alias.includes(norm))
  return match ? match[1] : null
}

// Extract every unique raw token from the allergen column
export function collectAllergenTokens(
  rows: Record<string, string>[],
  allergenColumn: string | null,
): string[] {
  if (!allergenColumn) return []
  const tokens = new Set<string>()
  for (const row of rows) {
    const raw = (row[allergenColumn] ?? '').trim()
    if (!raw) continue
    raw.split(/[,;/|·•\n]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => tokens.add(s))
  }
  return Array.from(tokens).sort()
}

function parseAllergens(raw: string, customMap: Record<string, string> = {}): string[] {
  if (!raw.trim()) return []
  return raw
    .split(/[,;/|·•\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => {
      // User-defined mapping takes priority
      const custom = customMap[s]
      if (custom === '') return []   // explicitly skipped
      if (custom) return [custom]

      // EU numeric code
      const resolved = resolveAllergenToken(s)
      if (resolved) return [resolved]
      return []
    })
    .filter((v, i, arr) => arr.indexOf(v) === i)
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[€$£\s]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  customAllergenMap: Record<string, string> = {},
): ExcelMenuRow[] {
  return rows
    .map((row) => ({
      name: (mapping.name ? row[mapping.name] ?? '' : '').trim(),
      description: mapping.description ? (row[mapping.description] ?? '').trim() || null : null,
      category: mapping.category ? (row[mapping.category] ?? '').trim() || null : null,
      price: mapping.price ? parsePrice(row[mapping.price] ?? '') : null,
      allergens: mapping.allergens ? parseAllergens(row[mapping.allergens] ?? '', customAllergenMap) : [],
      ingredients: mapping.ingredients ? (row[mapping.ingredients] ?? '').trim() || null : null,
      difficulty: null,
      prep_time: null,
      cook_time: null,
      servings: null,
      instructions: null,
    }))
    .filter((r) => r.name)
}
