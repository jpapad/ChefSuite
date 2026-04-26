import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { HACCPLocation, TempUnit } from '../../types/database.types'

export interface HACCPCheckFormValues {
  location: string
  temperature: number
  unit: TempUnit
  min_temp: number
  max_temp: number
  notes: string | null
  corrective_action: string | null
}

interface Props {
  locations: HACCPLocation[]
  submitting?: boolean
  onSubmit: (values: HACCPCheckFormValues) => void | Promise<void>
  onCancel: () => void
}

function blank(): HACCPCheckFormValues {
  return {
    location: '',
    temperature: 0,
    unit: 'C',
    min_temp: 0,
    max_temp: 5,
    notes: null,
    corrective_action: null,
  }
}

export function HACCPCheckForm({ locations, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation()
  const [values, setValues] = useState<HACCPCheckFormValues>(blank)
  const [error, setError] = useState<string | null>(null)
  const [customLocation, setCustomLocation] = useState(false)

  const isOutOfRange =
    values.temperature < values.min_temp || values.temperature > values.max_temp

  function selectLocation(loc: HACCPLocation) {
    setValues((v) => ({
      ...v,
      location: loc.name,
      min_temp: loc.min_temp,
      max_temp: loc.max_temp,
      unit: loc.unit,
    }))
    setCustomLocation(false)
  }

  useEffect(() => {
    if (locations.length > 0 && !customLocation && !values.location) {
      selectLocation(locations[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!values.location.trim()) { setError(t('haccp.form.locationRequired')); return }
    try {
      await onSubmit({ ...values, location: values.location.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Location picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/80">{t('haccp.tableHeaders.location')}</label>
        {locations.length > 0 && !customLocation ? (
          <div className="flex flex-wrap gap-2">
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => selectLocation(loc)}
                className={
                  'rounded-lg border px-3 py-1.5 text-sm transition ' +
                  (values.location === loc.name
                    ? 'bg-brand-orange border-brand-orange text-white-fixed'
                    : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5')
                }
              >
                {loc.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setCustomLocation(true); setValues((v) => ({ ...v, location: '' })) }}
              className="rounded-lg border border-dashed border-glass-border px-3 py-1.5 text-sm text-white/40 hover:text-white transition"
            >
              + {t('haccp.form.custom')}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              name="location"
              placeholder={t('haccp.locationPlaceholder')}
              required
              value={values.location}
              onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
            />
            {locations.length > 0 && (
              <Button type="button" variant="secondary" size="md" onClick={() => setCustomLocation(false)}>
                {t('haccp.form.presets')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Temperature + unit */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            type="number"
            name="temperature"
            label={t('haccp.tableHeaders.temperature')}
            step="0.1"
            required
            value={values.temperature}
            onChange={(e) => setValues((v) => ({ ...v, temperature: Number(e.target.value) }))}
          />
        </div>
        <div className="flex gap-1 mb-0.5">
          {(['C', 'F'] as TempUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setValues((v) => ({ ...v, unit: u }))}
              className={
                'h-11 w-11 rounded-xl border text-sm font-semibold transition ' +
                (values.unit === u
                  ? 'bg-brand-orange border-brand-orange text-white-fixed'
                  : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5')
              }
            >
              °{u}
            </button>
          ))}
        </div>
      </div>

      {/* Min / Max */}
      <div className="flex gap-3">
        <Input
          type="number"
          name="min_temp"
          label={t('haccp.minTemp', { unit: values.unit })}
          step="0.1"
          required
          value={values.min_temp}
          onChange={(e) => setValues((v) => ({ ...v, min_temp: Number(e.target.value) }))}
        />
        <Input
          type="number"
          name="max_temp"
          label={t('haccp.maxTemp', { unit: values.unit })}
          step="0.1"
          required
          value={values.max_temp}
          onChange={(e) => setValues((v) => ({ ...v, max_temp: Number(e.target.value) }))}
        />
      </div>

      {/* Live pass/fail indicator */}
      {(values.temperature !== 0 || values.min_temp !== 0 || values.max_temp !== 0) && (
        <div className={
          'rounded-xl border px-4 py-2.5 text-sm font-medium ' +
          (!isOutOfRange
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            : 'border-red-500/40 bg-red-500/10 text-red-300')
        }>
          {!isOutOfRange
            ? `✓ ${t('haccp.form.pass')} — ${values.temperature}°${values.unit} (${values.min_temp}–${values.max_temp}°${values.unit})`
            : `✗ ${t('haccp.form.fail')} — ${values.temperature}°${values.unit} (${values.min_temp}–${values.max_temp}°${values.unit})`}
        </div>
      )}

      {/* Corrective action — shown only when out of range */}
      {isOutOfRange && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-red-300">
            {t('haccp.correctiveAction')}
          </label>
          <textarea
            name="corrective_action"
            rows={3}
            placeholder={t('haccp.correctiveActionPlaceholder')}
            value={values.corrective_action ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, corrective_action: e.target.value || null }))}
            className="w-full rounded-xl border border-glass-border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none"
          />
        </div>
      )}

      <Input
        name="notes"
        label={t('haccp.form.notesLabel')}
        placeholder={t('haccp.form.notesPlaceholder')}
        value={values.notes ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value || null }))}
      />

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t('common.saving') : t('haccp.logCheck')}
        </Button>
      </div>
    </form>
  )
}
