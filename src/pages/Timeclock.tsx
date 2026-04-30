import { useState } from 'react'
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight, Trash2, Timer, FileDown } from 'lucide-react'
import { exportTimeclockE8 } from '../lib/erganiExport'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { useTimeclock, durationMins, formatDuration } from '../hooks/useTimeclock'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string): string {
  const today = todayIso()
  const yesterday = addDays(today, -1)
  if (iso === today) return 'Today'
  if (iso === yesterday) return 'Yesterday'
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function Timeclock() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [date, setDate] = useState(todayIso())
  const { entries, loading, error, myOpenEntry, clockIn, clockOut, remove } = useTimeclock(date)

  const [clockingIn, setClockinIn] = useState(false)
  const [clockingOut, setClockinOut] = useState(false)

  const isToday = date === todayIso()

  async function handleClockIn() {
    setClockinIn(true)
    try { await clockIn() } finally { setClockinIn(false) }
  }

  async function handleClockOut() {
    if (!myOpenEntry) return
    setClockinOut(true)
    try { await clockOut(myOpenEntry.id) } finally { setClockinOut(false) }
  }

  // Total hours per member today
  const memberTotals = new Map<string, { name: string | null; totalMins: number; open: boolean }>()
  for (const e of entries) {
    const prev = memberTotals.get(e.member_id)
    const mins = durationMins(e.clock_in, e.clock_out)
    memberTotals.set(e.member_id, {
      name: e.member_name,
      totalMins: (prev?.totalMins ?? 0) + mins,
      open: (prev?.open ?? false) || !e.clock_out,
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('timeclock.title')}</h1>
          <p className="text-white/60 mt-1">{t('timeclock.subtitle')}</p>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => exportTimeclockE8(
              entries.map((e) => ({
                memberName: e.member_name ?? '—',
                clockIn: e.clock_in,
                clockOut: e.clock_out,
              })),
              formatDateLabel(date),
            )}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white/90 border border-white/10 hover:border-white/25 rounded-xl px-3 py-2 transition"
          >
            <FileDown className="h-4 w-4" />
            {t('timeclock.erganiExport')}
          </button>
        )}
      </header>

      {/* Clock In / Out card — only shown for today */}
      {isToday && (
        <GlassCard className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <Timer className="h-8 w-8" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            {myOpenEntry ? (
              <>
                <p className="font-semibold text-emerald-300">{t('timeclock.clockedIn')}</p>
                <p className="text-sm text-white/60 mt-0.5">
                  {t('timeclock.since')} {formatTime(myOpenEntry.clock_in)}
                  {' · '}
                  <span className="text-white">{formatDuration(durationMins(myOpenEntry.clock_in, null))}</span>
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">{t('timeclock.notClockedIn')}</p>
                <p className="text-sm text-white/60 mt-0.5">{t('timeclock.tapToClockIn')}</p>
              </>
            )}
          </div>
          {myOpenEntry ? (
            <Button
              variant="ghost"
              leftIcon={<LogOut className="h-5 w-5" />}
              disabled={clockingOut}
              onClick={() => void handleClockOut()}
              className="border border-red-500/40 text-red-300 hover:bg-red-500/10"
            >
              {clockingOut ? t('common.saving') : t('timeclock.clockOut')}
            </Button>
          ) : (
            <Button
              leftIcon={<LogIn className="h-5 w-5" />}
              disabled={clockingIn}
              onClick={() => void handleClockIn()}
            >
              {clockingIn ? t('common.saving') : t('timeclock.clockIn')}
            </Button>
          )}
        </GlassCard>
      )}

      {/* Date navigator */}
      <GlassCard className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setDate((d) => addDays(d, -1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold">{formatDateLabel(date)}</p>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayIso())}
              className="text-xs text-white/40 hover:text-white/70 transition mt-0.5"
            >
              {t('common.today')}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDate((d) => addDays(d, 1))}
          disabled={date >= todayIso()}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </GlassCard>

      {/* Summary by member */}
      {memberTotals.size > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...memberTotals.entries()].map(([memberId, info]) => (
            <GlassCard key={memberId} className="flex items-center gap-4">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                info.open ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/40',
              )}>
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{info.name ?? t('common.unnamed')}</p>
                <p className="text-sm text-white/50">
                  {formatDuration(info.totalMins)}
                  {info.open && <span className="ml-1 text-emerald-400">· {t('timeclock.active')}</span>}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Detailed entries */}
      {error && <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>}

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : entries.length === 0 ? (
        <GlassCard className="text-center py-10">
          <Clock className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">{t('timeclock.noEntries')}</p>
        </GlassCard>
      ) : (
        <GlassCard>
          <h2 className="text-base font-semibold mb-3">{t('timeclock.entries')}</h2>
          <ul className="divide-y divide-glass-border">
            {entries.map((entry) => {
              const mins = durationMins(entry.clock_in, entry.clock_out)
              const isMe = entry.member_id === user?.id
              return (
                <li key={entry.id} className="flex items-center gap-3 py-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.member_name ?? t('common.unnamed')}</span>
                      {isMe && <span className="text-xs text-brand-orange">{t('common.you')}</span>}
                    </div>
                    <div className="text-white/50 mt-0.5">
                      {formatTime(entry.clock_in)}
                      {' → '}
                      {entry.clock_out ? formatTime(entry.clock_out) : (
                        <span className="text-emerald-400">{t('timeclock.stillIn')}</span>
                      )}
                      {' · '}
                      <span className={entry.clock_out ? 'text-white/60' : 'text-emerald-400'}>
                        {formatDuration(mins)}
                      </span>
                    </div>
                  </div>
                  {isMe && (
                    <button
                      type="button"
                      onClick={() => void remove(entry.id)}
                      className="text-white/20 hover:text-red-400 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </GlassCard>
      )}
    </div>
  )
}
