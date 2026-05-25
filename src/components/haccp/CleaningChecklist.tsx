import { useState } from 'react'
import { CheckSquare, Square, MapPin, Clock } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { HACCPCleaningTask, HACCPCleaningLogWithUser, CleaningFrequency } from '../../types/database.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
}

const FREQ_LABEL: Record<CleaningFrequency, string> = {
  daily:  'Καθημερινή',
  weekly: 'Εβδομαδιαία',
}

const FREQ_COLOR: Record<CleaningFrequency, string> = {
  daily:  'bg-teal-500/15 text-teal-400 border-teal-500/30',
  weekly: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

// ── Task row ──────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task:      HACCPCleaningTask
  doneLog:   HACCPCleaningLogWithUser | undefined
  onCheck:   (taskId: string) => Promise<void>
  onUncheck: (logId: string) => Promise<void>
}

function TaskRow({ task, doneLog, onCheck, onUncheck }: TaskRowProps) {
  const [loading, setLoading] = useState(false)
  const done = !!doneLog

  async function toggle() {
    setLoading(true)
    try {
      if (done && doneLog) await onUncheck(doneLog.id)
      else await onCheck(task.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={cn(
        'group w-full flex items-start gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.99]',
        done
          ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80'
          : 'border-glass-border bg-white/5 hover:bg-white/8',
        loading && 'opacity-60 cursor-wait',
      )}
    >
      {/* Checkbox icon */}
      <div className={cn(
        'mt-0.5 shrink-0 h-6 w-6 flex items-center justify-center rounded-md transition',
        done
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-white/10 text-white/30 group-hover:text-white/60',
      )}>
        {done
          ? <CheckSquare className="h-4 w-4" />
          : <Square className="h-4 w-4" />}
      </div>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium leading-snug',
          done ? 'text-white/50 line-through decoration-white/30' : 'text-white',
        )}>
          {task.task_name}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {task.area && (
            <span className="inline-flex items-center gap-1 text-xs text-white/40">
              <MapPin className="h-3 w-3" />
              {task.area}
            </span>
          )}
          <span className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
            FREQ_COLOR[task.frequency],
          )}>
            {FREQ_LABEL[task.frequency]}
          </span>
        </div>
        {done && doneLog && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400/70">
            <Clock className="h-3 w-3" />
            {formatTime(doneLog.created_at)}
            {doneLog.user_name && <span className="text-white/30"> · {doneLog.user_name}</span>}
          </div>
        )}
      </div>

      {/* Tap hint */}
      {!done && (
        <span className="shrink-0 self-center text-xs text-white/20 group-hover:text-white/40 transition">
          Tap ✓
        </span>
      )}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | CleaningFrequency

interface CleaningChecklistProps {
  tasks:     HACCPCleaningTask[]
  getDoneLog:(task: HACCPCleaningTask) => HACCPCleaningLogWithUser | undefined
  onCheck:   (taskId: string) => Promise<void>
  onUncheck: (logId: string) => Promise<void>
  loading:   boolean
}

export function CleaningChecklist({ tasks, getDoneLog, onCheck, onUncheck, loading }: CleaningChecklistProps) {
  const [filter, setFilter] = useState<FilterTab>('all')

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.frequency === filter)
  const doneCount   = tasks.filter((t) => !!getDoneLog(t)).length
  const totalCount  = tasks.length
  const pct         = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',    label: `Όλες (${totalCount})` },
    { key: 'daily',  label: `Καθημερινές (${tasks.filter((t) => t.frequency === 'daily').length})` },
    { key: 'weekly', label: `Εβδομαδιαίες (${tasks.filter((t) => t.frequency === 'weekly').length})` },
  ]

  if (loading) {
    return <div className="py-12 text-center text-white/40 text-sm">Φόρτωση…</div>
  }

  if (tasks.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/30">
          <CheckSquare className="h-7 w-7" />
        </div>
        <p className="text-white/50 text-sm">Δεν υπάρχουν εργασίες καθαριότητας.</p>
        <p className="text-white/30 text-xs">Προσθέστε εργασίες από τις Ρυθμίσεις.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-400' : 'bg-white/30',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={cn(
          'shrink-0 text-sm font-bold tabular-nums',
          pct === 100 ? 'text-emerald-400' : 'text-white/60',
        )}>
          {doneCount}/{totalCount}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'flex-1 rounded-xl border py-2 text-xs font-medium transition',
              filter === key
                ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-orange'
                : 'border-glass-border bg-white/5 text-white/50 hover:bg-white/10',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {visible.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            doneLog={getDoneLog(task)}
            onCheck={onCheck}
            onUncheck={onUncheck}
          />
        ))}
      </div>

      {pct === 100 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-400">✓ Όλες οι εργασίες ολοκληρώθηκαν!</p>
        </div>
      )}
    </div>
  )
}
