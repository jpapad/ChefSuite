import type { RecipeFormValues } from '../components/recipes/RecipeForm'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const MODEL = 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const SYSTEM_PROMPT = `You are a recipe parser. Extract recipe information from the provided text and return ONLY a valid JSON object with these fields:
- title: string (required)
- description: string or null (short 1-2 sentence summary)
- instructions: string or null (full step-by-step, preserve line breaks)
- allergens: string[] (e.g. ["gluten", "dairy", "eggs", "nuts"] — use common English allergen names, lowercase)
- cost_per_portion: number or null (only if explicitly mentioned)
- ingredients: array of {name: string, quantity: number, unit: string} (extract all ingredients with their amounts; normalize units to: g, kg, ml, l, tsp, tbsp, cup, pcs)

Return ONLY the JSON object, no markdown, no explanation.`

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: { message: string }
}

export interface ExtractedIngredient {
  name: string
  quantity: number
  unit: string
}

export type ImportedRecipe = Pick<
  RecipeFormValues,
  'title' | 'description' | 'instructions' | 'allergens' | 'cost_per_portion' | 'ingredients'
> & {
  extractedIngredients: ExtractedIngredient[]
}

async function callGemini(prompt: string): Promise<string> {
  if (!API_KEY) throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env.local file.')
  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  })
  const json = (await res.json()) as GeminiResponse
  if (json.error) throw new Error(json.error.message)
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
}

// Known unit aliases → normalised form
const UNIT_MAP: Record<string, string> = {
  g: 'g', gr: 'g', γρ: 'g', γραμ: 'g', gram: 'g', grams: 'g',
  kg: 'kg', κιλο: 'kg', κιλό: 'kg', kilo: 'kg',
  ml: 'ml', μλ: 'ml',
  l: 'l', lt: 'l', λτ: 'l', liter: 'l', litre: 'l',
  dl: 'dl', cl: 'cl',
  tsp: 'tsp', 'κ.γ': 'tsp', κγ: 'tsp',
  tbsp: 'tbsp', 'κ.σ': 'tbsp', κσ: 'tbsp',
  cup: 'cup', φλ: 'cup', φλιτζ: 'cup',
  pcs: 'pcs', pc: 'pcs', τεμ: 'pcs', τεμάχια: 'pcs', τεμαχια: 'pcs',
  piece: 'pcs', pieces: 'pcs',
}

export function parseIngredientsList(text: string): ExtractedIngredient[] {
  return text
    .split(/\r?\n|[,;]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      // Try "qty unit name" first (most common)
      const fwd = /^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*([a-zα-ωάέήίόύώϊϋΐΰ]+\.?)?\s+(.+)$/i.exec(line)
      if (fwd) {
        const rawQty = fwd[1].replace(',', '.').replace(/\s/g, '')
        const qty = rawQty.includes('/') ? evalFraction(rawQty) : parseFloat(rawQty)
        const rawUnit = (fwd[2] ?? '').toLowerCase().replace('.', '')
        const unit = UNIT_MAP[rawUnit] ?? (rawUnit || 'pcs')
        const name = fwd[3].trim()
        if (qty > 0 && name) return [{ name, quantity: qty, unit }]
      }
      // Try "name qty unit" (reversed)
      const rev = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zα-ωάέήίόύώϊϋΐΰ]+\.?)$/i.exec(line)
      if (rev) {
        const name = rev[1].trim()
        const qty = parseFloat(rev[2].replace(',', '.'))
        const rawUnit = rev[3].toLowerCase().replace('.', '')
        const unit = UNIT_MAP[rawUnit] ?? rawUnit
        if (qty > 0 && name) return [{ name, quantity: qty, unit }]
      }
      // No quantity found — name only
      const name = line.trim()
      if (name) return [{ name, quantity: 0, unit: '' }]
      return []
    })
}

function evalFraction(s: string): number {
  const [num, den] = s.split('/').map(Number)
  return den ? num / den : num
}

export interface PrepStationTask {
  station: string
  title: string
  description: string
  workstation_id: string | null
}

export async function generatePrepBreakdown(
  recipe: { title: string; instructions: string | null },
  scaledIngredients: Array<{ name: string; quantity: number; unit: string }>,
  workstationNames: string[],
  covers: number,
): Promise<PrepStationTask[]> {
  const stationBlock = workstationNames.length > 0
    ? `Available kitchen stations — use EXACTLY these names, no others:\n${workstationNames.map((n) => `- ${n}`).join('\n')}`
    : `Use standard professional kitchen station names (e.g. "Prep", "Hot Station", "Sauce", "Pastry", "Assembly", "Cold Station").`

  const ingBlock = scaledIngredients.length > 0
    ? scaledIngredients.map((i) => `- ${i.quantity % 1 === 0 ? i.quantity : i.quantity.toFixed(2)} ${i.unit} ${i.name}`).join('\n')
    : '(no ingredients listed)'

  const prompt = `You are a professional kitchen operations manager.

Break down the preparation of the recipe below into specific tasks per kitchen station.
Scale all quantities for exactly ${covers} covers.

RECIPE: ${recipe.title}
COVERS: ${covers}

INGREDIENTS (already scaled for ${covers} covers):
${ingBlock}

PREPARATION STEPS:
${recipe.instructions ?? '(no instructions provided)'}

${stationBlock}

Return ONLY a valid JSON array. Each element:
{
  "station": "exact station name",
  "title": "brief task title, max 8 words",
  "description": "detailed task description: include exact quantities, specific cutting techniques (e.g. 5mm rounds), temperatures, timing. Be precise and actionable. One paragraph."
}

Rules:
- Only include stations that have actual work to do for this recipe.
- Quantities in descriptions must be scaled for ${covers} covers.
- Do NOT include markdown, explanation, or any text outside the JSON array.`

  const raw = await callGemini(prompt)

  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(parsed)) return []

  return (parsed as unknown[]).flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const o = item as Record<string, unknown>
    if (typeof o.station !== 'string' || typeof o.title !== 'string') return []
    return [{
      station: o.station,
      title: String(o.title),
      description: typeof o.description === 'string' ? o.description : '',
      workstation_id: null,
    }]
  })
}

export async function importRecipeFromText(text: string): Promise<ImportedRecipe> {
  const cleaned = await callGemini(`${SYSTEM_PROMPT}\n\nRecipe text:\n${text}`)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Could not parse recipe from AI response. Try pasting more complete recipe text.')
  }

  if (typeof parsed !== 'object' || parsed === null || !('title' in parsed)) {
    throw new Error('AI did not return a valid recipe structure.')
  }

  const obj = parsed as Record<string, unknown>

  const extractedIngredients: ExtractedIngredient[] = Array.isArray(obj.ingredients)
    ? (obj.ingredients as unknown[]).filter(
        (i): i is ExtractedIngredient =>
          typeof i === 'object' &&
          i !== null &&
          typeof (i as Record<string, unknown>).name === 'string' &&
          typeof (i as Record<string, unknown>).quantity === 'number' &&
          typeof (i as Record<string, unknown>).unit === 'string',
      )
    : []

  return {
    title: typeof obj.title === 'string' ? obj.title : '',
    description: typeof obj.description === 'string' ? obj.description : null,
    instructions: typeof obj.instructions === 'string' ? obj.instructions : null,
    allergens: Array.isArray(obj.allergens)
      ? (obj.allergens as unknown[]).filter((a): a is string => typeof a === 'string')
      : [],
    cost_per_portion: typeof obj.cost_per_portion === 'number' ? obj.cost_per_portion : null,
    ingredients: [],
    extractedIngredients,
  }
}
