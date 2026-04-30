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

// ── AI Menu Generator ────────────────────────────────────────────────────────

export interface AIMenuSection {
  name: string
  items: AIMenuItem[]
}

export interface AIMenuItem {
  name: string
  description: string | null
  price: number | null
  recipe: {
    title: string
    description: string | null
    instructions: string | null
    allergens: string[]
    prep_time: number | null
    cook_time: number | null
    servings: number
  } | null
}

export interface AIGeneratedMenu {
  name: string
  description: string | null
  sections: AIMenuSection[]
}

export async function generateMenuFromPrompt(
  prompt: string,
  menuType: string,
  covers: number,
): Promise<AIGeneratedMenu> {
  const typeHint: Record<string, string> = {
    a_la_carte: 'à la carte restaurant menu with individual dishes and prices',
    buffet: 'buffet menu with multiple dishes per section, no individual prices',
    tasting: 'tasting / degustation menu with 5-7 small courses',
    daily: 'daily specials menu with a few focused dishes',
  }

  const p = `You are an expert chef and menu designer.

Create a complete ${typeHint[menuType] ?? 'restaurant menu'} based on the following brief:

"${prompt}"

Covers / guests: ${covers}

Return ONLY a valid JSON object with this exact structure:
{
  "name": "menu name",
  "description": "1-2 sentence menu description or null",
  "sections": [
    {
      "name": "section name (e.g. Appetizers, Mains, Desserts)",
      "items": [
        {
          "name": "dish name",
          "description": "1 sentence dish description or null",
          "price": number or null,
          "recipe": {
            "title": "recipe title",
            "description": "recipe description or null",
            "instructions": "numbered step-by-step instructions, one step per line",
            "allergens": ["gluten","dairy","eggs","fish","shellfish","nuts","peanuts","soy","sesame","celery","mustard","sulphites","lupin","molluscs"],
            "prep_time": minutes as integer or null,
            "cook_time": minutes as integer or null,
            "servings": integer (portions per recipe)
          }
        }
      ]
    }
  ]
}

Rules:
- 3-5 sections appropriate for the menu type
- 3-6 items per section
- Include only allergens actually present in each dish
- Instructions should be clear, professional, numbered steps
- Prices in EUR, realistic for the cuisine style (null for buffet)
- Do NOT include markdown or any text outside the JSON`

  const raw = await callGemini(p)
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch {
    throw new Error('AI returned an invalid menu structure. Please try again.')
  }
  if (typeof parsed !== 'object' || parsed === null || !('sections' in parsed)) {
    throw new Error('AI did not return a valid menu.')
  }
  return parsed as AIGeneratedMenu
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

// ── Nutrition Estimator ────────────────────────────────────────────────────────

export interface NutritionInfo {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sodium_mg: number
}

export async function estimateNutrition(
  recipeTitle: string,
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
  servings: number,
): Promise<NutritionInfo> {
  const ingBlock = ingredients.length > 0
    ? ingredients.map((i) => `- ${i.quantity} ${i.unit} ${i.name}`).join('\n')
    : '(no ingredient data)'

  const prompt = `You are a professional nutritionist. Estimate the nutritional values per serving for this recipe.

RECIPE: ${recipeTitle}
SERVINGS: ${servings}
INGREDIENTS (total for all servings):
${ingBlock}

Return ONLY a valid JSON object with these fields (all numbers, per serving):
{
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "sodium_mg": number
}

Rules:
- All values are per serving (divide totals by ${servings})
- Round to 1 decimal place
- Estimate based on typical preparation methods
- Do NOT include markdown, explanation, or any text outside the JSON`

  const raw = await callGemini(prompt)
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch {
    throw new Error('Could not parse nutrition data from AI response.')
  }
  const o = parsed as Record<string, unknown>
  return {
    calories:   typeof o.calories   === 'number' ? o.calories   : 0,
    protein_g:  typeof o.protein_g  === 'number' ? o.protein_g  : 0,
    carbs_g:    typeof o.carbs_g    === 'number' ? o.carbs_g    : 0,
    fat_g:      typeof o.fat_g      === 'number' ? o.fat_g      : 0,
    fiber_g:    typeof o.fiber_g    === 'number' ? o.fiber_g    : 0,
    sodium_mg:  typeof o.sodium_mg  === 'number' ? o.sodium_mg  : 0,
  }
}

// ── Chef Copilot ───────────────────────────────────────────────────────────────

export interface CopilotMessage {
  role: 'user' | 'model'
  text: string
}

export async function chatWithCopilot(
  messages: CopilotMessage[],
  context: string,
): Promise<string> {
  if (!API_KEY) throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env.local file.')

  const systemTurn = {
    role: 'user',
    parts: [{ text: `You are Chef Copilot, an expert culinary AI assistant embedded in ChefSuite — a professional kitchen management app.

Current kitchen data:
${context}

Answer questions about recipes, ingredients, costs, prep tasks, menu planning, and general culinary advice. Be concise and professional. When citing specific data from the kitchen, refer to it naturally (e.g. "your Beef Bourguignon recipe").` }],
  }

  const historyTurns = messages.slice(0, -1).flatMap((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }))

  const lastMsg = messages[messages.length - 1]

  const body = {
    system_instruction: systemTurn,
    contents: [
      ...historyTurns,
      { role: 'user', parts: [{ text: lastMsg.text }] },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  }

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as GeminiResponse
  if (json.error) throw new Error(json.error.message)
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

// ── URL import helpers ─────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractSchemaRecipe(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]) as unknown
      const items: unknown[] = Array.isArray((data as Record<string, unknown>)['@graph'])
        ? ((data as Record<string, unknown>)['@graph'] as unknown[])
        : [data]
      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue
        const type = (item as Record<string, unknown>)['@type']
        if (type === 'Recipe' || (Array.isArray(type) && (type as string[]).includes('Recipe'))) {
          return item as Record<string, unknown>
        }
      }
    } catch { /* malformed JSON-LD — skip */ }
  }
  return null
}

