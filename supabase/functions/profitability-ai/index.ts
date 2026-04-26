import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecipeInput {
  title: string
  current_cost: number
  current_price: number
  food_cost_pct: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { recipes, avg_market_increase_pct } = await req.json() as {
      recipes: RecipeInput[]
      avg_market_increase_pct: number
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const client = new Anthropic({ apiKey })

    const prompt = `You are a restaurant pricing consultant. Analyse these menu items and suggest optimal selling prices.

Context:
- Average ingredient cost increase since last pricing: ${avg_market_increase_pct.toFixed(1)}%
- Target food cost %: 28–32%
- Industry benchmark gross margin: ≥ 68%

Menu items (JSON):
${JSON.stringify(recipes, null, 2)}

Return ONLY a JSON array — no markdown, no explanation:
[
  {
    "title": string,
    "current_price": number,
    "suggested_price": number,
    "suggested_food_cost_pct": number,
    "reasoning": string (1 sentence, max 80 chars)
  }
]

Rules:
- Suggested prices should be psychologically friendly (e.g. 12.50, 14.90, 18.00)
- Only suggest a price change if it improves food cost % meaningfully (>2% improvement)
- If price is already optimal, keep suggested_price === current_price
- reasoning must be concise and actionable`

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')

    const suggestions = JSON.parse(jsonMatch[0])

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
