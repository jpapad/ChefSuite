import { useState } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, Users, Phone, Mail, Check, X, Coffee, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { useReservations } from '../hooks/useReservations'
import { cn } from '../lib/cn'
import type { Reservation, ReservationStatus } from '../types/database.types'

const STATUS_STYLES: Record<ReservationStatus, string> = {
  pending:   'bg-amber-500/20 text-amber-300',
  confirmed: 'bg-blue-500/20 text-blue-300',
  seated:    'bg-brand-orange/20 text-brand-orange',
  completed: 'bg-emerald-500/20 text-emerald-300',
  cancelled: 'bg-white/10 text-white/40',
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">{t('reservations.title')}</h1>
        <p className="text-white/60 mt-1">{t('reservations.subtitle')}</p>
      </header>

      {error && <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>}

      {/* Date navigator */}
      <GlassCard className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setDate((d) => addDays(d, -1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold">{dateLabel(date)}</p>
          <div className="flex items-center justify-center gap-3 mt-0.5">
            {pending > 0 && (
              <span className="text-xs text-amber-400">{t('reservations.pendingCount', { count: pending })}</span>
            )}
            {date !== todayIso() && (
              <button type="button" onClick={() => setDate(todayIso())}
                className="text-xs text-white/40 hover:text-white/70 transition">
                {t('common.today')}
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setDate((d) => addDays(d, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5">
          <ChevronRight className="h-5 w-5" />
        </button>
      </GlassCard>

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : reservations.length === 0 ? (
        <GlassCard className="text-center py-10">
          <CalendarCheck className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">{t('reservations.noReservations')}</p>
        </GlassCard>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* List */}
          <div className="space-y-2">
            {reservations.map((r) => (
              <GlassCard
                key={r.id}
                className={cn(
                  'flex items-center gap-4 cursor-pointer hover:bg-white/[.03] transition',
                  selectedId === r.id && 'ring-2 ring-brand-orange/50',
                )}
                onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <span className="text-lg font-bold text-white/60">{r.party_size}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{r.guest_name}</span>
                    <span className={cn('text-xs rounded-full px-2 py-0.5 font-medium shrink-0', STATUS_STYLES[r.status])}>
                      {t(`reservations.status.${r.status}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-white/50">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(r.reservation_time)}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{r.party_size}</span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Detail panel */}
          {selected ? (
            <GlassCard className="space-y-4 self-start">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selected.guest_name}</h2>
                  <p className="text-sm text-white/50 mt-0.5">
                    {formatTime(selected.reservation_time)} · {selected.party_size} {t('reservations.guests')}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedId(null)}
                  className="text-white/40 hover:text-white transition">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Contact */}
              <div className="space-y-1.5">
                {selected.guest_phone && (
                  <a href={`tel:${selected.guest_phone}`} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition">
                    <Phone className="h-4 w-4" />{selected.guest_phone}
                  </a>
                )}
                {selected.guest_email && (
                  <a href={`mailto:${selected.guest_email}`} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition">
                    <Mail className="h-4 w-4" />{selected.guest_email}
                  </a>
                )}
                {selected.notes && (
                  <p className="text-sm text-white/50 mt-2 p-3 rounded-xl bg-white/5 border border-glass-border">
                    {selected.notes}
                  </p>
                )}
              </div>

              {/* Status actions */}
              <div className="space-y-2 pt-1">
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">{t('reservations.changeStatus')}</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ORDER.filter((s) => s !== selected.status).map((s) => {
                    const icons: Record<ReservationStatus, React.ReactNode> = {
                      pending:   <Clock className="h-4 w-4" />,
                      confirmed: <Check className="h-4 w-4" />,
                      seated:    <Coffee className="h-4 w-4" />,
                      completed: <Check className="h-4 w-4" />,
                      cancelled: <X className="h-4 w-4" />,
                    }
                    return (
                      <button key={s} type="button"
                        onClick={() => void handleStatus(selected, s)}
                        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition', STATUS_STYLES[s],
                          'hover:brightness-125')}>
                        {icons[s]}
                        {t(`reservations.status.${s}`)}
                      </button>
                    )
                  })}
                </div>
                <Button
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 text-xs"
                  onClick={() => { if (window.confirm(t('reservations.deleteConfirm'))) void remove(selected.id).then(() => setSelectedId(null)) }}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </GlassCard>
          ) : (
            <div className="hidden lg:flex items-center justify-center text-white/20 text-sm">
              {t('reservations.selectHint')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
