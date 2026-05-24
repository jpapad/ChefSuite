import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import type { BuffetItemStatus, BuffetLiveStatus } from '../types/database.types'

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
  full:  { label: 'buffetPulse.full',  bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400', ring: 'ring-emerald-400', text: 'text-white' },
  low:   { label: 'buffetPulse.low',   bg: 'bg-amber-600   hover:bg-amber-500   active:bg-amber-400',   ring: 'ring-amber-400',   text: 'text-white' },
  empty: { label: 'buffetPulse.empty', bg: 'bg-red-600     hover:bg-red-500     active:bg-red-400',     ring: 'ring-red-400',     text: 'text-white' },
} as const satisfies Record<BuffetItemStatus, { label: string; bg: string; ring: string; text: string }>

// ── Component ──────────────────────────────────────────────────────────────────

export default function BuffetMonitorInterface() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null

  const [menus, setMenus] = useState<BuffetMenu[]>([])
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [statusMap, setStatusMap] = useState<Map<string, BuffetLiveStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

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
    if (parsed.length > 0 && !activeMenuId) setActiveMenuId(parsed[0]!.id)
    setLoading(false)
  }, [teamId, activeMenuId])

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
          if (row.menu_item_id) {
            setStatusMap((prev) => new Map(prev).set(row.menu_item_id!, row))
          }
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
      await supabase.from('buffet_live_status').upsert(
        {
          team_id: teamId,
          menu_item_id: item.menu_item_id,
          item_name: item.item_name,
          status: current?.status ?? 'full',
          vessel_request: current?.vessel_request ?? false,
          ...patch,
          status_changed_at: new Date().toISOString(),
          changed_by: userId,
        },
        { onConflict: 'team_id,menu_item_id' },
      )
    } finally {
      setUpdating(null)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeMenu = menus.find((m) => m.id === activeMenuId)

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
        <button
          onClick={() => { void loadMenus(); void loadStatus() }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

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

              return (
                <div
                  key={item.menu_item_id}
                  className="rounded-2xl overflow-hidden flex flex-col shadow-lg"
                  style={{ backgroundColor: '#1f2937' }}   // explicit gray-800
                >
                  {/* ── Name block (colored by status) ──────────────── */}
                  <div className={cn('px-5 py-5 flex flex-col gap-1', nameBg)}>
                    <p
                      className="text-2xl font-black leading-snug tracking-tight"
                      style={{ color: '#ffffff' }}          // explicit white
                    >
                      {item.item_name}
                    </p>
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
    </div>
  )
}
