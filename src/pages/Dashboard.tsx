import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChefHat, Package, Users, ClipboardList, AlertTriangle,
  Check, ShoppingBag, CalendarCheck, Clock,
  Utensils, ChevronRight, Flame,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useRecipes } from '../hooks/useRecipes'
import { useInventory, isLowStock } from '../hooks/useInventory'
import { useTeam } from '../hooks/useTeam'
import { usePrepTasks } from '../hooks/usePrepTasks'
import { useOnlineOrders } from '../hooks/useOnlineOrders'
import { useReservations } from '../hooks/useReservations'
import { useAuth } from '../contexts/AuthContext'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getGreeting(morning: string, afternoon: string, evening: string, name: string) {
  const h = new Date().getHours()
  const g = h < 12 ? morning : h < 17 ? afternoon : evening
  return `${g}, ${name}`
}

function BentoCard({
  className,
  children,
  to,
  glow,
}: {
  className?: string
  children: React.ReactNode
  to?: string
  glow?: string
}) {
  const base = cn(
    'relative glass gradient-border rounded-2xl p-5 flex flex-col gap-3',
    'transition-all duration-300 hover:-translate-y-0.5',
    'hover:shadow-[0_16px_48px_rgba(120,70,20,0.18)]',
    'overflow-hidden',
    className,
  )
  const inner = (
    <>
      {glow && (
        <div className={cn('absolute pointer-events-none rounded-full blur-3xl opacity-25', glow)} />
      )}
      {children}
    </>
  )
  if (to) return <Link to={to} className={base}>{inner}</Link>
  return <div className={base}>{inner}</div>
}

