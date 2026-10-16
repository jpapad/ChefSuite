import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/cn'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { useInventory, isLowStock } from '../hooks/useInventory'
import { usePrepTasks } from '../hooks/usePrepTasks'
import { useOnlineOrders } from '../hooks/useOnlineOrders'
import { useReservations } from '../hooks/useReservations'
import { useTeam } from '../hooks/useTeam'
import { certStatus, daysLeft, useStaffCertificates } from '../hooks/useStaffCertificates'
import { lotDaysLeft, useLots } from '../hooks/useLots'
import { useEquipment } from '../hooks/useEquipment'
import { countdown as formatCountdown, useNow } from '../lib/useNow'
import { shiftKey } from '../lib/useClock'
import { FlipNumber, SectionHead, Ticker, Ticket } from '../components/station/Station'
import { ticketFor } from '../components/station/orderTicket'

// Today — "Station Board": the service countdown, today's four numbers, the
// tickets on the pass, tonight's tables and what needs attention, with the
// same alerts scrolling along the bottom.

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function greetingFor(t: (k: string) => string, name: string) {
  const h = new Date().getHours()
  const key = h < 12 ? 'launchpad.greetingMorning' : h < 18 ? 'launchpad.greetingAfternoon' : 'launchpad.greetingEvening'
  return `${t(key)}, ${name}`
}

type Tone = 'bad' | 'warn' | 'info'
const TAG: Record<Tone, string> = {
  bad:  'bg-[#FF3B30] text-white-fixed',
  warn: 'bg-signal text-ink',
  info: 'bg-white/10 text-white',
}

const tileBase = 'relative flex min-h-[200px] flex-col gap-2 overflow-hidden p-5 sm:p-6 text-white transition-colors hover:bg-white/[0.04]'

