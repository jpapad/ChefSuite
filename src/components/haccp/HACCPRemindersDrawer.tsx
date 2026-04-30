import { useState, type FormEvent } from 'react'
import { Bell, BellRing, Clock, Plus, Trash2, Check, Loader2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useHACCPReminders } from '../../hooks/useHACCPReminders'
import { cn } from '../../lib/cn'

interface Props {
  open: boolean
  onClose: () => void
}

const FREQ_OPTIONS = [1, 2, 4, 6, 8, 12, 24]

function fmtDue(iso: string): { label: string; overdue: boolean; soonMin: number | null } {
  const diff = new Date(iso).getTime() - Date.now()
  const overdue = diff < 0
  const absMin = Math.round(Math.abs(diff) / 60000)
  if (absMin < 60) return { label: overdue ? `${absMin}min overdue` : `in ${absMin}min`, overdue, soonMin: absMin }
  const h = (Math.abs(diff) / 3600000).toFixed(1)
  return { label: overdue ? `${h}h overdue` : `in ${h}h`, overdue, soonMin: null }
}

export function HACCPRemindersDrawer({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { reminders, loading, createReminder, deleteReminder, markChecked } = useHACCPReminders()

  const [showForm, setShowForm] = useState(false)
  const [location, setLocation] = useState('')
  const [label, setLabel] = useState('')
  const [frequencyH, setFrequencyH] = useState(4)
  const [saving, setSaving] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!location.trim() || !label.trim()) return
    setSaving(true)
    try {
      const nextDue = new Date(Date.now() + frequencyH * 3600 * 1000).toISOString()
      await createReminder({ location: location.trim(), label: label.trim(), frequency_h: frequencyH, next_due: nextDue, assignee_id: null, active: true })
      setLocation('')
      setLabel('')
      setFrequencyH(4)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleCheck(id: string, frequencyH: number) {
    setCheckingId(id)
    try { await markChecked(id, frequencyH) }
    finally { setCheckingId(null) }
  }

  const overdueCount = reminders.filter((r) => r.active && new Date(r.next_due) < new Date()).length

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {t('haccp.reminders.title')}
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{overdueCount}</span>
          )}
        </span>
      }
    >
      <div className="space-y-4">
        {loading && (
          <div className="flex justify-center py-8 text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && reminders.length === 0 && !showForm && (
          <div className="rounded-xl border border-dashed border-glass-border px-6 py-10 text-center text-sm text-white/40">
            {t('haccp.reminders.empty')}
          </div>
        )}

        {reminders.filter((r) => r.active).map((r) => {
          const { label: dueLabel, overdue } = fmtDue(r.next_due)
          return (
            <div key={r.id} className={cn('glass rounded-xl p-4 flex items-start gap-3', overdue && 'border border-red-500/40 bg-red-500/5')}>
              <div className="mt-0.5 shrink-0">
                {overdue ? (
                  <BellRing className="h-5 w-5 text-red-400 animate-pulse" />
                ) : (
                  <Bell className="h-5 w-5 text-white/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">{r.label}</div>
                <div className="text-xs text-white/50 mt-0.5">{r.location}</div>
                <div className={cn('mt-1 flex items-center gap-1.5 text-xs', overdue ? 'text-red-400' : 'text-white/40')}>
                  <Clock className="h-3 w-3" />
                  {dueLabel}
                  <span className="text-white/20">·</span>
                  <span className="text-white/40">every {r.frequency_h}h</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCheck(r.id, r.frequency_h)}
                  disabled={checkingId !== null}
                  className="flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                >
                  {checkingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {t('haccp.reminders.checked')}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteReminder(r.id)}
                  className="rounded-lg p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {showForm ? (
          <form onSubmit={(e) => void handleCreate(e)} className="glass rounded-xl p-4 space-y-3">
            <Input
              label={t('haccp.reminders.location')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('haccp.reminders.locationPlaceholder')}
              required
            />
            <Input
              label={t('haccp.reminders.label')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('haccp.reminders.labelPlaceholder')}
              required
            />
            <div>
              <span className="mb-2 block text-sm font-medium text-white/80">{t('haccp.reminders.frequency')}</span>
              <div className="flex flex-wrap gap-2">
                {FREQ_OPTIONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setFrequencyH(h)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                      frequencyH === h
                        ? 'bg-brand-orange/20 border-brand-orange/50 text-brand-orange'
                        : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving} leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}>
                {t('haccp.reminders.add')}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            leftIcon={<Plus className="h-4 w-4" />}
            className="w-full border border-dashed border-glass-border"
            onClick={() => setShowForm(true)}
          >
            {t('haccp.reminders.addButton')}
          </Button>
        )}

        {overdueCount > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {t('haccp.reminders.overdueWarning', { count: overdueCount })}
          </div>
        )}
      </div>
    </Drawer>
  )
}
