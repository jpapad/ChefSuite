import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowUpRight, Bot, ClipboardList, Monitor, Package, ShoppingBag, Activity,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/cn'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { useRecipes } from '../hooks/useRecipes'
import { useInventory, isLowStock } from '../hooks/useInventory'
import { usePrepTasks } from '../hooks/usePrepTasks'
import { useOnlineOrders } from '../hooks/useOnlineOrders'
import { useReservations } from '../hooks/useReservations'
import { useTeam } from '../hooks/useTeam'
import { certStatus, daysLeft, useStaffCertificates } from '../hooks/useStaffCertificates'
import { lotDaysLeft, useLots } from '../hooks/useLots'
import { useEquipment } from '../hooks/useEquipment'
import { NAV_SECTIONS } from '../components/layout/navigation'

// Home — "Bento & Lime": what needs the chef's attention right now, today's
// numbers as a bento grid, and every section of the app one click away.

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function greetingFor(t: (k: string) => string, name: string) {
  const h = new Date().getHours()
  const key = h < 12 ? 'launchpad.greetingMorning' : h < 18 ? 'launchpad.greetingAfternoon' : 'launchpad.greetingEvening'
  return `${t(key)}, ${name}`
}

const card = 'rounded-3xl bg-bg-card p-5 sm:p-6 shadow-card flex flex-col gap-3'
const tile = cn(card, 'transition-transform hover:-translate-y-0.5')

type Tone = 'bad' | 'warn' | 'info'
const TONE: Record<Tone, string> = {
  bad:  'bg-red-500/10 text-red-500',
  warn: 'bg-amber-500/12 text-amber-500',
  info: 'bg-sky-500/10 text-sky-500',
}

