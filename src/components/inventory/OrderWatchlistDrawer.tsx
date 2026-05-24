import { useState } from 'react'
import { Plus, Trash2, ShoppingCart, Loader2, Package } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { cn } from '../../lib/cn'
import { useOrderWatchlist } from '../../hooks/useOrderWatchlist'
import { useIngredientSuppliers } from '../../hooks/useIngredientSuppliers'
import type { InventoryItem, Supplier } from '../../types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  inventoryItems: InventoryItem[]
  suppliers: Supplier[]
}

// ── Quick-add form ─────────────────────────────────────────────────────────

function AddForm({
  inventoryItems,
  suppliers,
  onAdd,
}: {
  inventoryItems: InventoryItem[]
  suppliers: Supplier[]
  onAdd: (ingredientId: string, supplierId: string | null, qty: number, notes: string) => Promise<void>
}) {
  const { getPreferredLink } = useIngredientSuppliers()
  const [ingredientId, setIngredientId] = useState(inventoryItems[0]?.id ?? '')
  const [supplierId, setSupplierId] = useState<string>('')
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function onIngredientChange(id: string) {
    setIngredientId(id)
    // Auto-fill preferred supplier
    const preferred = getPreferredLink(id)
    setSupplierId(preferred?.supplier_id ?? '')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = parseFloat(qty)
    if (!ingredientId || isNaN(q) || q <= 0) return
    setSaving(true)
    try {
      await onAdd(ingredientId, supplierId || null, q, notes.trim())
      setQty('1')
      setNotes('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4 space-y-3">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Γρήγορη Προσθήκη</p>

      <select
        value={ingredientId}
        onChange={(e) => onIngredientChange(e.target.value)}
        className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-orange/60"
      >
        {inventoryItems.map((i) => (
          <option key={i.id} value={i.id} className="bg-gray-900">{i.name}</option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] text-white/40 uppercase tracking-wide">Ποσότητα *</span>
          <input
            type="number" min="0.001" step="any" value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-orange/60"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-white/40 uppercase tracking-wide">Προμηθευτής</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-brand-orange/60"
          >
            <option value="" className="bg-gray-900">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      <input
        type="text" placeholder="Σημείωση (προαιρετικό)" value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded-lg bg-white/10 border border-white/20 px-2.5 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-orange/60"
      />

      <button
        type="submit"
        disabled={saving || !ingredientId || !qty}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-orange hover:bg-brand-orange/80 disabled:opacity-40 py-2.5 text-sm font-bold text-white transition-colors"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Προσθήκη στο Watchlist
      </button>
    </form>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OrderWatchlistDrawer({ open, onClose, inventoryItems, suppliers }: Props) {
  const { entries, loading, addItem, removeItem } = useOrderWatchlist()

  // Group by supplier
  const grouped = entries.reduce<Record<string, { supplierName: string; items: typeof entries }>>(
    (acc, e) => {
      const key = e.supplier_id ?? '__none__'
      const name = e.supplier_name ?? 'Χωρίς Προμηθευτή'
      if (!acc[key]) acc[key] = { supplierName: name, items: [] }
      acc[key].items.push(e)
      return acc
    },
    {},
  )

  async function handleAdd(ingredientId: string, suppId: string | null, qty: number, notes: string) {
    await addItem({ ingredient_id: ingredientId, supplier_id: suppId, requested_quantity: qty, notes: notes || null })
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div>
          <p className="font-semibold text-white">Order Watchlist</p>
          <p className="text-xs text-white/40">Είδη που χρειάζονται παραγγελία</p>
        </div>
      }
    >
      <div className="space-y-5">
        <AddForm inventoryItems={inventoryItems} suppliers={suppliers} onAdd={handleAdd} />

        {loading ? (
          <p className="text-sm text-white/40 text-center py-6">Φόρτωση…</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <ShoppingCart className="h-8 w-8 text-white/20" />
            <p className="text-sm text-white/40">Το watchlist είναι άδειο.<br />Πρόσθεσε είδη που τελειώνουν.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([key, group]) => (
              <div key={key} className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-brand-orange/80">
                  {group.supplierName} · {group.items.length}
                </p>
                {group.items.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <Package className="h-4 w-4 text-white/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{entry.ingredient_name}</p>
                      <p className="text-xs text-white/40">
                        {entry.requested_quantity} {entry.ingredient_unit}
                        {entry.notes && ` · ${entry.notes}`}
                      </p>
                    </div>
                    <button
                      onClick={() => void removeItem(entry.id)}
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        'text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors',
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}
