import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  ClipboardList,
  UserCircle2,
  Utensils,
  X,
  Check,
  BookTemplate,
  UtensilsCrossed,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, PillButton, ActionMenu, EmptyState, Notice, Chip, ChipRow } from '../components/ui/page'
import { Drawer } from '../components/ui/Drawer'
import {
  PrepTaskForm,
  type PrepTaskFormValues,
} from '../components/prep/PrepTaskForm'
import { PrepTemplatesDrawer } from '../components/prep/PrepTemplatesDrawer'
import { PrepFromMenuDrawer, type GeneratedPrepItem } from '../components/prep/PrepFromMenuDrawer'
import { usePrepTasks } from '../hooks/usePrepTasks'
import { useWorkstations } from '../hooks/useWorkstations'
import { useRecipes } from '../hooks/useRecipes'
import { useInventory } from '../hooks/useInventory'
import { useTeam } from '../hooks/useTeam'
import { usePrepTaskSteps } from '../hooks/usePrepTaskSteps'
import { createNotification } from '../lib/createNotification'
import { play } from '../lib/sounds'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { FlipNumber } from '../components/station/Station'
import type { PrepTask, PrepTaskStatus, PrepTaskStep, Recipe, Workstation } from '../types/database.types'
import type { PrepTemplateWithItems } from '../hooks/usePrepTemplates'

// ── Helpers ────────────────────────────────────────────────────────────────────

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

const STATUS_LABEL_KEY: Record<PrepTaskStatus, string> = {
  pending: 'prep.kanban.todo',
  in_progress: 'prep.kanban.inProgress',
  done: 'prep.kanban.done',
}

const STATUS_NEXT_KEY: Record<PrepTaskStatus, string> = {
  pending: 'prep.kanban.moveInProgress',
  in_progress: 'prep.kanban.moveDone',
  done: 'prep.kanban.movePending',
}

/** Each workstation gets a pattern so stations read apart by shape, not only colour. */
const PATTERNS = ['pat-hot', 'pat-cold', 'pat-grill', 'pat-pastry', 'pat-wash']

