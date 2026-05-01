import { useEffect, useState } from 'react'
import { Heart, TrendingUp, Users, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { ErrorState } from '../components/ui/ErrorState'

interface PulseRow {
  week: string
  morale: number
  workload: number
  note: string | null
  created_at: string
}

interface WeekSummary {
  week: string
  label: string
  avgMorale: number
  avgWorkload: number
  count: number
}

function thisMonday(): string {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 1 - day)
  return d.toISOString().slice(0, 10)
}

function weekLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const MORALE_LABEL = ['', '😞 Very low', '😐 Low', '🙂 OK', '😊 Good', '🤩 Great']
const WORKLOAD_LABEL = ['', '😴 Too light', '🧘 Light', '⚡ Normal', '🔥 Heavy', '💀 Overloaded']

export default function KitchenPulse() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [history, setHistory] = useState<WeekSummary[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [morale, setMorale] = useState(3)
  const [workload, setWorkload] = useState(3)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const currentWeek = thisMonday()

  async function load() {
    if (!profile?.team_id) return
    setLoadError(null)
    const twoMonthsAgo = new Date()
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 56)
    const { data, error: err } = await supabase
      .from('pulse_responses')
      .select('week, morale, workload, note, created_at')
      .eq('team_id', profile.team_id)
      .gte('week', twoMonthsAgo.toISOString().slice(0, 10))
      .order('week', { ascending: false })

    if (err) { setLoadError(err.message); setLoading(false); return }
    const rows = (data ?? []) as PulseRow[]

    // Aggregate by week
    const map = new Map<string, { morale: number[]; workload: number[] }>()
    for (const r of rows) {
      const existing = map.get(r.week)
      if (existing) { existing.morale.push(r.morale); existing.workload.push(r.workload) }
      else map.set(r.week, { morale: [r.morale], workload: [r.workload] })
    }

    const avg = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / arr.length

    const summaries: WeekSummary[] = [...map.entries()].map(([week, v]) => ({
      week,
      label: weekLabel(week),
      avgMorale: avg(v.morale),
      avgWorkload: avg(v.workload),
      count: v.morale.length,
    })).sort((a, b) => a.week.localeCompare(b.week))

    setHistory(summaries)

    // Check if current user already submitted this week
    const thisWeekRows = rows.filter((r) => r.week === currentWeek)
    // We can't know if it's the same anonymous user, but limit via UI by checking created_at in localStorage
    const lastSubmit = localStorage.getItem(`pulse_${profile.team_id}_${currentWeek}`)
    setSubmitted(!!lastSubmit)
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile?.team_id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile?.team_id) return
    setSaving(true)
    try {
      await supabase.from('pulse_responses').insert({
        team_id: profile.team_id,
        week: currentWeek,
        morale,
        workload,
        note: note.trim() || null,
      })
      localStorage.setItem(`pulse_${profile.team_id}_${currentWeek}`, '1')
      setSubmitted(true)
      void load()
    } finally {
      setSaving(false)
    }
  }

  const latestWeek = history.at(-1)
  const prevWeek = history.at(-2)
  const moraleTrend = latestWeek && prevWeek ? latestWeek.avgMorale - prevWeek.avgMorale : null
  const maxMorale = Math.max(...history.map((w) => w.avgMorale), 1)

  function scoreColor(v: number): string {
    if (v >= 4) return 'text-emerald-400'
    if (v >= 3) return 'text-amber-400'
    return 'text-red-400'
  }
  function barColor(v: number): string {
    if (v >= 4) return 'bg-emerald-400'
    if (v >= 3) return 'bg-amber-400'
    return 'bg-red-400'
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">{t('pulse.title')}</h1>
        <p className="text-white/60 mt-1">{t('pulse.subtitle')}</p>
      </header>

      {loadError && <ErrorState message={loadError} onRetry={() => void load()} />}

      {/* Weekly check-in card */}
      <GlassCard className="border border-brand-orange/20">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Heart className="h-5 w-5 text-brand-orange" />
          {t('pulse.thisWeek')}
          <span className="ml-auto text-sm font-normal text-white/40">{weekLabel(currentWeek)}</span>
        </h2>
        <p className="text-sm text-white/50 mb-5">{t('pulse.anonymous')}</p>

        {submitted ? (
          <div className="flex items-center gap-3 py-4 text-emerald-400">
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold">{t('pulse.submitted')}</p>
              <p className="text-sm text-white/50">{t('pulse.submittedSub')}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mb-3 block text-sm font-medium text-white/80">{t('pulse.moraleQ')}</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map((v) => (
                  <button key={v} type="button" onClick={() => setMorale(v)}
                    className={cn('flex-1 flex flex-col items-center gap-1 rounded-xl py-3 border transition text-sm',
                      morale === v ? 'border-brand-orange bg-brand-orange/15' : 'border-glass-border hover:bg-white/5')}>
                    <span className="text-xl">{MORALE_LABEL[v].split(' ')[0]}</span>
                    <span className={cn('text-xs', morale === v ? 'text-white' : 'text-white/40')}>{v}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-white/80">{t('pulse.workloadQ')}</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map((v) => (
                  <button key={v} type="button" onClick={() => setWorkload(v)}
                    className={cn('flex-1 flex flex-col items-center gap-1 rounded-xl py-3 border transition text-sm',
                      workload === v ? 'border-brand-orange bg-brand-orange/15' : 'border-glass-border hover:bg-white/5')}>
                    <span className="text-xl">{WORKLOAD_LABEL[v].split(' ')[0]}</span>
                    <span className={cn('text-xs', workload === v ? 'text-white' : 'text-white/40')}>{v}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">{t('pulse.noteQ')}</label>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={t('pulse.notePlaceholder')}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none" />
            </div>

            <Button type="submit" disabled={saving} leftIcon={<Heart className="h-4 w-4" />}>
              {saving ? t('common.saving') : t('pulse.submit')}
            </Button>
          </form>
        )}
      </GlassCard>

      {/* Summary stats */}
      {!loading && latestWeek && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: t('pulse.teamMorale'),
              value: latestWeek.avgMorale.toFixed(1),
              sub: MORALE_LABEL[Math.round(latestWeek.avgMorale)],
              color: scoreColor(latestWeek.avgMorale),
            },
            {
              label: t('pulse.teamWorkload'),
              value: latestWeek.avgWorkload.toFixed(1),
              sub: WORKLOAD_LABEL[Math.round(latestWeek.avgWorkload)],
              color: scoreColor(6 - latestWeek.avgWorkload),
            },
            {
              label: t('pulse.responses'),
              value: String(latestWeek.count),
              sub: t('pulse.thisWeekLabel'),
              color: 'text-white',
            },
          ].map(({ label, value, sub, color }) => (
            <GlassCard key={label} className="text-center py-5">
              <div className={cn('text-3xl font-bold', color)}>{value}</div>
              <div className="text-sm text-white/60 mt-1">{label}</div>
              <div className="text-xs text-white/40 mt-0.5">{sub}</div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Trend chart */}
      {!loading && history.length > 1 && (
        <GlassCard>
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            {t('pulse.moraleTrend')}
            {moraleTrend !== null && (
              <span className={cn('text-sm font-normal ml-auto', moraleTrend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {moraleTrend >= 0 ? '+' : ''}{moraleTrend.toFixed(1)} {t('pulse.vsLastWeek')}
              </span>
            )}
          </h2>
          <p className="text-xs text-white/40 mb-5">{t('pulse.trendHint')}</p>
          <div className="flex items-end gap-2 h-28">
            {history.map((w) => {
              const h = (w.avgMorale / 5) * 100
              return (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-white/50">{w.avgMorale.toFixed(1)}</div>
                  <div className={cn('w-full rounded-t-lg transition-all', barColor(w.avgMorale))}
                    style={{ height: `${Math.max(h, 6)}%` }} />
                  <div className="text-[10px] text-white/40 text-center">{w.label}</div>
                  <div className="text-[10px] text-white/25">{w.count}×</div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      )}

      {!loading && history.length === 0 && !submitted && (
        <GlassCard className="flex flex-col items-center text-center gap-2 py-8">
          <Users className="h-8 w-8 text-white/20" />
          <p className="text-white/40 text-sm">{t('pulse.noHistory')}</p>
        </GlassCard>
      )}
    </div>
  )
}
