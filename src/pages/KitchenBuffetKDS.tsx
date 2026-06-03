import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { BuffetItemStatus, BuffetLiveStatus } from '../types/database.types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BuffetItem {
  menu_item_id: string
  item_name: string
}

type MenuItemRow = { id: string; name: string }
type MenuSectionRow = { id: string; menu_items: MenuItemRow[] }
type MenuRow = { id: string; name: string; menu_sections: MenuSectionRow[] }

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatElapsed(sinceIso: string, nowMs: number): string {
  const diffSec = Math.floor((nowMs - new Date(sinceIso).getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}δ`
  const m = Math.floor(diffSec / 60)
  const s = diffSec % 60
  return `${m}λ ${String(s).padStart(2, '0')}δ`
}

function priorityScore(status: BuffetItemStatus, vessel: boolean): number {
  if (status === 'empty') return 0
  if (vessel && status === 'low') return 1
  if (vessel) return 2
  return 3
}

function needsAttention(status: BuffetItemStatus, vessel: boolean) {
  return status !== 'full' || vessel
}

// ── Merged view of a buffet item with its live status ─────────────────────────

interface MergedItem {
  menu_item_id: string
  item_name: string
  status: BuffetItemStatus
  vessel_request: boolean
  status_changed_at: string | null
  row_id: string | null // buffet_live_status.id, null if never set
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function KitchenBuffetKDS() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const menuParam = searchParams.get('menu')
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null

  const [menuName, setMenuName] = useState<string>('')
  const [menuItems, setMenuItems] = useState<BuffetItem[]>([])
  const [statusMap, setStatusMap] = useState<Map<string, BuffetLiveStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Tick every second ────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Load buffet menu items ────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!teamId) return
    setLoading(true)

    let menuQuery = supabase
      .from('menus')
      .select('id, name, menu_sections(id, menu_items(id, name))')
      .eq('team_id', teamId)
      .eq('type', 'buffet')
      .eq('active', true)

    if (menuParam) menuQuery = menuQuery.eq('id', menuParam)

    const [{ data: menuData }, { data: statusData }] = await Promise.all([
      menuQuery,
      supabase.from('buffet_live_status').select('*').eq('team_id', teamId),
    ])

    const menus = (menuData ?? []) as unknown as MenuRow[]
    if (menus.length > 0) setMenuName(menus[0]!.name)
    const items: BuffetItem[] = menus.flatMap((m) =>
      m.menu_sections.flatMap((s) =>
        s.menu_items.map((i) => ({ menu_item_id: i.id, item_name: i.name })),
      ),
    )
    setMenuItems(items)

    const map = new Map<string, BuffetLiveStatus>()
    for (const row of (statusData ?? []) as BuffetLiveStatus[]) {
      if (row.menu_item_id) map.set(row.menu_item_id, row)
    }
    setStatusMap(map)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void loadAll() }, [loadAll])

  // ── Realtime ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) return

    const ch = supabase
      .channel(`buffet-kds:${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buffet_live_status', filter: `team_id=eq.${teamId}` },
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

  // ── Dispatch ─────────────────────────────────────────────────────────────────

  async function dispatch(item: MergedItem) {
    if (!teamId || !userId) return
    setDispatching(item.menu_item_id)
    try {
      if (item.row_id) {
        await supabase
          .from('buffet_live_status')
          .update({
            status: 'full',
            vessel_request: false,
            status_changed_at: new Date().toISOString(),
            changed_by: userId,
          })
          .eq('id', item.row_id)
      }
    } finally {
      setDispatching(null)
    }
  }

  // ── Merge menu items with live status ────────────────────────────────────────

  const merged: MergedItem[] = menuItems.map((item) => {
    const live = statusMap.get(item.menu_item_id)
    return {
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      status: live?.status ?? 'full',
      vessel_request: live?.vessel_request ?? false,
      status_changed_at: live?.status_changed_at ?? null,
      row_id: live?.id ?? null,
    }
  })

  const urgent = merged
    .filter((i) => needsAttention(i.status, i.vessel_request))
    .sort((a, b) => priorityScore(a.status, a.vessel_request) - priorityScore(b.status, b.vessel_request))

  const ok = merged.filter((i) => !needsAttention(i.status, i.vessel_request))

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#030712', color: '#fff' }}>

      {/* Top bar */}
      <header
        className="sticky top-0 z-10 backdrop-blur border-b px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: 'rgba(17,24,39,0.85)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <button
          onClick={() => navigate('/buffet-pulse')}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <ArrowLeft className="h-5 w-5" style={{ color: '#fff' }} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Activity className="h-5 w-5 shrink-0" style={{ color: '#f87171' }} />
          <span className="font-semibold truncate" style={{ color: '#fff' }}>
            {t('buffetPulse.kdsMode')}
          </span>
          {menuName && (
            <span className="hidden sm:inline shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              📋 {menuName}
            </span>
          )}
          <span
            className="ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
            style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}
          >
            {t('buffetPulse.liveIndicator')}
          </span>
        </div>
        <div className="shrink-0 text-sm font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
          </div>
        ) : merged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Activity className="h-12 w-12" style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {t('buffetPulse.noBuffetMenu')}
            </p>
          </div>
        ) : (
          <>
            {/* ── URGENT section ──────────────────────────────────── */}
            {urgent.length === 0 ? (
              <div
                className="flex items-center gap-3 rounded-2xl px-5 py-4"
                style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: '#34d399' }} />
                <div>
                  <p className="font-semibold" style={{ color: '#34d399' }}>{t('buffetPulse.allGood')}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(52,211,153,0.6)' }}>{t('buffetPulse.allGoodDesc')}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Urgent header */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {t('buffetPulse.priority')}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-black"
                    style={{ backgroundColor: '#dc2626', color: '#fff' }}
                  >
                    {urgent.length}
                  </span>
                </div>

                {/* Urgent cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {urgent.map((item) => {
                    const isDispatching = dispatching === item.menu_item_id
                    const headerBg = item.status === 'empty' ? '#991b1b' : '#92400e'

                    return (
                      <div
                        key={item.menu_item_id}
                        className="rounded-2xl overflow-hidden flex flex-col shadow-xl"
                        style={{
                          border: `1px solid ${item.status === 'empty' ? 'rgba(239,68,68,0.6)' : 'rgba(245,158,11,0.6)'}`,
                          backgroundColor: '#111827',
                        }}
                      >
                        {/* Name header */}
                        <div className="px-5 py-4" style={{ backgroundColor: headerBg }}>
                          <p className="text-2xl font-black leading-snug" style={{ color: '#fff' }}>
                            {item.item_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>
                              {item.status === 'empty' ? t('buffetPulse.empty') : t('buffetPulse.low')}
                            </span>
                            {item.vessel_request && (
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>· 🥘 Αλλαγή Σκεύους</span>
                            )}
                            {item.status_changed_at && (
                              <span className="ml-auto font-mono text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>
                                {formatElapsed(item.status_changed_at, nowMs)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dispatch button */}
                        <div className="p-3">
                          <button
                            disabled={isDispatching}
                            onClick={() => void dispatch(item)}
                            className="w-full rounded-xl py-5 text-base font-black transition-all select-none"
                            style={{
                              backgroundColor: isDispatching ? 'rgba(16,185,129,0.4)' : '#059669',
                              color: '#fff',
                              cursor: isDispatching ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isDispatching
                              ? <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                              : `✓ ${t('buffetPulse.dispatched')}`}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ── OK items compact grid ────────────────────────────── */}
            {ok.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {t('buffetPulse.full')} ({ok.length})
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {ok.map((item) => (
                    <div
                      key={item.menu_item_id}
                      className="rounded-xl px-4 py-3 flex items-center gap-2"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <span
                        className="shrink-0 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: '#10b981' }}
                      />
                      <span className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        {item.item_name}
                      </span>
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
