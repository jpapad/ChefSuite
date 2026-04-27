import { useEffect, useState } from 'react'
import { Printer, X, ChefHat, CheckSquare, Square } from 'lucide-react'
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

interface TaskGroup {
  workstation: Workstation | null
  tasks: PrepTask[]
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

  const groups: TaskGroup[] = (() => {
    const map = new Map<string | null, PrepTask[]>()
    for (const task of tasks) {
      const key = task.workstation_id ?? null
      const arr = map.get(key) ?? []
      arr.push(task)
      map.set(key, arr)
    }
    const wsById = new Map(workstations.map((w) => [w.id, w]))
    const result: TaskGroup[] = []
    for (const [wsId, wsTasks] of map) {
      result.push({ workstation: wsId ? (wsById.get(wsId) ?? null) : null, tasks: wsTasks })
    }
    return result.sort((a, b) => {
      if (!a.workstation) return 1
      if (!b.workstation) return -1
      return (a.workstation.sort_order ?? 0) - (b.workstation.sort_order ?? 0)
    })
  })()

  const membersById = new Map(members.map((m) => [m.id, m]))
  const recipesById = new Map(recipes.map((r) => [r.id, r]))

  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === 'done').length

  function printSheet() {
    window.print()
  }

  const S = {
    root:      { background: 'rgb(26,18,8)' } as React.CSSProperties,
    topBar:    { background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
    title:     { color: '#ffffff', fontSize: '15px', fontWeight: 700 } as React.CSSProperties,
    muted:     { color: 'rgba(255,255,255,0.5)', fontSize: '13px' } as React.CSSProperties,
    section:   { border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' } as React.CSSProperties,
    sHead:     { background: 'rgba(255,255,255,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties,
    sHeadText: { fontWeight: 700, fontSize: '13px', color: '#ffffff' } as React.CSSProperties,
    row:       { padding: '10px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' } as React.CSSProperties,
    rowDone:   { padding: '10px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: 0.45 } as React.CSSProperties,
    taskTitle: { fontWeight: 600, fontSize: '13px', color: 'rgba(255,255,255,0.9)' } as React.CSSProperties,
    taskMeta:  { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' } as React.CSSProperties,
    badge:     { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' } as React.CSSProperties,
    empty:     { padding: '32px 16px', textAlign: 'center' as const, color: 'rgba(255,255,255,0.25)', fontSize: '13px' } as React.CSSProperties,
    progress:  { height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', margin: '0 16px 16px' } as React.CSSProperties,
    progressFill: { height: '100%', background: '#ea580c', borderRadius: '2px', transition: 'width 0.3s', width: totalTasks > 0 ? `${Math.round((doneTasks / totalTasks) * 100)}%` : '0%' } as React.CSSProperties,
  }

  const statusColor: Record<string, string> = {
    done:        'rgba(16,185,129,0.2)',
    in_progress: 'rgba(234,88,12,0.2)',
    pending:     'rgba(255,255,255,0.08)',
  }
  const statusText: Record<string, string> = {
    done:        'rgba(16,185,129,1)',
    in_progress: '#ea580c',
    pending:     'rgba(255,255,255,0.4)',
  }

  return (
    <Drawer open={open} onClose={onClose} title={t('menus.productionSheet.title')}>
      <div className="space-y-4">

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
            <ChefHat className="h-8 w-8 text-white/20 mx-auto" />
            <p className="text-sm text-white/40">{t('menus.productionSheet.noTasks')}</p>
            <p className="text-xs text-white/25">{t('menus.productionSheet.noTasksHint')}</p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white/40">
                <span>{t('menus.productionSheet.progress')}</span>
                <span>{doneTasks}/{totalTasks}</span>
              </div>
              <div style={S.progress}>
                <div style={S.progressFill} />
              </div>
            </div>

            {/* Groups by workstation */}
            {groups.map((group, gi) => (
              <div key={gi} style={S.section}>
                <div style={S.sHead}>
                  <ChefHat style={{ width: '14px', height: '14px', color: '#ea580c', flexShrink: 0 }} />
                  <span style={S.sHeadText}>
                    {group.workstation?.name ?? t('menus.productionSheet.unassigned')}
                  </span>
                  <span style={{ ...S.taskMeta, marginTop: 0, marginLeft: 'auto' }}>
                    {group.tasks.filter((t) => t.status === 'done').length}/{group.tasks.length}
                  </span>
                </div>

                {group.tasks.map((task) => {
                  const recipe = task.recipe_id ? recipesById.get(task.recipe_id) : undefined
                  const assignee = task.assignee_id ? membersById.get(task.assignee_id) : undefined
                  return (
                    <div key={task.id} style={task.status === 'done' ? S.rowDone : S.row}>
                      {task.status === 'done'
                        ? <CheckSquare style={{ width: '16px', height: '16px', color: 'rgba(16,185,129,0.7)', flexShrink: 0, marginTop: '1px' }} />
                        : <Square style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: '1px' }} />
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={S.taskTitle}>{task.title}</p>
                        <p style={S.taskMeta}>
                          {recipe && <span>{recipe.title} · </span>}
                          {task.quantity && <span>{task.quantity} {t('menus.productionSheet.portions')} · </span>}
                          {assignee && <span>{assignee.full_name ?? '—'}</span>}
                          {!assignee && <span style={{ color: 'rgba(255,255,255,0.2)' }}>{t('menus.productionSheet.unassignedMember')}</span>}
                        </p>
                        {task.description && (
                          <p style={{ ...S.taskMeta, fontStyle: 'italic', marginTop: '4px' }}>{task.description}</p>
                        )}
                      </div>
                      <span style={{
                        ...S.badge,
                        background: statusColor[task.status] ?? statusColor.pending,
                        color: statusText[task.status] ?? statusText.pending,
                      }}>
                        {t(`prep.status.${task.status}`)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            leftIcon={<Printer className="h-4 w-4" />}
            onClick={printSheet}
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
        }
      `}</style>
    </Drawer>
  )
}
