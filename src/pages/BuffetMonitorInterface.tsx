import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowLeft, Hash, Loader2, RefreshCw, History, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import type { BuffetItemStatus, BuffetLiveStatus } from '../types/database.types'

interface RefillEntry {
  id: string
  itemName: string
  fromStatus: BuffetItemStatus
  toStatus: BuffetItemStatus
  at: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface BuffetItem {
  menu_item_id: string
  item_name: string
}

interface BuffetMenu {
  id: string
  name: string
  items: BuffetItem[]
}

type MenuItemRow = {
  id: string
  name: string
}

type MenuSectionRow = {
  id: string
  menu_items: MenuItemRow[]
}

type MenuRow = {
  id: string
  name: string
  menu_sections: MenuSectionRow[]
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  full:      { label: 'buffetPulse.full',  bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400', ring: 'ring-emerald-400', text: 'text-white' },
  low:       { label: 'buffetPulse.low',   bg: 'bg-amber-600   hover:bg-amber-500   active:bg-amber-400',   ring: 'ring-amber-400',   text: 'text-white' },
  empty:     { label: 'buffetPulse.empty', bg: 'bg-red-600     hover:bg-red-500     active:bg-red-400',     ring: 'ring-red-400',     text: 'text-white' },
  preparing: { label: 'buffetPulse.low',   bg: 'bg-blue-600   hover:bg-blue-500    active:bg-blue-400',    ring: 'ring-blue-400',    text: 'text-white' },
  coming:    { label: 'buffetPulse.low',   bg: 'bg-cyan-600   hover:bg-cyan-500    active:bg-cyan-400',    ring: 'ring-cyan-400',    text: 'text-white' },
} as const satisfies Record<BuffetItemStatus, { label: string; bg: string; ring: string; text: string }>

// ── Component ──────────────────────────────────────────────────────────────────

export default function BuffetMonitorInterface() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const menuParam = searchParams.get('menu')
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null

  const [menus, setMenus] = useState<BuffetMenu[]>([])
  const [activeMenuId, setActiveMenuId] = useState<string | null>(menuParam)
  const [statusMap, setStatusMap] = useState<Map<string, BuffetLiveStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating]     = useState<string | null>(null)
  const [codeQuery, setCodeQuery]   = useState('')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [refillHistory, setRefillHistory] = useState<RefillEntry[]>([])
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Toast notifications when kitchen dispatches
  const [toasts, setToasts] = useState<Array<{ id: string; itemName: string }>>([])

  // Refs so the realtime closure always reads fresh values
  const statusMapRef = useRef(statusMap)
  const userIdRef = useRef(userId)
  useEffect(() => { statusMapRef.current = statusMap }, [statusMap])
  useEffect(() => { userIdRef.current = userId }, [userId])

  // ── Load buffet menus ────────────────────────────────────────────────────────

  const loadMenus = useCallback(async () => {
    if (!teamId) return
    setLoading(true)

    const { data } = await supabase
      .from('menus')
      .select(`
        id, name,
        menu_sections(id, menu_items(id, name))
      `)
      .eq('team_id', teamId)
      .eq('type', 'buffet')
      .eq('active', true)
      .order('name')

    const rows = (data ?? []) as unknown as MenuRow[]

    const parsed: BuffetMenu[] = rows.map((m) => ({
      id: m.id,
      name: m.name,
      items: m.menu_sections.flatMap((s) =>
        s.menu_items.map((i) => ({ menu_item_id: i.id, item_name: i.name })),
      ),
    }))

    setMenus(parsed)
    // Prefer URL param, then existing selection, then first menu
    if (!activeMenuId && parsed.length > 0) {
      const fromParam = menuParam ? parsed.find((m) => m.id === menuParam) : null
      setActiveMenuId(fromParam?.id ?? parsed[0]!.id)
    }
    setLoading(false)
  }, [teamId, activeMenuId, menuParam])

  // ── Load live status ─────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    if (!teamId) return
    const { data } = await supabase
      .from('buffet_live_status')
      .select('*')
      .eq('team_id', teamId)

