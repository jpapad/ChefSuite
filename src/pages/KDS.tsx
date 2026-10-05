import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Monitor,
  Utensils,
  ShoppingBag,
  Clock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePrepTasks } from '../hooks/usePrepTasks'
import { useRecipes } from '../hooks/useRecipes'
import { useTeam } from '../hooks/useTeam'
import { useOnlineOrders } from '../hooks/useOnlineOrders'
import { cn } from '../lib/cn'
import type { OnlineOrderStatus, OnlineOrderWithItems, PrepTask } from '../types/database.types'

const NEXT_STATUS: Partial<Record<OnlineOrderStatus, OnlineOrderStatus>> = {
  pending:   'preparing',
  preparing: 'ready',
  ready:     'completed',
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

interface Station {
  id: string | null
  name: string
  tasks: PrepTask[]
}

export default function KDS() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'prep' | 'orders'>('prep')
  const [date, setDate] = useState(todayIso())
  const { tasks, loading, toggleDone } = usePrepTasks(date)
  const { recipes } = useRecipes()
  const { members } = useTeam()
  const { orders, updateStatus } = useOnlineOrders()
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function formatLabel(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    const today = todayIso()
    if (iso === today) return t('common.today')
    if (iso === shiftDate(today, 1)) return t('common.tomorrow')
    if (iso === shiftDate(today, -1)) return t('common.yesterday')
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  }

  const enterFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (el.requestFullscreen) void el.requestFullscreen()
    setFullscreen(true)
  }, [])

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    setFullscreen(false)
  }, [])

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const stations = useMemo<Station[]>(() => {
    const map = new Map<string | null, PrepTask[]>()

    for (const task of tasks) {
      const key = task.assignee_id ?? null
      const arr = map.get(key) ?? []
      arr.push(task)
      map.set(key, arr)
    }

    const result: Station[] = []

    for (const [id, stTasks] of map.entries()) {
      if (id === null) continue
      const member = membersById.get(id)
      result.push({ id, name: member?.full_name ?? t('kds.general'), tasks: stTasks })
    }
    result.sort((a, b) => a.name.localeCompare(b.name))

    if (map.has(null)) {
      result.push({ id: null, name: t('kds.general'), tasks: map.get(null)! })
    }

    return result
  }, [tasks, membersById, t])

  const totalDone = tasks.filter((t) => !!t.done_at).length

  const lanes: { status: OnlineOrderStatus; label: string; tone: string }[] = [
    { status: 'pending', label: t('kds.v2.new'), tone: 'bg-amber-500/15 text-amber-500' },
    { status: 'preparing', label: t('kds.v2.preparing'), tone: 'bg-sky-500/15 text-sky-500' },
    { status: 'ready', label: t('kds.v2.ready'), tone: 'bg-lime text-ink' },
  ]
  const pct = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0

  return (
    <div
      ref={containerRef}
      className={cn(
        // Kitchen-floor screen: always dark, whatever the app theme
        'theme-dark flex flex-col min-h-0 gap-4',
        fullscreen ? 'fixed inset-0 z-50 overflow-hidden p-5' : 'h-[calc(100vh-2rem)] rounded-3xl p-4',
      )}
    >
      {/* ── Top bar ── */}
      <div className="flex flex-none flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-ink"><Monitor className="h-5 w-5" /></span>
        <span className={cn('font-medium tracking-[-0.02em]', fullscreen ? 'text-3xl' : 'text-2xl')}>{t('kds.title')}</span>

        <div className="ml-2 inline-flex rounded-full bg-white/[0.06] p-1">
          {(['prep', 'orders'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={cn('relative inline-flex h-11 items-center gap-2 rounded-full px-5 text-base font-medium transition', tab === key ? 'bg-lime text-ink' : 'text-white/70 hover:text-white')}
            >
              {key === 'prep' ? t('kds.tabPrep') : t('kds.tabOrders')}
              {key === 'orders' && orders.length > 0 && (
                <span className={cn('flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums', tab === key ? 'bg-ink text-lime' : 'bg-amber-500 text-ink')}>
                  {orders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-full bg-white/[0.06] p-1">
          <button type="button" aria-label={t('kds.v2.prevDay')} onClick={() => setDate((d) => shiftDate(d, -1))} className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className={cn('min-w-[96px] text-center font-medium', fullscreen ? 'text-xl' : 'text-base')}>{formatLabel(date)}</span>
          <button type="button" aria-label={t('kds.v2.nextDay')} onClick={() => setDate((d) => shiftDate(d, 1))} className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {tasks.length > 0 && (
          <div className="flex items-center gap-3 rounded-full bg-white/[0.06] px-4 py-2">
            <span className="text-sm text-white/60 tabular-nums">{totalDone}/{tasks.length}</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-lime transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-medium tabular-nums text-lime">{pct}%</span>
          </div>
        )}

        <button
          type="button"
          onClick={fullscreen ? exitFullscreen : enterFullscreen}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white"
          aria-label={fullscreen ? t('kds.exitFullscreen') : t('kds.enterFullscreen')}
        >
          {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'prep' ? (
          loading ? (
            <div className="flex h-full items-center justify-center"><p className="text-lg text-white/50">{t('common.loading')}</p></div>
          ) : tasks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Monitor className="h-16 w-16 text-white/15" />
              <p className="text-xl font-medium text-white/60">{t('kds.noTasks', { date: formatLabel(date) })}</p>
              <p className="text-sm text-white/40">{t('kds.addTasksHint')}</p>
            </div>
          ) : (
            <div className="flex h-full gap-4 overflow-x-auto" style={{ minWidth: `${stations.length * 300}px` }}>
              {stations.map((station) => (
                <StationColumn
                  key={station.id ?? '__general__'}
                  station={station}
                  recipesById={recipesById}
                  onToggle={toggleDone}
                  fullscreen={fullscreen}
                  allDoneLabel={t('kds.allDone')}
                />
              ))}
            </div>
          )
        ) : orders.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <ShoppingBag className="h-16 w-16 text-white/15" />
            <p className="text-xl font-medium text-white/60">{t('kds.noOrders')}</p>
          </div>
        ) : (
          <div className="grid h-full gap-4 lg:grid-cols-3">
            {lanes.map((lane) => {
              const list = orders.filter((o) => o.status === lane.status)
              return (
                <section key={lane.status} className="flex min-h-0 flex-col gap-3 rounded-3xl bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between px-1">
                    <span className={cn('rounded-full px-4 py-1.5 text-base font-medium', lane.tone)}>{lane.label}</span>
                    <span className="text-lg font-medium tabular-nums text-white/60">{list.length}</span>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                    {list.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onAdvance={(o) => {
                          const next = NEXT_STATUS[o.status]
                          if (next) void updateStatus(o.id, { status: next })
                        }}
                        fullscreen={fullscreen}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface StationColumnProps {
  station: Station
  recipesById: Map<string, { title: string }>
  onToggle: (task: PrepTask) => void | Promise<unknown>
  fullscreen: boolean
  allDoneLabel: string
}

function StationColumn({ station, recipesById, onToggle, fullscreen, allDoneLabel }: StationColumnProps) {
  const pending = station.tasks.filter((t) => !t.done_at)
  const done = station.tasks.filter((t) => !!t.done_at)
  const allDone = pending.length === 0 && done.length > 0

  return (
    <div className={cn('flex shrink-0 flex-col overflow-hidden rounded-3xl bg-white/[0.03]', fullscreen ? 'w-96' : 'w-80')}>
      <div className="flex flex-none items-center justify-between gap-2 px-4 pb-2 pt-4">
        <span className={cn('truncate font-medium', fullscreen ? 'text-2xl' : 'text-lg')}>{station.name}</span>
        {allDone ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-lime px-3 py-1 text-sm font-medium text-ink">
            <Check className="h-4 w-4" /> {allDoneLabel}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-sm font-medium tabular-nums">{done.length}/{station.tasks.length}</span>
        )}
      </div>
      <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-1.5 rounded-full bg-lime transition-all" style={{ width: station.tasks.length > 0 ? `${(done.length / station.tasks.length) * 100}%` : '0%' }} />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {pending.map((task) => (
          <TaskCard key={task.id} task={task} recipe={task.recipe_id ? recipesById.get(task.recipe_id) : undefined} onToggle={onToggle} fullscreen={fullscreen} />
        ))}
        {done.length > 0 && (
          <>
            {pending.length > 0 && <div className="my-2 border-t border-white/10" />}
            {done.map((task) => (
              <TaskCard key={task.id} task={task} recipe={task.recipe_id ? recipesById.get(task.recipe_id) : undefined} onToggle={onToggle} fullscreen={fullscreen} isDone />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Order Card ─────────────────────────────────────────────────────────────────
interface OrderCardProps {
  order: OnlineOrderWithItems
  onAdvance: (order: OnlineOrderWithItems) => void
  fullscreen: boolean
}

function OrderCard({ order, onAdvance, fullscreen }: OrderCardProps) {
  const { t } = useTranslation()
  const nextStatus = NEXT_STATUS[order.status]
  const timeAgo = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000)
  // Age drives the colour: green on time, amber slow, red late
  const age = timeAgo >= 15 ? 'bg-red-500/15 text-red-400' : timeAgo >= 8 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-card', fullscreen ? 'text-lg' : 'text-base')}>
      <div className={cn('flex items-center justify-between px-4 py-3', age)}>
        <span className="font-semibold">{order.table_ref ? t('kds.v2.table', { table: order.table_ref }) : t('kds.v2.takeaway')}</span>
        <span className="flex items-center gap-1 font-medium tabular-nums"><Clock className="h-4 w-4" />{timeAgo}′</span>
      </div>
      <div className="flex-1 space-y-1.5 p-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-baseline gap-2">
            <span className="font-semibold tabular-nums">{item.quantity}×</span>
            <span className="truncate">{item.name}</span>
          </div>
        ))}
        {order.customer_name && <p className="pt-1 text-sm text-white/55">{order.customer_name}</p>}
        {order.customer_notes && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-400">“{order.customer_notes}”</p>}
      </div>
      {nextStatus && (
        <button
          type="button"
          onClick={() => onAdvance(order)}
          className={cn(
            'm-3 mt-0 h-14 rounded-full text-base font-semibold transition active:scale-[0.98]',
            nextStatus === 'completed' ? 'bg-lime text-ink' : 'bg-white/[0.08] text-white hover:bg-white/[0.12]',
          )}
        >
          {nextStatus === 'preparing' ? t('kds.v2.start') : nextStatus === 'ready' ? t('kds.v2.markReady') : t('kds.v2.served')}
        </button>
      )}
    </div>
  )
}

interface TaskCardProps {
  task: PrepTask
  recipe?: { title: string }
  onToggle: (task: PrepTask) => void | Promise<unknown>
  fullscreen: boolean
  isDone?: boolean
}

function TaskCard({ task, recipe, onToggle, fullscreen, isDone }: TaskCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(task)}
      className={cn(
        'w-full rounded-2xl text-left transition-all',
        fullscreen ? 'px-4 py-4' : 'px-4 py-3',
        isDone ? 'bg-transparent opacity-45' : 'bg-bg-card hover:bg-bg-card-2 active:scale-[0.98]',
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn(
          'mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2 transition',
          fullscreen ? 'h-8 w-8' : 'h-7 w-7',
          isDone ? 'border-lime bg-lime text-ink' : 'border-white/30 text-transparent',
        )}>
          <Check className={fullscreen ? 'h-5 w-5' : 'h-4 w-4'} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn('font-medium leading-snug', fullscreen ? 'text-xl' : 'text-base', isDone && 'line-through')}>
            {task.title}
            {task.quantity != null && <span className="ml-2 font-normal text-white/55 tabular-nums">× {task.quantity}</span>}
          </div>
          {task.description && !isDone && <p className={cn('mt-0.5 leading-snug text-white/55', fullscreen ? 'text-base' : 'text-sm')}>{task.description}</p>}
          {recipe && (
            <span className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-white/70', fullscreen ? 'text-sm' : 'text-xs')}>
              <Utensils className={fullscreen ? 'h-4 w-4' : 'h-3 w-3'} />{recipe.title}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
