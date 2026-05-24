import { useState } from 'react'
import { Plus, Star, Trash2, Pencil, Check, X } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { cn } from '../../lib/cn'
import { useIngredientSuppliers } from '../../hooks/useIngredientSuppliers'
import type { IngredientSupplier, InventoryItem, Supplier } from '../../types/database.types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  item: InventoryItem
  allSuppliers: Supplier[]
}

interface EditState {
  purchase_price: string
  supplier_sku: string
  lead_time_days: string
}

// ── Row ────────────────────────────────────────────────────────────────────────

function LinkRow({
  link,
  supplierName,
  onUpdate,
  onRemove,
  onSetPreferred,
}: {
  link: IngredientSupplier
  supplierName: string
  onUpdate: (patch: Partial<EditState>) => Promise<void>
  onRemove: () => Promise<void>
  onSetPreferred: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditState>({
    purchase_price: String(link.purchase_price),
    supplier_sku: link.supplier_sku ?? '',
    lead_time_days: String(link.lead_time_days),
  })
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await onUpdate(form)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setRemoving(true)
    try { await onRemove() } finally { setRemoving(false) }
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-colors',
        link.is_preferred ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10 bg-white/[0.03]',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <button
          title="Ορισμός ως βασικός προμηθευτής"
          onClick={onSetPreferred}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
            link.is_preferred
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-white/5 text-white/30 hover:text-amber-400',
          )}
        >
          <Star className={cn('h-3.5 w-3.5', link.is_preferred && 'fill-amber-400')} />
        </button>
        <span className="flex-1 text-sm font-semibold truncate">{supplierName}</span>
        <button
          onClick={() => setEditing((e) => !e)}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/40 hover:text-white transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          disabled={removing}
          onClick={remove}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/40 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Display mode */}
      {!editing && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="space-y-0.5">
            <p className="text-white/40 uppercase tracking-wide">Τιμή</p>
            <p className="font-bold text-sm text-white">€{link.purchase_price.toFixed(4)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-white/40 uppercase tracking-wide">Κωδικός</p>
            <p className="font-medium text-white/70">{link.supplier_sku || '—'}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-white/40 uppercase tracking-wide">Lead time</p>
            <p className="font-medium text-white/70">{link.lead_time_days}η</p>
          </div>
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-white/40 uppercase tracking-wide">Τιμή (€)</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={form.purchase_price}
                onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-orange/60"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-white/40 uppercase tracking-wide">SKU</span>
              <input
                type="text"
                value={form.supplier_sku}
                onChange={(e) => setForm((f) => ({ ...f, supplier_sku: e.target.value }))}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-orange/60"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-white/40 uppercase tracking-wide">Lead (ημ.)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.lead_time_days}
                onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value }))}
                className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-orange/60"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={save}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold text-white transition-colors"
            >
              <Check className="h-3.5 w-3.5" /> Αποθήκευση
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 transition-colors"
            >
              <X className="h-4 w-4 text-white/60" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add-link form ──────────────────────────────────────────────────────────────

function AddLinkForm({
  availableSuppliers,
  onAdd,
  onCancel,
}: {
  availableSuppliers: Supplier[]
  onAdd: (supplierId: string, price: number, sku: string, leadDays: number) => Promise<void>
  onCancel: () => void
}) {
  const [supplierId, setSupplierId] = useState(availableSuppliers[0]?.id ?? '')
  const [price, setPrice] = useState('')
  const [sku, setSku] = useState('')
  const [lead, setLead] = useState('1')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const p = parseFloat(price)
    if (!supplierId || isNaN(p) || p < 0) return
    setSaving(true)
    try {
      await onAdd(supplierId, p, sku, parseInt(lead, 10) || 1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4 space-y-3">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Νέος Προμηθευτής</p>

      <div className="space-y-2">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-orange/60"
        >
          {availableSuppliers.map((s) => (
            <option key={s.id} value={s.id} className="bg-gray-900">
              {s.name}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-white/40 uppercase tracking-wide">Τιμή (€)*</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              placeholder="0.0000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-orange/60"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-white/40 uppercase tracking-wide">SKU</span>
            <input
              type="text"
              placeholder="π.χ. CHE-001"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-orange/60"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-white/40 uppercase tracking-wide">Lead (ημ.)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-orange/60"
            />
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          disabled={saving || !price || !supplierId}
          onClick={submit}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-brand-orange hover:bg-brand-orange/80 disabled:opacity-40 py-2.5 text-xs font-bold text-white transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Προσθήκη
        </button>
        <button
          onClick={onCancel}
          className="flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 transition-colors"
        >
          <X className="h-4 w-4 text-white/60" />
        </button>
      </div>
    </div>
  )
}

// ── Main drawer ────────────────────────────────────────────────────────────────

export function IngredientSuppliersDrawer({ open, onClose, item, allSuppliers }: Props) {
  const { loading, addLink, updateLink, removeLink, getLinksForItem } =
    useIngredientSuppliers()

  const [showAddForm, setShowAddForm] = useState(false)

  const itemLinks = getLinksForItem(item.id)
  const linkedSupplierIds = new Set(itemLinks.map((l) => l.supplier_id))
  const availableSuppliers = allSuppliers.filter((s) => !linkedSupplierIds.has(s.id))

  const supplierNameById = new Map(allSuppliers.map((s) => [s.id, s.name]))

  async function handleAdd(supplierId: string, price: number, sku: string, leadDays: number) {
    await addLink({
      inventory_item_id: item.id,
      supplier_id: supplierId,
      purchase_price: price,
      supplier_sku: sku || null,
      lead_time_days: leadDays,
      is_preferred: itemLinks.length === 0, // first link auto-preferred
    })
    setShowAddForm(false)
  }

  async function handleUpdate(id: string, form: Partial<EditState>) {
    await updateLink(id, {
      ...(form.purchase_price != null && { purchase_price: parseFloat(form.purchase_price) }),
      ...(form.supplier_sku   != null && { supplier_sku: form.supplier_sku || null }),
      ...(form.lead_time_days != null && { lead_time_days: parseInt(form.lead_time_days, 10) || 1 }),
    })
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div>
          <p className="font-semibold text-white truncate">{item.name}</p>
          <p className="text-xs text-white/40">Διαχείριση Προμηθευτών</p>
        </div>
      }
    >
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-white/40 text-center py-6">Φόρτωση…</p>
        ) : (
          <>
            {itemLinks.length === 0 && !showAddForm && (
              <p className="text-sm text-white/40 text-center py-4">
                Δεν υπάρχουν συνδεδεμένοι προμηθευτές.
              </p>
            )}

            {itemLinks.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                supplierName={supplierNameById.get(link.supplier_id) ?? '—'}
                onUpdate={(form) => handleUpdate(link.id, form)}
                onRemove={() => removeLink(link.id)}
                onSetPreferred={() => { void updateLink(link.id, { is_preferred: true }) }}
              />
            ))}

            {showAddForm && availableSuppliers.length > 0 && (
              <AddLinkForm
                availableSuppliers={availableSuppliers}
                onAdd={handleAdd}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            {!showAddForm && availableSuppliers.length > 0 && (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm text-white/40 hover:text-white hover:border-white/40 transition-colors"
              >
                <Plus className="h-4 w-4" /> Προσθήκη Προμηθευτή
              </button>
            )}

            {availableSuppliers.length === 0 && !showAddForm && (
              <p className="text-xs text-white/30 text-center">
                Όλοι οι διαθέσιμοι προμηθευτές έχουν συνδεθεί.
              </p>
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}
