import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n: number) { return n.toFixed(1) + '%' }

function bar(pct: number, color = '#C4956A'): string {
  const w = Math.min(Math.round(pct), 100)
  return `<div style="height:6px;background:#2a2a2a;border-radius:4px;overflow:hidden;margin-top:4px">
    <div style="width:${w}%;height:100%;background:${color};border-radius:4px"></div>
  </div>`
}

function statBox(label: string, value: string, sub: string, color: string): string {
  return `
  <td style="width:25%;padding:12px;text-align:center">
    <div style="background:#1e1e1e;border:1px solid #333;border-radius:10px;padding:14px 10px">
      <div style="font-size:22px;font-weight:700;color:${color}">${value}</div>
      <div style="font-size:11px;color:#aaa;margin-top:3px">${label}</div>
      <div style="font-size:10px;color:#666;margin-top:2px">${sub}</div>
    </div>
  </td>`
}

// ── main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json() as { team_id?: string; to?: string[] }

    // Auth: get team_id from JWT or body
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    let teamId = body.team_id

    if (!teamId) {
      const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
      if (!jwt) throw new Error('Unauthorized')
      const { data: { user } } = await supabase.auth.getUser(jwt)
      if (!user) throw new Error('Unauthorized')
      const { data: profile } = await supabase.from('profiles').select('team_id, full_name').eq('id', user.id).single()
      teamId = profile?.team_id
    }
    if (!teamId) throw new Error('No team found')

    // ── Gather data ─────────────────────────────────────────────────────────

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
    const isoToday = now.toISOString().slice(0, 10)
    const iso7dAgo = sevenDaysAgo.slice(0, 10)

    // Team name
    const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single()
    const teamName: string = (team as { name?: string } | null)?.name ?? 'Your Kitchen'

    // Waste last 7 days
    const { data: wasteRows } = await supabase
      .from('waste_entries')
      .select('item_name, quantity, unit, cost, reason')
      .eq('team_id', teamId)
      .gte('wasted_at', iso7dAgo)
      .lte('wasted_at', isoToday)

    const wasteEntries = (wasteRows ?? []) as Array<{ item_name: string; quantity: number; unit: string; cost: number | null; reason: string }>
    const totalWasteCost = wasteEntries.reduce((s, e) => s + (e.cost ?? 0), 0)

    // Low stock
    const { data: stockRows } = await supabase
      .from('inventory')
      .select('name, quantity, min_stock_level, unit')
      .eq('team_id', teamId)
    const stockItems = (stockRows ?? []) as Array<{ name: string; quantity: number; min_stock_level: number; unit: string }>
    const lowStock = stockItems.filter((i) => i.quantity <= i.min_stock_level)

    // Prep completion last 7 days
    const { data: prepRows } = await supabase
      .from('prep_tasks')
      .select('status')
      .eq('team_id', teamId)
      .gte('prep_for', iso7dAgo)
      .lte('prep_for', isoToday)
    const prepTasks = (prepRows ?? []) as Array<{ status: string }>
    const prepTotal = prepTasks.length
    const prepDone  = prepTasks.filter((t) => t.status === 'done').length
    const prepPct   = prepTotal > 0 ? Math.round((prepDone / prepTotal) * 100) : null

    // Recipes with food cost
    const { data: recipeRows } = await supabase
      .from('recipes')
      .select('title, cost_per_portion, selling_price')
      .eq('team_id', teamId)
      .not('selling_price', 'is', null)
      .not('cost_per_portion', 'is', null)
    const recipeData = (recipeRows ?? []) as Array<{ title: string; cost_per_portion: number; selling_price: number }>
    const withPct = recipeData.filter((r) => r.selling_price > 0).map((r) => ({
      title: r.title,
      pct: (r.cost_per_portion / r.selling_price) * 100,
    }))
    const avgFoodCost = withPct.length > 0
      ? withPct.reduce((s, r) => s + r.pct, 0) / withPct.length
      : null

    // HACCP pass rate today
    const { data: haccpRows } = await supabase
      .from('haccp_checks')
      .select('temperature, min_temp, max_temp')
      .eq('team_id', teamId)
      .gte('created_at', sevenDaysAgo)
    const haccpChecks = (haccpRows ?? []) as Array<{ temperature: number; min_temp: number; max_temp: number }>
    const haccpPass = haccpChecks.filter((c) => c.temperature >= c.min_temp && c.temperature <= c.max_temp).length
    const haccpPct  = haccpChecks.length > 0 ? Math.round((haccpPass / haccpChecks.length) * 100) : null

    // ── Build HTML ──────────────────────────────────────────────────────────

    const weekLabel = `${new Date(iso7dAgo).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(isoToday).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111;font-family:system-ui,-apple-system,sans-serif;color:#eee">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-flex;align-items:center;gap:10px;background:#1e1e1e;border:1px solid #333;border-radius:12px;padding:12px 20px">
        <span style="font-size:24px">🔥</span>
        <div style="text-align:left">
          <div style="font-size:18px;font-weight:700;color:#C4956A">ChefSuite</div>
          <div style="font-size:12px;color:#888">Weekly Kitchen Report</div>
        </div>
      </div>
      <div style="margin-top:14px">
        <div style="font-size:22px;font-weight:700">${teamName}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">${weekLabel}</div>
      </div>
    </div>

    <!-- Stat boxes -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr>
        ${statBox('Avg Food Cost', avgFoodCost != null ? fmtPct(avgFoodCost) : '—',
          avgFoodCost != null ? (avgFoodCost <= 30 ? '✓ Healthy' : avgFoodCost <= 40 ? '⚠ Watch' : '✗ High') : 'No priced recipes',
          avgFoodCost == null ? '#666' : avgFoodCost <= 30 ? '#4ade80' : avgFoodCost <= 40 ? '#fbbf24' : '#f87171')}
        ${statBox('Waste Cost', `€${fmt(totalWasteCost)}`, `${wasteEntries.length} items wasted`, totalWasteCost > 50 ? '#f87171' : '#4ade80')}
        ${statBox('Prep Done', prepPct != null ? `${prepPct}%` : '—', `${prepDone}/${prepTotal} tasks`, prepPct == null ? '#666' : prepPct >= 80 ? '#4ade80' : '#fbbf24')}
        ${statBox('HACCP', haccpPct != null ? `${haccpPct}%` : '—', `${haccpPass}/${haccpChecks.length} pass`, haccpPct == null ? '#666' : haccpPct >= 90 ? '#4ade80' : '#f87171')}
      </tr>
    </table>

    ${withPct.length > 0 ? `
    <!-- Food Cost by Recipe -->
    <div style="background:#1e1e1e;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#C4956A">📊 Food Cost by Recipe</div>
      ${withPct.slice(0, 6).map((r) => `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span style="color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">${r.title}</span>
            <span style="font-weight:600;color:${r.pct <= 30 ? '#4ade80' : r.pct <= 40 ? '#fbbf24' : '#f87171'}">${fmtPct(r.pct)}</span>
          </div>
          ${bar(r.pct, r.pct <= 30 ? '#4ade80' : r.pct <= 40 ? '#fbbf24' : '#f87171')}
        </div>`).join('')}
    </div>` : ''}

    ${lowStock.length > 0 ? `
    <!-- Low Stock -->
    <div style="background:#1e1e1e;border:1px solid #f87171;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#f87171">⚠️ Low Stock Alert (${lowStock.length} items)</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${lowStock.slice(0, 8).map((i) => `
        <tr>
          <td style="padding:5px 0;font-size:12px;color:#ccc;border-bottom:1px solid #2a2a2a">${i.name}</td>
          <td style="padding:5px 0;font-size:12px;color:#f87171;text-align:right;border-bottom:1px solid #2a2a2a">${i.quantity} ${i.unit} / min ${i.min_stock_level}</td>
        </tr>`).join('')}
      </table>
    </div>` : `
    <div style="background:#1e1e1e;border:1px solid #4ade80;border-radius:12px;padding:14px;margin-bottom:16px;text-align:center;font-size:13px;color:#4ade80">
      ✓ All stock levels are healthy
    </div>`}

    ${wasteEntries.length > 0 ? `
    <!-- Waste -->
    <div style="background:#1e1e1e;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#fbbf24">🗑 Waste This Week</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${wasteEntries.slice(0, 6).map((e) => `
        <tr>
          <td style="padding:5px 0;font-size:12px;color:#ccc;border-bottom:1px solid #2a2a2a">${e.item_name}</td>
          <td style="padding:5px 0;font-size:11px;color:#888;text-align:center;border-bottom:1px solid #2a2a2a">${e.reason}</td>
          <td style="padding:5px 0;font-size:12px;color:#fbbf24;text-align:right;border-bottom:1px solid #2a2a2a">${e.cost != null ? `€${fmt(e.cost)}` : `${e.quantity}${e.unit}`}</td>
        </tr>`).join('')}
      </table>
      ${totalWasteCost > 0 ? `<div style="text-align:right;margin-top:8px;font-size:12px;color:#f87171;font-weight:600">Total: €${fmt(totalWasteCost)}</div>` : ''}
    </div>` : ''}

    <!-- Footer -->
    <div style="text-align:center;font-size:11px;color:#555;margin-top:24px;padding-top:16px;border-top:1px solid #222">
      ChefSuite · Weekly Kitchen Report · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
</body>
</html>`

    // ── Send via Resend ─────────────────────────────────────────────────────

    // Get recipients from settings or body
    let recipients: string[] = body.to ?? []
    if (recipients.length === 0) {
      const { data: settings } = await supabase
        .from('email_report_settings')
        .select('recipients')
        .eq('team_id', teamId)
        .single()
      recipients = (settings as { recipients?: string[] } | null)?.recipients ?? []
    }

    if (recipients.length === 0) throw new Error('No recipients configured.')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ChefSuite Reports <reports@chefsuite.app>',
        to: recipients,
        subject: `🔥 ${teamName} — Weekly Kitchen Report (${weekLabel})`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.text()
      throw new Error(`Resend error: ${err}`)
    }

    // Update last_sent_at
    await supabase
      .from('email_report_settings')
      .upsert({ team_id: teamId, recipients, last_sent_at: new Date().toISOString() }, { onConflict: 'team_id' })

    return new Response(JSON.stringify({ ok: true, recipients, weekLabel }), {
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
