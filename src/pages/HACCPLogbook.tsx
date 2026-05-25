import { useState } from 'react'
import { Settings2, Plus, RefrigeratorIcon, Snowflake, Trash2, Thermometer, BrushIcon, ChevronDown } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { TemperatureLog } from '../components/haccp/TemperatureLog'
import { CleaningChecklist } from '../components/haccp/CleaningChecklist'
import { useHACCPLogbook } from '../hooks/useHACCPLogbook'
import { useHACCPCleaning } from '../hooks/useHACCPCleaning'
import { cn } from '../lib/cn'
import type { ApplianceType, CleaningFrequency, HACCPShift } from '../types/database.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('el-GR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Settings drawer ───────────────────────────────────────────────────────────

interface SettingsDrawerProps {
  open:              boolean
  onClose:           () => void
  logbook:           ReturnType<typeof useHACCPLogbook>
  cleaning:          ReturnType<typeof useHACCPCleaning>
}

function SettingsDrawer({ open, onClose, logbook, cleaning }: SettingsDrawerProps) {
  const [section, setSection] = useState<'appliances' | 'tasks'>('appliances')

  // Appliance form
  const [aName, setAName]   = useState('')
  const [aType, setAType]   = useState<ApplianceType>('fridge')
  const [aMin, setAMin]     = useState('-2')
  const [aMax, setAMax]     = useState('5')
  const [aSaving, setASaving] = useState(false)
  const [aError, setAError]  = useState<string | null>(null)

  // Cleaning task form
  const [tName, setTName]   = useState('')
  const [tFreq, setTFreq]   = useState<CleaningFrequency>('daily')
  const [tArea, setTArea]   = useState('')
  const [tSaving, setTSaving] = useState(false)
  const [tError, setTError]  = useState<string | null>(null)

  async function addAppliance(e: React.FormEvent) {
    e.preventDefault()
    const min = parseFloat(aMin), max = parseFloat(aMax)
    if (isNaN(min) || isNaN(max) || min >= max) { setAError('Οι θερμοκρασίες δεν είναι έγκυρες.'); return }
    setASaving(true); setAError(null)
    try {
      await logbook.createAppliance({ name: aName.trim(), type: aType, min_temp: min, max_temp: max })
      setAName(''); setAMin('-2'); setAMax('5')
    } catch (err) { setAError(err instanceof Error ? err.message : 'Σφάλμα') }
    finally { setASaving(false) }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!tName.trim()) { setTError('Εισάγετε όνομα εργασίας.'); return }
    setTSaving(true); setTError(null)
    try {
      await cleaning.createTask({ task_name: tName.trim(), frequency: tFreq, area: tArea.trim() })
      setTName(''); setTArea('')
    } catch (err) { setTError(err instanceof Error ? err.message : 'Σφάλμα') }
    finally { setTSaving(false) }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Ρυθμίσεις HACCP Logbook">
      {/* Section tabs */}
      <div className="flex gap-2 mb-5">
        {(['appliances', 'tasks'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSection(s)}
            className={cn(
              'flex-1 rounded-xl border py-2.5 text-sm font-medium transition',
              section === s
                ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-orange'
                : 'border-glass-border bg-white/5 text-white/60 hover:bg-white/10',
            )}>
            {s === 'appliances' ? '🌡 Συσκευές' : '🧹 Εργασίες'}
          </button>
        ))}
      </div>

      {section === 'appliances' ? (
        <div className="space-y-4">
          {/* Add form */}
          <form onSubmit={addAppliance} className="rounded-xl border border-glass-border bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-white/70">Νέα Συσκευή</p>
            <Input name="name" label="Όνομα" placeholder="π.χ. Ψυγείο 1" required
              value={aName} onChange={(e) => setAName(e.target.value)} />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-white/70">Τύπος</span>
              <div className="flex gap-2">
                {(['fridge', 'freezer'] as ApplianceType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setAType(t)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition',
                      aType === t
                        ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                        : 'border-glass-border bg-white/5 text-white/60',
                    )}>
                    {t === 'freezer'
                      ? <><Snowflake className="h-4 w-4" /> Καταψύκτης</>
                      : <><RefrigeratorIcon className="h-4 w-4" /> Ψυγείο</>}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="min" type="number" label="Min °C" step="0.5"
                value={aMin} onChange={(e) => setAMin(e.target.value)} />
              <Input name="max" type="number" label="Max °C" step="0.5"
                value={aMax} onChange={(e) => setAMax(e.target.value)} />
            </div>
            {aError && <p className="text-xs text-red-400">{aError}</p>}
            <Button type="submit" disabled={aSaving || !aName.trim()} leftIcon={<Plus className="h-4 w-4" />}>
              {aSaving ? 'Αποθήκευση…' : 'Προσθήκη'}
            </Button>
          </form>

          {/* List */}
          {logbook.appliances.length === 0 ? (
            <p className="text-sm text-white/40 text-center py-4">Δεν υπάρχουν συσκευές ακόμα.</p>
          ) : (
            <ul className="space-y-2">
              {logbook.appliances.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border border-glass-border bg-white/5 px-4 py-3">
                  <span className="text-lg">{a.type === 'freezer' ? '❄️' : '🌡️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-white/40">{a.min_temp}°C – {a.max_temp}°C</p>
                  </div>
                  <button type="button" onClick={() => void logbook.deleteAppliance(a.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Add form */}
          <form onSubmit={addTask} className="rounded-xl border border-glass-border bg-white/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-white/70">Νέα Εργασία</p>
            <Input name="task_name" label="Περιγραφή" placeholder="π.χ. Καθαρισμός επιφανειών εργασίας" required
              value={tName} onChange={(e) => setTName(e.target.value)} />
            <Input name="area" label="Χώρος / Ζώνη" placeholder="π.χ. Μαγειρείο" required
              value={tArea} onChange={(e) => setTArea(e.target.value)} />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-white/70">Συχνότητα</span>
              <div className="flex gap-2">
                {(['daily', 'weekly'] as CleaningFrequency[]).map((f) => (
                  <button key={f} type="button" onClick={() => setTFreq(f)}
                    className={cn(
                      'flex-1 rounded-xl border py-2.5 text-sm font-medium transition',
                      tFreq === f
                        ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                        : 'border-glass-border bg-white/5 text-white/60',
                    )}>
                    {f === 'daily' ? '📅 Καθημερινή' : '📆 Εβδομαδιαία'}
                  </button>
                ))}
              </div>
            </div>
            {tError && <p className="text-xs text-red-400">{tError}</p>}
            <Button type="submit" disabled={tSaving || !tName.trim()} leftIcon={<Plus className="h-4 w-4" />}>
              {tSaving ? 'Αποθήκευση…' : 'Προσθήκη'}
            </Button>
          </form>

          {/* List */}
          {cleaning.tasks.length === 0 ? (
            <p className="text-sm text-white/40 text-center py-4">Δεν υπάρχουν εργασίες ακόμα.</p>
          ) : (
            <ul className="space-y-2">
              {cleaning.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-glass-border bg-white/5 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.task_name}</p>
                    <p className="text-xs text-white/40">{t.area} · {t.frequency === 'daily' ? 'Καθημερινή' : 'Εβδομαδιαία'}</p>
                  </div>
                  <button type="button" onClick={() => void cleaning.deleteTask(t.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'temperature' | 'cleaning'

const SHIFT_OPTIONS: { value: HACCPShift; label: string; sub: string }[] = [
  { value: 'morning', label: '☀️ Πρωινή', sub: 'Βάρδια' },
  { value: 'night',   label: '🌙 Βραδινή', sub: 'Βάρδια' },
]

export default function HACCPLogbook() {
  const [date, setDate]         = useState(todayIso())
  const [tab, setTab]           = useState<Tab>('temperature')
  const [shift, setShift]       = useState<HACCPShift>('morning')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const logbook  = useHACCPLogbook(date, shift)
  const cleaning = useHACCPCleaning(date)

  // Stats for header
  const tempLogged = logbook.logs.length
  const tempTotal  = logbook.appliances.length
  const tempFail   = logbook.logs.filter((l) => {
    const a = logbook.appliances.find((a) => a.id === l.appliance_id)
    return a && (l.temperature < a.min_temp || l.temperature > a.max_temp)
  }).length

  const cleanDone  = cleaning.tasks.filter((t) => !!cleaning.getDoneLog(t.id)).length
  const cleanTotal = cleaning.tasks.length

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400">
              <Thermometer className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-semibold">Digital HACCP Logbook</h1>
          </div>
          <p className="text-white/60 mt-1 capitalize">{fmtDate(date)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-xl border border-glass-border bg-white/5 pl-4 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            />
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          </div>
          <Button variant="secondary" leftIcon={<Settings2 className="h-4 w-4" />} onClick={() => setSettingsOpen(true)}>
            Ρυθμίσεις
          </Button>
        </div>
      </header>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className={cn('space-y-0.5', tempFail > 0 && 'border border-red-500/30')}>
          <p className="text-xs text-white/50 flex items-center gap-1">
            <Thermometer className="h-3.5 w-3.5" />Θερμ. καταγραφές
          </p>
          <p className={cn('text-2xl font-bold', tempFail > 0 ? 'text-red-400' : 'text-white')}>
            {tempLogged}/{tempTotal}
          </p>
          {tempFail > 0 && <p className="text-xs text-red-400">{tempFail} εκτός ορίου</p>}
        </GlassCard>
        <GlassCard className={cn('space-y-0.5', cleanDone === cleanTotal && cleanTotal > 0 && 'border border-emerald-500/30')}>
          <p className="text-xs text-white/50 flex items-center gap-1">
            <BrushIcon className="h-3.5 w-3.5" />Καθαριότητα
          </p>
          <p className={cn('text-2xl font-bold', cleanDone === cleanTotal && cleanTotal > 0 ? 'text-emerald-400' : 'text-white')}>
            {cleanDone}/{cleanTotal}
          </p>
        </GlassCard>
        {tempFail > 0 && (
          <GlassCard className="space-y-0.5 border border-amber-500/30 col-span-2">
            <p className="text-xs text-amber-400">⚠️ Υπάρχουν εκτός ορίου θερμοκρασίες — απαιτούνται διορθωτικές ενέργειες</p>
          </GlassCard>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('temperature')}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition',
            tab === 'temperature'
              ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
              : 'border-glass-border bg-white/5 text-white/60 hover:bg-white/10',
          )}>
          <Thermometer className="h-4 w-4" />
          Θερμοκρασίες
          {tempLogged > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-bold',
              tempFail > 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400',
            )}>
              {tempLogged}/{tempTotal}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setTab('cleaning')}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition',
            tab === 'cleaning'
              ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
              : 'border-glass-border bg-white/5 text-white/60 hover:bg-white/10',
          )}>
          <BrushIcon className="h-4 w-4" />
          Καθαριότητα
          {cleanTotal > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-bold',
              cleanDone === cleanTotal ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40',
            )}>
              {cleanDone}/{cleanTotal}
            </span>
          )}
        </button>
      </div>

      {/* ── Content ── */}
      <GlassCard className="space-y-5">
        {tab === 'temperature' ? (
          <>
            {/* Shift selector */}
            <div className="flex gap-2">
              {SHIFT_OPTIONS.map(({ value, label, sub }) => (
                <button key={value} type="button" onClick={() => setShift(value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-0.5 rounded-2xl border py-3 text-sm font-semibold transition',
                    shift === value
                      ? 'border-teal-500/50 bg-teal-500/10 text-teal-300'
                      : 'border-glass-border bg-white/5 text-white/50 hover:bg-white/10',
                  )}>
                  <span className="text-base">{label}</span>
                  <span className="text-xs font-normal text-current/70">{sub}</span>
                </button>
              ))}
            </div>

            <TemperatureLog
              appliances={logbook.appliances}
              logs={logbook.logs}
              shift={shift}
              onLog={(id, temp, ca) => { void logbook.logTemperature(id, temp, ca) }}
              onDeleteLog={logbook.deleteLog}
              loading={logbook.loadingAppliances || logbook.loadingLogs}
            />
          </>
        ) : (
          <CleaningChecklist
            tasks={cleaning.tasks}
            getDoneLog={(task) => cleaning.getDoneLog(task.id)}
            onCheck={(taskId) => { void cleaning.logTask(taskId) }}
            onUncheck={cleaning.unlogTask}
            loading={cleaning.loadingTasks || cleaning.loadingLogs}
          />
        )}
      </GlassCard>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        logbook={logbook}
        cleaning={cleaning}
      />
    </div>
  )
}
