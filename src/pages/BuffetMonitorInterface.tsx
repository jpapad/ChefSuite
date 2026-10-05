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

  const items = activeMenu?.items ?? []
  const statusOf = (id: string): BuffetItemStatus => statusMap.get(id)?.status ?? 'full'
  const RANK: Record<string, number> = { empty: 0, low: 1, preparing: 2, coming: 2, full: 3 }
  // Dishes that need action float to the top; codes stay tied to menu order
  const ordered = [...items].sort((a, b) => (RANK[statusOf(a.menu_item_id)] ?? 3) - (RANK[statusOf(b.menu_item_id)] ?? 3))
  const counts = {
    full: items.filter((i) => statusOf(i.menu_item_id) === 'full').length,
    low: items.filter((i) => statusOf(i.menu_item_id) === 'low').length,
    empty: items.filter((i) => statusOf(i.menu_item_id) === 'empty').length,
  }
  const barBtn = 'flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/20 transition-colors'

  return (
    <div className="theme-dark min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-bg-surface/90 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate('/buffet-pulse')} aria-label={t('common.back', 'Back')} className={barBtn}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="truncate text-xl font-medium">{activeMenu?.name ?? t('buffetPulse.monitorMode')}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />{t('buffetPulse.liveIndicator')}
          </span>
        </div>
        {/* Manual short-code lookup (Plan B when QR scan fails) */}
        <label className="flex h-12 items-center gap-1 rounded-full bg-white/[0.08] px-4 focus-within:ring-2 focus-within:ring-lime/60">
          <Hash className="h-4 w-4 shrink-0 text-white/45" />
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder="000"
            value={codeQuery}
            onChange={(e) => handleCodeInput(e.target.value)}
            onBlur={() => setTimeout(() => setCodeQuery(''), 1500)}
            className="w-12 bg-transparent font-mono text-base font-semibold placeholder:text-white/25 focus:outline-none"
            aria-label="Αναζήτηση με 3-ψήφιο κωδικό"
          />
        </label>
        <button onClick={() => setShowHistory((v) => !v)} title="Ιστορικό ανεφοδιασμών" aria-label="Ιστορικό ανεφοδιασμών"
          className={cn(barBtn, showHistory && 'bg-lime text-ink hover:bg-lime')}>
          <History className="h-5 w-5" />
        </button>
        <button onClick={() => { void loadMenus(); void loadStatus() }} aria-label="Refresh" className={barBtn}>
          <RefreshCw className="h-5 w-5" />
        </button>
      </header>

      {/* ── Refill history ── */}
      {showHistory && (
        <div className="mx-4 mb-2 rounded-3xl bg-bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-white/60">Ιστορικό ανεφοδιασμών</p>
            <button onClick={() => setShowHistory(false)} aria-label="Close" className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          {refillHistory.length === 0 ? (
            <p className="py-2 text-sm text-white/40">Δεν υπάρχουν καταγραφές ακόμα.</p>
          ) : (
            <div className="max-h-48 space-y-1.5 overflow-y-auto scrollbar-none">
              {refillHistory.map((entry) => {
                const tone = (st: string) => st === 'empty' ? 'text-red-400' : st === 'low' ? 'text-amber-400' : 'text-emerald-400'
                return (
                  <div key={entry.id} className="flex items-center gap-2 text-sm">
                    <span className="shrink-0 font-mono text-white/40">{formatTime(entry.at)}</span>
                    <span className="flex-1 truncate">{entry.itemName}</span>
                    <span className={cn('shrink-0 text-xs font-semibold uppercase', tone(entry.fromStatus))}>{entry.fromStatus}</span>
                    <span className="text-white/25">→</span>
                    <span className={cn('shrink-0 text-xs font-semibold uppercase', tone(entry.toStatus))}>{entry.toStatus}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Menu tabs + live counts */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
        {menus.length > 1 && menus.map((m) => (
          <button key={m.id} onClick={() => setActiveMenuId(m.id)}
            className={cn('h-11 shrink-0 rounded-full px-5 text-sm font-medium transition-colors', m.id === activeMenuId ? 'bg-lime text-ink' : 'bg-white/[0.08] text-white/70 hover:bg-white/[0.14]')}>
            {m.name}
          </button>
        ))}
        {items.length > 0 && (
          <div className="ml-auto flex gap-2">
            <span className="rounded-full bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-400 tabular-nums">{counts.empty} {t('buffetPulse.empty')}</span>
            <span className="rounded-full bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-400 tabular-nums">{counts.low} {t('buffetPulse.low')}</span>
            <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 tabular-nums">{counts.full} {t('buffetPulse.full')}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <main className="flex-1 p-4 pt-2">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-white/40"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : menus.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Activity className="h-12 w-12 text-white/20" />
            <p className="max-w-xs text-sm text-white/55">{t('buffetPulse.noBuffetMenu')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {ordered.map((item) => {
              const st = statusMap.get(item.menu_item_id)
              const currentStatus: BuffetItemStatus = st?.status ?? 'full'
              const vesselReq = st?.vessel_request ?? false
              const isUpdating = updating === item.menu_item_id
              const head =
                currentStatus === 'empty' ? 'bg-red-600 text-white-fixed'
                : currentStatus === 'low' ? 'bg-amber-500 text-ink'
                : 'bg-bg-card-2 text-white'
              const isHighlighted = highlightedId === item.menu_item_id
              const itemIndex = items.indexOf(item)
              const shortCode = itemIndex >= 0 ? String(itemIndex + 1).padStart(3, '0') : null

              return (
                <div
                  key={item.menu_item_id}
                  ref={(el) => { if (el) cardRefs.current.set(item.menu_item_id, el) }}
                  className={cn('flex flex-col overflow-hidden rounded-3xl bg-bg-card transition-all duration-300', isHighlighted && 'scale-[1.02] ring-4 ring-lime')}
                >
                  <div className={cn('flex flex-col gap-1 px-5 py-4', head)}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 text-xl font-semibold leading-snug">{item.item_name}</p>
                      {shortCode && <span className="shrink-0 rounded-full bg-black/20 px-2.5 py-1 font-mono text-xs font-semibold">#{shortCode}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-80">
                      {t(STATUS_CFG[currentStatus].label)}
                      {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                      {vesselReq && !isUpdating && <span className="normal-case tracking-normal">· Αλλαγή σκεύους</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3">
                    {(['full', 'low', 'empty'] as BuffetItemStatus[]).map((s) => {
                      const active = currentStatus === s
                      const on = s === 'empty' ? 'bg-red-600 text-white-fixed' : s === 'low' ? 'bg-amber-500 text-ink' : 'bg-emerald-600 text-white-fixed'
                      return (
                        <button
                          key={s}
                          disabled={isUpdating}
                          aria-pressed={active}
                          onClick={() => void upsertStatus(item, { status: s, vessel_request: vesselReq })}
                          className={cn('select-none rounded-2xl py-5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-30',
                            active ? on : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1]')}
                        >
                          {t(STATUS_CFG[s].label)}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    disabled={isUpdating}
                    aria-pressed={vesselReq}
                    onClick={() => void upsertStatus(item, { vessel_request: !vesselReq })}
                    className={cn('mx-3 mb-3 select-none rounded-full py-4 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-30',
                      vesselReq ? 'bg-lime text-ink' : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1]')}
                  >
                    {t(vesselReq ? 'buffetPulse.vesselRequested' : 'buffetPulse.vesselRequest')}
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
              className="flex min-w-[280px] max-w-[90vw] items-center gap-3 rounded-full bg-lime px-5 py-3.5 text-ink shadow-2xl animate-fade-in-up"
            >
              <p className="text-sm font-semibold leading-snug">
                <span>«{toast.itemName}»</span>
                {' '}ανανεώθηκε από την κουζίνα!
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
