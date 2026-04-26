import { useEffect, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import type {
  PrepTask,
  PrepTaskStatus,
  PrepTaskStep,
  Profile,
  Recipe,
  Workstation,
} from '../../types/database.types'

export interface PrepTaskFormValues {
  title: string
  description: string | null
  recipe_id: string | null
  quantity: number | null
  assignee_id: string | null
  workstation_id: string | null
  status: PrepTaskStatus
  prep_for: string
  steps: string[]
}

interface PrepTaskFormProps {
  initial?: PrepTask
  initialSteps?: PrepTaskStep[]
  defaultDate: string
  defaultWorkstationId?: string | null
  recipes: Recipe[]
  members: Profile[]
  workstations: Workstation[]
  submitting?: boolean
  onSubmit: (values: PrepTaskFormValues) => void | Promise<void>
  onCancel: () => void
}

function blank(
  initial: PrepTask | undefined,
  defaultDate: string,
  defaultWorkstationId: string | null | undefined,
  initialSteps: PrepTaskStep[],
): PrepTaskFormValues {
  return {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    recipe_id: initial?.recipe_id ?? null,
    quantity: initial?.quantity ?? null,
    assignee_id: initial?.assignee_id ?? null,
    workstation_id: initial?.workstation_id ?? defaultWorkstationId ?? null,
    status: initial?.status ?? 'pending',
    prep_for: initial?.prep_for ?? defaultDate,
    steps: initialSteps.map((s) => s.title),
  }
}

export function PrepTaskForm({
  initial,
  initialSteps = [],
  defaultDate,
  defaultWorkstationId,
  recipes,
  members,
  workstations,
  submitting,
  onSubmit,
  onCancel,
}: PrepTaskFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<PrepTaskFormValues>(() =>
    blank(initial, defaultDate, defaultWorkstationId, initialSteps),
  )
  const [error, setError] = useState<string | null>(null)
  const [newStep, setNewStep] = useState('')

  useEffect(() => {
    setValues(blank(initial, defaultDate, defaultWorkstationId, initialSteps))
  }, [initial, defaultDate, defaultWorkstationId, initialSteps])

  function addStep() {
    const title = newStep.trim()
    if (!title) return
    setValues((v) => ({ ...v, steps: [...v.steps, title] }))
    setNewStep('')
  }

  function removeStep(index: number) {
    setValues((v) => ({ ...v, steps: v.steps.filter((_, i) => i !== index) }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!values.title.trim()) {
      setError(t('prep.form.titleRequired'))
      return
    }
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        description: values.description?.trim() || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        name="title"
        label={t('prep.form.title')}
        placeholder={t('prep.form.titlePlaceholder')}
        required
        value={values.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
      />

      <Textarea
        name="description"
        label={t('prep.form.notes')}
        placeholder={t('prep.form.notesPlaceholder')}
        rows={2}
        value={values.description ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
      />

      {/* Workstation */}
      {workstations.length > 0 && (
        <div>
          <span className="mb-2 block text-sm font-medium text-white/80">
            {t('prep.form.workstation')}
          </span>
          <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
            <select
              value={values.workstation_id ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, workstation_id: e.target.value || null }))}
              className="flex-1 bg-transparent outline-none text-base text-white"
            >
              <option value="" className="bg-[#f5ede0]">{t('prep.form.noWorkstation')}</option>
              {workstations.map((w) => (
                <option key={w.id} value={w.id} className="bg-[#f5ede0]">{w.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Recipe */}
      <div>
        <span className="mb-2 block text-sm font-medium text-white/80">
          {t('prep.form.recipe')}
        </span>
        <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
          <select
            value={values.recipe_id ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, recipe_id: e.target.value || null }))}
            className="flex-1 bg-transparent outline-none text-base text-white"
          >
            <option value="" className="bg-[#f5ede0]">{t('prep.form.noRecipe')}</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#f5ede0]">{r.title}</option>
            ))}
          </select>
        </div>
      </div>

      <Input
        type="number"
        name="quantity"
        label={t('prep.form.quantity')}
        placeholder="20"
        step="any"
        min={0}
        value={values.quantity ?? ''}
        onChange={(e) =>
          setValues((v) => ({
            ...v,
            quantity: e.target.value === '' ? null : Number(e.target.value),
          }))
        }
      />

      {/* Assignee */}
      <div>
        <span className="mb-2 block text-sm font-medium text-white/80">
          {t('prep.form.assignee')}
        </span>
        <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
          <select
            value={values.assignee_id ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, assignee_id: e.target.value || null }))}
            className="flex-1 bg-transparent outline-none text-base text-white"
          >
            <option value="" className="bg-[#f5ede0]">{t('prep.form.noAssignee')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#f5ede0]">
                {m.full_name ?? t('common.unnamed')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Steps / Checklist */}
      <div>
        <span className="mb-2 block text-sm font-medium text-white/80">
          {t('prep.form.steps')}
        </span>
        {values.steps.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {values.steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="flex-1 text-white/80">{step}</span>
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="text-white/30 hover:text-red-400 transition shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }}
            placeholder={t('prep.form.stepPlaceholder')}
            className="flex-1 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-brand-orange"
          />
          <button
            type="button"
            onClick={addStep}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 transition shrink-0"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Input
        type="date"
        name="prep_for"
        label={t('prep.form.date')}
        required
        value={values.prep_for}
        onChange={(e) => setValues((v) => ({ ...v, prep_for: e.target.value }))}
      />

      {error && (
        <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t('common.saving') : initial ? t('common.save') : t('common.add')}
        </Button>
      </div>
    </form>
  )
}