export default function AppLaunchpad() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { can } = usePermissions()

  const { recipes, loading: recipesLoading } = useRecipes()
  const { items, loading: invLoading } = useInventory()
  const { tasks, loading: prepLoading } = usePrepTasks(todayIso())
  const { orders } = useOnlineOrders()
  const { reservations, loading: resLoading } = useReservations(todayIso())
  const { members } = useTeam()
  const { certs } = useStaffCertificates()
  const { lots } = useLots()
  const { equipment, logs: equipLogs } = useEquipment()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Chef'
  const dateStr = new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })

  const lowStock = items.filter(isLowStock)
  const done = tasks.filter((x) => x.done_at).length
  const pendingPrep = tasks.length - done
  const prepPct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const ordersBy = (s: string) => orders.filter((o) => o.status === s).length
  const activeRes = reservations
    .filter((r) => r.status !== 'cancelled' && r.status !== 'completed')
    .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
  const guests = activeRes.reduce((s, r) => s + r.party_size, 0)

  const certAlerts = can('certificates')
    ? certs.filter((c) => ['expired', 'expiring'].includes(certStatus(c)))
    : []
  const certName = (id: string) => members.find((m) => m.id === id)?.full_name ?? '—'

  const lotAlerts = can('traceability')
    ? lots.filter((l) => { const d = lotDaysLeft(l.expires_on); return l.status === 'active' && d != null && d <= 2 })
        .sort((a, b) => (a.expires_on ?? '').localeCompare(b.expires_on ?? ''))
    : []
  const lotItem = (id: string) => items.find((i) => i.id === id)?.name ?? '—'

  // The "rail": things that need action, most urgent first
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
  ].slice(0, 5)

  const sections = NAV_SECTIONS.filter((s) => s.id !== 'home')
    .map((s) => ({ ...s, first: s.items.find((i) => can(i.module)) }))
    .filter((s) => s.first)

  return (
    <div className="mx-auto max-w-[1360px] flex flex-col gap-6">

      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <p className="text-sm text-white/55 first-letter:uppercase">{dateStr}</p>
          <h1 className="mt-1 text-4xl sm:text-5xl font-medium tracking-[-0.03em]">{greetingFor(t, firstName)}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('buffet-pulse') && (
            <Link to="/buffet-monitor" className="inline-flex h-11 items-center gap-2 rounded-full bg-bg-card px-5 text-sm font-medium shadow-card hover:bg-white/5">
              <Activity className="h-4 w-4" /> {t('home.buffetMonitor')}
            </Link>
          )}
          {can('kds') && (
            <Link to="/kds" className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-medium text-on-accent hover:bg-brand-orange/85">
              <Monitor className="h-4 w-4" /> {t('home.openKds')}
            </Link>
          )}
        </div>
      </header>

      {/* ── Bento: today's numbers ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/prep" className="sm:col-span-2 lg:row-span-2 rounded-3xl bg-ink p-6 sm:p-7 flex flex-col justify-between gap-6 text-white-fixed transition-transform hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[#C9CEC8]">{t('home.prepToday')}</p>
              <p className="mt-1 text-6xl sm:text-7xl font-medium tracking-[-0.04em] text-lime tabular-nums">
                {prepLoading ? '…' : tasks.length ? `${prepPct}%` : '—'}
              </p>
            </div>
            <ClipboardList className="h-6 w-6 text-[#C9CEC8]" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-2.5 rounded-full bg-white-fixed/10 overflow-hidden">
              <div className="h-full rounded-full bg-lime transition-all duration-700" style={{ width: `${prepPct}%` }} />
            </div>
            <p className="text-sm text-[#C9CEC8]">
              {tasks.length ? t('home.prepDone', { done, total: tasks.length }) : t('home.prepEmpty')}
            </p>
          </div>
        </Link>

        <Link to="/inventory" className={tile}>
          <div className="flex items-center justify-between text-sm text-white/55">
            {t('home.lowStock')} <Package className="h-4 w-4" />
          </div>
          <p className={cn('text-4xl font-medium tracking-[-0.03em] tabular-nums', lowStock.length > 0 && 'text-amber-500')}>
            {invLoading ? '…' : lowStock.length}
          </p>
          <p className="text-xs text-white/55">
            {lowStock.length ? lowStock.slice(0, 2).map((i) => i.name).join(', ') : t('home.lowStockNone')}
          </p>
        </Link>

        <Link to="/reservations" className={tile}>
          <div className="flex items-center justify-between text-sm text-white/55">
            {t('home.reservations')} <span className="text-xs">{t('home.guests', { count: guests })}</span>
          </div>
          <p className="text-4xl font-medium tracking-[-0.03em] tabular-nums">{resLoading ? '…' : activeRes.length}</p>
          <p className="text-xs text-white/55">
            {activeRes[0] ? `${activeRes[0].reservation_time.slice(0, 5)} · ${activeRes[0].guest_name}` : t('home.noReservations')}
          </p>
        </Link>

        <Link to="/kds" className={tile}>
          <div className="flex items-center justify-between text-sm text-white/55">
            {t('home.orders')} <ShoppingBag className="h-4 w-4" />
          </div>
          <p className="text-4xl font-medium tracking-[-0.03em] tabular-nums">{ordersBy('pending') + ordersBy('preparing')}</p>
          <p className="text-xs text-white/55">
            {t('home.ordersBreakdown', { pending: ordersBy('pending'), preparing: ordersBy('preparing'), ready: ordersBy('ready') })}
          </p>
        </Link>

        <Link to="/recipes" className={cn(tile, 'bg-lime text-ink')}>
          <div className="flex items-center justify-between text-sm text-ink/70">
            {t('home.recipes')} <ArrowUpRight className="h-4 w-4" />
          </div>
          <p className="text-4xl font-medium tracking-[-0.03em] tabular-nums">{recipesLoading ? '…' : recipes.length}</p>
          <p className="text-xs text-ink/70">{members.length} {t('home.teamMembers')}</p>
        </Link>
      </section>

      {/* ── Attention + next reservations ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={cn(card, 'lg:col-span-2')}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{t('home.needsAttention')}</h2>
            {attention.length > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          </div>
          {attention.length === 0 ? (
            <p className="py-6 text-sm text-white/55">{t('home.allClear')}</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {attention.map((a, i) => (
                <li key={i}>
                  <Link to={a.to} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', TONE[a.tone])}>{a.label}</span>
                    <span className="flex-1 min-w-0 truncate text-sm">{a.detail}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-white/35" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h2 className="text-lg font-medium">{t('home.nextUp')}</h2>
          {activeRes.length === 0 ? (
            <p className="py-6 text-sm text-white/55">{t('home.noReservations')}</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {activeRes.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="font-mono tabular-nums text-white/55">{r.reservation_time.slice(0, 5)}</span>
                  <span className="flex-1 min-w-0 truncate">{r.guest_name}</span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs tabular-nums">{r.party_size}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Every section, one click away ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('home.everything')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {sections.map((s) => {
            const Icon = s.icon
            return (
              <Link key={s.id} to={s.first!.to} className={cn(tile, 'gap-2')}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span className="mt-1 font-medium">{t(s.titleKey)}</span>
                <span className="text-xs text-white/55 leading-relaxed">{t(`home.sectionDesc.${s.id}`)}</span>
              </Link>
            )
          })}
          {can('copilot') && (
            <Link to="/copilot" className={cn(tile, 'gap-2 bg-violet-500/10')}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-card">
                <Bot className="h-5 w-5 text-violet-500" strokeWidth={1.8} />
              </span>
              <span className="mt-1 font-medium">{t('home.copilotTitle')}</span>
              <span className="text-xs text-white/55 leading-relaxed">{t('home.copilotBody')}</span>
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