function schemaToImportedRecipe(schema: Record<string, unknown>): ImportedRecipe {
  const title = typeof schema.name === 'string' ? schema.name : ''
  const description = typeof schema.description === 'string' ? schema.description : null

  let instructions = ''
  if (typeof schema.recipeInstructions === 'string') {
    instructions = schema.recipeInstructions
  } else if (Array.isArray(schema.recipeInstructions)) {
    instructions = (schema.recipeInstructions as unknown[])
      .map((step, i) => {
        const text = typeof step === 'string' ? step
          : (typeof step === 'object' && step !== null && typeof (step as Record<string, unknown>).text === 'string')
            ? (step as Record<string, unknown>).text as string
            : ''
        return text ? `${i + 1}. ${text}` : ''
      })
      .filter(Boolean)
      .join('\n')
  }

  const rawIngredients = Array.isArray(schema.recipeIngredient)
    ? (schema.recipeIngredient as unknown[]).filter((s): s is string => typeof s === 'string')
    : []

  const extractedIngredients: ExtractedIngredient[] = rawIngredients.map((line) => {
    const parsed = parseIngredientsList(line)
    return parsed.length > 0 ? parsed[0] : { name: line, quantity: 0, unit: 'pcs' }
  })

  return {
    title,
    description,
    instructions: instructions || null,
    allergens: [],
    cost_per_portion: null,
    ingredients: [],
    extractedIngredients,
  }
}

async function fetchHtmlViaProxy(url: string): Promise<string> {
  const encoded = encodeURIComponent(url)
  const timeout = 12000

  // Primary: corsproxy.io — returns raw HTML with CORS headers
  try {
    const res = await fetch(`https://corsproxy.io/?${encoded}`, {
      signal: AbortSignal.timeout(timeout),
    })
    if (res.ok) {
      const html = await res.text()
      if (html.trim()) return html
    }
  } catch { /* fall through to next proxy */ }

  // Fallback: allorigins.win — wraps response in JSON
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encoded}`, {
      signal: AbortSignal.timeout(timeout),
    })
    if (res.ok) {
      const json = (await res.json()) as { contents?: string }
      const html = json.contents ?? ''
      if (html.trim()) return html
    }
  } catch { /* fall through */ }

  throw new Error('Could not fetch the URL. The site may block scrapers — try copying the recipe text instead.')
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const html = await fetchHtmlViaProxy(url)

  // Prefer structured JSON-LD data (no AI tokens needed)
  const schema = extractSchemaRecipe(html)
  if (schema) return schemaToImportedRecipe(schema)

  // Fall back: strip tags → Gemini
  const text = htmlToText(html).slice(0, 8000)
  if (!text.trim()) throw new Error('Could not extract readable text from the page.')
  return importRecipeFromText(text)
}
