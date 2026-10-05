import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, ArrowLeft, CheckCircle2, Loader2, Siren, Truck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import type { BuffetItemStatus, BuffetLiveStatus } from '../types/database.types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BuffetItem { menu_item_id: string; item_name: string }
type MenuItemRow    = { id: string; name: string }
type MenuSectionRow = { id: string; menu_items: MenuItemRow[] }
type MenuRow        = { id: string; name: string; menu_sections: MenuSectionRow[] }

interface MergedItem {
  menu_item_id: string
  item_name: string
  status: BuffetItemStatus
  vessel_request: boolean
  status_changed_at: string | null
  row_id: string | null
  note: string | null
  eta_minutes: number | null
  is_urgent: boolean
  photo_url: string | null
}

interface WorkflowState { eta: number | null; note: string }

const ETA_OPTIONS = [5, 10, 15, 20]

const QUICK_NOTES = [
  'Ετοιμάζεται τώρα',
  'Αλλαγή πιάτου',
  'Λίγα λεπτά ακόμα',
  'Δεν υπάρχει υλικό',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatElapsed(sinceIso: string, nowMs: number): string {
  const diffSec = Math.floor((nowMs - new Date(sinceIso).getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}δ`
  const m = Math.floor(diffSec / 60); const s = diffSec % 60
  return `${m}λ ${String(s).padStart(2, '0')}δ`
}

function formatEtaRemaining(sinceIso: string, etaMin: number, nowMs: number): string {
  const elapsed = (nowMs - new Date(sinceIso).getTime()) / 1000
  const remaining = etaMin * 60 - elapsed
  if (remaining <= 0) return 'Αργεί!'
  const m = Math.floor(remaining / 60); const s = Math.floor(remaining % 60)
  return m > 0 ? `${m}λ ${String(s).padStart(2, '0')}δ` : `${s}δ`
}

function needsAttention(status: BuffetItemStatus) {
  return status !== 'full'
}

function priorityScore(item: MergedItem): number {
  if (item.is_urgent) return 0
  if (item.status === 'empty') return 1
  if (item.status === 'low') return 2
  if (item.status === 'preparing') return 3
  if (item.status === 'coming') return 4
  return 5
}

const STATUS_CFG: Record<BuffetItemStatus, { label: string; headerBg: string; border: string; dot: string }> = {
  empty:     { label: 'Τελείωσε',   headerBg: '#991b1b', border: 'rgba(239,68,68,0.6)',   dot: '#ef4444' },
  low:       { label: 'Λίγο',       headerBg: '#92400e', border: 'rgba(245,158,11,0.6)',  dot: '#f59e0b' },
  preparing: { label: 'Ετοιμάζεται', headerBg: '#1e3a8a', border: 'rgba(59,130,246,0.6)', dot: '#3b82f6' },
  coming:    { label: 'Έρχεται',    headerBg: '#164e63', border: 'rgba(6,182,212,0.6)',   dot: '#06b6d4' },
  full:      { label: 'Γεμάτο',     headerBg: '#065f46', border: 'rgba(16,185,129,0.4)',  dot: '#10b981' },
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function KitchenBuffetKDS() {
  const navigate   = useNavigate()
  const [searchParams] = useSearchParams()
  const menuParam  = searchParams.get('menu')
  const { profile } = useAuth()
  const teamId  = profile?.team_id ?? null
  const userId  = profile?.id ?? null

  const [menuName, setMenuName]   = useState('')
  const [menuItems, setMenuItems] = useState<BuffetItem[]>([])
  const [statusMap, setStatusMap] = useState<Map<string, BuffetLiveStatus>>(new Map())
  const [loading, setLoading]     = useState(true)
  const [acting, setActing]       = useState<string | null>(null)
  const [nowMs, setNowMs]         = useState(Date.now())

  // Per-item workflow (ETA selector open + choices)
  const [workflowOpen, setWorkflowOpen] = useState<string | null>(null)
  const [workflow, setWorkflow]         = useState<WorkflowState>({ eta: null, note: '' })

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Tick ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!teamId) return
    setLoading(true)

    // Resolve which menu to show: URL param → weekly schedule → fallback to all active buffet
    let targetId: string | null = menuParam
    if (!targetId) {
      const { data } = await supabase.rpc('get_daily_menu', { p_team_id: teamId })
      targetId = (data as string | null) ?? null
    }

    let q = supabase
      .from('menus')
      .select('id, name, menu_sections(id, menu_items(id, name))')
      .eq('team_id', teamId)
    if (targetId) {
      q = q.eq('id', targetId)
    } else {
      q = q.eq('type', 'buffet').eq('active', true)
    }

    const [{ data: menuData }, { data: statusData }] = await Promise.all([
      q,
      supabase.from('buffet_live_status').select('*').eq('team_id', teamId),
    ])

    const menus = (menuData ?? []) as unknown as MenuRow[]
    if (menus.length > 0) setMenuName(menus[0]!.name)
    setMenuItems(menus.flatMap((m) =>
      m.menu_sections.flatMap((s) => s.menu_items.map((i) => ({ menu_item_id: i.id, item_name: i.name }))),
    ))
    const map = new Map<string, BuffetLiveStatus>()
    for (const row of (statusData ?? []) as BuffetLiveStatus[]) {
      if (row.menu_item_id) map.set(row.menu_item_id, row)
    }
    setStatusMap(map)
    setLoading(false)
  }, [teamId, menuParam])

  useEffect(() => { void loadAll() }, [loadAll])

  // ── Realtime ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) return
    const ch = supabase
      .channel(`buffet-kds:${teamId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'buffet_live_status', filter: `team_id=eq.${teamId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<BuffetLiveStatus>
            if (old.menu_item_id) setStatusMap((p) => { const n = new Map(p); n.delete(old.menu_item_id!); return n })
            return
          }
          const row = payload.new as BuffetLiveStatus
          if (row.menu_item_id) setStatusMap((p) => new Map(p).set(row.menu_item_id!, row))
        })
      .subscribe()
    channelRef.current = ch
    return () => { void supabase.removeChannel(ch) }
  }, [teamId])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function setStatus(
    item: MergedItem,
    newStatus: BuffetItemStatus,
    opts?: { note?: string; eta_minutes?: number | null; is_urgent?: boolean },
  ) {
    if (!teamId || !userId) return
    setActing(item.menu_item_id)
    try {
      const payload = {
        team_id: teamId, menu_item_id: item.menu_item_id, item_name: item.item_name,
        status: newStatus,
        vessel_request: newStatus === 'full' ? false : item.vessel_request,
        status_changed_at: new Date().toISOString(),
        changed_by: userId,
        note: opts?.note ?? null,
        eta_minutes: opts?.eta_minutes ?? null,
        is_urgent: opts?.is_urgent ?? item.is_urgent,
      }
      if (item.row_id) {
        await supabase.from('buffet_live_status').update(payload).eq('id', item.row_id)
      } else {
        await supabase.from('buffet_live_status').insert(payload)
      }
      void supabase.from('buffet_refill_events').insert({
        team_id: teamId, menu_item_id: item.menu_item_id,
        item_name: item.item_name, event_type: newStatus, created_by: userId,
      })
    } finally {
      setActing(null)
      setWorkflowOpen(null)
      setWorkflow({ eta: null, note: '' })
    }
  }

  async function toggleUrgent(item: MergedItem) {
    if (!teamId || !userId) return
    setActing(item.menu_item_id)
    try {
      const payload = { is_urgent: !item.is_urgent, changed_by: userId }
      if (item.row_id) {
        await supabase.from('buffet_live_status').update(payload).eq('id', item.row_id)
      }
    } finally { setActing(null) }
  }

  // ── Merge ────────────────────────────────────────────────────────────────────

  const merged: MergedItem[] = menuItems.map((item) => {
    const live = statusMap.get(item.menu_item_id)
    return {
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      status: live?.status ?? 'full',
      vessel_request: live?.vessel_request ?? false,
      status_changed_at: live?.status_changed_at ?? null,
      row_id: live?.id ?? null,
      note: live?.note ?? null,
      eta_minutes: live?.eta_minutes ?? null,
      is_urgent: live?.is_urgent ?? false,
      photo_url: live?.photo_url ?? null,
    }
  })

  const urgent = merged.filter((i) => needsAttention(i.status) || i.vessel_request)
    .sort((a, b) => priorityScore(a) - priorityScore(b))
  const ok = merged.filter((i) => !needsAttention(i.status) && !i.vessel_request)

  // ── Render helpers ────────────────────────────────────────────────────────────

  function renderCard(item: MergedItem) {
    const cfg = STATUS_CFG[item.status]
    const isActing = acting === item.menu_item_id
    const isWorkflowOpen = workflowOpen === item.menu_item_id

    return (
      <div
        key={item.menu_item_id}
        className={cn('flex flex-col overflow-hidden rounded-3xl bg-bg-card', item.is_urgent && 'ring-2 ring-red-500')}
      >
        {/* Header */}
        <div className="px-5 py-4 relative" style={{ backgroundColor: item.is_urgent ? '#7f1d1d' : cfg.headerBg }}>
          {item.is_urgent && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-500/30 border border-red-400/50">
              <Siren className="h-3 w-3 text-red-300 animate-pulse" />
              <span className="text-[10px] font-black text-red-300 uppercase tracking-wider">ΕΠΕΙΓΟΝ</span>
            </div>
          )}
          <p className="pr-20 text-2xl font-semibold leading-snug text-white-fixed">{item.item_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/80">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
            {item.vessel_request && <span className="text-xs text-white-fixed/75">· Αλλαγή σκεύους</span>}
            {item.status_changed_at && (
              <span className="ml-auto font-mono text-xs tabular-nums text-white/50">
                {formatElapsed(item.status_changed_at, nowMs)}
              </span>
            )}
          </div>
          {/* ETA remaining */}
          {(item.status === 'preparing' || item.status === 'coming') && item.eta_minutes && item.status_changed_at && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-white/50">ETA:</span>
              <span className={cn(
                'font-mono text-sm font-bold',
                (nowMs - new Date(item.status_changed_at).getTime()) / 60000 > item.eta_minutes
                  ? 'text-red-400 animate-pulse' : 'text-white/80',
              )}>
                {formatEtaRemaining(item.status_changed_at, item.eta_minutes, nowMs)}
              </span>
            </div>
          )}
          {/* Kitchen note */}
          {item.note && (
            <p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-sm text-white-fixed/85">{item.note}</p>
          )}
          {/* Photo from buffet person */}
          {item.photo_url && (
            <a href={item.photo_url} target="_blank" rel="noreferrer" className="block mt-2 rounded-lg overflow-hidden border border-white/10">
              <img src={item.photo_url} alt="σταθμός" className="w-full object-cover" style={{ maxHeight: 110 }} />
            </a>
          )}
        </div>

        {/* Action area */}
        <div className="p-3 space-y-2">

          {/* empty / low → ETA + note workflow */}
          {(item.status === 'empty' || item.status === 'low') && (
            <>
              {isWorkflowOpen ? (
                <div className="space-y-2">
                  {/* ETA selector */}
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/30">ETA</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ETA_OPTIONS.map((min) => (
                      <button key={min}
                        onClick={() => setWorkflow((w) => ({ ...w, eta: w.eta === min ? null : min }))}
                        className={cn(
                          'rounded-full py-2.5 text-sm font-semibold tabular-nums transition-all',
                          workflow.eta === min
                            ? 'bg-lime text-ink'
                            : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white',
                        )}>
                        {min}λ
                      </button>
                    ))}
                  </div>
                  {/* Quick notes */}
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 pt-1">Σημείωση</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_NOTES.map((n) => (
                      <button key={n}
                        onClick={() => setWorkflow((w) => ({ ...w, note: w.note === n ? '' : n }))}
                        className={cn(
                          'rounded-full px-3 py-2 text-xs font-medium transition-all',
                          workflow.note === n
                            ? 'bg-white-fixed text-ink'
                            : 'bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/10',
                        )}>
                        {n}
                      </button>
                    ))}
                  </div>
                  {/* Confirm */}
                  <button
                    disabled={isActing}
                    onClick={() => void setStatus(item, 'preparing', { eta_minutes: workflow.eta, note: workflow.note || undefined })}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 py-4 text-sm font-semibold text-white-fixed transition-all hover:bg-sky-500 disabled:opacity-40"
                  >
                    {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ετοιμάζεται'}
                  </button>
                  <button onClick={() => setWorkflowOpen(null)}
                    className="w-full rounded-full py-2.5 text-sm text-white/50 transition-all hover:text-white">
                    Ακύρωση
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setWorkflowOpen(item.menu_item_id); setWorkflow({ eta: null, note: '' }) }}
                    className="rounded-full bg-sky-600 py-4 text-sm font-semibold text-white-fixed transition-all hover:bg-sky-500">
                    Ετοιμάζεται
                  </button>
                  <button
                    disabled={isActing}
                    onClick={() => void setStatus(item, 'full')}
                    className="flex items-center justify-center rounded-full bg-lime py-4 text-sm font-semibold text-ink transition-all hover:brightness-95 disabled:opacity-40">
                    {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : '✓ Παραδόθηκε'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* preparing → έρχεται */}
          {item.status === 'preparing' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={isActing}
                onClick={() => void setStatus(item, 'coming', { note: item.note ?? undefined, eta_minutes: item.eta_minutes })}
                className="flex items-center justify-center gap-1.5 rounded-full bg-sky-600 py-4 text-sm font-semibold text-white-fixed transition-all hover:bg-sky-500 disabled:opacity-40">
                {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Truck className="h-4 w-4" />Έρχεται</>}
              </button>
              <button
                disabled={isActing}
                onClick={() => void setStatus(item, 'full')}
                className="flex items-center justify-center rounded-full bg-lime py-4 text-sm font-semibold text-ink transition-all hover:brightness-95 disabled:opacity-40">
                ✓ Παραδόθηκε
              </button>
            </div>
          )}

          {/* coming → done */}
          {item.status === 'coming' && (
            <button
              disabled={isActing}
              onClick={() => void setStatus(item, 'full')}
              className="flex w-full items-center justify-center rounded-full bg-lime py-5 text-base font-semibold text-ink transition-all hover:brightness-95 disabled:opacity-40">
              {isActing ? <Loader2 className="h-5 w-5 animate-spin" /> : '✓ Παραδόθηκε'}
            </button>
          )}

          {/* Urgent toggle */}
          {item.row_id && (
            <button
              onClick={() => void toggleUrgent(item)}
              disabled={isActing}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition-all',
                item.is_urgent
                  ? 'bg-red-600 text-white-fixed hover:bg-red-500'
                  : 'bg-white/[0.05] text-white/45 hover:bg-red-500/10 hover:text-red-400',
              )}>
              <Siren className="h-3 w-3" />
              {item.is_urgent ? 'Ακύρωση επείγοντος' : 'Σήμανση Επείγον'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="theme-dark min-h-screen flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-bg-surface/90 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate('/buffet-pulse')} aria-label="Back"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08] transition-colors hover:bg-white/[0.14]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="truncate text-xl font-medium">Ανεφοδιασμός buffet</span>
          {menuName && <span className="hidden shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-xs text-white/60 sm:inline">{menuName}</span>}
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />LIVE
          </span>
        </div>
        <span className="text-2xl font-medium tabular-nums">
          {new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 space-y-6 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/30" /></div>
        ) : merged.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <Activity className="h-12 w-12 text-white/15" />
            <p className="text-sm text-white/50">Δεν βρέθηκε buffet μενού</p>
          </div>
        ) : (
          <>
            {urgent.length === 0 ? (
              <div className="flex items-center gap-4 rounded-3xl bg-lime px-6 py-5 text-ink">
                <CheckCircle2 className="h-8 w-8 shrink-0" />
                <div>
                  <p className="text-xl font-medium">Όλα καλά</p>
                  <p className="text-sm text-ink/70">Όλοι οι σταθμοί είναι γεμάτοι.</p>
                </div>
              </div>
            ) : (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium">Θέλουν ανεφοδιασμό</span>
                  <span className="rounded-full bg-red-600 px-3 py-0.5 text-sm font-semibold text-white-fixed tabular-nums">{urgent.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{urgent.map(renderCard)}</div>
              </section>
            )}

            {ok.length > 0 && (
              <section className="space-y-3">
                <span className="text-sm font-medium text-white/50">Γεμάτα · {ok.length}</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                  {ok.map((item) => (
                    <div key={item.menu_item_id} className="flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-3">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                      <span className="truncate text-sm font-medium text-white/70">{item.item_name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