export default function AppLaunchpad() {
  const { t, i18n } = useTranslation()
  const { profile, myTeams } = useAuth()
  const { can } = usePermissions()
  const now = useNow(1000)

  const { items, loading: invLoading } = useInventory()
  const { tasks, loading: prepLoading } = usePrepTasks(todayIso())
  const { orders } = useOnlineOrders()
  const { reservations, loading: resLoading } = useReservations(todayIso())
  const { members } = useTeam()
  const { certs } = useStaffCertificates()
  const { lots } = useLots()
  const { equipment, logs: equipLogs } = useEquipment()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Chef'
  const kitchen = myTeams.find((x) => x.id === profile?.team_id)?.name
  const dateStr = new Date(now).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })

  const lowStock = items.filter(isLowStock)
  const done = tasks.filter((x) => x.done_at).length
  const pendingPrep = tasks.length - done
  const prepPct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const ordersBy = (s: string) => orders.filter((o) => o.status === s).length
  const activeRes = reservations
    .filter((r) => r.status !== 'cancelled' && r.status !== 'completed')
    .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
  const guests = activeRes.reduce((s, r) => s + r.party_size, 0)

  // Countdown to the next table still to arrive today.
  const nowDate = new Date(now)
  const nowSecs = nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds()
  const toSecs = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 3600 + m * 60 }
  const nextRes = activeRes.find((r) => toSecs(r.reservation_time) > nowSecs)
  const countdown = nextRes ? formatCountdown(toSecs(nextRes.reservation_time) - nowSecs) : null

  const tickets = orders.map((o) => ({ id: o.id, ...ticketFor(o, now, t) }))
  const lateCount = tickets.filter((x) => x.late).length

  const certAlerts = can('certificates')
    ? certs.filter((c) => ['expired', 'expiring'].includes(certStatus(c)))
    : []
  const certName = (id: string) => members.find((m) => m.id === id)?.full_name ?? '—'

  const lotAlerts = can('traceability')
    ? lots.filter((l) => { const d = lotDaysLeft(l.expires_on); return l.status === 'active' && d != null && d <= 2 })
        .sort((a, b) => (a.expires_on ?? '').localeCompare(b.expires_on ?? ''))
    : []
  const lotItem = (id: string) => items.find((i) => i.id === id)?.name ?? '—'

  // What needs action, most urgent first.
  const attention: { tone: Tone; label: string; detail: string; to: string }[] = [
    ...lowStock
      .filter((i) => i.quantity <= 0)
      .slice(0, 2)
      .map((i) => ({ tone: 'bad' as Tone, label: t('home.lowStock'), detail: t('home.lowStockItem', { name: i.name, qty: i.quantity, unit: i.unit, min: i.min_stock_level }), to: '/inventory' })),
    ...certAlerts
      .filter((c) => certStatus(c) === 'expired')
      .slice(0, 2)
      .map((c) => ({ tone: 'bad' as Tone, label: t('nav.certificates'), detail: t('home.certExpired', { name: certName(c.user_id), kind: t(`certs.kinds.${c.kind}`) }), to: '/certificates' })),
    ...(can('equipment') ? equipLogs : [])
      .filter((l) => l.kind === 'issue' && !l.resolved)
      .slice(0, 2)
      .map((l) => ({ tone: 'bad' as Tone, label: t('nav.equipment'), detail: t('home.equipIssue', { name: equipment.find((e) => e.id === l.equipment_id)?.name ?? '—', title: l.title }), to: '/equipment' })),
    ...(ordersBy('pending') > 0
      ? [{ tone: 'bad' as Tone, label: t('home.orders'), detail: t('home.ordersPending', { count: ordersBy('pending') }), to: '/kds' }]
      : []),
    ...lowStock
      .filter((i) => i.quantity > 0)
      .slice(0, 3)
      .map((i) => ({ tone: 'warn' as Tone, label: t('home.lowStock'), detail: t('home.lowStockItem', { name: i.name, qty: i.quantity, unit: i.unit, min: i.min_stock_level }), to: '/inventory' })),
    ...certAlerts
      .filter((c) => certStatus(c) === 'expiring')
      .slice(0, 2)
      .map((c) => ({ tone: 'warn' as Tone, label: t('nav.certificates'), detail: t('home.certExpiring', { name: certName(c.user_id), kind: t(`certs.kinds.${c.kind}`), count: daysLeft(c.expires_on) ?? 0 }), to: '/certificates' })),
    ...lotAlerts.slice(0, 2).map((l) => ({
      tone: ((lotDaysLeft(l.expires_on) ?? 0) < 0 ? 'bad' : 'warn') as Tone,
      label: t('nav.traceability'),
      detail: t('home.lotExpiring', { item: lotItem(l.inventory_item_id), lot: l.lot_number ?? '—', when: new Date(l.expires_on + 'T00:00:00').toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }) }),
      to: '/traceability',
    })),
    ...(pendingPrep > 0
      ? [{ tone: 'info' as Tone, label: t('nav.prep'), detail: t('home.prepPending', { count: pendingPrep }), to: '/prep' }]
      : []),
  ].slice(0, 6)

  const tickerItems = [
    ...tickets.filter((x) => x.late).map((x) => `${x.title} · ${x.tag} ${x.timer}`),
    ...attention.map((a) => a.detail),
    ...(nextRes ? [`${nextRes.reservation_time.slice(0, 5)} ${nextRes.guest_name} × ${nextRes.party_size}`] : []),
  ]

  return (
    <div className="-mx-4 -mt-4 flex min-h-[calc(100vh-130px)] flex-col sm:-mx-6 sm:-mt-6 md:-mb-8">
      {/* ── 01 Header + service countdown ── */}
      <section className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-inv-border px-4 pb-6 pt-6 sm:px-6">
        <div className="min-w-0">
          <p className="flex items-baseline gap-3">
            <span className="font-mono text-[15px] font-bold text-signal">01</span>
            <span className="sb-label text-white/60 first-letter:uppercase">
              {[kitchen, t(`station.${shiftKey(nowDate)}`), dateStr].filter(Boolean).join(' · ')}
            </span>
          </p>
          <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-[0.9] sm:text-6xl">{greetingFor(t, firstName)}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {can('kds') && (
              <Link to="/kds" className="inline-flex h-12 items-center gap-2 rounded bg-brand-orange px-5 font-display text-[17px] font-bold uppercase tracking-[0.04em] text-on-accent hover:bg-brand-orange/85">
                <Monitor className="h-5 w-5" strokeWidth={2.2} /> {t('home.openKds')}
              </Link>
            )}
            {can('buffet-pulse') && (
              <Link to="/buffet-monitor" className="inline-flex h-12 items-center gap-2 rounded px-5 font-display text-[17px] font-bold uppercase tracking-[0.04em] shadow-card hover:bg-white/[0.05]">
                <Activity className="h-5 w-5" strokeWidth={2.2} /> {t('home.buffetMonitor')}
              </Link>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="sb-label text-white/60">{countdown ? t('station.serviceIn') : t('station.serviceNow')}</span>
          <div className="font-mono text-[clamp(56px,8vw,104px)] font-bold leading-[0.9] tracking-[-0.04em] text-signal tabular-nums">
            {countdown ?? `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`}
          </div>
        </div>
      </section>

      {/* ── KPI strip ── */}
      <section className="grid grid-cols-2 border-b-2 border-inv-border lg:grid-cols-4">
        <Link to="/prep" className={cn(tileBase, 'border-b-2 border-r-2 border-inv-border lg:border-b-0')}>
          <span aria-hidden="true" className="sb-ghost -bottom-16 -right-2 text-[300px]">{tasks.length ? prepPct : ''}</span>
          <span className="sb-label relative">{t('home.prepToday')}</span>
          <span className="relative font-mono text-[clamp(56px,7vw,88px)] font-bold leading-[0.85] tracking-[-0.04em] tabular-nums">
            {prepLoading ? '…' : tasks.length ? <>{prepPct}<span className="text-[0.55em]">%</span></> : '—'}
          </span>
          <span className="relative mt-auto grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.max(tasks.length, 1)}, minmax(0, 1fr))` }} aria-hidden="true">
            {(tasks.length ? tasks : [null]).map((_, i) => (
              <i key={i} className={cn('h-2.5', i < done ? 'bg-signal' : 'bg-white/15')} />
            ))}
          </span>
          <span className="relative text-[14px] font-medium text-white/60">
            {tasks.length ? t('home.prepDone', { done, total: tasks.length }) : t('home.prepEmpty')}
          </span>
        </Link>

        <Link to="/kds" className={cn(tileBase, 'border-b-2 border-inv-border lg:border-b-0 lg:border-r-2')}>
          <span className="sb-label">{t('home.orders')}</span>
          <span className="font-mono text-[clamp(56px,7vw,88px)] font-bold leading-[0.85] tracking-[-0.04em] tabular-nums">
            <FlipNumber value={ordersBy('pending') + ordersBy('preparing')} />
          </span>
          <span className="mt-auto text-[14px] font-medium">
            {t('home.ordersBreakdown', { pending: ordersBy('pending'), preparing: ordersBy('preparing'), ready: ordersBy('ready') })}
          </span>
        </Link>

        <Link to="/reservations" className={cn(tileBase, 'border-r-2 border-inv-border')}>
          <span className="sb-label">{t('station.firstTable')}</span>
          <span className="font-mono text-[clamp(56px,7vw,88px)] font-bold leading-[0.85] tracking-[-0.04em] tabular-nums">
            {resLoading ? '…' : nextRes ? nextRes.reservation_time.slice(0, 5) : '—'}
          </span>
          <span className="mt-auto text-[14px] font-medium">
            {nextRes ? `${nextRes.guest_name} · ` : ''}{t('home.guests', { count: guests })}
          </span>
        </Link>

        <Link to="/inventory" className={cn(tileBase, lowStock.length > 0 ? 'bg-signal text-ink hover:bg-signal hover:brightness-105' : '')}>
          <span className="sb-label">{t('station.missing')}</span>
          <span className="font-mono text-[clamp(56px,7vw,88px)] font-bold leading-[0.85] tracking-[-0.04em] tabular-nums">
            {invLoading ? '…' : lowStock.length}
          </span>
          <span className="mt-auto text-[14px] font-semibold">
            {lowStock.length ? `${lowStock.slice(0, 3).map((i) => i.name).join(', ')}${lowStock.length > 3 ? ` +${lowStock.length - 3}` : ''} →` : t('home.lowStockNone')}
          </span>
        </Link>
      </section>

      <div className="flex flex-1 flex-col gap-8 px-4 py-7 sm:px-6">
        {/* ── 02 On the pass ── */}
        {can('kds') && (
          <section>
            <SectionHead
              no="02"
              title={t('station.onThePass')}
              meta={lateCount > 0 ? `${t('station.ticketsCount', { count: tickets.length })} · ${lateCount} ${t('station.ticketLate').toLowerCase()}` : t('station.ticketsCount', { count: tickets.length })}
              action={<Link to="/kds" className="sb-label hover:text-signal">{t('station.allKds')}</Link>}
            />
            {tickets.length === 0 ? (
              <p className="rounded bg-emerald-500 px-6 py-8 font-display text-4xl font-extrabold uppercase leading-none text-ink">{t('station.clearPass')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tickets.slice(0, 8).map((x) => (
                  <Link key={x.id} to="/kds" className="block">
                    <Ticket tone={x.tone} tag={x.tag} timer={x.timer} title={x.title} meta={x.meta} lines={x.lines} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* ── 03 Tonight ── */}
          <section className="lg:col-span-2">
            <SectionHead no="03" title={t('station.tonight')} meta={t('home.guests', { count: guests })} />
            {activeRes.length === 0 ? (
              <p className="border-t-2 border-inv-border py-5 text-base text-white/60">{t('home.noReservations')}</p>
            ) : (
              <ul className="border-t-2 border-inv-border">
                {activeRes.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center gap-4 border-b border-glass-border py-3">
                    <span className={cn('w-[92px] font-mono text-[28px] font-bold tracking-[-0.03em] tabular-nums', r.id === nextRes?.id && 'text-signal')}>
                      {r.reservation_time.slice(0, 5)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[17px] font-medium">{r.guest_name}</span>
                    <span className="font-display text-[28px] font-extrabold">{r.party_size}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── 04 Needs attention ── */}
          <section className="lg:col-span-3">
            <SectionHead no="04" title={t('home.needsAttention')} />
            {attention.length === 0 ? (
              <p className="border-t-2 border-inv-border py-5 text-base text-white/60">{t('home.allClear')}</p>
            ) : (
              <ul className="border-t-2 border-inv-border">
                {attention.map((a, i) => (
                  <li key={i}>
                    <Link to={a.to} className="flex items-center gap-3 border-b border-glass-border py-3 hover:bg-white/[0.04]">
                      <span className={cn('sb-label shrink-0 rounded-sm px-2 py-1.5', TAG[a.tone])}>{a.label}</span>
                      <span className="min-w-0 flex-1 truncate text-[16px]">{a.detail}</span>
                      <ArrowUpRight className="h-5 w-5 shrink-0" strokeWidth={2.2} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/sections" className="sb-label mt-4 inline-block hover:text-signal">{t('station.allSectionsLink')}</Link>
          </section>
        </div>
      </div>

      <Ticker items={tickerItems} label={t('station.alerts')} />
    </div>
  )
}
