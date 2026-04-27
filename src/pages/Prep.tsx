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
  Settings2,
  X,
  Check,
  BookTemplate,
  UtensilsCrossed,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
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

const STATUS_COLOR: Record<PrepTaskStatus, string> = {
  pending: 'border-white/20 text-white/60',
  in_progress: 'border-amber-400/60 text-amber-400',
  done: 'border-emerald-400/60 text-emerald-400',
}

const STATUS_DOT: Record<PrepTaskStatus, string> = {
  pending: 'bg-white/30',
  in_progress: 'bg-amber-400',
  done: 'bg-emerald-400',
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
    <div className="flex flex-col gap-3 min-w-0">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <span className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT[status])} />
        <span className="text-sm font-semibold text-white/80">{t(STATUS_LABEL_KEY[status])}</span>
        <span className="ml-auto text-xs text-white/40 tabular-nums">{tasks.length}</span>
      </div>

      {/* Cards */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-white/30">
          {t('prep.kanban.empty')}
        </div>
      ) : (
        tasks.map((task) => {
          const recipe = task.recipe_id ? recipesById.get(task.recipe_id) : undefined
          const assignee = task.assignee_id ? membersById.get(task.assignee_id) : undefined
          return (
            <div key={task.id}
              className={cn(
                'rounded-xl border bg-white/5 p-3 space-y-2 group transition',
                status === 'done' ? 'opacity-60' : '',
                STATUS_COLOR[status].split(' ')[0],
              )}
            >
              {/* Title row */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium text-sm', status === 'done' && 'line-through text-white/50')}>
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
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button type="button" onClick={() => onEdit(task)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onDelete(task)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-xs text-white/40">
                {recipe && (
                  <span className="flex items-center gap-1">
                    <Utensils className="h-3 w-3" />{recipe.title}
                  </span>
                )}
                {assignee && (
                  <span className="flex items-center gap-1">
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
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                            step.done
                              ? 'bg-emerald-500 border-emerald-500 text-white'
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
                    'w-full flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                    status === 'pending'
                      ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10'
                      : 'border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10',
                  )}>
                  <ArrowRight className="h-3 w-3" />
                  {t(STATUS_NEXT_KEY[status])}
                </button>
              ) : (
                <button type="button" onClick={() => onCycle(task)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-white/15 text-white/40 hover:text-white/70 hover:bg-white/5 px-3 py-1.5 text-xs font-medium transition">
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
  onCreate: (name: string) => Promise<void>
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
      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white/40">
        {t('prep.workstations.title')}
      </p>

      {/* All tasks option */}
      <button type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition text-left',
          selected === null
            ? 'bg-brand-orange/20 text-brand-orange'
            : 'text-white/70 hover:bg-white/5 hover:text-white',
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
              'flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition text-left min-w-0',
              selected === w.id
                ? 'bg-brand-orange/20 text-brand-orange'
                : 'text-white/70 hover:bg-white/5 hover:text-white',
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
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-white-fixed hover:bg-brand-orange/80 transition shrink-0">
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
  const { tasks, loading, error, create, update, remove, cycleStatus } = usePrepTasks(date)
  const { workstations, create: createWorkstation, remove: removeWorkstation } = useWorkstations()
  const { recipes } = useRecipes()
  const { items: inventory } = useInventory()
  const { members } = useTeam()

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])
  const { stepsByTaskId, createSteps, replaceSteps, toggle: toggleStep } = usePrepTaskSteps(taskIds)

  const [selectedWorkstation, setSelectedWorkstation] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
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

  const selectedWorkstationName = workstations.find((w) => w.id === selectedWorkstation)?.name ?? null

  return (
    <div className="flex gap-6 min-h-0">
      {/* ── Left: workstation sidebar ── */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 gap-4">
        <WorkstationSidebar
          workstations={workstations}
          selected={selectedWorkstation}
          onSelect={setSelectedWorkstation}
          onCreate={createWorkstation}
          onDelete={handleDeleteWorkstation}
          t={t}
        />
      </aside>

      {/* ── Right: main area ── */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">{t('prep.title')}</h1>
            <p className="text-white/60 mt-1">
              {selectedWorkstationName
                ? selectedWorkstationName
                : t('prep.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile workstation dropdown */}
            <div className="lg:hidden">
              <div className="glass flex items-center rounded-xl px-3 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
                <Settings2 className="h-4 w-4 text-white/40 mr-2" />
                <select
                  value={selectedWorkstation ?? ''}
                  onChange={(e) => setSelectedWorkstation(e.target.value || null)}
                  className="bg-transparent outline-none text-sm text-white py-2"
                >
                  <option value="" className="bg-[#f5ede0]">{t('prep.workstations.all')}</option>
                  {workstations.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#f5ede0]">{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button variant="secondary" leftIcon={<UtensilsCrossed className="h-5 w-5" />} onClick={() => setFromMenuOpen(true)}>
              <span className="hidden sm:inline">{t('prep.fromMenu.button')}</span>
            </Button>
            <Button variant="secondary" leftIcon={<BookTemplate className="h-5 w-5" />} onClick={() => setTemplatesOpen(true)}>
              <span className="hidden sm:inline">{t('prep.templates.button')}</span>
            </Button>
            <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
              {t('prep.addTask')}
            </Button>
          </div>
        </header>

        {/* Date picker */}
        <GlassCard className="flex items-center justify-between gap-3">
          <button type="button"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            aria-label={t('prep.prevDay')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-semibold">{formatLabel(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayIso())}
              className="bg-transparent text-xs text-white/60 outline-none text-center"
            />
          </div>
          <button type="button"
            onClick={() => setDate((d) => shiftDate(d, 1))}
            aria-label={t('prep.nextDay')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5">
            <ChevronRight className="h-5 w-5" />
          </button>
        </GlassCard>

        {error && (
          <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>
        )}

        {loading ? (
          <GlassCard>
            <p className="text-white/60">{t('common.loading')}</p>
          </GlassCard>
        ) : filteredTasks.length === 0 ? (
          <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
              <ClipboardList className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">{t('prep.empty.title')}</h2>
            <p className="text-white/60 max-w-sm">
              {t('prep.empty.description', { date: formatLabel(date).toLowerCase() })}
            </p>
            <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate} className="mt-2">
              {t('prep.empty.cta')}
            </Button>
          </GlassCard>
        ) : (
          /* ── 3-column Kanban ── */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
    </div>
  )
}
