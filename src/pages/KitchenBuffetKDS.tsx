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
    let q = supabase
      .from('menus')
      .select('id, name, menu_sections(id, menu_items(id, name))')
      .eq('team_id', teamId).eq('type', 'buffet').eq('active', true)
    if (menuParam) q = q.eq('id', menuParam)

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
        className="rounded-2xl overflow-hidden flex flex-col shadow-xl"
        style={{ border: `1px solid ${item.is_urgent ? 'rgba(239,68,68,0.9)' : cfg.border}`, backgroundColor: '#111827' }}
      >
        {/* Header */}
        <div className="px-5 py-4 relative" style={{ backgroundColor: item.is_urgent ? '#7f1d1d' : cfg.headerBg }}>
          {item.is_urgent && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-500/30 border border-red-400/50">
              <Siren className="h-3 w-3 text-red-300 animate-pulse" />
              <span className="text-[10px] font-black text-red-300 uppercase tracking-wider">ΕΠΕΙΓΟΝ</span>
            </div>
          )}
          <p className="text-2xl font-black leading-snug text-white pr-20">{item.item_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/80">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
            {item.vessel_request && <span className="text-xs text-white/70">· 🥘 Αλλαγή Σκεύους</span>}
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
            <p className="mt-2 text-xs text-white/60 italic">💬 {item.note}</p>
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
                          'rounded-lg py-2 text-sm font-bold transition-all',
                          workflow.eta === min
                            ? 'bg-blue-500 text-white'
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
                          'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                          workflow.note === n
                            ? 'bg-blue-500/30 border border-blue-400/60 text-blue-300'
                            : 'bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10',
                        )}>
                        {n}
                      </button>
                    ))}
                  </div>
                  {/* Confirm */}
                  <button
                    disabled={isActing}
                    onClick={() => void setStatus(item, 'preparing', { eta_minutes: workflow.eta, note: workflow.note || undefined })}
                    className="w-full rounded-xl py-3.5 text-sm font-black bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : '🔥 Ετοιμάζεται'}
                  </button>
                  <button onClick={() => setWorkflowOpen(null)}
                    className="w-full rounded-xl py-2 text-xs text-white/30 hover:text-white/60 transition-all">
                    Ακύρωση
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setWorkflowOpen(item.menu_item_id); setWorkflow({ eta: null, note: '' }) }}
                    className="rounded-xl py-4 text-sm font-black bg-blue-600/80 hover:bg-blue-600 text-white transition-all">
                    🔥 Ετοιμάζεται
                  </button>
                  <button
                    disabled={isActing}
                    onClick={() => void setStatus(item, 'full')}
                    className="rounded-xl py-4 text-sm font-black bg-emerald-600/80 hover:bg-emerald-600 text-white transition-all disabled:opacity-40 flex items-center justify-center">
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
                className="rounded-xl py-4 text-sm font-black bg-cyan-600/80 hover:bg-cyan-600 text-white transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Truck className="h-4 w-4" />Έρχεται</>}
              </button>
              <button
                disabled={isActing}
                onClick={() => void setStatus(item, 'full')}
                className="rounded-xl py-4 text-sm font-black bg-emerald-600/80 hover:bg-emerald-600 text-white transition-all disabled:opacity-40 flex items-center justify-center">
                ✓ Παραδόθηκε
              </button>
            </div>
          )}

          {/* coming → done */}
          {item.status === 'coming' && (
            <button
              disabled={isActing}
              onClick={() => void setStatus(item, 'full')}
              className="w-full rounded-xl py-5 text-base font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-40 flex items-center justify-center">
              {isActing ? <Loader2 className="h-5 w-5 animate-spin" /> : '✓ Παραδόθηκε'}
            </button>
          )}

          {/* Urgent toggle */}
          {item.row_id && (
            <button
              onClick={() => void toggleUrgent(item)}
              disabled={isActing}
              className={cn(
                'w-full rounded-xl py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                item.is_urgent
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/5 text-white/30 hover:text-red-400 hover:bg-red-500/10',
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#030712', color: '#fff' }}>

      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur border-b px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: 'rgba(17,24,39,0.85)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <button onClick={() => navigate('/buffet-pulse')}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Activity className="h-5 w-5 shrink-0 text-red-400" />
          <span className="font-semibold truncate">Κουζίνα — Buffet KDS</span>
          {menuName && (
            <span className="hidden sm:inline shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              📋 {menuName}
            </span>
          )}
          <span className="ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
            style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
            LIVE
          </span>
        </div>
        <div className="shrink-0 text-sm font-mono tabular-nums text-white/40">
          {new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : merged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Activity className="h-12 w-12 text-white/15" />
            <p className="text-sm text-white/40">Δεν βρέθηκε buffet μενού</p>
          </div>
        ) : (
          <>
            {/* Urgent */}
            {urgent.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl px-5 py-4"
                style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                <div>
                  <p className="font-semibold text-emerald-400">Όλα καλά!</p>
                  <p className="text-xs mt-0.5 text-emerald-400/60">Όλοι οι σταθμοί είναι γεμάτοι.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/40">Προτεραιότητα</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-black bg-red-600 text-white">{urgent.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {urgent.map(renderCard)}
                </div>
              </>
            )}

            {/* OK items */}
            {ok.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest text-white/25">
                  Γεμάτα ({ok.length})
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {ok.map((item) => (
                    <div key={item.menu_item_id}
                      className="rounded-xl px-4 py-3 flex items-center gap-2"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <span className="shrink-0 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-sm font-medium truncate text-white/65">{item.item_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
