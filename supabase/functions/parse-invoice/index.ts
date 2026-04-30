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
      max_tokens: 2048,
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

    const data = JSON.parse(jsonMatch[0]) as InvoiceData

    if (!Array.isArray(data.items)) data.items = []
    data.items = data.items.filter((i) => i.name && i.quantity > 0)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[parse-invoice] error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
