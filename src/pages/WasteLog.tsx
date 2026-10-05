import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Trash2, Trash, TrendingDown, ChevronLeft, ChevronRight,
  Package2, UtensilsCrossed, AlertCircle, BadgeDollarSign,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, PillButton, StatRow, StatTile, Panel, EmptyState, Notice } from '../components/ui/page'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { useWasteLogs } from '../hooks/useWasteLogs'
import { useInventory } from '../hooks/useInventory'
import { useSuppliers } from '../hooks/useSuppliers'
import { useRecipes } from '../hooks/useRecipes'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { WasteReasonCode, WasteLogRow } from '../types/database.types'

// ── Constants ─────────────────────────────────────────────────────────────────

type WasteMode = 'ingredient' | 'dish'

const REASON_CODES: WasteReasonCode[] = ['spoilage', 'kitchen_mistake', 'supplier_damaged', 'customer_return']

const REASON_LABEL: Record<WasteReasonCode, string> = {
  spoilage:         'Αλλοίωση',
  kitchen_mistake:  'Λάθος κουζίνας',
  supplier_damaged: 'Κατεστραμμένο (Προμηθευτής)',
  customer_return:  'Επιστροφή πελάτη',
}

const REASON_COLOR: Record<WasteReasonCode, string> = {
  spoilage:         'bg-red-500/10 text-red-500',
  kitchen_mistake:  'bg-orange-500/10 text-orange-500',
  supplier_damaged: 'bg-amber-500/12 text-amber-500',
  customer_return:  'bg-sky-500/10 text-sky-500',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function displayName(entry: WasteLogRow): string {
  return entry.ingredient?.name ?? entry.menu_item?.name ?? '—'
}

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  mode:          WasteMode
  ingredient_id: string
  menu_item_id:  string
  quantity:      string
  reason_code:   WasteReasonCode
  supplier_id:   string
  notes:         string
  wasted_at:     string
}

function blankForm(): FormState {
  return {
    mode:          'ingredient',
    ingredient_id: '',
    menu_item_id:  '',
    quantity:      '',
    reason_code:   'spoilage',
    supplier_id:   '',
    notes:         '',
    wasted_at:     todayIso(),
  }
}

// ── Menu item type (local) ────────────────────────────────────────────────────

interface MenuItemFlat {
  id:        string
  name:      string
  recipe_id: string | null
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WasteLog() {
  const { t } = useTranslation()
  const { entries, loading, error, create, remove } = useWasteLogs()
  const { items: inventoryItems } = useInventory()
  const { suppliers } = useSuppliers()
  const { recipes } = useRecipes()

  const [month, setMonth] = useState(() => todayIso().slice(0, 7))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm())
  const [menuItems, setMenuItems] = useState<MenuItemFlat[]>([])

  // Load all menu items once
  useEffect(() => {
    supabase
      .from('menu_items')
      .select('id, name, recipe_id')
      .order('name')
      .then(({ data }) => setMenuItems((data ?? []) as MenuItemFlat[]))
  }, [])

  // ── Derived live cost ───────────────────────────────────────────────────────

  const liveCost = useMemo((): number | null => {
    const qty = parseFloat(form.quantity)
    if (isNaN(qty) || qty <= 0) return null

    if (form.mode === 'ingredient' && form.ingredient_id) {
      const item = inventoryItems.find((i) => i.id === form.ingredient_id)
      if (item?.cost_per_unit != null) return +(qty * item.cost_per_unit).toFixed(2)
    }

    if (form.mode === 'dish' && form.menu_item_id) {
      const mi = menuItems.find((m) => m.id === form.menu_item_id)
      if (mi?.recipe_id) {
        const recipe = recipes.find((r) => r.id === mi.recipe_id)
        if (recipe?.cost_per_portion != null) return +(qty * recipe.cost_per_portion).toFixed(2)
      }
    }

    return null
  }, [form.mode, form.ingredient_id, form.menu_item_id, form.quantity, inventoryItems, menuItems, recipes])

  // Auto-fill unit when ingredient is selected
  function onIngredientSelect(id: string) {
    const item = inventoryItems.find((i) => i.id === id)
    setForm((f) => ({ ...f, ingredient_id: id, quantity: item ? '' : f.quantity }))
  }