function StatPill({
  icon: Icon,
  label,
  value,
  from,
  to: toColor,
  href,
}: {
  icon: React.ElementType
  label: string
  value: string
  from: string
  to: string
  href?: string
}) {
  const inner = (
    <div className="group relative glass gradient-border rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(120,70,20,0.15)] overflow-hidden">
      <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br', from, toColor)} />
      <div className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br', from, toColor)}>
        <Icon className="h-5 w-5 text-white-fixed" />
      </div>
      <div className="relative min-w-0">
        <div className="text-xs text-white/45 truncate">{label}</div>
        <div className="text-xl font-bold leading-tight tabular-nums">{value}</div>
      </div>
      {href && (
        <ChevronRight className="relative h-4 w-4 text-white/20 group-hover:text-white/60 ml-auto shrink-0 transition-colors" />
      )}
    </div>
  )
  if (href) return <Link to={href}>{inner}</Link>
  return inner
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { recipes, loading: recipesLoading } = useRecipes()
  const { items, loading: invLoading } = useInventory()
  const { members, loading: teamLoading } = useTeam()
  const { tasks, loading: prepLoading } = usePrepTasks(todayIso())
  const { orders, loading: ordersLoading } = useOnlineOrders()
  const { reservations, loading: resLoading } = useReservations(todayIso())

  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  )
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const lowStock    = items.filter(isLowStock)
  const doneTasks   = tasks.filter((t) => t.done_at)
  const pendingTasks = tasks.filter((t) => !t.done_at)
  const prepPct     = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0

  const pendingOrders   = orders.filter((o) => o.status === 'pending')
  const preparingOrders = orders.filter((o) => o.status === 'preparing')
  const readyOrders     = orders.filter((o) => o.status === 'ready')

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Chef'
  const dateStr   = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
  const greeting  = getGreeting(
    t('dashboard.greetingMorning'),
    t('dashboard.greetingAfternoon'),
    t('dashboard.greetingEvening'),
    firstName,
  )

  return (
    <div className="flex flex-col gap-5">

      {/* ── Hero greeting card ─────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden glass gradient-border p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-h-[140px]">
        {/* Warm glow blobs */}
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-brand-orange/25 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-orange/20">
              <Flame className="h-3.5 w-3.5 text-brand-orange" />
            </div>
            <span className="text-xs text-white/40 uppercase tracking-widest font-medium">{dateStr}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{greeting}</h1>
          <p className="mt-1.5 text-sm text-white/40">
            {tasks.length > 0
              ? t('dashboard.heroSubtitle', { done: doneTasks.length, total: tasks.length, pct: prepPct })
              : t('dashboard.heroSubtitleNoTasks')}
          </p>
        </div>

        <div className="relative z-10 sm:text-right flex sm:flex-col items-center sm:items-end gap-3 sm:gap-0">
          <div className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight text-white leading-none">{time}</div>
          {tasks.length > 0 && (
            <div className="sm:mt-2 flex items-center gap-1.5">
              <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-orange to-[#e8b87a] rounded-full transition-all duration-700"
                  style={{ width: `${prepPct}%` }}
                />
              </div>
              <span className="text-xs text-white/35 tabular-nums">{prepPct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat pills row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill
          icon={ChefHat}
          label={t('nav.recipes')}
          value={recipesLoading ? '…' : recipes.length.toString()}
          from="from-brand-orange/25"
          to="to-amber-700/10"
          href="/recipes"
        />
        <StatPill
          icon={Package}
          label={t('dashboard.stats.lowStockItems')}
          value={invLoading ? '…' : lowStock.length.toString()}
          from={lowStock.length > 0 ? 'from-amber-500/30' : 'from-emerald-500/30'}
          to={lowStock.length > 0 ? 'to-orange-600/10' : 'to-emerald-600/10'}
          href="/inventory"
        />
        <StatPill
          icon={Users}
          label={t('nav.team')}
          value={teamLoading ? '…' : members.length.toString()}
          from="from-blue-500/30"
          to="to-blue-700/10"
          href="/team"
        />
        <StatPill
          icon={ClipboardList}
          label={t('dashboard.stats.todayPrep')}
          value={prepLoading ? '…' : `${doneTasks.length}/${tasks.length}`}
          from="from-emerald-500/30"
          to="to-teal-600/10"
          href="/prep"
        />
      </div>

      {/* ── Bento grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Active Orders — 2 cols */}
        <BentoCard to="/kds" className="lg:col-span-2" glow="-top-8 -right-8 w-48 h-48 bg-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20">
                <ShoppingBag className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-white/70">{t('dashboard.activeOrders')}</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-white/25 font-medium">{t('dashboard.live')}</span>
          </div>

          {ordersLoading ? (
            <p className="text-white/40 text-sm">Loading…</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-6 gap-2">
              <Utensils className="h-8 w-8 text-white/10" />
              <p className="text-white/30 text-sm">{t('dashboard.noActiveOrders')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 flex-1">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t('dashboard.orderPending'),   count: pendingOrders.length,   from: 'from-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/20' },
                  { label: t('dashboard.orderPreparing'), count: preparingOrders.length, from: 'from-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/20'  },
                  { label: t('dashboard.orderReady'),     count: readyOrders.length,     from: 'from-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/20'},
                ].map(({ label, count, from, text, border }) => (
                  <div key={label} className={cn('rounded-xl border bg-gradient-to-b px-3 py-3 text-center', border, from, 'to-transparent')}>
                    <div className={cn('text-2xl font-bold', text)}>{count}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 mt-auto">
                {orders.slice(0, 3).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-xs bg-white/4 rounded-xl px-3 py-2">
                    <span className="font-medium text-white/80">{o.customer_name ?? o.table_ref ?? 'Order'}</span>
                    <span className={cn('capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      o.status === 'pending'   ? 'bg-amber-500/20 text-amber-400'   :
                      o.status === 'preparing' ? 'bg-blue-500/20 text-blue-400'     :
                                                 'bg-emerald-500/20 text-emerald-400',
                    )}>
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </BentoCard>

        {/* Low Stock */}
        <BentoCard
          to="/inventory"
          glow={lowStock.length > 0 ? '-top-8 -left-8 w-40 h-40 bg-amber-500' : '-top-8 -left-8 w-40 h-40 bg-emerald-500'}
          className={cn(lowStock.length > 0 && 'border-amber-500/25')}
        >
          <div className="flex items-center gap-2">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', lowStock.length > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20')}>
              <AlertTriangle className={cn('h-3.5 w-3.5', lowStock.length > 0 ? 'text-amber-400' : 'text-emerald-400')} />
            </div>
            <span className="text-sm font-semibold text-white/70">{t('dashboard.lowStock')}</span>
          </div>

          {invLoading ? (
            <p className="text-white/40 text-sm">Loading…</p>
          ) : lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-2xl font-bold">✓</div>
              <p className="text-xs text-white/40 text-center">{t('dashboard.allStockOK')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="text-3xl font-bold text-amber-400 tabular-nums">{lowStock.length}</div>
              <ul className="space-y-1 mt-auto">
                {lowStock.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex justify-between text-xs">
                    <span className="text-white/70 truncate">{item.name}</span>
                    <span className="text-amber-400 ml-2 shrink-0 tabular-nums">
                      {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                    </span>
                  </li>
                ))}
                {lowStock.length > 4 && (
                  <li className="text-xs text-white/30">+{lowStock.length - 4} more</li>
                )}
              </ul>
            </div>
          )}
        </BentoCard>

        {/* Prep Tasks — tall */}
        <BentoCard to="/prep" className="lg:row-span-2" glow="-bottom-8 -right-8 w-48 h-48 bg-brand-orange">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/20">
                <ClipboardList className="h-3.5 w-3.5 text-brand-orange" />
              </div>
              <span className="text-sm font-semibold text-white/70">{t('dashboard.todaysPrepTitle')}</span>
            </div>
            <span className="text-xs font-bold tabular-nums text-brand-orange">{prepPct}%</span>
          </div>

          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-orange to-[#e8b87a] rounded-full transition-all duration-700"
              style={{ width: `${prepPct}%` }}
            />
          </div>

          {prepLoading ? (
            <p className="text-white/40 text-sm">Loading…</p>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 py-6">
              <ClipboardList className="h-8 w-8 text-white/10" />
              <p className="text-white/30 text-sm text-center">{t('dashboard.noPrepToday')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5 flex-1 overflow-hidden">
              {tasks.slice(0, 10).map((task) => (
                <li key={task.id} className="flex items-center gap-2.5 text-sm">
                  <span className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                    task.done_at
                      ? 'bg-brand-orange border-brand-orange text-white-fixed-fixed'
                      : 'border-white/20',
                  )}>
                    {task.done_at && <Check className="h-3 w-3" />}
                  </span>
                  <span className={cn('truncate', task.done_at ? 'text-white/30 line-through' : 'text-white/80')}>
                    {task.title}
                  </span>
                </li>
              ))}
              {tasks.length > 10 && (
                <li className="text-xs text-white/30 pl-7">+{tasks.length - 10} more</li>
              )}
            </ul>
          )}

          <div className="mt-auto flex items-center justify-between text-xs text-white/30 border-t border-white/6 pt-3">
            <span>{doneTasks.length} {t('dashboard.doneLabel')}</span>
            <span>{pendingTasks.length} {t('dashboard.pendingLabel')}</span>
          </div>
        </BentoCard>

        {/* Reservations — 2 cols */}
        <BentoCard to="/reservations" className="lg:col-span-2" glow="-bottom-8 -left-8 w-48 h-48 bg-brand-orange">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/20">
                <CalendarCheck className="h-3.5 w-3.5 text-brand-orange" />
              </div>
              <span className="text-sm font-semibold text-white/70">{t('dashboard.reservationsToday')}</span>
            </div>
            <span className="text-2xl font-bold tabular-nums">
              {resLoading ? '…' : reservations.length}
            </span>
          </div>

          {resLoading ? (
            <p className="text-white/40 text-sm">Loading…</p>
          ) : reservations.length === 0 ? (
            <p className="text-white/30 text-sm">{t('dashboard.noReservationsToday')}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {reservations.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center gap-3 bg-white/4 rounded-xl px-3 py-2.5">
                  <Clock className="h-3.5 w-3.5 text-brand-orange/70 shrink-0" />
                  <span className="text-sm font-semibold tabular-nums text-white/80">
                    {r.reservation_time?.slice(0, 5)}
                  </span>
                  <span className="text-sm text-white/60 truncate">{r.guest_name}</span>
                  <span className="ml-auto text-xs text-white/35 shrink-0">{r.party_size} guests</span>
                </div>
              ))}
              {reservations.length > 3 && (
                <p className="text-xs text-white/30 pl-1">+{reservations.length - 3} more</p>
              )}
            </div>
          )}
        </BentoCard>

        {/* Team card */}
        <BentoCard to="/team" glow="-top-8 -right-8 w-36 h-36 bg-blue-600">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20">
              <Users className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-white/70">{t('dashboard.teamCard')}</span>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5">
            <div className="text-4xl font-bold tabular-nums">
              {teamLoading ? '…' : members.length}
            </div>
            <p className="text-xs text-white/40">
              {t('dashboard.member', { count: members.length })}
            </p>
          </div>
          <div className="flex -space-x-2 mt-auto">
            {members.slice(0, 5).map((m) => (
              <div
                key={m.id}
                title={m.full_name ?? ''}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 border-2 border-chef-dark text-[10px] font-bold text-blue-300"
              >
                {(m.full_name ?? '?').slice(0, 1).toUpperCase()}
              </div>
            ))}
            {members.length > 5 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 border-2 border-chef-dark text-[10px] text-white/50">
                +{members.length - 5}
              </div>
            )}
          </div>
        </BentoCard>

      </div>
    </div>
  )
}
