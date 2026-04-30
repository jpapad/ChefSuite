const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `You are a recipe data extractor for a restaurant management system.
Analyse this image or document and return ONLY a JSON object — no other text, no markdown, no explanation.

Required format:
{
  "title": string,
  "description": string or null,
  "instructions": string or null,
  "allergens": string[],
  "ingredients": [
    {
      "name": string,
      "quantity": number,
      "unit": string
    }
  ]
}

Rules:
- title: the recipe name, required
- description: a short one or two sentence description of the dish
- instructions: full cooking steps as a single string, separated by newlines
- allergens: array of any that apply: gluten, dairy, eggs, nuts, peanuts, soy, fish, shellfish, sesame, celery, mustard, sulphites, lupin, molluscs
- ingredients: list every ingredient with a positive quantity and a unit (g, kg, ml, l, tsp, tbsp, cup, pcs, etc.)
- If a value cannot be determined, use null for strings or [] for arrays
- Return ONLY the JSON object, nothing else`

interface RecipeIngredient {
  name: string
  quantity: number
  unit: string
}

interface RecipeData {
  title: string
  description: string | null
  instructions: string | null
  allergens: string[]
  ingredients: RecipeIngredient[]
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

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret not set')

    const isPdf = media_type === 'application/pdf'

    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const contentSource = isPdf
      ? { type: 'base64' as const, media_type: 'application/pdf' as const, data: file_base64 }
      : { type: 'base64' as const, media_type: (media_type || 'image/jpeg') as ImageMediaType, data: file_base64 }

    const contentBlock = isPdf
      ? { type: 'document', source: contentSource }
      : { type: 'image', source: contentSource }

    const body = {
      model: 'claude-opus-4-7',
      max_tokens: 4096,
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

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in Claude response')

    const data = JSON.parse(jsonMatch[0]) as RecipeData

    if (!data.title) throw new Error('Could not extract recipe title from image')
    if (!Array.isArray(data.ingredients)) data.ingredients = []
    if (!Array.isArray(data.allergens)) data.allergens = []
    data.ingredients = data.ingredients.filter((i) => i.name && i.quantity > 0)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[parse-recipe] error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