  function openCreate() {
    setForm(blankForm())
    setFormError(null)
    setDrawerOpen(true)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (form.mode === 'ingredient' && !form.ingredient_id) {
      setFormError('Επιλέξτε υλικό από την αποθήκη.'); return
    }
    if (form.mode === 'dish' && !form.menu_item_id) {
      setFormError('Επιλέξτε πιάτο από το μενού.'); return
    }
    const qty = parseFloat(form.quantity)
    if (isNaN(qty) || qty <= 0) { setFormError('Εισάγετε έγκυρη ποσότητα.'); return }

    if (form.reason_code === 'supplier_damaged' && !form.supplier_id) {
      setFormError('Επιλέξτε προμηθευτή για να δημιουργηθεί πιστωτικό.'); return
    }

    const unit = form.mode === 'ingredient'
      ? (inventoryItems.find((i) => i.id === form.ingredient_id)?.unit ?? '')
      : 'μερίδα'

    setSaving(true)
    try {
      await create({
        ingredient_id:   form.mode === 'ingredient' ? form.ingredient_id || null : null,
        menu_item_id:    form.mode === 'dish'       ? form.menu_item_id  || null : null,
        quantity:        qty,
        unit,
        reason_code:     form.reason_code,
        supplier_id:     form.reason_code === 'supplier_damaged' ? (form.supplier_id || null) : null,
        calculated_cost: liveCost,
        notes:           form.notes.trim() || null,
      })
      setDrawerOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entry: WasteLogRow) {
    const name = displayName(entry)
    const ok = window.confirm(`Διαγραφή καταχώρησης για «${name}»;`)
    if (!ok) return
    await remove(entry.id)
  }

  // ── Monthly filtering & stats ───────────────────────────────────────────────

  const monthEntries = useMemo(() =>
    entries.filter((e) => e.created_at.startsWith(month)),
    [entries, month],
  )

  const totalCost = useMemo(() =>
    monthEntries.reduce((s, e) => s + (e.calculated_cost ?? 0), 0),
    [monthEntries],
  )

  const byReason = useMemo(() => {
    const map: Record<string, { count: number; cost: number }> = {}
    for (const e of monthEntries) {
      const r = map[e.reason_code] ??= { count: 0, cost: 0 }
      r.count++
      r.cost += e.calculated_cost ?? 0
    }
    return map
  }, [monthEntries])

  const creditCount = useMemo(() =>
    monthEntries.filter((e) => e.reason_code === 'supplier_damaged').length,
    [monthEntries],
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedIngredient = inventoryItems.find((i) => i.id === form.ingredient_id)
  const selectedMenuItem   = menuItems.find((m) => m.id === form.menu_item_id)
  const selectedRecipe     = selectedMenuItem?.recipe_id
    ? recipes.find((r) => r.id === selectedMenuItem.recipe_id)
    : null

  const reasonRows = REASON_CODES.map((code) => ({ code, ...(byReason[code] ?? { count: 0, cost: 0 }) }))
  const topReason = [...reasonRows].sort((a, b) => b.cost - a.cost || b.count - a.count)[0]
  const reasonMax = Math.max(...reasonRows.map((r) => r.cost || r.count), 1)

  return (
    <Page>
      <PageHeader
        title={t('waste.title')}
        subtitle={t('waste.subtitle')}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-full bg-bg-card p-1 shadow-card">
              <button type="button" aria-label="−1" onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[140px] text-center text-sm font-medium first-letter:uppercase">{monthLabel(month + '-01')}</span>
              <button type="button" aria-label="+1" onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <PillButton icon={Plus} variant="primary" onClick={openCreate}>Καταγραφή απώλειας</PillButton>
          </>
        }
      />

      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile tone="ink" label="Κόστος απωλειών" value={totalCost > 0 ? `€${totalCost.toFixed(2)}` : '—'} hint={monthLabel(month + '-01')} />
        <StatTile label="Καταχωρήσεις" value={monthEntries.length} />
        <StatTile label="Πιστωτικά προμηθευτών" value={creditCount} tone={creditCount ? 'warn' : 'default'} icon={BadgeDollarSign} hint="κατεστραμμένα από παραλαβή" />
        <StatTile tone="lime" label="Κύρια αιτία" value={topReason && (topReason.count > 0) ? REASON_LABEL[topReason.code] : '—'}
          hint={topReason && topReason.cost > 0 ? `€${topReason.cost.toFixed(0)}` : undefined}
          className="[&>span:nth-child(2)]:text-2xl" />
      </StatRow>

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : monthEntries.length === 0 ? (
        <EmptyState
          icon={Trash}
          title="Δεν υπάρχουν καταχωρήσεις αυτό τον μήνα"
          body="Κατέγραψε τις απώλειες για να βλέπεις πού χάνονται χρήματα."
          action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>Πρώτη καταχώρηση</PillButton>}
        />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── Entries ── */}
          <Panel padded={false}>
            <ul className="flex flex-col divide-y divide-white/[0.06] p-2">
              {monthEntries.map((entry) => (
                <li key={entry.id} className="group flex items-center gap-3 px-3 py-3">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', entry.ingredient_id ? 'bg-emerald-500/10 text-emerald-500' : 'bg-violet-500/10 text-violet-500')}>
                    {entry.ingredient_id ? <Package2 className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{displayName(entry)}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/50">
                      <span className={cn('rounded-full px-2 py-0.5 font-medium', REASON_COLOR[entry.reason_code])}>{REASON_LABEL[entry.reason_code]}</span>
                      <span className="tabular-nums">{entry.quantity} {entry.unit}</span>
                      <span>{new Date(entry.created_at).toLocaleDateString('el-GR')}</span>
                      {entry.notes && <span className="truncate">· {entry.notes}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {entry.calculated_cost != null ? `€${entry.calculated_cost.toFixed(2)}` : <span className="text-white/30">—</span>}
                  </span>
                  <button type="button" onClick={() => handleDelete(entry)} aria-label={t('common.delete')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/40 opacity-0 transition hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 focus:opacity-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            {totalCost > 0 && (
              <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4">
                <span className="text-sm text-white/55">Συνολικό κόστος</span>
                <span className="flex items-center gap-1 text-lg font-medium tabular-nums text-red-500"><TrendingDown className="h-4 w-4" />€{totalCost.toFixed(2)}</span>
              </div>
            )}
          </Panel>

          {/* ── By reason ── */}
          <Panel title="Ανά αιτία" className="xl:sticky xl:top-24">
            <ul className="flex flex-col gap-4">
              {reasonRows.map((r) => (
                <li key={r.code} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{REASON_LABEL[r.code]}</span>
                    <span className="tabular-nums text-white/60">{r.count} · €{r.cost.toFixed(0)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06]">
                    <div className="h-2 rounded-full bg-ink" style={{ width: `${((r.cost || r.count) / reasonMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {/* ── Log Drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => { if (!saving) setDrawerOpen(false) }}
        title="Νέα Καταγραφή Αποβλήτου"
      >
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, mode: 'ingredient', menu_item_id: '' }))}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border py-4 text-sm font-medium transition',
                form.mode === 'ingredient'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-glass-border bg-white/5 text-white/60 hover:bg-white/10',
              )}
            >
              <Package2 className="h-6 w-6" />
              Υλικό Αποθήκης
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, mode: 'dish', ingredient_id: '' }))}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border py-4 text-sm font-medium transition',
                form.mode === 'dish'
                  ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                  : 'border-glass-border bg-white/5 text-white/60 hover:bg-white/10',
              )}
            >
              <UtensilsCrossed className="h-6 w-6" />
              Έτοιμο Πιάτο
            </button>
          </div>

          {/* Item selector */}
          {form.mode === 'ingredient' ? (
            <div>
              <span className="mb-2 block text-sm font-medium text-white/80">Υλικό από Αποθήκη</span>
              <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
                <select
                  value={form.ingredient_id}
                  onChange={(e) => onIngredientSelect(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-base text-white"
                  required
                >
                  <option value="" className="bg-bg-card">— επιλέξτε υλικό —</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id} className="bg-bg-card">
                      {item.name} ({item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </div>
              {selectedIngredient && (
                <p className="mt-1.5 text-xs text-white/40">
                  Τιμή αγοράς: {selectedIngredient.cost_per_unit != null
                    ? `€${selectedIngredient.cost_per_unit.toFixed(3)} / ${selectedIngredient.unit}`
                    : 'Δεν έχει οριστεί'}
                </p>
              )}
            </div>
          ) : (
            <div>
              <span className="mb-2 block text-sm font-medium text-white/80">Πιάτο από Μενού</span>
              <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
                <select
                  value={form.menu_item_id}
                  onChange={(e) => setForm((f) => ({ ...f, menu_item_id: e.target.value }))}
                  className="flex-1 bg-transparent outline-none text-base text-white"
                  required
                >
                  <option value="" className="bg-bg-card">— επιλέξτε πιάτο —</option>
                  {menuItems.map((mi) => (
                    <option key={mi.id} value={mi.id} className="bg-bg-card">{mi.name}</option>
                  ))}
                </select>
              </div>
              {selectedMenuItem && (
                <p className="mt-1.5 text-xs text-white/40">
                  {selectedRecipe
                    ? `Κόστος συνταγής: €${selectedRecipe.cost_per_portion?.toFixed(2) ?? '—'} / μερίδα`
                    : 'Δεν υπάρχει συνδεδεμένη συνταγή'}
                </p>
              )}
            </div>
          )}

          {/* Quantity */}
          <Input
            name="quantity"
            type="number"
            label={form.mode === 'ingredient' ? 'Ποσότητα' : 'Αριθμός μερίδων'}
            placeholder={form.mode === 'ingredient' ? '2.5' : '1'}
            step="any"
            min={0}
            required
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />

          {/* Live cost banner */}
          {liveCost !== null ? (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <TrendingDown className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs text-red-300/70">Υπολογισμένη ζημιά</p>
                <p className="text-2xl font-bold text-red-400 tabular-nums">€{liveCost.toFixed(2)}</p>
              </div>
            </div>
          ) : form.quantity && (form.ingredient_id || form.menu_item_id) ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Δεν υπάρχει τιμή κόστους — η ζημιά δεν θα υπολογιστεί
            </div>
          ) : null}

          {/* Reason code */}
          <div>
            <span className="mb-2 block text-sm font-medium text-white/80">Αιτία</span>
            <div className="grid grid-cols-2 gap-2">
              {REASON_CODES.map((r) => (
                <button key={r} type="button"
                  onClick={() => setForm((f) => ({ ...f, reason_code: r }))}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-xs font-medium text-left transition',
                    form.reason_code === r
                      ? REASON_COLOR[r]
                      : 'border-glass-border bg-white/5 text-white/60 hover:bg-white/10',
                  )}>
                  {REASON_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Supplier dropdown — only for supplier_damaged */}
          {form.reason_code === 'supplier_damaged' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
                <BadgeDollarSign className="h-4 w-4" />
                Πιστωτικό Προμηθευτή
              </div>
              <p className="text-xs text-white/50">
                Θα δημιουργηθεί αυτόματα αίτημα πιστωτικού προς τον προμηθευτή για €{liveCost?.toFixed(2) ?? '—'}.
              </p>
              <div>
                <span className="mb-2 block text-xs font-medium text-white/70">Επιλογή Προμηθευτή</span>
                <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-amber-500/50">
                  <select
                    value={form.supplier_id}
                    onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                    className="flex-1 bg-transparent outline-none text-base text-white"
                    required
                  >
                    <option value="" className="bg-bg-card">— επιλέξτε προμηθευτή —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id} className="bg-bg-card">{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Notes & date */}
          <Textarea
            name="notes"
            label="Σημειώσεις"
            placeholder="Πρόσθετες λεπτομέρειες…"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <Input
            name="wasted_at"
            type="date"
            label="Ημερομηνία"
            value={form.wasted_at}
            onChange={(e) => setForm((f) => ({ ...f, wasted_at: e.target.value }))}
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
              {saving ? t('common.saving') : 'Καταγραφή'}
            </Button>
          </div>
        </form>
      </Drawer>
    </Page>
  )
}
