import { useEffect, useState } from 'react'
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight, Trash2, Timer, FileDown } from 'lucide-react'
import { exportTimeclockE8 } from '../lib/erganiExport'
import { useTranslation } from 'react-i18next'
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
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

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
    // Kitchen-floor screen: always dark, whatever the app theme
    <div className="theme-dark rounded-3xl p-4 sm:p-6">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-medium tracking-[-0.03em]">{t('timeclock.title')}</h1>
            <p className="text-sm text-white/55">{t('timeclock.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white/[0.06] p-1">
              <button type="button" aria-label="−1" onClick={() => setDate((d) => addDays(d, -1))}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={() => setDate(todayIso())} className="min-w-[140px] px-2 text-sm font-medium">{formatDateLabel(date)}</button>
              <button type="button" aria-label="+1" onClick={() => setDate((d) => addDays(d, 1))} disabled={date >= todayIso()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
            </div>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => exportTimeclockE8(
                  entries.map((e) => ({ memberName: e.member_name ?? '—', clockIn: e.clock_in, clockOut: e.clock_out })),
                  formatDateLabel(date),
                )}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.06] px-5 text-sm font-medium hover:bg-white/10"
              >
                <FileDown className="h-4 w-4" />{t('timeclock.erganiExport')}
              </button>
            )}
          </div>
        </header>

        {error && <div className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-400">{error}</div>}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ── Clock in / out ── */}
          {isToday ? (
            <section className="flex flex-col items-center gap-5 rounded-3xl bg-bg-card p-8 text-center">
              <Timer className="h-8 w-8 text-white/50" />
              <p className="text-7xl font-medium tracking-[-0.04em] tabular-nums">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              {myOpenEntry ? (
                <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-400">
                  {t('timeclock.clockedIn')} · {t('timeclock.since')} {formatTime(myOpenEntry.clock_in)} · {formatDuration(durationMins(myOpenEntry.clock_in, null))}
                </span>
              ) : (
                <span className="text-sm text-white/55">{t('timeclock.tapToClockIn')}</span>
              )}
              {myOpenEntry ? (
                <button type="button" disabled={clockingOut} onClick={() => void handleClockOut()}
                  className="inline-flex h-20 w-full max-w-sm items-center justify-center gap-3 rounded-full bg-red-600 text-xl font-semibold text-white-fixed transition active:scale-[0.98] disabled:opacity-50">
                  <LogOut className="h-6 w-6" />{clockingOut ? t('common.saving') : t('timeclock.clockOut')}
                </button>
              ) : (
                <button type="button" disabled={clockingIn} onClick={() => void handleClockIn()}
                  className="inline-flex h-20 w-full max-w-sm items-center justify-center gap-3 rounded-full bg-lime text-xl font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50">
                  <LogIn className="h-6 w-6" />{clockingIn ? t('common.saving') : t('timeclock.clockIn')}
                </button>
              )}
            </section>
          ) : (
            <section className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-bg-card p-8 text-center">
              <Clock className="h-10 w-10 text-white/30" />
              <p className="text-lg font-medium">{formatDateLabel(date)}</p>
              <button type="button" onClick={() => setDate(todayIso())} className="rounded-full bg-lime px-5 py-2.5 text-sm font-medium text-ink">{t('common.today')}</button>
            </section>
          )}

          <div className="flex flex-col gap-4">
            {/* ── Who is on shift ── */}
            {memberTotals.size > 0 && (
              <section className="rounded-3xl bg-bg-card p-5">
                <h2 className="mb-3 text-lg font-medium">{t('timeclock.v2.people')}</h2>
                <ul className="flex flex-col gap-2">
                  {[...memberTotals.entries()].map(([memberId, info]) => (
                    <li key={memberId} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', info.open ? 'bg-emerald-500' : 'bg-white/25')} />
                      <span className="flex-1 truncate font-medium">{info.name ?? t('common.unnamed')}</span>
                      <span className="tabular-nums text-white/60">{formatDuration(info.totalMins)}</span>
                      {info.open && <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">{t('timeclock.active')}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Entries ── */}
            <section className="rounded-3xl bg-bg-card p-5">
              <h2 className="mb-3 text-lg font-medium">{t('timeclock.entries')}</h2>
              {loading ? (
                <p className="text-white/55">{t('common.loading')}</p>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Clock className="h-10 w-10 text-white/20" />
                  <p className="text-white/55">{t('timeclock.noEntries')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {entries.map((entry) => {
                    const mins = durationMins(entry.clock_in, entry.clock_out)
                    const isMe = entry.member_id === user?.id
                    return (
                      <li key={entry.id} className="flex items-center gap-3 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{entry.member_name ?? t('common.unnamed')}</span>
                            {isMe && <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-medium text-ink">{t('common.you')}</span>}
                          </div>
                          <div className="mt-0.5 tabular-nums text-white/55">
                            {formatTime(entry.clock_in)} → {entry.clock_out ? formatTime(entry.clock_out) : <span className="text-emerald-400">{t('timeclock.stillIn')}</span>}
                            {' · '}<span className={entry.clock_out ? '' : 'text-emerald-400'}>{formatDuration(mins)}</span>
                          </div>
                        </div>
                        {isMe && (
                          <button type="button" onClick={() => void remove(entry.id)} aria-label={t('common.delete')}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-white/35 hover:bg-red-500/10 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
