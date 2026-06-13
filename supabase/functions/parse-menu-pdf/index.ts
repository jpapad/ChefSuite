const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `You are a restaurant menu analyser. Extract every dish/item from this menu.

Return ONLY a JSON array — no markdown, no explanation, no other text.

Format:
[
  {
    "name": string,
    "category": string or null,
    "description": string or null,
    "price": number or null,
    "allergens": string[],
    "ingredients": [
      { "name": string, "quantity": number or null, "unit": string or null }
    ]
  }
]

Rules:
- name: dish name, required
- category: section of the menu (e.g. "Starters", "Main Course", "Desserts", "Drinks") — infer from menu structure
- description: short description if available on the menu, otherwise null
- price: numeric price if shown, null otherwise
- allergens: array of any that apply from: gluten, dairy, eggs, nuts, peanuts, soy, fish, shellfish, sesame, celery, mustard, sulphites, lupin, molluscs
- ingredients: list every ingredient that can be inferred from the dish name/description; quantity and unit can be null if not specified
- Include EVERY dish on the menu, nothing skipped
- Return ONLY the JSON array, nothing else`

interface DishIngredient {
  name: string
  quantity: number | null
  unit: string | null
}

interface Dish {
  name: string
  category: string | null
  description: string | null
  price: number | null
  allergens: string[]
  ingredients: DishIngredient[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_base64, media_type } = await req.json() as {
      file_base64: string
      media_type: string
    }

    if (!file_base64) throw new Error('No file provided')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret not set')

    const isPdf = media_type === 'application/pdf'

    const contentSource = isPdf
      ? { type: 'base64' as const, media_type: 'application/pdf' as const, data: file_base64 }
      : { type: 'base64' as const, media_type: (media_type || 'image/jpeg') as 'image/jpeg', data: file_base64 }

    const contentBlock = isPdf
      ? { type: 'document', source: contentSource }
      : { type: 'image', source: contentSource }

    const body = {
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: PROMPT }],
        },
      ],
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${errText}`)
    }

    const result = await response.json() as {
      content: Array<{ type: string; text?: string }>
    }

    const text = result.content?.[0]?.type === 'text' ? (result.content[0].text ?? '') : ''

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found in Claude response')

    const dishes = JSON.parse(jsonMatch[0]) as Dish[]

    if (!Array.isArray(dishes)) throw new Error('Response was not a JSON array')

    // Sanitise
    const sanitised = dishes
      .filter((d) => d.name)
      .map((d) => ({
        name: d.name,
        category: d.category ?? null,
        description: d.description ?? null,
        price: typeof d.price === 'number' ? d.price : null,
        allergens: Array.isArray(d.allergens) ? d.allergens : [],
        ingredients: Array.isArray(d.ingredients)
          ? d.ingredients.filter((i) => i.name)
          : [],
      }))

    return new Response(JSON.stringify({ dishes: sanitised, count: sanitised.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[parse-menu-pdf] error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
