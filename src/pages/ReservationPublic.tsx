import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarCheck, CalendarDays, CalendarX, Users, User, Phone, Mail, Clock } from 'lucide-react'
import { useLightTheme } from '../lib/useLightTheme'
import { supabase } from '../lib/supabase'
import { submitReservation } from '../hooks/useReservations'

interface TeamInfo { id: string; name: string }

const PARTY_SIZES = [1, 2, 3, 4, 5, 6]
const TIME_SLOTS = ['13:00', '14:00', '19:00', '20:00', '21:00', '22:00']

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReservationPublic() {
  useLightTheme()
  const { id } = useParams<{ id: string }>() // menu id
  const [team, setTeam] = useState<TeamInfo | null | undefined>(undefined)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [resDate, setResDate] = useState(todayIso())
  const [resTime, setResTime] = useState('19:00')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!id) { setTeam(null); return }
    supabase
      .from('menus')
      .select('team_id, teams:team_id(name)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) { setTeam(null); return }
        const row = data as unknown as { team_id: string; teams: { name: string } | null }
        setTeam({ id: row.team_id, name: row.teams?.name ?? 'Restaurant' })
      })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!team) return
    setSubmitting(true)
    setError(null)
    try {
      await submitReservation({
        team_id: team.id,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim() || null,
        guest_email: guestEmail.trim() || null,
        party_size: parseInt(partySize),
        reservation_date: resDate,
        reservation_time: resTime,
        notes: notes.trim() || null,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit reservation')
    } finally {
      setSubmitting(false)
    }
  }

  if (team === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-surface">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/60" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-surface px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-card shadow-card">
          <CalendarX className="h-6 w-6 text-white/50" />
        </span>
        <p className="text-white/60">Reservation page not found.</p>
      </div>
    )
  }

  const dateLabel = new Date(resDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-surface px-4 py-10">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-bg-card shadow-card">
          <div className="flex flex-col items-center gap-3 bg-ink px-6 py-10 text-center text-white-fixed">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime text-ink">
              <CalendarCheck className="h-6 w-6" />
            </span>
            <h1 className="text-3xl font-medium tracking-[-0.03em]">Reservation received!</h1>
            <p className="text-white-fixed/60">We'll confirm your table at <strong className="text-white-fixed">{team.name}</strong>.</p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-white/[0.08] py-6 text-center">
            <div><dt className="text-xs text-white/50">Guests</dt><dd className="mt-1 text-2xl font-medium tabular-nums">{partySize}</dd></div>
            <div><dt className="text-xs text-white/50">Time</dt><dd className="mt-1 text-2xl font-medium tabular-nums">{resTime}</dd></div>
            <div><dt className="text-xs text-white/50">Name</dt><dd className="mt-1 truncate px-2 text-lg font-medium">{guestName}</dd></div>
          </dl>
          <p className="border-t border-white/[0.08] px-6 py-4 text-center text-sm capitalize text-white/60">{dateLabel}</p>
        </div>
      </div>
    )
  }

  const field = 'flex items-center gap-3 rounded-2xl bg-bg-input px-4 h-12 focus-within:ring-2 focus-within:ring-brand-orange/40'
  const inputCls = 'min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/35'
  const chip = (on: boolean) => `h-10 min-w-10 rounded-full px-3.5 text-sm font-medium tabular-nums transition ${on ? 'bg-ink text-white-fixed' : 'bg-bg-input text-white/70 hover:text-white'}`

  return (
    <div className="min-h-screen bg-bg-surface px-3 py-3 sm:py-8">
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        {/* Header */}
        <header className="rounded-[2rem] bg-ink px-6 pb-7 pt-6 text-white-fixed">
          <span className="inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink">
            <CalendarCheck className="h-3.5 w-3.5" />Book a table
          </span>
          <h1 className="mt-5 text-4xl font-medium tracking-[-0.03em]">{team.name}</h1>
          <p className="mt-1 text-white-fixed/55">Pick a date and time — we'll confirm by phone or email.</p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* When */}
          <section className="flex flex-col gap-4 rounded-3xl bg-bg-card p-5 shadow-card">
            <h2 className="text-sm font-medium text-white/55">When & how many</h2>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/50">Guests *</span>
              <div className="flex flex-wrap gap-1.5">
                {PARTY_SIZES.map((n) => (
                  <button key={n} type="button" onClick={() => setPartySize(String(n))} className={chip(partySize === String(n))}>{n}</button>
                ))}
                <label className={`${field} h-10 w-24 px-3`}>
                  <Users className="h-4 w-4 shrink-0 text-white/40" />
                  <input type="number" min="1" max="50" required value={partySize}
                    onChange={(e) => setPartySize(e.target.value)} className={inputCls} />
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/50">Date *</span>
              <span className={field}>
                <CalendarDays className="h-4 w-4 shrink-0 text-white/40" />
                <input type="date" required min={todayIso()} value={resDate}
                  onChange={(e) => setResDate(e.target.value)} className={inputCls} />
              </span>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/50">Time *</span>
              <div className="flex flex-wrap gap-1.5">
                {TIME_SLOTS.map((ts) => (
                  <button key={ts} type="button" onClick={() => setResTime(ts)} className={chip(resTime === ts)}>{ts}</button>
                ))}
                <label className={`${field} h-10 w-32 px-3`}>
                  <Clock className="h-4 w-4 shrink-0 text-white/40" />
                  <input type="time" required value={resTime}
                    onChange={(e) => setResTime(e.target.value)} className={inputCls} />
                </label>
              </div>
            </div>
          </section>

          {/* Who */}
          <section className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card">
            <h2 className="text-sm font-medium text-white/55">Your details</h2>
            <label className={field}>
              <User className="h-4 w-4 shrink-0 text-white/40" />
              <input type="text" required placeholder="Your name *" value={guestName}
                onChange={(e) => setGuestName(e.target.value)} className={inputCls} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>
                <Phone className="h-4 w-4 shrink-0 text-white/40" />
                <input type="tel" placeholder="+30 210 000 0000" value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)} className={inputCls} />
              </label>
              <label className={field}>
                <Mail className="h-4 w-4 shrink-0 text-white/40" />
                <input type="email" placeholder="email@example.com" value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)} className={inputCls} />
              </label>
            </div>
            <textarea rows={2} placeholder="Special requests — allergies, birthday, high chair…" value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none rounded-2xl bg-bg-input px-4 py-3 text-[15px] outline-none placeholder:text-white/35 focus:ring-2 focus:ring-brand-orange/40" />
          </section>

          {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

          {/* Summary + submit */}
          <div className="sticky bottom-3 flex items-center gap-3 rounded-full bg-bg-card p-2 pl-5 shadow-card">
            <span className="min-w-0 flex-1 truncate text-sm">
              <strong className="tabular-nums">{partySize}</strong> · <span className="capitalize">{dateLabel}</span> · <strong className="tabular-nums">{resTime}</strong>
            </span>
            <button type="submit" disabled={submitting}
              className="h-12 shrink-0 rounded-full bg-brand-orange px-6 text-[15px] font-medium text-on-accent hover:bg-brand-orange/85 disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Request'}
            </button>
          </div>
        </form>

        <p className="pb-4 text-center text-xs text-white/35">Powered by ChefSuite</p>
      </div>
    </div>
  )
}
