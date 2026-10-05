import { useEffect, useMemo, useState } from 'react'
import {
  Users, Clock, TrendingUp, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, Segmented, StatRow, StatTile, Panel, EmptyState } from '../components/ui/page'
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

  const sel = members.find((m) => m.id === expanded) ?? members[0]
  const pctTone = (v: number | null) => v == null ? 'text-white/40' : v === 100 ? 'text-emerald-500' : v >= 80 ? 'text-amber-500' : 'text-red-500'
  const rateOf = (a: number, b: number) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : null)

  return (
    <Page>
      <PageHeader
        title={t('staffPerf.title')}
        subtitle={t('staffPerf.subtitle')}
        actions={<Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />}
      />

      {!loading && members.length > 0 && (
        <StatRow>
          <StatTile tone="ink" label={t('staffPerf.totalHours')} value={fmtHours(totalHours)} icon={Clock} />
          <StatTile label={t('staffPerf.lateArrivals')} value={totalLate} tone={totalLate > 0 ? 'warn' : 'good'} icon={AlertTriangle} />
          <StatTile label={t('staffPerf.totalOvertime')} value={fmtHours(totalOvertime)} tone={totalOvertime > 0 ? 'warn' : 'default'} icon={TrendingUp} />
          <StatTile tone="lime" label={t('team.members')} value={members.length} icon={Users} />
        </StatRow>
      )}

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title={t('staffPerf.empty.title')} body={t('staffPerf.empty.description')} />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── Ranking ── */}
          <Panel padded={false}>
            <div className="overflow-x-auto p-2">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/50">
                    <th className="px-3 py-3 font-medium">{t('staffPerf.v2.person')}</th>
                    <th className="px-3 py-3 font-medium">{t('staffPerf.v2.hoursVsScheduled')}</th>
                    <th className="px-3 py-3 text-right font-medium">{t('staffPerf.punctuality')}</th>
                    <th className="px-3 py-3 text-right font-medium">{t('staffPerf.attendance')}</th>
                    <th className="px-3 py-3 text-right font-medium">{t('staffPerf.late')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const punctuality = rateOf(m.onTimeCount, m.lateCount)
                    const attendanceRate = m.daysScheduled > 0 ? Math.round((m.daysWorked / m.daysScheduled) * 100) : null
                    const isSel = sel?.id === m.id
                    const fill = m.scheduledMins > 0 ? Math.min((m.workedMins / m.scheduledMins) * 100, 100) : m.workedMins > 0 ? 100 : 0
                    return (
                      <tr key={m.id} onClick={() => setExpanded(m.id)} className={cn('cursor-pointer transition', isSel ? 'bg-ink text-white-fixed' : 'hover:bg-white/[0.03]')}>
                        <td className="rounded-l-2xl px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold', isSel ? 'bg-lime text-ink' : 'bg-white/[0.06]')}>{m.name.charAt(0).toUpperCase()}</span>
                            <span className="font-medium">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn('h-2 w-28 overflow-hidden rounded-full', isSel ? 'bg-white-fixed/15' : 'bg-white/[0.08]')}>
                              <div className={cn('h-2 rounded-full', isSel ? 'bg-lime' : 'bg-ink')} style={{ width: `${fill}%` }} />
                            </div>
                            <span className="text-xs tabular-nums opacity-70">
                              {fmtHours(m.workedMins)}{m.scheduledMins > 0 && ` / ${fmtHours(m.scheduledMins)}`}
                            </span>
                            {m.overtimeMins > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">+{fmtHours(m.overtimeMins)}</span>}
                          </div>
                        </td>
                        <td className={cn('px-3 py-3 text-right font-medium tabular-nums', !isSel && pctTone(punctuality))}>{punctuality != null ? `${punctuality}%` : '—'}</td>
                        <td className={cn('px-3 py-3 text-right font-medium tabular-nums', !isSel && pctTone(attendanceRate))}>{attendanceRate != null ? `${attendanceRate}%` : '—'}</td>
                        <td className="rounded-r-2xl px-3 py-3 text-right tabular-nums">{m.lateCount || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* ── Detail ── */}
          {sel && (
            <Panel title={sel.name} className="xl:sticky xl:top-24">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/[0.04] p-3">
                  <p className="text-xs text-white/50">{t('staffPerf.avgPerDay')}</p>
                  <p className="font-medium tabular-nums">{fmtHours(sel.avgDailyMins)}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-3">
                  <p className="text-xs text-white/50">{t('staffPerf.days')}</p>
                  <p className="font-medium tabular-nums">{sel.daysWorked}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-3">
                  <p className="text-xs text-white/50">{t('staffPerf.overtime')}</p>
                  <p className="font-medium tabular-nums">{sel.overtimeMins > 0 ? fmtHours(sel.overtimeMins) : '—'}</p>
                </div>
              </div>
              <ul className="max-h-[420px] divide-y divide-white/[0.06] overflow-y-auto">
                {[...sel.dailyBreakdown].reverse().map((day) => {
                  const late = day.lateBy !== null && day.lateBy !== -1 && day.lateBy > LATE_THRESHOLD_MINS
                  const noShow = day.scheduledMins > 0 && day.workedMins === 0
                  return (
                    <li key={day.date} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 text-sm">
                      <span>
                        <span className="block">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <span className="block text-xs tabular-nums text-white/50">
                          {day.clockIn ? new Date(day.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          {' → '}
                          {day.clockOut ? new Date(day.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">{day.workedMins > 0 ? fmtHours(day.workedMins) : '—'}</span>
                      <span className="w-20 text-right">
                        {noShow ? <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">{t('staffPerf.noShow')}</span>
                          : late ? <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-500 tabular-nums">+{day.lateBy}′</span>
                          : day.workedMins > 0 ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
                          : <span className="text-white/25">—</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </Page>
  )
}
