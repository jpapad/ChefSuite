import { useState } from 'react'
import { CheckCircle2, XCircle, Thermometer, AlertTriangle, RefrigeratorIcon, Snowflake } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { HACCPAppliance, HACCPTemperatureLog, HACCPShift } from '../../types/database.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOutOfRange(temp: number, appliance: HACCPAppliance) {
  return temp < appliance.min_temp || temp > appliance.max_temp
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
}

// ── Logged result row ─────────────────────────────────────────────────────────

interface LoggedRowProps {
  appliance: HACCPAppliance
  log:       HACCPTemperatureLog
  onReset:   () => void
}

function LoggedRow({ appliance, log, onReset }: LoggedRowProps) {
  const pass = !isOutOfRange(log.temperature, appliance)
  return (
    <div className={cn(
      'flex items-start gap-4 rounded-2xl border p-4 transition',
      pass
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-red-500/30 bg-red-500/5',
    )}>
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg',
        pass ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
      )}>
        {appliance.type === 'freezer' ? <Snowflake className="h-5 w-5" /> : <RefrigeratorIcon className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm">{appliance.name}</p>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
            pass ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
          )}>
            {pass ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {log.temperature}°C
          </span>
          <span className="text-xs text-white/30">{formatTime(log.created_at)}</span>
        </div>
        <p className="text-xs text-white/40 mt-0.5">
          Αποδεκτό: {appliance.min_temp}°C – {appliance.max_temp}°C
        </p>
        {!pass && log.corrective_action && (
          <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <span className="font-semibold">⚠️ Διορθωτική ενέργεια:</span> {log.corrective_action}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="shrink-0 text-xs text-white/30 hover:text-white/60 underline-offset-2 hover:underline transition"
      >
        Επεξ.
      </button>
    </div>
  )
}

// ── Per-appliance input form ──────────────────────────────────────────────────

interface ApplianceFormState {
  temp:       string
  corrective: string
  saving:     boolean
  error:      string | null
}

interface ApplianceCardProps {
  appliance: HACCPAppliance
  shift:     HACCPShift
  onLog:     (applianceId: string, temp: number, corrective?: string | null) => Promise<void>
}

function ApplianceCard({ appliance, shift, onLog }: ApplianceCardProps) {
  const [form, setForm] = useState<ApplianceFormState>({
    temp: '', corrective: '', saving: false, error: null,
  })

  const tempNum  = parseFloat(form.temp)
  const hasTemp  = !isNaN(tempNum)
  const outRange = hasTemp && isOutOfRange(tempNum, appliance)
  const needsCA  = outRange && !form.corrective.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasTemp) return
    if (outRange && !form.corrective.trim()) {
      setForm((f) => ({ ...f, error: 'Υποχρεωτικό πεδίο: περιγράψτε τη διορθωτική ενέργεια.' }))
      return
    }
    setForm((f) => ({ ...f, saving: true, error: null }))
    try {
      await onLog(appliance.id, tempNum, form.corrective.trim() || null)
    } catch (err) {
      setForm((f) => ({ ...f, saving: false, error: err instanceof Error ? err.message : 'Σφάλμα' }))
    }
  }

  const shiftLabel = shift === 'morning' ? 'Πρωινή' : 'Βραδινή'

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-glass-border bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/60">
          {appliance.type === 'freezer'
            ? <Snowflake className="h-5 w-5 text-sky-400" />
            : <RefrigeratorIcon className="h-5 w-5 text-teal-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{appliance.name}</p>
          <p className="text-xs text-white/40">
            {appliance.type === 'freezer' ? 'Καταψύκτης' : 'Ψυγείο'} · {appliance.min_temp}°C έως {appliance.max_temp}°C
          </p>
        </div>
        <span className="shrink-0 text-xs text-white/30">{shiftLabel} βάρδια</span>
      </div>

      {/* Temperature input */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/60">Θερμοκρασία (°C)</label>
        <div className="relative">
          <Thermometer className={cn(
            'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
            outRange ? 'text-red-400' : hasTemp ? 'text-emerald-400' : 'text-white/30',
          )} />
          <input
            type="number"
            step="0.1"
            placeholder="π.χ. 3.5"
            value={form.temp}
            onChange={(e) => setForm((f) => ({ ...f, temp: e.target.value, error: null }))}
            required
            className={cn(
              'w-full rounded-xl border bg-white/5 pl-9 pr-4 py-3 text-base font-semibold text-white',
              'placeholder:text-white/20 focus:outline-none focus:ring-2 transition',
              outRange
                ? 'border-red-500/60 focus:ring-red-500/40'
                : hasTemp
                ? 'border-emerald-500/40 focus:ring-emerald-500/30'
                : 'border-glass-border focus:ring-brand-orange/40',
            )}
          />
          {outRange && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-red-400">
              ΕΚΤΟΣ
            </span>
          )}
        </div>
      </div>

      {/* Out-of-range corrective action */}
      {outRange && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Εκτός ορίου — Καταγράψτε τη διορθωτική ενέργεια
          </div>
          <textarea
            placeholder="π.χ. Ρύθμιση θερμοστάτη, Μεταφορά προϊόντων σε άλλο ψυγείο, Κλήση τεχνικού…"
            value={form.corrective}
            onChange={(e) => setForm((f) => ({ ...f, corrective: e.target.value, error: null }))}
            required
            rows={2}
            className="w-full resize-none rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-white placeholder:text-red-300/30 focus:outline-none focus:ring-2 focus:ring-red-500/30"
          />
        </div>
      )}

      {/* Error */}
      {form.error && (
        <p className="text-xs text-red-400">{form.error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={form.saving || !hasTemp || needsCA}
        className={cn(
          'w-full rounded-xl py-3 text-sm font-semibold transition',
          form.saving || !hasTemp || needsCA
            ? 'bg-white/5 text-white/30 cursor-not-allowed'
            : 'bg-brand-orange text-white hover:bg-brand-orange/90 active:scale-[0.98]',
        )}
      >
        {form.saving ? 'Αποθήκευση…' : '✓ Καταγραφή'}
      </button>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface TemperatureLogProps {
  appliances: HACCPAppliance[]
  logs:       HACCPTemperatureLog[]
  shift:      HACCPShift
  onLog:      (applianceId: string, temp: number, corrective?: string | null) => Promise<void>
  onDeleteLog:(id: string) => Promise<void>
  loading:    boolean
}

export function TemperatureLog({ appliances, logs, shift, onLog, onDeleteLog, loading }: TemperatureLogProps) {
  const [, setResettingId] = useState<string | null>(null)

  const logMap = new Map(logs.map((l) => [l.appliance_id, l]))
  const loggedCount = appliances.filter((a) => logMap.has(a.id)).length
  const failCount   = appliances.filter((a) => {
    const log = logMap.get(a.id)
    return log && isOutOfRange(log.temperature, a)
  }).length

  async function handleReset(_applianceId: string, logId: string) {
    setResettingId(logId)
    try { await onDeleteLog(logId) }
    finally { setResettingId(null) }
  }

  if (loading) {
    return <div className="py-12 text-center text-white/40 text-sm">Φόρτωση…</div>
  }

  if (appliances.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/30">
          <RefrigeratorIcon className="h-7 w-7" />
        </div>
        <p className="text-white/50 text-sm">Δεν υπάρχουν καταχωρημένες συσκευές.</p>
        <p className="text-white/30 text-xs">Προσθέστε ψυγεία/καταψύκτες από τις Ρυθμίσεις.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              failCount > 0 ? 'bg-red-500' : 'bg-emerald-500',
            )}
            style={{ width: appliances.length > 0 ? `${(loggedCount / appliances.length) * 100}%` : '0%' }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-white/50">
          {loggedCount}/{appliances.length}
          {failCount > 0 && <span className="text-red-400 ml-1.5">• {failCount} ΕΚΤΟΣ</span>}
        </span>
      </div>

      {/* Appliance list */}
      <div className="space-y-3">
        {appliances.map((appliance) => {
          const log = logMap.get(appliance.id)
          if (log) {
            return (
              <LoggedRow
                key={appliance.id}
                appliance={appliance}
                log={log}
                onReset={() => void handleReset(appliance.id, log.id)}
              />
            )
          }
          return (
            <ApplianceCard
              key={appliance.id}
              appliance={appliance}
              shift={shift}
              onLog={onLog}
            />
          )
        })}
      </div>
    </div>
  )
}
