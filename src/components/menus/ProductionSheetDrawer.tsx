import { useEffect, useState } from 'react'
import { Printer, X, ChefHat, CheckSquare, Square, UtensilsCrossed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useWorkstations } from '../../hooks/useWorkstations'
import type { Menu, PrepTask, Profile, Recipe, Workstation } from '../../types/database.types'

interface ProductionSheetDrawerProps {
  open: boolean
  onClose: () => void
  menu: Menu
  members: Profile[]
  recipes: Recipe[]
}

interface RecipeGroup {
  recipeId: string | null
  recipe: Recipe | undefined
  tasks: PrepTask[]
}

interface WorkstationGroup {
  workstation: Workstation | null
  recipeGroups: RecipeGroup[]
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ProductionSheetDrawer({ open, onClose, menu, members, recipes }: ProductionSheetDrawerProps) {
  const { t } = useTranslation()
  const { workstations } = useWorkstations()
  const [date, setDate] = useState(todayIso)
  const [tasks, setTasks] = useState<PrepTask[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    supabase
      .from('prep_tasks')
      .select('*')
      .eq('menu_id', menu.id)
      .eq('prep_for', date)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setTasks((data ?? []) as PrepTask[])
        setLoading(false)
      })
  }, [open, menu.id, date])

  const membersById = new Map(members.map((m) => [m.id, m]))
  const recipesById = new Map(recipes.map((r) => [r.id, r]))
  const wsById = new Map(workstations.map((w) => [w.id, w]))

  // Build: Workstation → Recipe → Tasks
  const groups: WorkstationGroup[] = (() => {
    // First level: group by workstation
    const wsMap = new Map<string | null, Map<string | null, PrepTask[]>>()
    for (const task of tasks) {
      const wsKey = task.workstation_id ?? null
      if (!wsMap.has(wsKey)) wsMap.set(wsKey, new Map())
      const recipeMap = wsMap.get(wsKey)!
      const recipeKey = task.recipe_id ?? null
      const arr = recipeMap.get(recipeKey) ?? []
      arr.push(task)
      recipeMap.set(recipeKey, arr)
    }

    const result: WorkstationGroup[] = []
    for (const [wsId, recipeMap] of wsMap) {
      const ws = wsId ? (wsById.get(wsId) ?? null) : null
      const recipeGroups: RecipeGroup[] = []
      for (const [recipeId, recipeTasks] of recipeMap) {
        recipeGroups.push({
          recipeId,
          recipe: recipeId ? recipesById.get(recipeId) : undefined,
          tasks: recipeTasks,
        })
      }
      // Sort recipe groups: named recipes first, then null
      recipeGroups.sort((a, b) => {
        if (!a.recipe && !b.recipe) return 0
        if (!a.recipe) return 1
        if (!b.recipe) return -1
        return a.recipe.title.localeCompare(b.recipe.title)
      })
      result.push({ workstation: ws, recipeGroups })
    }
    // Sort workstations by sort_order, unassigned last
    return result.sort((a, b) => {
      if (!a.workstation) return 1
      if (!b.workstation) return -1
      return (a.workstation.sort_order ?? 0) - (b.workstation.sort_order ?? 0)
    })
  })()

  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const S = {
    section:      { border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' } as React.CSSProperties,
    wsHead:       { background: 'rgba(234,88,12,0.12)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
    wsHeadText:   { fontWeight: 700, fontSize: '14px', color: '#ffffff', flex: 1 } as React.CSSProperties,
    wsCount:      { fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 } as React.CSSProperties,
    recipeHead:   { background: 'rgba(255,255,255,0.04)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' } as React.CSSProperties,
    recipeTitle:  { fontWeight: 600, fontSize: '12px', color: 'rgba(255,255,255,0.7)', flex: 1 } as React.CSSProperties,
    recipeMeta:   { fontSize: '11px', color: 'rgba(255,255,255,0.35)' } as React.CSSProperties,
    taskRow:      { padding: '9px 16px 9px 36px', display: 'flex', alignItems: 'flex-start', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' } as React.CSSProperties,
    taskRowDone:  { padding: '9px 16px 9px 36px', display: 'flex', alignItems: 'flex-start', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: 0.4 } as React.CSSProperties,
    taskTitle:    { fontWeight: 600, fontSize: '13px', color: 'rgba(255,255,255,0.88)', lineHeight: 1.3 } as React.CSSProperties,
    taskDesc:     { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: '3px', lineHeight: 1.4 } as React.CSSProperties,
    taskAssignee: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' } as React.CSSProperties,
    badge:        { flexShrink: 0, fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '6px', marginTop: '1px' } as React.CSSProperties,
    progress:     { height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' } as React.CSSProperties,
    progressFill: { height: '100%', background: '#ea580c', borderRadius: '3px', transition: 'width 0.3s', width: `${progressPct}%` } as React.CSSProperties,
  }

  const statusBg:   Record<string, string> = { done: 'rgba(16,185,129,0.18)', in_progress: 'rgba(234,88,12,0.18)', pending: 'rgba(255,255,255,0.07)' }
  const statusFg:   Record<string, string> = { done: 'rgb(16,185,129)', in_progress: '#ea580c', pending: 'rgba(255,255,255,0.35)' }
  const statusLabel: Record<string, string> = { done: '✓', in_progress: '⟳', pending: '○' }

  return (
    <Drawer open={open} onClose={onClose} title={t('menus.productionSheet.title')}>
      <div className="space-y-4">

        {/* Header info */}
        <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
          <p className="text-sm font-semibold text-white/80">{menu.name}</p>
          <p className="text-xs text-white/40 mt-0.5">{t(`menus.types.${menu.type}`)}</p>
        </div>

        {/* Date picker */}
        <div>
          <span className="mb-2 block text-sm font-medium text-white/80">{t('menus.productionSheet.date')}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>

        {loading ? (
          <p className="text-sm text-white/40 text-center py-8">{t('common.loading')}</p>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center space-y-2">
            <UtensilsCrossed className="h-8 w-8 text-white/20 mx-auto" />
            <p className="text-sm text-white/40">{t('menus.productionSheet.noTasks')}</p>
            <p className="text-xs text-white/25">{t('menus.productionSheet.noTasksHint')}</p>
          </div>
        ) : (
          <>
            {/* Progress summary */}
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-white/50">{t('menus.productionSheet.progress')}</span>
                <span className="text-xs font-bold text-white/70">{doneTasks}/{totalTasks} · {progressPct}%</span>
              </div>
              <div style={S.progress}><div style={S.progressFill} /></div>
            </div>

            {/* Workstation → Recipe → Tasks */}
            {groups.map((group, gi) => {
              const wsDone  = group.recipeGroups.flatMap((rg) => rg.tasks).filter((t) => t.status === 'done').length
              const wsTotal = group.recipeGroups.flatMap((rg) => rg.tasks).length
              return (
                <div key={gi} style={S.section}>

                  {/* Workstation header */}
                  <div style={S.wsHead}>
                    <ChefHat style={{ width: '15px', height: '15px', color: '#ea580c', flexShrink: 0 }} />
                    <span style={S.wsHeadText}>
                      {group.workstation?.name ?? t('menus.productionSheet.unassigned')}
                    </span>
                    <span style={S.wsCount}>{wsDone}/{wsTotal}</span>
                  </div>

                  {/* Recipe sub-groups */}
                  {group.recipeGroups.map((rg, ri) => {
                    const totalQty = rg.tasks.reduce((s, t) => s + (t.quantity ?? 0), 0)
                    const assigneeIds = [...new Set(rg.tasks.map((t) => t.assignee_id).filter(Boolean))]
                    const assigneeNames = assigneeIds
                      .map((aid) => membersById.get(aid!)?.full_name ?? null)
                      .filter(Boolean)
                      .join(', ')

                    return (
                      <div key={ri}>
                        {/* Recipe header */}
                        <div style={S.recipeHead}>
                          <UtensilsCrossed style={{ width: '12px', height: '12px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                          <span style={S.recipeTitle}>
                            {rg.recipe?.title ?? t('menus.productionSheet.noRecipe')}
                          </span>
                          <span style={S.recipeMeta}>
                            {totalQty > 0 && `${totalQty} ${t('menus.productionSheet.portions')}`}
                            {totalQty > 0 && assigneeNames && ' · '}
                            {assigneeNames}
                          </span>
                        </div>

                        {/* Tasks */}
                        {rg.tasks.map((task) => {
                          const assignee = task.assignee_id ? membersById.get(task.assignee_id) : undefined
                          const isDone = task.status === 'done'
                          return (
                            <div key={task.id} style={isDone ? S.taskRowDone : S.taskRow}>
                              {isDone
                                ? <CheckSquare style={{ width: '14px', height: '14px', color: 'rgb(16,185,129)', flexShrink: 0, marginTop: '2px' }} />
                                : <Square style={{ width: '14px', height: '14px', color: 'rgba(255,255,255,0.18)', flexShrink: 0, marginTop: '2px' }} />
                              }
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={S.taskTitle}>{task.title}</p>
                                {task.description && <p style={S.taskDesc}>{task.description}</p>}
                                {assignee && (
                                  <p style={S.taskAssignee}>→ {assignee.full_name ?? '—'}</p>
                                )}
                              </div>
                              <span style={{
                                ...S.badge,
                                background: statusBg[task.status] ?? statusBg.pending,
                                color: statusFg[task.status] ?? statusFg.pending,
                              }}>
                                {statusLabel[task.status] ?? '○'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            leftIcon={<Printer className="h-4 w-4" />}
            onClick={() => window.print()}
            disabled={tasks.length === 0}
          >
            {t('menus.productionSheet.print')}
          </Button>
          <Button variant="secondary" leftIcon={<X className="h-4 w-4" />} onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .fixed, [role="dialog"] > div:first-child { display: none !important; }
        }
      `}</style>
    </Drawer>
  )
}
