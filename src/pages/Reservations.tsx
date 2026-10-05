import { useState } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, Users, Phone, Mail, Check, X, Coffee, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, StatRow, StatTile, Panel, EmptyState, Notice } from '../components/ui/page'
import { useReservations } from '../hooks/useReservations'
import { cn } from '../lib/cn'
import type { Reservation, ReservationStatus } from '../types/database.types'

const STATUS_STYLES: Record<ReservationStatus, string> = {
  pending:   'bg-amber-500/15 text-amber-500',
  confirmed: 'bg-sky-500/12 text-sky-500',
  seated:    'bg-lime text-ink',
  completed: 'bg-emerald-500/12 text-emerald-500',
  cancelled: 'bg-white/[0.08] text-white/50',
}

const STATUS_ORDER: ReservationStatus[] = ['pending', 'confirmed', 'seated', 'completed', 'cancelled']

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateLabel(iso: string) {
  const today = todayIso()
  const tomorrow = addDays(today, 1)
  if (iso === today) return 'Today'
  if (iso === tomorrow) return 'Tomorrow'
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'short',
  })
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function Reservations() {
  const { t } = useTranslation()
  const [date, setDate] = useState(todayIso())
  const { reservations, loading, error, update, remove } = useReservations(date)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = reservations.find((r) => r.id === selectedId) ?? null

  async function handleStatus(r: Reservation, status: ReservationStatus) {
    await update(r.id, { status })
    if (selectedId === r.id && (status === 'completed' || status === 'cancelled')) {
      setSelectedId(null)
    }
  }

  const pending = reservations.filter((r) => r.status === 'pending').length

  const active = reservations.filter((r) => r.status !== 'cancelled')
  const covers = active.reduce((sum, r) => sum + r.party_size, 0)
  const seated = reservations.filter((r) => r.status === 'seated').length
  const byHour = [...new Set(reservations.map((r) => r.reservation_time.slice(0, 2)))].sort()

  return (
    <Page>
      <PageHeader
        title={t('reservations.title')}
        subtitle={t('reservations.subtitle')}
        actions={
          <div className="flex items-center gap-1 rounded-full bg-bg-card p-1 shadow-card">
            <button type="button" aria-label="−1" onClick={() => setDate((d) => addDays(d, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setDate(todayIso())} className="min-w-[140px] px-2 text-sm font-medium first-letter:uppercase" title={t('common.today')}>
              {dateLabel(date)}
            </button>
            <button type="button" aria-label="+1" onClick={() => setDate((d) => addDays(d, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white"><ChevronRight className="h-4 w-4" /></button>
          </div>
        }
      />

      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile tone="ink" label={t('reservations.title')} value={active.length} hint={dateLabel(date)} />
        <StatTile label={t('reservations.guests')} value={covers} icon={Users} />
        <StatTile label={t('reservations.status.pending')} value={pending} tone={pending ? 'warn' : 'default'} hint={pending ? t('reservations.pendingCount', { count: pending }) : undefined} />
        <StatTile tone="lime" label={t('reservations.status.seated')} value={seated} icon={Coffee} />
      </StatRow>

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : reservations.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={t('reservations.noReservations')} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── Timeline by hour ── */}
          <Panel>
            <ol className="flex flex-col">
              {byHour.map((hour) => (
                <li key={hour} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
                  <span className="pt-2 text-lg font-medium tabular-nums text-white/55">{hour}:00</span>
                  <div className="flex flex-col gap-2">
                    {reservations.filter((r) => r.reservation_time.slice(0, 2) === hour).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={selectedId === r.id}
                        onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                        className={cn('flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition', selectedId === r.id ? 'bg-ink text-white-fixed' : 'bg-white/[0.04] hover:bg-white/[0.07]', r.status === 'cancelled' && 'opacity-50')}
                      >
                        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-medium tabular-nums', selectedId === r.id ? 'bg-lime text-ink' : 'bg-bg-card shadow-card')}>
                          {r.party_size}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{r.guest_name}</span>
                          <span className={cn('flex items-center gap-1 text-xs tabular-nums', selectedId === r.id ? 'text-white-fixed/60' : 'text-white/50')}>
                            <Clock className="h-3 w-3" />{formatTime(r.reservation_time)}{r.notes && ` · ${r.notes.slice(0, 40)}`}
                          </span>
                        </span>
                        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[r.status])}>{t(`reservations.status.${r.status}`)}</span>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          {/* ── Detail ── */}
          {selected ? (
            <Panel className="lg:sticky lg:top-24">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-medium tracking-[-0.02em]">{selected.guest_name}</h2>
                  <p className="text-sm text-white/55">{formatTime(selected.reservation_time)} · {selected.party_size} {t('reservations.guests')}</p>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label={t('common.close', 'Close')} className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.guest_phone && (
                  <a href={`tel:${selected.guest_phone}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-orange px-4 text-sm font-medium text-on-accent"><Phone className="h-4 w-4" />{selected.guest_phone}</a>
                )}
                {selected.guest_email && (
                  <a href={`mailto:${selected.guest_email}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm font-medium"><Mail className="h-4 w-4" />{selected.guest_email}</a>
                )}
              </div>
              {selected.notes && <p className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-600">{selected.notes}</p>}
              <div className="flex flex-col gap-2">
                <span className="text-sm text-white/55">{t('reservations.changeStatus')}</span>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_ORDER.filter((st) => st !== selected.status).map((st) => (
                    <button key={st} type="button" onClick={() => void handleStatus(selected, st)}
                      className={cn('flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium transition hover:brightness-95', STATUS_STYLES[st])}>
                      {st === 'cancelled' ? <X className="h-4 w-4" /> : st === 'seated' ? <Coffee className="h-4 w-4" /> : st === 'pending' ? <Clock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      {t(`reservations.status.${st}`)}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => { if (window.confirm(t('reservations.deleteConfirm'))) void remove(selected.id).then(() => setSelectedId(null)) }}
                className="self-start text-sm font-medium text-red-500 hover:underline">
                {t('common.delete')}
              </button>
            </Panel>
          ) : (
            <div className="hidden items-center justify-center rounded-3xl border border-dashed border-white/15 p-10 text-center text-sm text-white/45 lg:flex">
              {t('reservations.selectHint')}
            </div>
          )}
        </div>
      )}
    </Page>
  )
}
