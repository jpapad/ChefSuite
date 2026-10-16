import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePrepTasks } from '../hooks/usePrepTasks'
import { useRecipes } from '../hooks/useRecipes'
import { useTeam } from '../hooks/useTeam'
import { useOnlineOrders } from '../hooks/useOnlineOrders'
import { cn } from '../lib/cn'
import { useNow } from '../lib/useNow'
import { play, setSoundEnabled, soundEnabled } from '../lib/sounds'
import { Ticket } from '../components/station/Station'
import { ticketFor } from '../components/station/orderTicket'
import type { OnlineOrderStatus, OnlineOrderWithItems, PrepTask } from '../types/database.types'

const NEXT_STATUS: Partial<Record<OnlineOrderStatus, OnlineOrderStatus>> = {
  pending:   'preparing',
  preparing: 'ready',
  ready:     'completed',
}

/** Sound that confirms each bump: start → click, ready → the pass bell, served → whoosh. */
const BUMP_SOUND = { preparing: 'click', ready: 'ding', completed: 'whoosh' } as const

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

const ctl = 'flex h-12 items-center justify-center rounded border-2 border-inv-border font-display text-[16px] font-bold uppercase tracking-[0.04em] transition hover:border-white'

export default function KDS() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'orders' | 'prep'>('orders')
  const [date, setDate] = useState(todayIso())
  const { tasks, loading, toggleDone } = usePrepTasks(date)
  const { recipes } = useRecipes()
  const { members } = useTeam()
  const { orders, updateStatus } = useOnlineOrders()
  const [fullscreen, setFullscreen] = useState(false)
  const [sound, setSound] = useState(soundEnabled())
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const now = useNow(1000)

  // A new ticket arriving prints with the thermal-printer sound.
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id))
    if (seen.current && orders.some((o) => o.status === 'pending' && !seen.current!.has(o.id))) play('print')
    seen.current = ids
  }, [orders])

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
    if (map.has(null)) result.push({ id: null, name: t('kds.general'), tasks: map.get(null)! })
    return result
  }, [tasks, membersById, t])

  const totalDone = tasks.filter((x) => !!x.done_at).length
  const pct = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0

  const lanes: { status: OnlineOrderStatus; label: string; action: string }[] = [
    { status: 'pending', label: t('kds.v2.new'), action: t('kds.v2.start') },
    { status: 'preparing', label: t('kds.v2.preparing'), action: t('kds.v2.markReady') },
    { status: 'ready', label: t('kds.v2.ready'), action: t('kds.v2.served') },
  ]

  // "All day" counts: every dish still waiting (new + on the fire).
  const totals = useMemo(() => {
    const agg = new Map<string, number>()
    for (const o of orders) {
      if (o.status !== 'pending' && o.status !== 'preparing') continue
      for (const i of o.items ?? []) agg.set(i.name, (agg.get(i.name) ?? 0) + i.quantity)
    }
    return [...agg.entries()].sort((a, b) => b[1] - a[1])
  }, [orders])

  function bump(order: OnlineOrderWithItems) {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    play(BUMP_SOUND[next as keyof typeof BUMP_SOUND])
    setLeaving((s) => new Set(s).add(order.id))
    setTimeout(() => {
      void updateStatus(order.id, { status: next }).finally(() => {
        setLeaving((s) => { const n = new Set(s); n.delete(order.id); return n })
      })
    }, 320)
  }

  function toggleSound() {
    const next = !sound
    setSound(next)
    setSoundEnabled(next)
    if (next) play('click')
  }

  async function togglePrep(task: PrepTask) {
    play('check')
    await toggleDone(task)
  }

  const waiting = orders.filter((o) => o.status === 'pending' || o.status === 'preparing').length

  return (
    <div
      ref={containerRef}
      className={cn(
        'theme-dark flex min-h-0 flex-col gap-5 bg-bg-surface text-white',
        fullscreen ? 'fixed inset-0 z-50 overflow-auto p-5' : 'min-h-[calc(100vh-220px)]',
      )}
    >
      {/* ── Controls ── */}
      <div className="flex flex-none flex-wrap items-center gap-2.5">
        <h1 className={cn('mr-2 font-display font-extrabold uppercase leading-none', fullscreen ? 'text-5xl' : 'text-4xl')}>{t('kds.title')}</h1>

        <div className="inline-flex overflow-hidden rounded border-2 border-inv-border">
          {(['orders', 'prep'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={cn('inline-flex h-11 items-center gap-2 px-5 font-display text-[17px] font-bold uppercase tracking-[0.04em]', tab === key ? 'bg-white text-ink' : 'text-white/70 hover:text-white')}
            >
              {key === 'prep' ? t('kds.tabPrep') : t('kds.tabOrders')}
              {key === 'orders' && orders.length > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-sm bg-signal px-1.5 font-mono text-[13px] font-bold text-ink">{orders.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {tab === 'prep' && (
            <>
              <button type="button" aria-label={t('kds.v2.prevDay')} onClick={() => setDate((d) => shiftDate(d, -1))} className={cn(ctl, 'w-12')}>
                <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
              </button>
              <span className="min-w-[110px] text-center font-display text-[18px] font-bold uppercase">{formatLabel(date)}</span>
              <button type="button" aria-label={t('kds.v2.nextDay')} onClick={() => setDate((d) => shiftDate(d, 1))} className={cn(ctl, 'w-12')}>
                <ChevronRight className="h-5 w-5" strokeWidth={2.4} />
              </button>
              {tasks.length > 0 && (
                <span className="ml-2 font-mono text-[22px] font-bold tabular-nums">
                  {totalDone}/{tasks.length} <span className="text-signal">{pct}%</span>
                </span>
              )}
            </>
          )}
          <button type="button" onClick={toggleSound} aria-pressed={sound} className={cn(ctl, 'gap-2 px-3.5')}>
            {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            {sound ? t('station.soundOn') : t('station.soundOff')}
          </button>
          <button
            type="button"
            onClick={fullscreen ? exitFullscreen : enterFullscreen}
            className={cn(ctl, 'w-12')}
            aria-label={fullscreen ? t('kds.exitFullscreen') : t('kds.enterFullscreen')}
          >
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {tab === 'orders' ? (
        <div className="flex min-h-0 flex-1 flex-wrap items-start gap-5">
          <div className="grid min-w-0 flex-[999_1_720px] grid-cols-1 items-start gap-5 md:grid-cols-3">
            {waiting === 0 && (
              <p className="rounded bg-emerald-500 px-6 py-8 font-display text-5xl font-extrabold uppercase leading-none text-ink md:col-span-3">{t('station.clearPass')}</p>
            )}
            {lanes.map((lane) => {
              const list = orders.filter((o) => o.status === lane.status)
              return (
                <section key={lane.status} className="min-w-0">
                  <div className="mb-3.5 flex items-baseline gap-2.5 border-b-4 border-white pb-2.5">
                    <h2 className="font-display text-[32px] font-extrabold uppercase leading-none">{lane.label}</h2>
                    <span className="font-mono text-[24px] font-bold text-white/60">{list.length}</span>
                  </div>
                  {list.map((order) => {
                    const tk = ticketFor(order, now, t)
                    return (
                      <Ticket
                        key={order.id}
                        tone={tk.tone}
                        tag={tk.tag}
                        timer={tk.timer}
                        title={tk.title}
                        meta={tk.meta}
                        lines={tk.lines}
                        className={cn(leaving.has(order.id) ? 'sb-out' : 'sb-in', fullscreen && 'text-lg')}
                      >
                        {order.customer_notes && (
                          <p className="mx-3 mb-2 bg-[#FFF4CC] px-2.5 py-2 text-[15px] font-medium">“{order.customer_notes}”</p>
                        )}
                        <button
                          type="button"
                          onClick={() => bump(order)}
                          disabled={leaving.has(order.id)}
                          className={cn(
                            'mx-3 mb-3.5 h-14 rounded-sm font-display text-[20px] font-extrabold uppercase tracking-[0.05em] transition active:scale-[0.98]',
                            lane.status === 'ready' ? 'bg-emerald-500 text-ink' : 'bg-ink text-white-fixed hover:text-signal',
                          )}
                        >
                          {lane.action}
                        </button>
                      </Ticket>
                    )
                  })}
                </section>
              )
            })}
          </div>

          {/* All-day totals */}
          <aside className="w-full flex-[1_1_240px] self-stretch border-t-2 border-inv-border pt-4 md:w-auto md:border-l-2 md:border-t-0 md:pl-5 md:pt-0">
            <div className="mb-3.5 flex items-baseline gap-2.5 border-b-4 border-signal pb-2.5">
              <h2 className="font-display text-[32px] font-extrabold uppercase leading-none">{t('station.totals')}</h2>
              <span className="sb-label text-white/60">{t('station.waiting')}</span>
            </div>
            {totals.length === 0 ? (
              <p className="sb-label text-white/60">{t('station.nothingWaiting')}</p>
            ) : (
              <ul>
                {totals.map(([name, qty], i) => (
                  <li key={name} className="flex items-baseline gap-3 border-b border-glass-border py-2.5">
                    <span className={cn('w-14 font-display text-[40px] font-extrabold leading-none', i === 0 && 'text-signal')}>{qty}</span>
                    <span className="flex-1 text-[18px] font-medium">{name}</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : loading ? (
        <p className="sb-label py-10 text-center text-white/60">{t('common.loading')}</p>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="font-display text-4xl font-extrabold uppercase">{t('kds.noTasks', { date: formatLabel(date) })}</p>
          <p className="text-base text-white/60">{t('kds.addTasksHint')}</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stations.map((station) => (
            <StationColumn
              key={station.id ?? '__general__'}
              station={station}
              recipesById={recipesById}
              onToggle={togglePrep}
              fullscreen={fullscreen}
              allDoneLabel={t('kds.allDone')}
            />
          ))}
        </div>
      )}
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
  const pending = station.tasks.filter((x) => !x.done_at)
  const done = station.tasks.filter((x) => !!x.done_at)
  const allDone = pending.length === 0 && done.length > 0

  return (
    <div className={cn('flex shrink-0 flex-col', fullscreen ? 'w-96' : 'w-80')}>
      <div className="mb-3 flex items-baseline justify-between gap-2 border-b-4 border-white pb-2.5">
        <span className={cn('truncate font-display font-extrabold uppercase leading-none', fullscreen ? 'text-3xl' : 'text-[26px]')}>{station.name}</span>
        {allDone ? (
          <span className="sb-label flex shrink-0 items-center gap-1 rounded-sm bg-emerald-500 px-2 py-1 text-ink">
            <Check className="h-4 w-4" strokeWidth={3} /> {allDoneLabel}
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[20px] font-bold tabular-nums">{done.length}/{station.tasks.length}</span>
        )}
      </div>
      <div className="mb-3 flex gap-[3px]" aria-hidden="true">
        {station.tasks.map((x, i) => <i key={x.id} className={cn('h-2 flex-1', i < done.length ? 'bg-signal' : 'bg-white/15')} />)}
      </div>

      <div className="flex flex-col gap-2">
        {pending.map((task) => (
          <TaskCard key={task.id} task={task} recipe={task.recipe_id ? recipesById.get(task.recipe_id) : undefined} onToggle={onToggle} fullscreen={fullscreen} />
        ))}
        {done.map((task) => (
          <TaskCard key={task.id} task={task} recipe={task.recipe_id ? recipesById.get(task.recipe_id) : undefined} onToggle={onToggle} fullscreen={fullscreen} isDone />
        ))}
      </div>
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
      aria-pressed={!!isDone}
      className={cn(
        'w-full rounded text-left transition active:scale-[0.99]',
        fullscreen ? 'px-4 py-4' : 'px-4 py-3.5',
        isDone ? 'bg-transparent shadow-card' : 'bg-bg-card hover:bg-bg-card-2',
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className={cn(
          'mt-0.5 flex shrink-0 items-center justify-center rounded-sm border-[3px]',
          fullscreen ? 'h-9 w-9' : 'h-8 w-8',
          isDone ? 'border-signal bg-signal text-ink' : 'border-white text-transparent',
        )}>
          <Check className={fullscreen ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={3.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn('font-display font-bold leading-tight', fullscreen ? 'text-2xl' : 'text-[21px]', isDone && 'text-white/60 line-through')}>
            {task.title}
            {task.quantity != null && <span className="ml-2 font-mono text-[0.8em] font-medium text-white/60">× {task.quantity}</span>}
          </div>
          {task.description && !isDone && <p className={cn('mt-1 leading-snug text-white/60', fullscreen ? 'text-base' : 'text-[15px]')}>{task.description}</p>}
          {recipe && (
            <span className="sb-label mt-2 inline-flex items-center gap-1.5 text-white/70">
              <Utensils className="h-4 w-4" />{recipe.title}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
