import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const SVG_W    = 900
const SVG_H    = 550

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json() as {
      // Legacy single-image format
      imageBase64?: string
      mimeType?: string
      // Multi-image format (advanced scan)
      images?: Array<{ imageBase64: string; mimeType: string; role: 'aerial' | 'ground' }>
    }

    // Normalise to images array
    type ImageEntry = { imageBase64: string; mimeType: string; role: 'aerial' | 'ground' }
    const images: ImageEntry[] = body.images
      ?? [{ imageBase64: body.imageBase64!, mimeType: body.mimeType ?? 'image/jpeg', role: 'ground' }]

    const hasAerial = images.some(i => i.role === 'aerial')

    // ── Build prompt ────────────────────────────────────────────────────────────
    const prompt = hasAerial
      ? `You are analyzing a buffet/food-service area using multiple photos.

IMAGE ROLES:
- Image 1 is an OVERHEAD (bird's-eye) photo taken from directly above the buffet. Use this as the primary source for spatial layout: station positions, relative distances, sizes, and proportions.
- Images 2+ are ground-level frames from a slow video sweep of the same space. Use these only to identify station names and food content — NOT for position data.

Your task: produce a single unified map of all buffet stations.

Map positions proportionally onto a canvas of ${SVG_W}×${SVG_H} pixels (top-left = 0,0).
The overhead image's left/right/top/bottom edges map directly to 0/${SVG_W}/0/${SVG_H}.

For each station return:
- name: short Greek name (e.g. "Σαλάτες", "Ζεστά Πιάτα", "Ψητά", "Γλυκά", "Σούπες", "Ψωμί", "Ορεκτικά", "Ψυχρά", "Τυριά", "Αλλαντικά")
- x: left edge in pixels (0 to ${SVG_W - 120})
- y: top edge in pixels (30 to ${SVG_H - 80})
- width: width in pixels (120 to 380)
- height: height in pixels (60 to 140)
- slotCount: estimated number of individual food dishes/trays in this station (1 to 8)

Rules:
- Derive positions and sizes ONLY from the overhead image
- Use ground-level images only for naming
- Stations must not overlap; add 10px margin between them
- Spread stations to fill the canvas proportionally
- Return ONLY valid JSON: {"stations": [...]} — no markdown, no explanation`

      : `You are analyzing a photo of a buffet/food service area.

Identify all visible food stations, serving tables, food trays, counters, or buffet sections.

Map their positions proportionally onto a canvas of ${SVG_W}×${SVG_H} pixels (top-left is 0,0).

For each detected station return:
- name: short Greek name (e.g. "Σαλάτες", "Ζεστά Πιάτα", "Ψητά", "Γλυκά", "Σούπες", "Ψωμί", "Ορεκτικά")
- x: left edge in pixels (0 to ${SVG_W - 120})
- y: top edge in pixels (30 to ${SVG_H - 80})
- width: width in pixels (120 to 380)
- height: height in pixels (60 to 140)
- slotCount: estimated number of individual food dishes/trays in this station (1 to 8)

Rules:
- Spread stations across the canvas proportionally to their real positions in the photo
- Stations must not overlap
- Prefer wider stations (width > height)
- Return ONLY valid JSON: {"stations": [...]} — no markdown, no explanation`

    // ── Build message content (images + prompt) ─────────────────────────────────
    const imageBlocks = images.map(img => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mimeType as 'image/jpeg', data: img.imageBase64 },
    }))

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'No JSON in AI response', raw: text }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
