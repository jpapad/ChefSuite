import { useMemo, useState } from 'react'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  ClipboardList,
  UserCircle2,
  Utensils,
  LayoutGrid,
  ChevronRight as ArrowRight,
  X,
  Check,
  BookTemplate,
  UtensilsCrossed,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, PillButton, ActionMenu, Panel, EmptyState, Notice, Chip, ChipRow } from '../components/ui/page'
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
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
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

const STATUS_DOT: Record<PrepTaskStatus, string> = {
  pending: 'bg-white/30',
  in_progress: 'bg-amber-500',
  done: 'bg-emerald-500',
}

const STATUS_NEXT_KEY: Record<PrepTaskStatus, string> = {
  pending: 'prep.kanban.moveInProgress',
  in_progress: 'prep.kanban.moveDone',
  done: 'prep.kanban.movePending',
}

// ── Kanban Column ──────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: PrepTaskStatus
  tasks: PrepTask[]
  recipesById: Map<string, Recipe>
  membersById: Map<string, { full_name: string | null }>
  stepsByTaskId: Map<string, PrepTaskStep[]>
  onCycle: (task: PrepTask) => void
  onEdit: (task: PrepTask) => void
  onDelete: (task: PrepTask) => void
  onToggleStep: (stepId: string, done: boolean) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function KanbanColumn({ status, tasks, recipesById, membersById, stepsByTaskId, onCycle, onEdit, onDelete, onToggleStep, t }: KanbanColumnProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-3xl bg-white/[0.04] p-3">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 pt-1">
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', STATUS_DOT[status])} />
        <span className="font-medium">{t(STATUS_LABEL_KEY[status])}</span>
        <span className="ml-auto rounded-full bg-bg-card px-2.5 py-0.5 text-xs font-medium tabular-nums shadow-card">{tasks.length}</span>
      </div>

      {/* Cards */}
      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/45">
          {t('prep.kanban.empty')}
        </div>
      ) : (
        tasks.map((task) => {
          const recipe = task.recipe_id ? recipesById.get(task.recipe_id) : undefined
          const assignee = task.assignee_id ? membersById.get(task.assignee_id) : undefined
          return (
            <div key={task.id}
              className={cn(
                'group space-y-2.5 rounded-2xl bg-bg-card p-4 shadow-card transition',
                status === 'done' ? 'opacity-60' : '',
              )}
            >
              {/* Title row */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium', status === 'done' && 'line-through text-white/50')}>
                    {task.title}
                    {task.quantity != null && (
                      <span className="ml-1.5 text-white/40 font-normal">×{task.quantity}</span>
                    )}
                  </p>
                  {task.description && (
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{task.description}</p>
                  )}
                </div>
                {/* Actions — visible on hover */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition shrink-0">
                  <button type="button" onClick={() => onEdit(task)} aria-label={t('common.edit')}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/[0.06]">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onDelete(task)} aria-label={t('common.delete')}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 hover:text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-1.5 text-xs text-white/60">
                {recipe && (
                  <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5">
                    <Utensils className="h-3 w-3" />{recipe.title}
                  </span>
                )}
                {assignee && (
                  <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5">
                    <UserCircle2 className="h-3 w-3" />{assignee.full_name ?? '—'}
                  </span>
                )}
                {(() => {
                  const steps = stepsByTaskId.get(task.id)
                  if (!steps || steps.length === 0) return null
                  const doneCount = steps.filter((s) => s.done).length
                  return (
                    <span className={cn(
                      'flex items-center gap-1 font-medium',
                      doneCount === steps.length ? 'text-emerald-400' : 'text-white/50'
                    )}>
                      <Check className="h-3 w-3" />
                      {doneCount}/{steps.length}
                    </span>
                  )
                })()}
              </div>

              {/* Steps checklist */}
              {(() => {
                const steps = stepsByTaskId.get(task.id)
                if (!steps || steps.length === 0) return null
                return (
                  <ul className="space-y-1">
                    {steps.map((step) => (
                      <li key={step.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleStep(step.id, !step.done)}
                          aria-label={step.title}
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                            step.done
                              ? 'bg-emerald-600 border-emerald-600 text-white-fixed'
                              : 'border-white/30 hover:border-white/60'
                          )}
                        >
                          {step.done && <Check className="h-2.5 w-2.5" />}
                        </button>
                        <span className={cn('text-xs', step.done ? 'line-through text-white/30' : 'text-white/70')}>
                          {step.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              })()}

              {/* Cycle button */}
              {status !== 'done' ? (
                <button type="button" onClick={() => onCycle(task)}
                  className={cn(
                    'w-full flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium transition',
                    status === 'pending'
                      ? 'bg-brand-orange text-on-accent hover:bg-brand-orange/85'
                      : 'bg-lime text-ink hover:brightness-95',
                  )}>
                  <ArrowRight className="h-3 w-3" />
                  {t(STATUS_NEXT_KEY[status])}
                </button>
              ) : (
                <button type="button" onClick={() => onCycle(task)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-full bg-white/[0.05] text-white/60 hover:text-white px-3 py-2 text-xs font-medium transition">
                  <X className="h-3 w-3" />
                  {t(STATUS_NEXT_KEY[status])}
                </button>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Workstation Sidebar ────────────────────────────────────────────────────────

interface WorkstationSidebarProps {
  workstations: Workstation[]
  selected: string | null
  onSelect: (id: string | null) => void
  onCreate: (name: string) => Promise<unknown>
  onDelete: (w: Workstation) => Promise<void>
  t: (key: string, opts?: Record<string, unknown>) => string
}

function WorkstationSidebar({ workstations, selected, onSelect, onCreate, onDelete, t }: WorkstationSidebarProps) {
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

  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 pt-2 text-xs font-medium text-white/50">
        {t('prep.workstations.title')}
      </p>

      {/* All tasks option */}
      <button type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition text-left',
          selected === null
            ? 'bg-brand-orange text-on-accent'
            : 'text-white/70 hover:bg-white/[0.05] hover:text-white',
        )}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        {t('prep.workstations.all')}
      </button>

      {workstations.map((w) => (
        <div key={w.id} className="group flex items-center gap-1">
          <button type="button"
            onClick={() => onSelect(w.id)}
            className={cn(
              'flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition text-left min-w-0',
              selected === w.id
                ? 'bg-brand-orange text-on-accent'
                : 'text-white/70 hover:bg-white/[0.05] hover:text-white',
            )}
          >
            <span className="truncate">{w.name}</span>
          </button>
          <button type="button"
            onClick={() => onDelete(w)}
            className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-1 mt-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewName('') }
            }}
            placeholder={t('prep.workstations.namePlaceholder')}
            className="flex-1 min-w-0 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-brand-orange"
          />
          <button type="button" onClick={() => void handleAdd()} disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-on-accent hover:bg-brand-orange/80 transition shrink-0">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewName('') }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 text-white/50 hover:text-white transition shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition mt-1">
          <Plus className="h-3.5 w-3.5" />
          {t('prep.workstations.add')}
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

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])
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
    const tomorrow = shiftDate(today, 1)
    const yesterday = shiftDate(today, -1)
    if (iso === today) return t('common.today')
    if (iso === tomorrow) return t('common.tomorrow')
    if (iso === yesterday) return t('common.yesterday')
    return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const filteredTasks = useMemo(() => {
    if (selectedWorkstation === null) return tasks
    return tasks.filter((t) => t.workstation_id === selectedWorkstation)
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
    () => filteredTasks.filter((t) => t.status !== 'done').map((t) => t.id),
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
        title={t('prep.title')}
        subtitle={selectedWorkstationName ?? t('prep.subtitle')}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-full bg-bg-card p-1 shadow-card">
              <button type="button" onClick={() => setDate((d) => shiftDate(d, -1))} aria-label={t('prep.prevDay')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <label className="relative flex min-w-[110px] cursor-pointer flex-col items-center px-1">
                <span className="text-sm font-medium">{formatLabel(date)}</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayIso())} aria-label={t('prep.title')}
                  className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <button type="button" onClick={() => setDate((d) => shiftDate(d, 1))} aria-label={t('prep.nextDay')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white">
                <ChevronRight className="h-4 w-4" />
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

      <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* ── Workstations ── */}
        <aside className="hidden lg:block rounded-3xl bg-bg-card p-2 shadow-card lg:sticky lg:top-24">
          <WorkstationSidebar
            workstations={workstations}
            selected={selectedWorkstation}
            onSelect={setSelectedWorkstation}
            onCreate={createWorkstation}
            onDelete={handleDeleteWorkstation}
            t={t}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Mobile workstation picker */}
          <ChipRow className="lg:hidden">
            <Chip active={selectedWorkstation === null} onClick={() => setSelectedWorkstation(null)}>{t('prep.workstations.all')}</Chip>
            {workstations.map((w) => (
              <Chip key={w.id} active={selectedWorkstation === w.id} onClick={() => setSelectedWorkstation(w.id)}>{w.name}</Chip>
            ))}
          </ChipRow>

          {!loading && filteredTasks.length > 0 && (
            <section className="flex flex-wrap items-center gap-6 rounded-3xl bg-ink p-5 sm:p-6 text-white-fixed">
              <div>
                <p className="text-sm text-[#C9CEC8]">{t('prep.v2.progress')}</p>
                <p className="text-5xl font-medium tracking-[-0.04em] tabular-nums text-lime">{progress}%</p>
              </div>
              <div className="flex min-w-[200px] flex-1 flex-col gap-3">
                <div className="h-3 overflow-hidden rounded-full bg-white-fixed/10">
                  <div className="h-3 rounded-full bg-lime transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-[#C9CEC8]">
                  {(['pending', 'in_progress', 'done'] as PrepTaskStatus[]).map((st) => (
                    <span key={st} className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[st])} />
                      {t(STATUS_LABEL_KEY[st])} <span className="font-medium tabular-nums text-white-fixed">{byStatus[st].length}</span>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {loading ? (
            <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('prep.empty.title')}
              body={t('prep.empty.description', { date: formatLabel(date).toLowerCase() })}
              action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('prep.empty.cta')}</PillButton>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(['pending', 'in_progress', 'done'] as PrepTaskStatus[]).map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={byStatus[status]}
                  recipesById={recipesById as Map<string, Recipe>}
                  membersById={membersById}
                  stepsByTaskId={stepsByTaskId}
                  onCycle={cycleStatus}
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
