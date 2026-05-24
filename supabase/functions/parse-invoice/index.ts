import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const PROMPT = `You are an invoice data extractor for a restaurant management system.
Analyse this invoice image or PDF and return ONLY a valid JSON object — no markdown, no explanation, no extra text.

Required JSON format:
{
  "supplier_info": {
    "name": string or null,
    "afm": string or null,
    "address": string or null,
    "phone": string or null,
    "invoice_number": string or null,
    "invoice_date": string or null
  },
  "items": [
    {
      "name": string,
      "quantity": number,
      "unit": string,
      "unit_price": number or null
    }
  ]
}

Extraction rules:
- supplier_info.name: the SELLER's company name (not the buyer/restaurant)
- supplier_info.afm: the SELLER's Greek tax registration number (ΑΦΜ) — digits only, no dots or spaces
- supplier_info.address: the SELLER's full address
- supplier_info.phone: the SELLER's phone number
- supplier_info.invoice_number: the document/invoice reference number
- supplier_info.invoice_date: date in ISO format YYYY-MM-DD, or null if not found
- items[].quantity: must be a positive number
- items[].unit: use standard units — kg, lt, pc, box, bag, bottle, can, etc.
- items[].unit_price: price PER unit (not line total). Derive from line total ÷ quantity if needed.
- Use null for any field that cannot be determined with confidence.
- Return ONLY the JSON object, nothing else.`

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  name: string
  quantity: number
  unit: string
  unit_price: number | null
}

interface SupplierInfo {
  name: string | null
  afm: string | null
  address: string | null
  phone: string | null
  invoice_number: string | null
  invoice_date: string | null
}

interface InvoiceData {
  supplier_info: SupplierInfo
  items: InvoiceItem[]
}

// ── Supplier resolution ───────────────────────────────────────────────────────

async function resolveSupplier(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
  info: SupplierInfo,
): Promise<{ supplier_id: string | null; is_new_supplier: boolean }> {
  // 1. Try AFM match first (most reliable)
  if (info.afm) {
    const { data: byAfm } = await supabase
      .from('suppliers')
      .select('id')
      .eq('team_id', teamId)
      .eq('afm', info.afm)
      .maybeSingle()

    if (byAfm) return { supplier_id: byAfm.id, is_new_supplier: false }
  }

  // 2. Try name match (case-insensitive) if no AFM
  if (info.name) {
    const { data: byName } = await supabase
      .from('suppliers')
      .select('id')
      .eq('team_id', teamId)
      .ilike('name', info.name.trim())
      .maybeSingle()

    if (byName) return { supplier_id: byName.id, is_new_supplier: false }
  }

  // 3. Auto-create supplier if we have at least a name
  if (!info.name) return { supplier_id: null, is_new_supplier: false }

  const { data: created, error } = await supabase
    .from('suppliers')
    .insert({
      team_id:      teamId,
      name:         info.name.trim(),
      afm:          info.afm   ?? null,
      address:      info.address ?? null,
      phone:        info.phone  ?? null,
      contact_name: null,
      email:        null,
      notes:        '🤖 Auto-created from scanned invoice',
      logo_url:     null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[parse-invoice] supplier insert error:', error.message)
    return { supplier_id: null, is_new_supplier: false }
  }

  return { supplier_id: created.id, is_new_supplier: true }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_base64, media_type, team_id } = await req.json() as {
      file_base64: string
      media_type: string
      team_id?: string
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret not set')

    // ── 1. Call Claude Vision ──────────────────────────────────────────────

    const isPdf = media_type === 'application/pdf'
    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const contentSource = isPdf
      ? { type: 'base64' as const, media_type: 'application/pdf' as const, data: file_base64 }
      : { type: 'base64' as const, media_type: (media_type || 'image/jpeg') as ImageMediaType, data: file_base64 }

    const contentBlock = isPdf
      ? { type: 'document', source: contentSource }
      : { type: 'image', source: contentSource }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 2048,
        messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: PROMPT }] }],
      }),
    })

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text()
      throw new Error(`Anthropic API error ${anthropicResponse.status}: ${errText}`)
    }

    const result = await anthropicResponse.json() as {
      content: Array<{ type: string; text?: string }>
    }

    const text = result.content?.[0]?.type === 'text' ? (result.content[0].text ?? '') : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in Claude response')

    const data = JSON.parse(jsonMatch[0]) as Partial<InvoiceData>

    // Ensure required shape
    const supplier_info: SupplierInfo = {
      name:           data.supplier_info?.name           ?? null,
      afm:            data.supplier_info?.afm            ?? null,
      address:        data.supplier_info?.address        ?? null,
      phone:          data.supplier_info?.phone          ?? null,
      invoice_number: data.supplier_info?.invoice_number ?? null,
      invoice_date:   data.supplier_info?.invoice_date   ?? null,
    }

    // Normalise AFM — digits only
    if (supplier_info.afm) {
      supplier_info.afm = supplier_info.afm.replace(/\D/g, '') || null
    }

    const items: InvoiceItem[] = Array.isArray(data.items)
      ? data.items.filter((i) => i.name && i.quantity > 0)
      : []

    // ── 2. Resolve / create supplier in DB ────────────────────────────────

    let supplier_id: string | null = null
    let is_new_supplier = false

    if (team_id) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )
      const resolved = await resolveSupplier(supabaseAdmin, team_id, supplier_info)
      supplier_id     = resolved.supplier_id
      is_new_supplier = resolved.is_new_supplier
    }

    // ── 3. Return ─────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({ supplier_info, supplier_id, is_new_supplier, items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[parse-invoice] error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
