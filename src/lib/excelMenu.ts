import * as XLSX from 'xlsx'
// @ts-ignore — no type declarations for this internal xlsx dist file
import * as cptable from 'xlsx/dist/cpexcel.full.mjs'
import { supabase } from './supabase'

// Enable full codepage support for .xls files with Greek, Cyrillic, etc. (Windows-1253, Windows-1251, …)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
XLSX.set_cptable(cptable as any)

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
}

export interface ParsedExcelData {
  headers: string[]
  rows: Record<string, string>[]
  sheetName: string
  sheetNames: string[]
}

export async function parseExcelFile(file: File, targetSheet?: string): Promise<ParsedExcelData> {
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

const ALLERGEN_ALIASES: Record<string, string> = {
  gluten: 'gluten', γλουτένη: 'gluten', glouten: 'gluten',
  dairy: 'dairy', γαλακτοκομικά: 'dairy', milk: 'dairy', γάλα: 'dairy', lactos: 'dairy',
  eggs: 'eggs', αυγά: 'eggs', αυγό: 'eggs', egg: 'eggs',
  fish: 'fish', ψάρι: 'fish', ψαρι: 'fish',
  shellfish: 'shellfish', οστρακοειδή: 'shellfish', οστρακοειδη: 'shellfish',
  nuts: 'nuts', ξηροί: 'nuts', καρποί: 'nuts', καρπους: 'nuts', καρύδια: 'nuts',
  peanuts: 'peanuts', φιστίκια: 'peanuts', φιστικια: 'peanuts',
  soy: 'soy', σόγια: 'soy', σογια: 'soy',
  sesame: 'sesame', σησάμι: 'sesame', σησαμι: 'sesame',
  celery: 'celery', σέλινο: 'celery', σελινο: 'celery',
  mustard: 'mustard', μουστάρδα: 'mustard', μουσταρδα: 'mustard',
  sulphites: 'sulphites', sulfites: 'sulphites', θειώδη: 'sulphites', θειωδη: 'sulphites',
  lupin: 'lupin', λούπινο: 'lupin', λουπινο: 'lupin',
  molluscs: 'molluscs', μαλάκια: 'molluscs', μαλακια: 'molluscs',
}

const KNOWN_ALLERGENS = Object.values(ALLERGEN_ALIASES).filter((v, i, a) => a.indexOf(v) === i)

function parseAllergens(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(/[,;/|·•\n]/)
    .map((s) => s.trim().toLowerCase())
    .flatMap((s) => {
      const direct = ALLERGEN_ALIASES[s]
      if (direct) return [direct]
      // Substring match
      return KNOWN_ALLERGENS.filter((a) => s.includes(a) || (ALLERGEN_ALIASES[s] === a))
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
): ExcelMenuRow[] {
  return rows
    .map((row) => ({
      name: (mapping.name ? row[mapping.name] ?? '' : '').trim(),
      description: mapping.description ? (row[mapping.description] ?? '').trim() || null : null,
      category: mapping.category ? (row[mapping.category] ?? '').trim() || null : null,
      price: mapping.price ? parsePrice(row[mapping.price] ?? '') : null,
      allergens: mapping.allergens ? parseAllergens(row[mapping.allergens] ?? '') : [],
      ingredients: mapping.ingredients ? (row[mapping.ingredients] ?? '').trim() || null : null,
    }))
    .filter((r) => r.name)
}
