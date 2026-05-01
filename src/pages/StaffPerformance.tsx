import { useEffect, useMemo, useState } from 'react'
import {
  Users, Clock, TrendingUp, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'

type Period = '7d' | '30d' | 'mtd'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function periodStart(p: Period): string {
  const now = new Date()
  if (p === '7d')  { const d = new Date(now); d.setDate(d.getDate() - 6); return isoDate(d) }
  if (p === '30d') { const d = new Date(now); d.setDate(d.getDate() - 29); return isoDate(d) }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function minuteOfDay(ts: string): number {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}

function timeStrToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fmtHours(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60)
  const m = Math.abs(mins) % 60
  const sign = mins < 0 ? '-' : ''
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${m}m`
}

const LATE_THRESHOLD_MINS = 5 // minutes after scheduled start = late

interface MemberStats {
  id: string
  name: string
  avatar: string
  workedMins: number
  scheduledMins: number
  daysWorked: number
  daysScheduled: number
  lateCount: number
  onTimeCount: number
  overtimeMins: number
  avgDailyMins: number
  dailyBreakdown: DayBreakdown[]
}

interface DayBreakdown {
  date: string
  workedMins: number
  scheduledMins: number
  lateBy: number | null   // null = no shift, -1 = no entry
  clockIn: string | null
  clockOut: string | null
}

export default function StaffPerformance() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [period, setPeriod] = useState<Period>('30d')
  const [members, setMembers] = useState<MemberStats[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.team_id) return
    const from = periodStart(period)
    const teamId = profile.team_id

    async function load() {
      setLoading(true)

      const [entriesRes, shiftsRes] = await Promise.all([
        supabase
          .from('time_entries')
          .select('id, member_id, clock_in, clock_out, profiles!member_id(full_name, avatar_url)')
          .eq('team_id', teamId)
          .gte('clock_in', from)
          .not('clock_out', 'is', null),

        supabase
          .from('shifts')
          .select('id, member_id, shift_date, start_time, end_time, profiles!member_id(full_name)')
          .eq('team_id', teamId)
          .gte('shift_date', from),
      ])

      type EntryRow = {
        id: string
        member_id: string
        clock_in: string
        clock_out: string
        profiles: { full_name: string | null; avatar_url: string | null }
      }
      type ShiftRow = {
        id: string
        member_id: string
        shift_date: string
        start_time: string
        end_time: string
      }

      const entries = (entriesRes.data ?? []) as unknown as EntryRow[]
      const shifts  = (shiftsRes.data  ?? []) as ShiftRow[]

      // Collect member names & ids
      const memberMap = new Map<string, { name: string; avatar: string }>()
      for (const e of entries) {
        if (!memberMap.has(e.member_id)) {
          memberMap.set(e.member_id, {
            name:   e.profiles?.full_name ?? e.member_id.slice(0, 8),
            avatar: e.profiles?.avatar_url ?? '',
          })
        }
      }
      for (const s of shifts) {
        if (!memberMap.has(s.member_id)) {
          memberMap.set(s.member_id, { name: s.member_id.slice(0, 8), avatar: '' })
        }
      }

      const stats: MemberStats[] = []

      for (const [memberId, { name, avatar }] of memberMap) {
        const myEntries = entries.filter((e) => e.member_id === memberId)
        const myShifts  = shifts.filter((s)  => s.member_id === memberId)

        // Build per-day map
        const dayMap = new Map<string, DayBreakdown>()

        for (const s of myShifts) {
          const schedMins =
            timeStrToMins(s.end_time) - timeStrToMins(s.start_time)
          const existing = dayMap.get(s.shift_date)
          if (existing) {
            existing.scheduledMins += schedMins
          } else {
            dayMap.set(s.shift_date, {
              date: s.shift_date,
              workedMins: 0,
              scheduledMins: schedMins,
              lateBy: -1, // no entry yet
              clockIn: null,
              clockOut: null,
            })
          }
        }

        for (const e of myEntries) {
          const date = e.clock_in.slice(0, 10)
          const workedMins = Math.round(
            (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 60000,
          )
          const existing = dayMap.get(date)
          const shift = myShifts.find((s) => s.shift_date === date)
          const lateBy = shift
            ? Math.max(0, minuteOfDay(e.clock_in) - timeStrToMins(shift.start_time))
            : null

          if (existing) {
            existing.workedMins += workedMins
            existing.clockIn  = existing.clockIn  ?? e.clock_in
            existing.clockOut = e.clock_out
            existing.lateBy   = lateBy
          } else {
            dayMap.set(date, {
              date,
              workedMins,
              scheduledMins: 0,
              lateBy,
              clockIn:  e.clock_in,
              clockOut: e.clock_out,
            })
          }
        }

        const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))

        const workedMins    = days.reduce((s, d) => s + d.workedMins, 0)
        const scheduledMins = days.reduce((s, d) => s + d.scheduledMins, 0)
        const daysWorked    = days.filter((d) => d.workedMins > 0).length
        const daysScheduled = days.filter((d) => d.scheduledMins > 0).length

        const daysWithBoth  = days.filter((d) => d.lateBy !== null && d.lateBy !== -1)
        const lateCount     = daysWithBoth.filter((d) => (d.lateBy ?? 0) > LATE_THRESHOLD_MINS).length
        const onTimeCount   = daysWithBoth.length - lateCount

        const overtimeMins  = scheduledMins > 0 ? Math.max(0, workedMins - scheduledMins) : 0
        const avgDailyMins  = daysWorked > 0 ? Math.round(workedMins / daysWorked) : 0

        stats.push({
          id: memberId,
          name,
          avatar,
          workedMins,
          scheduledMins,
          daysWorked,
          daysScheduled,
          lateCount,
          onTimeCount,
          overtimeMins,
          avgDailyMins,
          dailyBreakdown: days,
        })
      }

      stats.sort((a, b) => b.workedMins - a.workedMins)
      setMembers(stats)
      setLoading(false)
    }

    void load()
  }, [profile?.team_id, period])

  const totalHours    = useMemo(() => members.reduce((s, m) => s + m.workedMins, 0), [members])
  const totalLate     = useMemo(() => members.reduce((s, m) => s + m.lateCount, 0), [members])
  const totalOvertime = useMemo(() => members.reduce((s, m) => s + m.overtimeMins, 0), [members])

  const PERIODS: { key: Period; label: string }[] = [
    { key: '7d',  label: t('staffPerf.period7d') },
    { key: '30d', label: t('staffPerf.period30d') },
    { key: 'mtd', label: t('staffPerf.periodMtd') },
  ]

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('staffPerf.title')}</h1>
          <p className="text-white/60 mt-1">{t('staffPerf.subtitle')}</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                period === p.key
                  ? 'bg-brand-orange text-white-fixed'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Team summary */}
      {!loading && members.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: t('staffPerf.totalHours'),
              value: fmtHours(totalHours),
              icon: Clock,
              color: 'text-brand-orange',
              bg: 'bg-brand-orange/15',
            },
            {
              label: t('staffPerf.lateArrivals'),
              value: String(totalLate),
              icon: AlertTriangle,
              color: totalLate > 0 ? 'text-amber-400' : 'text-emerald-400',
              bg: totalLate > 0 ? 'bg-amber-400/15' : 'bg-emerald-400/15',
            },
            {
              label: t('staffPerf.totalOvertime'),
              value: fmtHours(totalOvertime),
              icon: TrendingUp,
              color: totalOvertime > 0 ? 'text-blue-400' : 'text-white/40',
              bg: 'bg-blue-400/15',
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <GlassCard key={label} className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm text-white/60">{label}</div>
                <div className={cn('text-2xl font-semibold mt-0.5', color)}>{value}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : members.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <Users className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('staffPerf.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('staffPerf.empty.description')}</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {members.map((m) => {
            const isExp = expanded === m.id
            const punctuality = m.onTimeCount + m.lateCount > 0
              ? Math.round((m.onTimeCount / (m.onTimeCount + m.lateCount)) * 100)
              : null
            const attendanceRate = m.daysScheduled > 0
              ? Math.round((m.daysWorked / m.daysScheduled) * 100)
              : null

            return (
              <GlassCard key={m.id} className={cn(m.lateCount > 2 && 'border border-amber-500/20')}>
                <button
                  type="button"
                  className="w-full flex items-center gap-4"
                  onClick={() => setExpanded(isExp ? null : m.id)}
                >
                  {/* Avatar / initial */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange text-sm font-bold">
                    {m.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-xs text-white/40 mt-0.5 flex items-center gap-3 flex-wrap">
                      <span>{fmtHours(m.workedMins)} {t('staffPerf.worked')}</span>
                      {m.scheduledMins > 0 && <span>/ {fmtHours(m.scheduledMins)} {t('staffPerf.scheduled')}</span>}
                      {m.overtimeMins > 0 && (
                        <span className="text-blue-400">+{fmtHours(m.overtimeMins)} OT</span>
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="hidden sm:flex items-center gap-6 shrink-0">
                    {punctuality !== null && (
                      <div className="text-center">
                        <div className={cn('text-lg font-semibold',
                          punctuality === 100 ? 'text-emerald-400'
                            : punctuality >= 80 ? 'text-amber-400'
                            : 'text-red-400',
                        )}>
                          {punctuality}%
                        </div>
                        <div className="text-xs text-white/40">{t('staffPerf.punctuality')}</div>
                      </div>
                    )}
                    {attendanceRate !== null && (
                      <div className="text-center">
                        <div className={cn('text-lg font-semibold',
                          attendanceRate === 100 ? 'text-emerald-400'
                            : attendanceRate >= 80 ? 'text-amber-400'
                            : 'text-red-400',
                        )}>
                          {attendanceRate}%
                        </div>
                        <div className="text-xs text-white/40">{t('staffPerf.attendance')}</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-lg font-semibold">{m.daysWorked}</div>
                      <div className="text-xs text-white/40">{t('staffPerf.days')}</div>
                    </div>
                  </div>

                  {m.lateCount > 0 && (
                    <span className="hidden sm:flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5 shrink-0">
                      <AlertTriangle className="h-3 w-3" />
                      {m.lateCount}× {t('staffPerf.late')}
                    </span>
                  )}

                  <div className="text-white/30 shrink-0">
                    {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isExp && (
                  <div className="mt-4 pt-4 border-t border-glass-border">
                    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 text-xs text-white/40 uppercase tracking-wide mb-2 px-1">
                      <span>{t('staffPerf.date')}</span>
                      <span>{t('staffPerf.clockIn')}</span>
                      <span>{t('staffPerf.clockOut')}</span>
                      <span>{t('staffPerf.hours')}</span>
                      <span>{t('staffPerf.status')}</span>
                    </div>
                    <ul className="space-y-1">
                      {[...m.dailyBreakdown].reverse().map((day) => {
                        const late = day.lateBy !== null && day.lateBy !== -1 && day.lateBy > LATE_THRESHOLD_MINS
                        const noShow = day.scheduledMins > 0 && day.workedMins === 0
                        return (
                          <li key={day.date} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-center text-sm px-1 py-1.5 rounded-lg hover:bg-white/3 transition">
                            <span className="text-white/60">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            <span className="text-white/70">
                              {day.clockIn ? new Date(day.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                            <span className="text-white/70">
                              {day.clockOut ? new Date(day.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                            <span className="font-medium">{day.workedMins > 0 ? fmtHours(day.workedMins) : '—'}</span>
                            <span>
                              {noShow
                                ? <span className="text-xs text-red-400">{t('staffPerf.noShow')}</span>
                                : late
                                ? <span className="text-xs text-amber-400">+{day.lateBy}m</span>
                                : day.workedMins > 0
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                : <span className="text-white/20">—</span>}
                            </span>
                          </li>
                        )
                      })}
                    </ul>

                    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-glass-border text-xs text-white/40">
                      <span>{t('staffPerf.avgPerDay')}: <span className="text-white/70 font-medium">{fmtHours(m.avgDailyMins)}</span></span>
                      {m.overtimeMins > 0 && <span>{t('staffPerf.overtime')}: <span className="text-blue-400 font-medium">{fmtHours(m.overtimeMins)}</span></span>}
                    </div>
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