// ── Kanban Column ──────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: PrepTaskStatus
  tasks: PrepTask[]
  recipesById: Map<string, Recipe>
  membersById: Map<string, { full_name: string | null }>
  stepsByTaskId: Map<string, PrepTaskStep[]>
  patternFor: (task: PrepTask) => string | null
  onCycle: (task: PrepTask) => void
  onEdit: (task: PrepTask) => void
  onDelete: (task: PrepTask) => void
  onToggleStep: (stepId: string, done: boolean) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function KanbanColumn({ status, tasks, recipesById, membersById, stepsByTaskId, patternFor, onCycle, onEdit, onDelete, onToggleStep, t }: KanbanColumnProps) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <div className={cn('mb-1 flex items-baseline gap-2.5 border-b-4 pb-2.5', status === 'in_progress' ? 'border-[#FFD60A]' : status === 'done' ? 'border-emerald-500' : 'border-white')}>
        <h2 className={cn('font-display text-[30px] font-extrabold uppercase leading-none', status === 'done' && 'text-white/60')}>{t(STATUS_LABEL_KEY[status])}</h2>
        <span className="font-mono text-[24px] font-bold tabular-nums text-white/60">{tasks.length}</span>
      </div>

      {tasks.length === 0 ? (
        <div className="sb-label rounded border-2 border-dashed border-white/25 px-4 py-8 text-center text-white/60">
          {t('prep.kanban.empty')}
        </div>
      ) : (
        tasks.map((task) => {
          const recipe = task.recipe_id ? recipesById.get(task.recipe_id) : undefined
          const assignee = task.assignee_id ? membersById.get(task.assignee_id) : undefined
          const steps = stepsByTaskId.get(task.id) ?? []
          const stepsDone = steps.filter((s) => s.done).length
          const pattern = patternFor(task)
          const isDone = status === 'done'
          return (
            <div key={task.id} className={cn('group relative flex flex-col gap-2.5 overflow-hidden rounded p-4 pl-6', isDone ? 'shadow-card' : 'bg-bg-card')}>
              {pattern && <span className={cn('absolute inset-y-0 left-0 w-2.5 text-white', pattern)} aria-hidden="true" />}

              <div className="flex items-start gap-3.5">
                <button
                  type="button"
                  onClick={() => onCycle(task)}
                  aria-label={t(STATUS_NEXT_KEY[status])}
                  className={cn(
                    'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border-[3px] transition active:scale-95',
                    isDone ? 'border-signal bg-signal text-ink'
                      : status === 'in_progress' ? 'border-[#FFD60A] text-[#FFD60A]'
                      : 'border-white text-transparent hover:text-white/40',
                  )}
                >
                  <Check className="h-6 w-6" strokeWidth={3.2} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('font-display text-[23px] font-bold leading-tight', isDone && 'text-white/60 line-through')}>
                    {task.title}
                    {task.quantity != null && <span className="ml-2 font-mono text-[0.75em] font-medium text-white/60">×{task.quantity}</span>}
                  </p>
                  {task.description && !isDone && (
                    <p className="mt-1 line-clamp-2 text-[15px] text-white/60">{task.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" onClick={() => onEdit(task)} aria-label={t('common.edit')}
                    className="flex h-10 w-10 items-center justify-center rounded text-white/60 hover:bg-white/[0.08] hover:text-white">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(task)} aria-label={t('common.delete')}
                    className="flex h-10 w-10 items-center justify-center rounded text-white/60 hover:bg-red-500/15 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {(recipe || assignee || steps.length > 0) && (
                <div className="sb-label flex flex-wrap gap-x-4 gap-y-1 text-white/60">
                  {recipe && <span className="flex items-center gap-1.5"><Utensils className="h-4 w-4" />{recipe.title}</span>}
                  {assignee && <span className="flex items-center gap-1.5"><UserCircle2 className="h-4 w-4" />{assignee.full_name ?? '—'}</span>}
                  {steps.length > 0 && (
                    <span className={cn('flex items-center gap-1.5 font-mono normal-case tracking-normal', stepsDone === steps.length && 'text-emerald-500')}>
                      <Check className="h-4 w-4" />{stepsDone}/{steps.length}
                    </span>
                  )}
                </div>
              )}

              {steps.length > 0 && !isDone && (
                <ul className="flex flex-col gap-1.5">
                  {steps.map((step) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => { play('check'); onToggleStep(step.id, !step.done) }}
                        aria-pressed={step.done}
                        className="flex min-h-[36px] w-full items-center gap-2.5 text-left"
                      >
                        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border-2',
                          step.done ? 'border-emerald-500 bg-emerald-500 text-ink' : 'border-white/60')}>
                          {step.done && <Check className="h-4 w-4" strokeWidth={3} />}
                        </span>
                        <span className={cn('text-[15px]', step.done ? 'text-white/60 line-through' : 'text-white')}>{step.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {isDone && (
                <button type="button" onClick={() => onCycle(task)}
                  className="sb-label flex items-center gap-1.5 self-start text-white/60 hover:text-white">
                  <X className="h-4 w-4" />{t(STATUS_NEXT_KEY[status])}
                </button>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}

// ── Workstation list ───────────────────────────────────────────────────────────

interface WorkstationSidebarProps {
  workstations: Workstation[]
  selected: string | null
  leftFor: (id: string | null) => number
  onSelect: (id: string | null) => void
  onCreate: (name: string) => Promise<unknown>
  onDelete: (w: Workstation) => Promise<void>
  t: (key: string, opts?: Record<string, unknown>) => string
}

const stationBtn = 'flex min-h-[56px] flex-1 items-center gap-3 rounded border-2 px-3 text-left font-display text-[19px] font-extrabold uppercase tracking-[0.03em] transition min-w-0'

function WorkstationSidebar({ workstations, selected, leftFor, onSelect, onCreate, onDelete, t }: WorkstationSidebarProps) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await onCreate(newName.trim())
      setNewName('')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const btn = (active: boolean) => cn(stationBtn, active ? 'border-white bg-white text-ink' : 'border-inv-border text-white hover:border-white')

  return (
    <div className="flex flex-col gap-2">
      <p className="sb-label text-white/60">{t('prep.workstations.title')}</p>

      <button type="button" onClick={() => onSelect(null)} aria-pressed={selected === null} className={btn(selected === null)}>
        <span className="pat-all h-8 w-3 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">{t('prep.workstations.all')}</span>
        <span className="font-mono text-[18px]">{leftFor(null)}</span>
      </button>

      {workstations.map((w, i) => (
        <div key={w.id} className="group flex items-center gap-1.5">
          <button type="button" onClick={() => onSelect(w.id)} aria-pressed={selected === w.id} className={btn(selected === w.id)}>
            <span className={cn('h-8 w-3 shrink-0', PATTERNS[i % PATTERNS.length])} aria-hidden="true" />
            <span className="flex-1 truncate">{w.name}</span>
            <span className="font-mono text-[18px]">{leftFor(w.id)}</span>
          </button>
          <button type="button" onClick={() => onDelete(w)} aria-label={t('common.delete')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-white/60 opacity-0 transition hover:bg-red-500/15 hover:text-red-500 group-hover:opacity-100 focus:opacity-100">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="mt-1 flex items-center gap-1.5">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewName('') }
            }}
            placeholder={t('prep.workstations.namePlaceholder')}
            className="h-12 min-w-0 flex-1 rounded border-2 border-inv-border bg-bg-input px-3 text-base text-white outline-none placeholder:text-white/50 focus:border-signal"
          />
          <button type="button" onClick={() => void handleAdd()} disabled={saving} aria-label={t('common.save')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white text-ink">
            <Check className="h-5 w-5" strokeWidth={3} />
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewName('') }} aria-label={t('common.cancel')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-inv-border text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="sb-label mt-1 flex items-center gap-2 px-1 py-2 text-white/60 hover:text-white">
          <Plus className="h-4 w-4" />{t('prep.workstations.add')}
        </button>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Prep() {
  const { t } = useTranslation()
  const [date, setDate] = useState<string>(todayIso())
  const { profile } = useAuth()
  const { tasks, loading, error, create, update, remove, removeMany, cycleStatus } = usePrepTasks(date)
  const { workstations, create: createWorkstation, remove: removeWorkstation } = useWorkstations()
  const { recipes } = useRecipes()
  const { items: inventory } = useInventory()
  const { members } = useTeam()

  const taskIds = useMemo(() => tasks.map((x) => x.id), [tasks])
  const { stepsByTaskId, createSteps, replaceSteps, toggle: toggleStep } = usePrepTaskSteps(taskIds)

  const [selectedWorkstation, setSelectedWorkstation] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [fromMenuOpen, setFromMenuOpen] = useState(false)
  const [editing, setEditing] = useState<PrepTask | null>(null)
  const [saving, setSaving] = useState(false)

  function formatLabel(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const today = todayIso()
    if (iso === today) return t('common.today')
    if (iso === shiftDate(today, 1)) return t('common.tomorrow')
    if (iso === shiftDate(today, -1)) return t('common.yesterday')
    return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const patternById = useMemo(() => new Map(workstations.map((w, i) => [w.id, PATTERNS[i % PATTERNS.length]])), [workstations])
  const patternFor = (task: PrepTask) => (task.workstation_id ? patternById.get(task.workstation_id) ?? null : null)
  const leftFor = (id: string | null) => tasks.filter((x) => x.status !== 'done' && (id === null || x.workstation_id === id)).length

  const filteredTasks = useMemo(() => {
    if (selectedWorkstation === null) return tasks
    return tasks.filter((x) => x.workstation_id === selectedWorkstation)
  }, [tasks, selectedWorkstation])

  const byStatus = useMemo(() => {
    const pending: PrepTask[] = []
    const in_progress: PrepTask[] = []
    const done: PrepTask[] = []
    for (const task of filteredTasks) {
      if (task.status === 'done') done.push(task)
      else if (task.status === 'in_progress') in_progress.push(task)
      else pending.push(task)
    }
    return { pending, in_progress, done }
  }, [filteredTasks])

  // The pass bell when the last open task of the day is done.
  const allDone = tasks.length > 0 && tasks.every((x) => x.status === 'done')
  const wasAllDone = useRef(allDone)
  useEffect(() => {
    if (allDone && !wasAllDone.current) play('ding')
    wasAllDone.current = allDone
  }, [allDone])

  function cycle(task: PrepTask) {
    if (task.status !== 'done') play('check')
    void cycleStatus(task)
  }

  function openCreate() {
    setEditing(null)
    setDrawerOpen(true)
  }

  function openEdit(task: PrepTask) {
    setEditing(task)
    setDrawerOpen(true)
  }

  async function onSubmit(values: PrepTaskFormValues) {
    setSaving(true)
    try {
      const { steps, ...taskFields } = values
      if (editing) {
        await update(editing.id, taskFields)
        await replaceSteps(editing.id, steps)
        // Notify if assignee changed
        if (taskFields.assignee_id && taskFields.assignee_id !== editing.assignee_id && profile?.team_id) {
          await createNotification(
            profile.team_id,
            taskFields.assignee_id,
            'prep_assigned',
            t('notifications.prepAssigned', { title: taskFields.title }),
            t('notifications.prepAssignedBody', { date: values.prep_for }),
          )
        }
      } else {
        const row = await create({ ...taskFields, status: taskFields.status ?? 'pending' })
        await createSteps(row.id, steps)
        if (taskFields.assignee_id && profile?.team_id) {
          await createNotification(
            profile.team_id,
            taskFields.assignee_id,
            'prep_assigned',
            t('notifications.prepAssigned', { title: taskFields.title }),
            t('notifications.prepAssignedBody', { date: values.prep_for }),
          )
        }
      }
      setDrawerOpen(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(task: PrepTask) {
    const ok = window.confirm(t('prep.deleteConfirm', { title: task.title }))
    if (!ok) return
    await remove(task.id)
  }

  async function applyTemplate(tmpl: PrepTemplateWithItems) {
    for (const item of tmpl.items) {
      await create({
        title: item.title,
        description: item.description,
        recipe_id: item.recipe_id,
        quantity: item.quantity,
        assignee_id: null,
        workstation_id: item.workstation_id ?? selectedWorkstation,
        status: 'pending',
        prep_for: date,
      })
    }
  }

  async function generateFromMenu(items: GeneratedPrepItem[]) {
    for (const item of items) {
      const row = await create({
        title: item.title,
        description: item.description ?? null,
        recipe_id: item.recipe_id,
        menu_id: item.menu_id ?? null,
        quantity: item.quantity,
        assignee_id: item.assignee_id,
        workstation_id: item.workstation_id,
        status: 'pending',
        prep_for: item.prep_for,
      })
      if (item.assignee_id && profile?.team_id) {
        await createNotification(
          profile.team_id,
          item.assignee_id,
          'prep_assigned',
          t('notifications.prepAssigned', { title: row.title }),
          t('notifications.prepAssignedBody', { date: item.prep_for }),
        )
      }
    }
  }

  async function handleDeleteWorkstation(w: Workstation) {
    const ok = window.confirm(t('prep.workstations.deleteConfirm', { name: w.name }))
    if (!ok) return
    if (selectedWorkstation === w.id) setSelectedWorkstation(null)
    await removeWorkstation(w.id)
  }

  const activeTaskIds = useMemo(
    () => filteredTasks.filter((x) => x.status !== 'done').map((x) => x.id),
    [filteredTasks],
  )

  async function onDeleteAll() {
    if (activeTaskIds.length === 0) return
    const ok = window.confirm(t('prep.deleteAllConfirm', { count: activeTaskIds.length }))
    if (!ok) return
    setDeletingAll(true)
    try {
      await removeMany(activeTaskIds)
    } finally {
      setDeletingAll(false)
    }
  }

  const selectedWorkstationName = workstations.find((w) => w.id === selectedWorkstation)?.name ?? null

  const doneCount = byStatus.done.length
  const progress = filteredTasks.length ? Math.round((doneCount / filteredTasks.length) * 100) : 0

  return (
    <Page>
      <PageHeader
        no="05"
        eyebrow={selectedWorkstationName ?? t('prep.subtitle')}
        title={t('prep.title')}
        actions={
          <>
            <div className="flex items-center gap-1 rounded shadow-card">
              <button type="button" onClick={() => setDate((d) => shiftDate(d, -1))} aria-label={t('prep.prevDay')}
                className="flex h-12 w-12 items-center justify-center hover:bg-white/[0.08]">
                <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
              </button>
              <label className="relative flex min-w-[120px] cursor-pointer flex-col items-center px-1">
                <span className="font-display text-[18px] font-bold uppercase">{formatLabel(date)}</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayIso())} aria-label={t('prep.title')}
                  className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <button type="button" onClick={() => setDate((d) => shiftDate(d, 1))} aria-label={t('prep.nextDay')}
                className="flex h-12 w-12 items-center justify-center hover:bg-white/[0.08]">
                <ChevronRight className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
            <ActionMenu
              label={t('prep.v2.more')}
              actions={[
                { label: t('prep.fromMenu.button'), icon: UtensilsCrossed, onClick: () => setFromMenuOpen(true) },
                { label: t('prep.templates.button'), icon: BookTemplate, onClick: () => setTemplatesOpen(true) },
                { label: t('prep.deleteAll'), icon: Trash2, onClick: () => void onDeleteAll(), hidden: activeTaskIds.length === 0 || deletingAll },
              ]}
            />
            <PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('prep.addTask')}</PillButton>
          </>
        }
      />

      {error && <Notice>{error}</Notice>}

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── Progress + workstations ── */}
        <aside className="hidden flex-col gap-5 lg:sticky lg:top-24 lg:flex">
          {!loading && filteredTasks.length > 0 && (
            <div className="relative overflow-hidden">
              <span aria-hidden="true" className="sb-ghost -right-3 top-2 text-[200px]">{progress}</span>
              <p className="sb-label relative text-white/60">{t('prep.v2.progress')}</p>
              <p className="relative font-mono text-[92px] font-bold leading-[0.85] tracking-[-0.04em] tabular-nums">
                <FlipNumber value={progress} /><span className="text-[44px]">%</span>
              </p>
              <p className="relative mt-2 font-display text-[21px] font-bold">{t('station.readyOf', { done: doneCount, total: filteredTasks.length })}</p>
              <div className="relative mt-3 flex gap-[3px]" aria-hidden="true">
                {filteredTasks.map((x, i) => <i key={x.id} className={cn('h-3 flex-1', i < doneCount ? 'bg-signal' : 'bg-white/15')} />)}
              </div>
            </div>
          )}
          <WorkstationSidebar
            workstations={workstations}
            selected={selectedWorkstation}
            leftFor={leftFor}
            onSelect={setSelectedWorkstation}
            onCreate={createWorkstation}
            onDelete={handleDeleteWorkstation}
            t={t}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          {/* Mobile: progress + workstation picker */}
          {!loading && filteredTasks.length > 0 && (
            <div className="flex items-center gap-4 lg:hidden">
              <span className="font-mono text-[56px] font-bold leading-none tracking-[-0.04em]">{progress}%</span>
              <div className="flex flex-1 flex-col gap-2">
                <span className="font-display text-[19px] font-bold">{t('station.readyOf', { done: doneCount, total: filteredTasks.length })}</span>
                <div className="flex gap-[3px]" aria-hidden="true">
                  {filteredTasks.map((x, i) => <i key={x.id} className={cn('h-2.5 flex-1', i < doneCount ? 'bg-signal' : 'bg-white/15')} />)}
                </div>
              </div>
            </div>
          )}
          <ChipRow className="lg:hidden">
            <Chip active={selectedWorkstation === null} onClick={() => setSelectedWorkstation(null)} count={leftFor(null)}>{t('prep.workstations.all')}</Chip>
            {workstations.map((w) => (
              <Chip key={w.id} active={selectedWorkstation === w.id} onClick={() => setSelectedWorkstation(w.id)} count={leftFor(w.id)}>{w.name}</Chip>
            ))}
          </ChipRow>

          {allDone && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded bg-emerald-500 px-6 py-6 text-ink">
              <p className="font-display text-5xl font-extrabold uppercase leading-[0.9]">{t('station.readyForService')}</p>
            </div>
          )}

          {loading ? (
            <p className="sb-label py-10 text-center text-white/60">{t('common.loading')}</p>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('prep.empty.title')}
              body={t('prep.empty.description', { date: formatLabel(date).toLowerCase() })}
              action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('prep.empty.cta')}</PillButton>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {(['pending', 'in_progress', 'done'] as PrepTaskStatus[]).map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={byStatus[status]}
                  recipesById={recipesById as Map<string, Recipe>}
                  membersById={membersById}
                  stepsByTaskId={stepsByTaskId}
                  patternFor={patternFor}
                  onCycle={cycle}
                  onEdit={openEdit}
                  onDelete={onDelete}
                  onToggleStep={toggleStep}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { if (!saving) { setDrawerOpen(false); setEditing(null) } }}
        title={editing ? t('prep.editTask') : t('prep.newTask')}
      >
        <PrepTaskForm
          initial={editing ?? undefined}
          initialSteps={editing ? (stepsByTaskId.get(editing.id) ?? []) : []}
          defaultDate={date}
          defaultWorkstationId={selectedWorkstation}
          recipes={recipes}
          members={members}
          workstations={workstations}
          submitting={saving}
          onSubmit={onSubmit}
          onCancel={() => { setDrawerOpen(false); setEditing(null) }}
        />
      </Drawer>

      {/* Templates drawer */}
      <PrepTemplatesDrawer
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        recipes={recipes}
        workstations={workstations}
        onApply={applyTemplate}
      />

      {/* From menu drawer */}
      <PrepFromMenuDrawer
        open={fromMenuOpen}
        onClose={() => setFromMenuOpen(false)}
        defaultDate={date}
        defaultWorkstationId={selectedWorkstation}
        recipes={recipes}
        inventory={inventory}
        workstations={workstations}
        members={members}
        onGenerate={generateFromMenu}
      />
    </Page>
  )
}
