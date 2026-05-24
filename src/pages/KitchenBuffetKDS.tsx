import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import type { BuffetLiveStatus } from '../types/database.types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatElapsed(sinceIso: string, nowMs: number): string {
  const diffSec = Math.floor((nowMs - new Date(sinceIso).getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}δ`
  const m = Math.floor(diffSec / 60)
  const s = diffSec % 60
  return `${m}λ ${String(s).padStart(2, '0')}δ`
}

function priorityScore(row: BuffetLiveStatus): number {
  if (row.status === 'empty') return 0
  if (row.vessel_request && row.status === 'low') return 1
  if (row.vessel_request) return 2
  return 3 // low only
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function KitchenBuffetKDS() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null

  const [rows, setRows] = useState<BuffetLiveStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Tick every second for timers ─────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Load all status rows ─────────────────────────────────────────────────────

  const loadRows = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    const { data } = await supabase
      .from('buffet_live_status')
      .select('*')
      .eq('team_id', teamId)
    setRows((data ?? []) as BuffetLiveStatus[])
    setLoading(false)
  }, [teamId])

  useEffect(() => { void loadRows() }, [loadRows])

  // ── Realtime ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) return

    const ch = supabase
      .channel(`buffet-kds:${teamId}`)
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
            if (old.id) setRows((prev) => prev.filter((r) => r.id !== old.id))
            return
          }
          const row = payload.new as BuffetLiveStatus
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.id === row.id)
            if (idx === -1) return [...prev, row]
            const next = [...prev]
            next[idx] = row
            return next
          })
        },
      )
      .subscribe()

    channelRef.current = ch
    return () => { void supabase.removeChannel(ch) }
  }, [teamId])

  // ── Dispatch: mark item as full, clear vessel request ────────────────────────

  async function dispatch(row: BuffetLiveStatus) {
    if (!teamId || !userId) return
    setDispatching(row.id)
    try {
      await supabase
        .from('buffet_live_status')
        .update({
          status: 'full',
          vessel_request: false,
          status_changed_at: new Date().toISOString(),
          changed_by: userId,
        })
        .eq('id', row.id)
    } finally {
      setDispatching(null)
    }
  }

  // ── Derived: filter + sort ────────────────────────────────────────────────────

  const attention = rows
    .filter((r) => r.status !== 'full' || r.vessel_request)
    .sort((a, b) => priorityScore(a) - priorityScore(b))

  // ── Card config ───────────────────────────────────────────────────────────────

  function cardStyle(row: BuffetLiveStatus) {
    if (row.status === 'empty') return { border: 'border-red-500/70', badge: 'bg-red-600', pulse: true }
    if (row.status === 'low')   return { border: 'border-amber-500/70', badge: 'bg-amber-600', pulse: false }
    return { border: 'border-amber-400/50', badge: 'bg-amber-500/80', pulse: false } // vessel only
  }

  // ── Render ────────────────────────────────────────────────────────────────────

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
          <Activity className="h-5 w-5 text-red-400 shrink-0" />
          <span className="font-semibold truncate">{t('buffetPulse.kdsMode')}</span>
          <span className="ml-1 shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-red-400 uppercase">
            {t('buffetPulse.liveIndicator')}
          </span>
        </div>
        <div className="shrink-0 text-sm font-mono text-white/40 tabular-nums">
          {new Date(nowMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </header>

      {/* Priority queue header */}
      {attention.length > 0 && (
        <div className="px-4 py-2 bg-gray-900 border-b border-white/10 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {t('buffetPulse.priority')}
          </span>
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            {attention.length}
          </span>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : attention.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <CheckCircle2 className="h-16 w-16 text-emerald-500/40" />
            <p className="text-xl font-semibold text-white/60">{t('buffetPulse.allGood')}</p>
            <p className="text-sm text-white/30">{t('buffetPulse.allGoodDesc')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map((row) => {
              const style = cardStyle(row)
              const isDispatching = dispatching === row.id
              const elapsed = formatElapsed(row.status_changed_at, nowMs)

              return (
                <div
                  key={row.id}
                  className={cn(
                    'rounded-2xl bg-gray-900 border p-4 flex flex-col gap-3',
                    style.border,
                    style.pulse && 'animate-pulse-border',
                  )}
                >
                  {/* Status badge + elapsed timer */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white', style.badge)}>
                        {row.status === 'empty'
                          ? t('buffetPulse.empty')
                          : row.status === 'low'
                          ? t('buffetPulse.low')
                          : '—'}
                      </span>
                      {row.vessel_request && (
                        <span className="rounded-lg bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 text-xs font-semibold text-amber-300">
                          🥘 Σκεύος
                        </span>
                      )}
                    </div>
                    {/* Timer */}
                    <span className="font-mono text-sm tabular-nums text-white/50">
                      {t('buffetPulse.since')} {elapsed}
                    </span>
                  </div>

                  {/* Item name */}
                  <p className="text-2xl font-bold leading-tight">{row.item_name}</p>

                  {/* Dispatch button */}
                  <button
                    disabled={isDispatching}
                    onClick={() => void dispatch(row)}
                    className={cn(
                      'mt-auto w-full rounded-xl py-4 text-base font-bold transition-all select-none',
                      'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 text-white',
                      isDispatching && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    {isDispatching
                      ? <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      : `✓ ${t('buffetPulse.dispatched')}`}
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
