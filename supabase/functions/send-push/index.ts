import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@chefsuite.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

interface PushRow {
  id: string
  endpoint: string
  p256dh: string
  auth_key: string
}

interface SendBody {
  team_id: string
  exclude_user_id?: string
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: SendBody
  try {
    payload = await req.json() as SendBody
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { team_id, exclude_user_id, title, body, url, tag, icon } = payload
  if (!team_id) return new Response('Missing team_id', { status: 400 })

  let query = supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('team_id', team_id)

  if (exclude_user_id) query = query.neq('user_id', exclude_user_id)

  const { data: subs, error: fetchErr } = await query

  if (fetchErr) {
    console.error('send-push fetch error', fetchErr)
    return new Response('DB error', { status: 500 })
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, total: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const pushPayload = JSON.stringify({
    title,
    body,
    url: url ?? '/chat',
    tag: tag ?? 'chefsuite',
    icon: icon ?? '/icon.svg',
  })

  const results = await Promise.allSettled(
    (subs as PushRow[]).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        pushPayload,
      )
    ),
  )

  // Remove expired subscriptions (410 = Gone, 404 = Not Found)
  const expiredIds = results
    .map((r, i) => {
      if (r.status === 'rejected') {
        const code = (r.reason as { statusCode?: number })?.statusCode
        if (code === 410 || code === 404) return (subs as PushRow[])[i].id
      }
      return null
    })
    .filter(Boolean)

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length

  return new Response(JSON.stringify({ sent, total: subs.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
