/**
 * POS Webhook Handler
 *
 * Receives payment events from Viva Wallet and Square.
 * URL: https://[project].supabase.co/functions/v1/pos-webhook?token=[team_token]
 *
 * Viva Wallet: sends EventTypeId 1796 (transaction created) via POST
 * Square:      sends payment.completed via POST with HMAC-SHA256 signature
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ── Viva Wallet ───────────────────────────────────────────────────────────────

interface VivaPayload {
  EventTypeId: number
  Payload?: {
    Amount: number           // in cents
    CurrencyCode: string
    TransactionId: string
    OrderCode: number
    StatusId: string         // 'F' = completed
    MerchantTrns?: string
    CardNumber?: string
    TransactionDate?: string
  }
}

function parseViva(body: VivaPayload): { externalId: string; amount: number; currency: string; transactedAt: string } | null {
  if (body.EventTypeId !== 1796) return null
  const p = body.Payload
  if (!p || p.StatusId !== 'F') return null
  return {
    externalId: p.TransactionId,
    amount: p.Amount / 100,
    currency: p.CurrencyCode || 'EUR',
    transactedAt: p.TransactionDate ?? new Date().toISOString(),
  }
}

// ── Square ────────────────────────────────────────────────────────────────────

interface SquarePayload {
  type: string
  event_id: string
  created_at: string
  data?: {
    object?: {
      payment?: {
        id: string
        amount_money?: { amount: number; currency: string }
        status: string
        created_at: string
      }
    }
  }
}

async function verifySquare(req: Request, body: string, secret: string): Promise<boolean> {
  try {
    const sig = req.headers.get('x-square-hmacsha256-signature')
    if (!sig) return false
    const url = req.url
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(url + body))
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
    return sig === expected
  } catch {
    return false
  }
}

function parseSquare(body: SquarePayload): { externalId: string; amount: number; currency: string; transactedAt: string } | null {
  if (body.type !== 'payment.completed') return null
  const payment = body.data?.object?.payment
  if (!payment || payment.status !== 'COMPLETED') return null
  return {
    externalId: payment.id,
    amount: (payment.amount_money?.amount ?? 0) / 100,
    currency: payment.amount_money?.currency ?? 'EUR',
    transactedAt: payment.created_at ?? body.created_at,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Viva sends a GET for webhook verification — respond 200
  if (req.method === 'GET') return new Response('OK', { status: 200 })

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return new Response('Missing token', { status: 400 })

    // Look up team by token
    const { data: settings, error: settingsErr } = await supabase
      .from('pos_settings')
      .select('team_id, provider, webhook_secret, active')
      .eq('team_token', token)
      .single()

    if (settingsErr || !settings) return new Response('Unknown token', { status: 401 })
    if (!settings.active) return new Response('POS integration disabled', { status: 403 })

    const rawBody = await req.text()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = JSON.parse(rawBody) as any

    let parsed: { externalId: string; amount: number; currency: string; transactedAt: string } | null = null

    if (settings.provider === 'viva') {
      parsed = parseViva(body as VivaPayload)
    } else if (settings.provider === 'square') {
      if (settings.webhook_secret) {
        const valid = await verifySquare(req, rawBody, settings.webhook_secret)
        if (!valid) return new Response('Invalid signature', { status: 401 })
      }
      parsed = parseSquare(body as SquarePayload)
    }

    if (!parsed) {
      // Not a transaction event we care about — acknowledge silently
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upsert transaction (unique on provider + external_id prevents duplicates)
    const { error: insertErr } = await supabase.from('pos_transactions').upsert({
      team_id: settings.team_id,
      provider: settings.provider,
      external_id: parsed.externalId,
      amount: parsed.amount,
      currency: parsed.currency,
      status: 'completed',
      transacted_at: parsed.transactedAt,
      raw: body,
    }, { onConflict: 'provider,external_id', ignoreDuplicates: true })

    if (insertErr) {
      console.error('pos-webhook insert error', insertErr)
      return new Response('DB error', { status: 500 })
    }

    return new Response(JSON.stringify({ received: true, processed: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('pos-webhook error', err)
    return new Response('Internal error', { status: 500 })
  }
})
