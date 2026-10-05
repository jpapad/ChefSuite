import { useEffect, useState } from 'react'
import { Heart, TrendingUp, Users, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, PillButton, Panel, StatTile, EmptyState } from '../components/ui/page'
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

    // Check if current user already submitted this week via localStorage
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

  const words = (label: string | undefined) => (label ?? '').split(' ').slice(1).join(' ')

  function Scale({ value, onChange, labels }: { value: number; onChange: (v: number) => void; labels: Record<number, string> }) {
    return (
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn('flex flex-col items-center gap-1 rounded-2xl py-3 transition', value === v ? 'bg-ink text-white-fixed' : 'bg-white/[0.05] hover:bg-white/[0.08]')}
          >
            <span className={cn('text-2xl font-medium tabular-nums', value === v && 'text-lime')}>{v}</span>
            <span className={cn('px-1 text-center text-[11px] leading-tight', value === v ? 'text-white-fixed/70' : 'text-white/50')}>{words(labels[v])}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <Page>
      <PageHeader title={t('pulse.title')} subtitle={t('pulse.subtitle')} eyebrow={weekLabel(currentWeek)} />

      {loadError && <ErrorState message={loadError} onRetry={() => void load()} />}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ── Weekly check-in ── */}
        <Panel title={<span className="flex items-center gap-2"><Heart className="h-5 w-5 text-red-500" />{t('pulse.thisWeek')}</span>}>
          <p className="-mt-2 text-sm text-white/55">{t('pulse.anonymous')}</p>
          {submitted ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 p-4 text-emerald-500">
              <CheckCircle2 className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-medium">{t('pulse.submitted')}</p>
                <p className="text-sm text-white/55">{t('pulse.submittedSub')}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('pulse.moraleQ')}</span>
                <Scale value={morale} onChange={setMorale} labels={MORALE_LABEL} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('pulse.workloadQ')}</span>
                <Scale value={workload} onChange={setWorkload} labels={WORKLOAD_LABEL} />
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('pulse.noteQ')}</span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pulse.notePlaceholder')}
                  className="w-full resize-none rounded-2xl bg-white/[0.05] px-4 py-3 text-sm outline-none placeholder:text-white/40 focus:ring-2 focus:ring-brand-orange/40" />
              </label>
              <PillButton type="submit" variant="primary" icon={Heart} disabled={saving} className="self-start">
                {saving ? t('common.saving') : t('pulse.submit')}
              </PillButton>
            </form>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          {!loading && latestWeek && (
            <div className="grid grid-cols-3 gap-3">
              <StatTile tone="ink" label={t('pulse.teamMorale')} value={latestWeek.avgMorale.toFixed(1)} hint={words(MORALE_LABEL[Math.round(latestWeek.avgMorale)])} />
              <StatTile label={t('pulse.teamWorkload')} value={latestWeek.avgWorkload.toFixed(1)} hint={words(WORKLOAD_LABEL[Math.round(latestWeek.avgWorkload)])}
                tone={latestWeek.avgWorkload >= 4 ? 'warn' : 'default'} />
              <StatTile label={t('pulse.responses')} value={latestWeek.count} hint={t('pulse.thisWeekLabel')} />
            </div>
          )}

          {!loading && history.length > 1 && (
            <Panel
              title={<span className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />{t('pulse.moraleTrend')}</span>}
              actions={moraleTrend !== null ? (
                <span className={cn('rounded-full px-3 py-1 text-sm font-medium', moraleTrend >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500')}>
                  {moraleTrend >= 0 ? '+' : ''}{moraleTrend.toFixed(1)} {t('pulse.vsLastWeek')}
                </span>
              ) : undefined}
            >
              <p className="-mt-2 text-xs text-white/50">{t('pulse.trendHint')}</p>
              <div className="flex h-40 items-end gap-2">
                {history.map((w, i) => (
                  <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[11px] tabular-nums text-white/55">{w.avgMorale.toFixed(1)}</span>
                    <div className={cn('w-full rounded-t-lg', i === history.length - 1 ? 'bg-ink' : 'bg-white/[0.1]')} style={{ height: `${Math.max((w.avgMorale / 5) * 100, 6)}%` }} />
                    <span className="text-center text-[11px] text-white/45">{w.label}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {!loading && history.length === 0 && !submitted && (
            <EmptyState icon={Users} title={t('pulse.noHistory')} />
          )}
        </div>
      </div>
    </Page>
  )
}
