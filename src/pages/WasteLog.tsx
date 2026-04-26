import { useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Trash, TrendingDown, Euro, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { useWasteLog } from '../hooks/useWasteLog'
import { useInventory } from '../hooks/useInventory'
import { cn } from '../lib/cn'
import type { WasteEntry, WasteReason } from '../types/database.types'

const REASONS: WasteReason[] = ['expired', 'spoiled', 'overproduction', 'dropped', 'other']

const REASON_COLOR: Record<WasteReason, string> = {
  expired:        'bg-red-500/15 text-red-400 border-red-500/30',
  spoiled:        'bg-orange-500/15 text-orange-400 border-orange-500/30',
  overproduction: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
  dropped:        'bg-blue-400/15 text-blue-400 border-blue-400/30',
  other:          'bg-white/10 text-white/50 border-white/20',
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface FormValues {
  item_id: string
  item_name: string
  quantity: string
  unit: string
  reason: WasteReason
  cost: string
  wasted_at: string
  notes: string
}

function blankForm(entry?: WasteEntry): FormValues {
  return {
    item_id: entry?.item_id ?? '',
    item_name: entry?.item_name ?? '',
    quantity: entry?.quantity?.toString() ?? '',
    unit: entry?.unit ?? '',
    reason: entry?.reason ?? 'expired',
    cost: entry?.cost?.toString() ?? '',
    wasted_at: entry?.wasted_at ?? todayIso(),
    notes: entry?.notes ?? '',
  }
}

export default function WasteLog() {
  const { t } = useTranslation()
  const { entries, loading, error, create, update, remove } = useWasteLog()
  const { items: inventoryItems } = useInventory()

  const [month, setMonth] = useState(() => todayIso().slice(0, 7))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<WasteEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState<FormValues>(blankForm())

  const monthEntries = useMemo(() =>
    entries.filter((e) => e.wasted_at.startsWith(month)),
    [entries, month],
  )

  const totalCost = useMemo(() =>
    monthEntries.reduce((s, e) => s + (e.cost ?? 0), 0),
    [monthEntries],
  )

  const byReason = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of monthEntries) map[e.reason] = (map[e.reason] ?? 0) + 1
    return map
  }, [monthEntries])

  function openCreate() {
    setEditing(null)
    setValues(blankForm())
    setFormError(null)
    setDrawerOpen(true)
  }

  function openEdit(e: WasteEntry) {
    setEditing(e)
    setValues(blankForm(e))
    setFormError(null)
    setDrawerOpen(true)
  }

  function onInventorySelect(itemId: string) {
    const item = inventoryItems.find((i) => i.id === itemId)
    if (!item) { setValues((v) => ({ ...v, item_id: '', item_name: '', unit: '' })); return }
    setValues((v) => ({ ...v, item_id: item.id, item_name: item.name, unit: item.unit }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!values.item_name.trim()) { setFormError(t('waste.form.nameRequired')); return }
    const qty = parseFloat(values.quantity)
    if (isNaN(qty) || qty <= 0) { setFormError(t('waste.form.quantityRequired')); return }
    setSaving(true)
    try {
      const payload = {
        item_id: values.item_id || null,
        item_name: values.item_name.trim(),
        quantity: qty,
        unit: values.unit.trim(),
        reason: values.reason,
        cost: values.cost ? parseFloat(values.cost) : null,
        wasted_at: values.wasted_at || todayIso(),
        notes: values.notes.trim() || null,
      }
      if (editing) await update(editing.id, payload)
      else await create(payload)
      setDrawerOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entry: WasteEntry) {
    const ok = window.confirm(t('waste.deleteConfirm', { name: entry.item_name }))
    if (!ok) return
    await remove(entry.id)
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('waste.title')}</h1>
          <p className="text-white/60 mt-1">{t('waste.subtitle')}</p>
        </div>
        <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
          {t('waste.logWaste')}
        </Button>
      </header>

      {error && <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>}

      {/* Month nav */}
      <GlassCard className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-lg font-semibold capitalize">{monthLabel(month + '-01')}</span>
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5">
          <ChevronRight className="h-5 w-5" />
        </button>
      </GlassCard>

      {/* Summary cards */}
      {monthEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GlassCard className="space-y-0.5">
            <p className="text-xs text-white/50">{t('waste.stats.totalEntries')}</p>
            <p className="text-2xl font-bold">{monthEntries.length}</p>
          </GlassCard>
          <GlassCard className="space-y-0.5">
            <p className="text-xs text-white/50">{t('waste.stats.totalCost')}</p>
            <p className="text-2xl font-bold text-red-400">
              {totalCost > 0 ? `€${totalCost.toFixed(2)}` : '—'}
            </p>
          </GlassCard>
          {REASONS.filter((r) => byReason[r]).slice(0, 2).map((r) => (
            <GlassCard key={r} className="space-y-0.5">
              <p className="text-xs text-white/50">{t(`waste.reasons.${r}`)}</p>
              <p className="text-2xl font-bold">{byReason[r]}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : monthEntries.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
            <Trash className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('waste.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('waste.empty.description')}</p>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate} className="mt-2">
            {t('waste.empty.cta')}
          </Button>
        </GlassCard>
      ) : (
        <GlassCard className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border bg-white/5">
                <th className="text-left px-4 py-3 text-xs text-white/50 font-medium">{t('waste.table.item')}</th>
                <th className="text-left px-4 py-3 text-xs text-white/50 font-medium hidden sm:table-cell">{t('waste.table.reason')}</th>
                <th className="text-right px-4 py-3 text-xs text-white/50 font-medium">{t('waste.table.qty')}</th>
                <th className="text-right px-4 py-3 text-xs text-white/50 font-medium hidden md:table-cell">{t('waste.table.cost')}</th>
                <th className="text-right px-4 py-3 text-xs text-white/50 font-medium hidden md:table-cell">{t('waste.table.date')}</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {monthEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-glass-border/50 last:border-0 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium">
                    {entry.item_name}
                    {entry.notes && (
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{entry.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={cn('inline-flex rounded-lg border px-2 py-0.5 text-xs font-medium', REASON_COLOR[entry.reason])}>
                      {t(`waste.reasons.${entry.reason}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-white/70">
                    {entry.quantity} <span className="text-white/40">{entry.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                    {entry.cost != null
                      ? <span className="text-red-400 font-semibold">€{entry.cost.toFixed(2)}</span>
                      : <span className="text-white/20">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-white/50 text-xs hidden md:table-cell">
                    {new Date(entry.wasted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openEdit(entry)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(entry)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {totalCost > 0 && (
              <tfoot>
                <tr className="border-t border-glass-border bg-white/5">
                  <td colSpan={3} className="px-4 py-3 text-xs text-white/50 font-medium hidden md:table-cell">
                    {t('waste.table.totalCost')}
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-right font-bold text-red-400 flex items-center justify-end gap-1 md:table-cell hidden">
                    <TrendingDown className="h-4 w-4" />€{totalCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 md:hidden" colSpan={4}>
                    <div className="flex items-center justify-end gap-1 font-bold text-red-400">
                      <Euro className="h-4 w-4" />{totalCost.toFixed(2)}
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </GlassCard>
      )}

      {/* Log / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { if (!saving) setDrawerOpen(false) }}
        title={editing ? t('waste.editEntry') : t('waste.newEntry')}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pick from inventory or type manually */}
          <div>
            <span className="mb-2 block text-sm font-medium text-white/80">{t('waste.form.inventoryItem')}</span>
            <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
              <select
                value={values.item_id}
                onChange={(e) => onInventorySelect(e.target.value)}
                className="flex-1 bg-transparent outline-none text-base text-white"
              >
                <option value="" className="bg-[#f5ede0]">{t('waste.form.selectItem')}</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id} className="bg-[#f5ede0]">{item.name}</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            name="item_name"
            label={t('waste.form.itemName')}
            placeholder={t('waste.form.itemNamePlaceholder')}
            required
            value={values.item_name}
            onChange={(e) => setValues((v) => ({ ...v, item_name: e.target.value, item_id: '' }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              name="quantity"
              type="number"
              label={t('waste.form.quantity')}
              placeholder="2.5"
              step="any"
              min={0}
              required
              value={values.quantity}
              onChange={(e) => setValues((v) => ({ ...v, quantity: e.target.value }))}
            />
            <Input
              name="unit"
              label={t('waste.form.unit')}
              placeholder="kg"
              value={values.unit}
              onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
            />
          </div>

          {/* Reason */}
          <div>
            <span className="mb-2 block text-sm font-medium text-white/80">{t('waste.form.reason')}</span>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r} type="button"
                  onClick={() => setValues((v) => ({ ...v, reason: r }))}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-xs font-medium transition',
                    values.reason === r ? REASON_COLOR[r] : 'border-white/20 text-white/60 hover:text-white',
                  )}>
                  {t(`waste.reasons.${r}`)}
                </button>
              ))}
            </div>
          </div>

          <Input
            name="cost"
            type="number"
            label={t('waste.form.cost')}
            placeholder="0.00"
            step="0.01"
            min={0}
            hint={t('waste.form.costHint')}
            value={values.cost}
            onChange={(e) => setValues((v) => ({ ...v, cost: e.target.value }))}
          />

          <Input
            name="wasted_at"
            type="date"
            label={t('waste.form.date')}
            value={values.wasted_at}
            onChange={(e) => setValues((v) => ({ ...v, wasted_at: e.target.value }))}
          />

          <Textarea
            name="notes"
            label={t('waste.form.notes')}
            placeholder={t('waste.form.notesPlaceholder')}
            rows={2}
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />

          {formError && (
            <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.saving') : editing ? t('common.save') : t('waste.form.log')}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  )
}