    const map = new Map<string, BuffetLiveStatus>()
    for (const row of (data ?? []) as BuffetLiveStatus[]) {
      if (row.menu_item_id) map.set(row.menu_item_id, row)
    }
    setStatusMap(map)
  }, [teamId])

  useEffect(() => {
    void loadMenus()
    void loadStatus()
  }, [loadMenus, loadStatus])

  // ── Realtime ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) return

    const ch = supabase
      .channel(`buffet-monitor:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buffet_live_status',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<BuffetLiveStatus>
            if (old.menu_item_id) {
              setStatusMap((prev) => {
                const next = new Map(prev)
                next.delete(old.menu_item_id!)
                return next
              })
            }
            return
          }

          const row = payload.new as BuffetLiveStatus
          if (!row.menu_item_id) return

          // Detect kitchen dispatch: status flipped TO 'full' by someone else
          const prevRow = statusMapRef.current.get(row.menu_item_id)
          const wasNotFull = !prevRow || prevRow.status !== 'full'
          const isNowFull  = row.status === 'full'
          const fromKitchen = row.changed_by != null && row.changed_by !== userIdRef.current

          if (wasNotFull && isNowFull && fromKitchen) {
            const toastId = crypto.randomUUID()
            setToasts((prev) => [...prev, { id: toastId, itemName: row.item_name }])
            setTimeout(
              () => setToasts((prev) => prev.filter((t) => t.id !== toastId)),
              4500,
            )
          }

          setStatusMap((prev) => new Map(prev).set(row.menu_item_id!, row))
        },
      )
      .subscribe()

    channelRef.current = ch
    return () => { void supabase.removeChannel(ch) }
  }, [teamId])

  // ── Upsert status ────────────────────────────────────────────────────────────

  async function upsertStatus(item: BuffetItem, patch: Partial<Pick<BuffetLiveStatus, 'status' | 'vessel_request'>>) {
    if (!teamId || !userId) return
    setUpdating(item.menu_item_id)
    try {
      const current = statusMap.get(item.menu_item_id)
      const prevStatus = current?.status ?? 'full'
      const newStatus  = patch.status ?? prevStatus
      await supabase.from('buffet_live_status').upsert(
        {
          team_id: teamId,
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          status: prevStatus,
          vessel_request: current?.vessel_request ?? false,
          ...patch,
          status_changed_at: new Date().toISOString(),
          changed_by: userId,
        },
        { onConflict: 'team_id,menu_item_id' },
      )
      // Track history locally (only status changes, not vessel toggles)
      if (patch.status && patch.status !== prevStatus) {
        const entry: RefillEntry = {
          id: crypto.randomUUID(),
          itemName: item.item_name,
          fromStatus: prevStatus,
          toStatus: newStatus,
          at: new Date().toISOString(),
        }
        setRefillHistory((prev) => [entry, ...prev].slice(0, 50))
      }
    } finally {
      setUpdating(null)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeMenu = menus.find((m) => m.id === activeMenuId)

  // Short code map mirrors the label drawer: 1-indexed, padded to 3 digits
  const shortCodeItemMap = useMemo<Map<string, BuffetItem>>(() => {
    const items = activeMenu?.items ?? []
    return new Map(items.map((item, i) => [String(i + 1).padStart(3, '0'), item]))
  }, [activeMenu])

  function handleCodeInput(raw: string) {
    const val = raw.replace(/\D/g, '').slice(0, 3)
    setCodeQuery(val)
    if (val.length < 3) return
    const item = shortCodeItemMap.get(val)
    if (!item) return
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    setHighlightedId(item.menu_item_id)
    const el = cardRefs.current.get(item.menu_item_id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 3000)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/buffet-pulse')}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Activity className="h-5 w-5 text-emerald-400 shrink-0" />
          <span className="font-semibold truncate">{t('buffetPulse.monitorMode')}</span>
          <span className="ml-1 shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
            {t('buffetPulse.liveIndicator')}
          </span>
        </div>
        {/* Manual short-code lookup (Plan B when QR scan fails) */}
        <div className="flex items-center gap-1 rounded-xl bg-white/10 px-2 border border-white/20 focus-within:border-emerald-400/60 focus-within:bg-white/15 transition-colors">
          <Hash className="h-4 w-4 text-white/40 shrink-0" />
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder="000"
            value={codeQuery}
            onChange={(e) => handleCodeInput(e.target.value)}
            onBlur={() => setTimeout(() => setCodeQuery(''), 1500)}
            className="w-10 bg-transparent py-2 text-sm font-mono font-bold text-white placeholder:text-white/25 focus:outline-none"
            aria-label="Αναζήτηση με 3-ψήφιο κωδικό"
          />
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
            showHistory ? 'bg-brand-orange/80 text-white' : 'bg-white/10 hover:bg-white/20',
          )}
          title="Ιστορικό ανεφοδιασμών"
        >
          <History className="h-4 w-4" />
        </button>
        <button
          onClick={() => { void loadMenus(); void loadStatus() }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {/* ── Refill History Panel ── */}
      {showHistory && (
        <div className="bg-gray-900/95 border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Ιστορικό Ανεφοδιασμών</p>
            <button onClick={() => setShowHistory(false)} className="text-white/30 hover:text-white transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          {refillHistory.length === 0 ? (
            <p className="text-xs text-white/30 py-2">Δεν υπάρχουν καταγραφές ακόμα.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
              {refillHistory.map((entry) => {
                const fromColor = entry.fromStatus === 'empty' ? 'text-red-400' : entry.fromStatus === 'low' ? 'text-amber-400' : 'text-emerald-400'
                const toColor   = entry.toStatus === 'empty'   ? 'text-red-400' : entry.toStatus === 'low'   ? 'text-amber-400' : 'text-emerald-400'
                return (
                  <div key={entry.id} className="flex items-center gap-2 text-xs">
                    <span className="text-white/30 font-mono shrink-0">{formatTime(entry.at)}</span>
                    <span className="text-white/70 truncate flex-1">{entry.itemName}</span>
                    <span className={cn('shrink-0 font-bold uppercase', fromColor)}>{entry.fromStatus}</span>
                    <span className="text-white/20">→</span>
                    <span className={cn('shrink-0 font-bold uppercase', toColor)}>{entry.toStatus}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Menu tabs */}
      {menus.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2 bg-gray-900 border-b border-white/10 scrollbar-none">
          {menus.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMenuId(m.id)}
              className={cn(
                'shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                m.id === activeMenuId
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20',
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : menus.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Activity className="h-12 w-12 text-white/20" />
            <p className="text-white/50 max-w-xs text-sm">{t('buffetPulse.noBuffetMenu')}</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(activeMenu?.items ?? []).map((item) => {
              const st = statusMap.get(item.menu_item_id)
              const currentStatus: BuffetItemStatus = st?.status ?? 'full'
              const vesselReq = st?.vessel_request ?? false
              const isUpdating = updating === item.menu_item_id

              // Name header background — the whole top block is colored
              const nameBg =
                currentStatus === 'empty' ? 'bg-red-700'
                : currentStatus === 'low'  ? 'bg-amber-600'
                : 'bg-emerald-700'

              const isHighlighted = highlightedId === item.menu_item_id
              // Short code for display on card
              const itemIndex = (activeMenu?.items ?? []).indexOf(item)
              const shortCode = itemIndex >= 0 ? String(itemIndex + 1).padStart(3, '0') : null

              return (
                <div
                  key={item.menu_item_id}
                  ref={(el) => { if (el) cardRefs.current.set(item.menu_item_id, el) }}
                  className={cn(
                    'rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all duration-300',
                    isHighlighted ? 'ring-4 ring-yellow-400 scale-[1.02]' : '',
                  )}
                  style={{ backgroundColor: '#1f2937' }}
                >
                  {/* ── Name block (colored by status) ──────────────── */}
                  <div className={cn('px-5 py-5 flex flex-col gap-1', nameBg)}>
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-2xl font-black leading-snug tracking-tight flex-1"
                        style={{ color: '#ffffff' }}
                      >
                        {item.item_name}
                      </p>
                      {shortCode && (
                        <span
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-mono font-bold tracking-widest"
                          style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.85)' }}
                        >
                          #{shortCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: 'rgba(255,255,255,0.75)' }}
                      >
                        {t(STATUS_CFG[currentStatus].label)}
                      </span>
                      {isUpdating && <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'rgba(255,255,255,0.6)' }} />}
                      {vesselReq && !isUpdating && (
                        <span style={{ color: 'rgba(255,255,255,0.75)' }} className="text-xs font-semibold">
                          · 🥘 Αλλαγή Σκεύους
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Status buttons ────────────────────────────────── */}
                  <div className="grid grid-cols-3 gap-2 p-3">
                    {(['full', 'low', 'empty'] as BuffetItemStatus[]).map((s) => {
                      const cfg = STATUS_CFG[s]
                      const active = currentStatus === s
                      return (
                        <button
                          key={s}
                          disabled={isUpdating}
                          onClick={() => void upsertStatus(item, { status: s, vessel_request: vesselReq })}
                          className={cn(
                            'rounded-xl py-5 text-sm font-black transition-all select-none',
                            cfg.bg,
                            active
                              ? `ring-2 ${cfg.ring} ring-offset-2`
                              : 'opacity-35',
                            isUpdating && 'cursor-not-allowed opacity-25',
                          )}
                          style={{ color: '#ffffff' }}
                        >
                          {t(cfg.label)}
                        </button>
                      )
                    })}
                  </div>

                  {/* ── Vessel request ────────────────────────────────── */}
                  <button
                    disabled={isUpdating}
                    onClick={() => void upsertStatus(item, { vessel_request: !vesselReq })}
                    className={cn(
                      'mx-3 mb-3 rounded-xl py-4 text-sm font-semibold transition-all select-none',
                      isUpdating && 'cursor-not-allowed opacity-25',
                    )}
                    style={{
                      backgroundColor: vesselReq ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                      color: vesselReq ? '#ffffff' : 'rgba(255,255,255,0.55)',
                    }}
                  >
                    🥘 {t(vesselReq ? 'buffetPulse.vesselRequested' : 'buffetPulse.vesselRequest')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Kitchen-dispatch toasts ──────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl animate-fade-in-up"
              style={{
                backgroundColor: '#065f46',
                border: '1px solid rgba(52,211,153,0.5)',
                minWidth: '280px',
                maxWidth: '90vw',
              }}
            >
              <span className="text-xl shrink-0">✅</span>
              <p className="text-sm font-semibold leading-snug" style={{ color: '#fff' }}>
                <span style={{ color: '#6ee7b7' }}>«{toast.itemName}»</span>
                {' '}ανανεώθηκε από την κουζίνα!
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
