import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `You are an invoice data extractor for a restaurant management system.
Analyse this invoice and return ONLY a JSON object — no other text, no markdown, no explanation.

Required format:
{
  "supplier_name": string or null,
  "items": [
    {
      "name": string,
      "quantity": number,
      "unit": string,
      "unit_price": number or null
    }
  ]
}

Rules:
- quantity must be a positive number
- unit: use kg, lt, pc, box, bag, bottle, can, etc.
- unit_price is the price PER unit (not the line total)
- If a value cannot be determined, use null
- Return ONLY the JSON object, nothing else`

interface InvoiceItem {
  name: string
  quantity: number
  unit: string
  unit_price: number | null
}

interface InvoiceData {
  supplier_name: string | null
  items: InvoiceItem[]
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

    const client = new Anthropic({ apiKey })

    const isPdf = media_type === 'application/pdf'

    type ContentBlock =
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
      | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } }
      | { type: 'text'; text: string }

    const content: ContentBlock[] = isPdf
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } },
          { type: 'text', text: PROMPT },
        ]
      : [
          { type: 'image', source: { type: 'base64', media_type: media_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: file_base64 } },
          { type: 'text', text: PROMPT },
        ]

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from response (handles cases where Claude adds extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in Claude response')

    const data = JSON.parse(jsonMatch[0]) as InvoiceData

    // Validate basic structure
    if (!Array.isArray(data.items)) data.items = []
    data.items = data.items.filter((i) => i.name && i.quantity > 0)

    return new Response(JSON.stringify(data), {
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
