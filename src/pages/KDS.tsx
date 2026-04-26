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

const ORDER_STATUS_STYLES: Record<OnlineOrderStatus, string> = {
  pending:   'bg-amber-500/20 border-amber-500/40 text-amber-300',
  preparing: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  ready:     'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  completed: 'bg-white/5 border-white/10 text-white/40',
  cancelled: 'bg-red-500/10 border-red-500/20 text-red-300',
}

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

  const totalPending = tasks.filter((t) => !t.done_at).length
  const totalDone = tasks.filter((t) => !!t.done_at).length

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col min-h-0',
        fullscreen
          ? 'fixed inset-0 z-50 bg-[#0f1117] overflow-hidden'
          : 'h-[calc(100vh-2rem)]',
      )}
    >
      <div className={cn(
        'flex-none flex items-center justify-between gap-4 px-4 py-3',
        'border-b border-glass-border glass-strong',
        fullscreen && 'px-6 py-4',
      )}>
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6 text-brand-orange shrink-0" />
          <span className={cn('font-semibold', fullscreen ? 'text-2xl' : 'text-lg')}>
            {t('kds.title')}
          </span>
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden ml-2">
            <button type="button" onClick={() => setTab('prep')}
              className={cn('px-3 py-1 text-xs font-medium transition', tab === 'prep' ? 'bg-brand-orange text-white-fixed' : 'text-white/50 hover:text-white')}>
              {t('kds.tabPrep')}
            </button>
            <button type="button" onClick={() => setTab('orders')}
              className={cn('px-3 py-1 text-xs font-medium transition relative', tab === 'orders' ? 'bg-brand-orange text-white-fixed' : 'text-white/50 hover:text-white')}>
              {t('kds.tabOrders')}
              {orders.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-neutral-900">
                  {orders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className={cn('font-medium min-w-[80px] text-center', fullscreen ? 'text-xl' : 'text-base')}>
            {formatLabel(date)}
          </span>
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-2', fullscreen ? 'text-base' : 'text-sm')}>
            <span className="text-white/50">{t('kds.pending', { count: totalPending })}</span>
            <span className="text-white/25">·</span>
            <span className="text-emerald-400">{t('kds.done', { count: totalDone })}</span>
          </div>

          {tasks.length > 0 && (
            <div className="hidden sm:block w-24 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-2 rounded-full bg-emerald-400 transition-all"
                style={{ width: `${(totalDone / tasks.length) * 100}%` }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={fullscreen ? exitFullscreen : enterFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5"
            aria-label={fullscreen ? t('kds.exitFullscreen') : t('kds.enterFullscreen')}
          >
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className={cn('flex-1 overflow-auto min-h-0', fullscreen ? 'p-4' : 'p-3')}>
        {tab === 'prep' ? (
          loading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-white/40 text-lg">{t('common.loading')}</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Monitor className="h-16 w-16 text-white/15" />
              <p className="text-white/40 text-xl font-medium">{t('kds.noTasks', { date: formatLabel(date) })}</p>
              <p className="text-white/25 text-sm">{t('kds.addTasksHint')}</p>
            </div>
          ) : (
            <div className="flex gap-4 h-full overflow-x-auto" style={{ minWidth: `${stations.length * 280}px` }}>
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
        ) : (
          /* ── Orders tab ── */
          orders.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingBag className="h-16 w-16 text-white/15" />
              <p className="text-white/40 text-xl font-medium">{t('kds.noOrders')}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 content-start">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} onAdvance={(o) => {
                  const next = NEXT_STATUS[o.status]
                  if (next) void updateStatus(o.id, { status: next })
                }} fullscreen={fullscreen} />
              ))}
            </div>
          )
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
    <div className={cn(
      'flex flex-col rounded-2xl border border-glass-border overflow-hidden shrink-0',
      fullscreen ? 'w-80' : 'w-72',
      allDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'glass',
    )}>
      <div className={cn(
        'flex-none flex items-center justify-between px-4 py-3 border-b border-glass-border',
        allDone ? 'bg-emerald-500/10' : 'bg-white/5',
      )}>
        <span className={cn('font-semibold truncate', fullscreen ? 'text-xl' : 'text-base')}>
          {station.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {allDone ? (
            <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
              <Check className="h-4 w-4" /> {allDoneLabel}
            </span>
          ) : (
            <>
              <span className="text-sm text-white/40">{done.length}/{station.tasks.length}</span>
              <div className="w-10 h-1.5 rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-emerald-400 transition-all"
                  style={{ width: station.tasks.length > 0 ? `${(done.length / station.tasks.length) * 100}%` : '0%' }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {pending.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            recipe={task.recipe_id ? recipesById.get(task.recipe_id) : undefined}
            onToggle={onToggle}
            fullscreen={fullscreen}
          />
        ))}

        {done.length > 0 && (
          <>
            {pending.length > 0 && <div className="border-t border-glass-border my-2" />}
            {done.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                recipe={task.recipe_id ? recipesById.get(task.recipe_id) : undefined}
                onToggle={onToggle}
                fullscreen={fullscreen}
                isDone
              />
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
  const nextStatus = NEXT_STATUS[order.status]
  const timeAgo = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000)

  return (
    <div className={cn(
      'flex flex-col rounded-2xl border overflow-hidden',
      ORDER_STATUS_STYLES[order.status],
      fullscreen ? 'text-base' : 'text-sm',
    )}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{order.table_ref ? `Table ${order.table_ref}` : 'Takeaway'}</span>
        </div>
        <span className="flex items-center gap-1 text-xs opacity-70">
          <Clock className="h-3.5 w-3.5" />{timeAgo}m
        </span>
      </div>
      <div className="flex-1 p-3 space-y-1.5">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-baseline gap-2">
            <span className="font-bold">{item.quantity}×</span>
            <span className="truncate">{item.name}</span>
          </div>
        ))}
        {order.customer_name && (
          <p className="text-xs opacity-60 pt-1">{order.customer_name}</p>
        )}
        {order.customer_notes && (
          <p className="text-xs opacity-60 italic">"{order.customer_notes}"</p>
        )}
      </div>
      {nextStatus && (
        <button type="button" onClick={() => onAdvance(order)}
          className="px-4 py-2.5 font-semibold text-sm border-t border-inherit hover:brightness-125 transition text-center">
          {nextStatus === 'preparing' ? '→ Preparing' : nextStatus === 'ready' ? '→ Ready' : '✓ Done'}
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
        'w-full text-left rounded-xl border transition-all',
        fullscreen ? 'px-4 py-3' : 'px-3 py-2.5',
        isDone
          ? 'border-white/5 bg-white/3 opacity-50'
          : 'border-glass-border bg-white/5 hover:bg-white/10 active:scale-[0.98]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 flex shrink-0 items-center justify-center rounded-lg border transition',
          fullscreen ? 'h-8 w-8' : 'h-6 w-6',
          isDone
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-white/30 text-transparent',
        )}>
          <Check className={fullscreen ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn(
            'font-semibold leading-snug',
            fullscreen ? 'text-xl' : 'text-base',
            isDone && 'line-through text-white/40',
          )}>
            {task.title}
            {task.quantity != null && (
              <span className={cn(
                'ml-2 font-normal',
                fullscreen ? 'text-base text-white/60' : 'text-sm text-white/50',
              )}>
                × {task.quantity}
              </span>
            )}
          </div>

          {task.description && !isDone && (
            <p className={cn(
              'text-white/50 mt-0.5 leading-snug',
              fullscreen ? 'text-base' : 'text-sm',
            )}>
              {task.description}
            </p>
          )}

          {recipe && (
            <span className={cn(
              'inline-flex items-center gap-1 mt-1 text-brand-orange/80',
              fullscreen ? 'text-sm' : 'text-xs',
            )}>
              <Utensils className={fullscreen ? 'h-4 w-4' : 'h-3 w-3'} />
              {recipe.title}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
