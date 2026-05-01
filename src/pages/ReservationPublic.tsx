import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Flame, CalendarCheck, Users, Phone, Mail, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { submitReservation } from '../hooks/useReservations'

interface TeamInfo { id: string; name: string }

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReservationPublic() {
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
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-white/50">Loading…</p>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <Flame className="h-10 w-10 text-brand-orange" />
        <p className="text-white/60">Reservation page not found.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <CalendarCheck className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold text-white">Reservation received!</h1>
        <p className="text-white/60 max-w-xs">
          We'll confirm your table at <strong className="text-white">{team.name}</strong>.
        </p>
        <div className="mt-2 rounded-xl bg-white/5 border border-white/10 px-6 py-4 text-sm text-white/70 space-y-1">
          <p><strong className="text-white">{guestName}</strong> · Party of {partySize}</p>
          <p>{new Date(resDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} at {resTime}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange mx-auto">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">{team.name}</h1>
          <p className="text-white/50">Book a table</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/80">Name *</label>
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <Users className="h-4 w-4 text-white/40 shrink-0" />
              <input
                type="text"
                required
                placeholder="Your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-sm"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/80">Phone</label>
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <Phone className="h-4 w-4 text-white/40 shrink-0" />
              <input
                type="tel"
                placeholder="+30 210 000 0000"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-sm"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/80">Email</label>
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <Mail className="h-4 w-4 text-white/40 shrink-0" />
              <input
                type="email"
                placeholder="email@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-sm"
              />
            </div>
          </div>

          {/* Party size + date + time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/80">Guests *</label>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-3">
                <Users className="h-4 w-4 text-white/40 shrink-0" />
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  className="w-full bg-transparent outline-none text-white text-sm"
                />
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="block text-sm font-medium text-white/80">Date *</label>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-3">
                <input
                  type="date"
                  required
                  min={todayIso()}
                  value={resDate}
                  onChange={(e) => setResDate(e.target.value)}
                  className="w-full bg-transparent outline-none text-white text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/80">Time *</label>
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <Clock className="h-4 w-4 text-white/40 shrink-0" />
              <input
                type="time"
                required
                value={resTime}
                onChange={(e) => setResTime(e.target.value)}
                className="flex-1 bg-transparent outline-none text-white text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/80">Special requests</label>
            <textarea
              rows={2}
              placeholder="Allergies, birthday, high chair…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:ring-2 focus:ring-brand-orange resize-none"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-orange text-white-fixed font-semibold py-3.5 text-base hover:bg-brand-orange/90 transition disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Request Reservation'}
          </button>
        </form>

        <p className="text-center text-xs text-white/20 pb-4">Powered by Chefsuite</p>
      </div>
    </div>
  )
}
