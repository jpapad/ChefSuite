import { useEffect, useState } from 'react'
import { Building2, Plus, Pencil, Trash2, Search, Phone, Mail, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import type { WhSupplier, WhSupplierForm } from '../../types/warehouse.types'

const DAY_LABELS = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ']

const EMPTY_FORM: WhSupplierForm = {
  name: '', phone: '', email: '', notes: '',
  delivery_days: [], order_lead_days: 1, order_deadline_time: '12:00',
}

interface Props { onNavigate: (page: 'products', filter: Record<string, string>) => void }

export function WareSuppliers({ onNavigate }: Props) {
  const [suppliers, setSuppliers]     = useState<WhSupplier[]>([])
  const [prodCounts, setProdCounts]   = useState<Record<string, number>>({})
  const [search, setSearch]           = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<WhSupplier | null>(null)
  const [form, setForm]               = useState<WhSupplierForm>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)

  useEffect(() => { void fetchAll() }, [])

  async function fetchAll() {
    const [{ data: sups }, { data: prods }] = await Promise.all([
      supabase.from('wh_suppliers').select('*').order('name'),
      supabase.from('wh_products').select('supplier_id'),
    ])
    setSuppliers((sups ?? []) as WhSupplier[])
    const c: Record<string, number> = {}
    ;(prods ?? []).forEach((p) => { if (p.supplier_id) c[p.supplier_id] = (c[p.supplier_id] ?? 0) + 1 })
    setProdCounts(c)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(s: WhSupplier) {
    setEditing(s)
    setForm({
      name: s.name, phone: s.phone ?? '', email: s.email ?? '', notes: s.notes ?? '',
      delivery_days: s.delivery_days ?? [],
      order_lead_days: s.order_lead_days ?? 1,
      order_deadline_time: s.order_deadline_time ?? '12:00',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      delivery_days: form.delivery_days,
      order_lead_days: form.order_lead_days,
      order_deadline_time: form.order_deadline_time,
    }
    if (editing) {
      await supabase.from('wh_suppliers').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('wh_suppliers').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    void fetchAll()
  }

  async function del(id: string) {
    if (!confirm('Διαγραφή προμηθευτή;')) return
    await supabase.from('wh_suppliers').delete().eq('id', id)
    void fetchAll()
  }

  function toggleDay(idx: number) {
    setForm((f) => ({
      ...f,
      delivery_days: f.delivery_days.includes(idx)
        ? f.delivery_days.filter((d) => d !== idx)
        : [...f.delivery_days, idx].sort(),
    }))
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Προμηθευτές Αποθήκης</h2>
          <p className="text-xs text-white/40">{suppliers.length} προμηθευτές</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition"
        >
          <Plus className="h-4 w-4" /> Νέος
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση…"
          className="w-full rounded-xl border border-glass-border bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-white/30 text-sm">Κανένας προμηθευτής</div>
        )}
        {filtered.map((s) => {
          const count = prodCounts[s.id] ?? 0
          const days = (s.delivery_days ?? []).map((d) => DAY_LABELS[d]).join(', ')
          return (
            <div key={s.id} className="rounded-xl border border-glass-border bg-white/3 p-4 space-y-2 hover:bg-white/5 transition">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10">
                  <Building2 className="h-4 w-4 text-brand-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{s.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {s.phone && <span className="text-xs text-white/40 flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                    {s.email && <span className="text-xs text-white/40 flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1.5 text-white/30 hover:text-white transition rounded-lg hover:bg-white/10">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => void del(s.id)} className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {days && (
                  <span className="text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                    🚚 {days}
                  </span>
                )}
                {s.order_deadline_time && (
                  <span className="text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                    ⏰ Παραγγελία έως {s.order_deadline_time}
                  </span>
                )}
                {count > 0 && (
                  <button
                    onClick={() => onNavigate('products', { supplier_id: s.id })}
                    className="text-[11px] text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-full hover:bg-brand-orange/20 transition flex items-center gap-1"
                  >
                    <Package className="h-3 w-3" />{count} προϊόντα
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-glass-border bg-[#1a1a2e] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-white">{editing ? 'Επεξεργασία Προμηθευτή' : 'Νέος Προμηθευτής'}</h3>

            {[
              { label: 'Επωνυμία *', key: 'name', placeholder: 'π.χ. Μεταξάς ΑΕΒΕ' },
              { label: 'Τηλέφωνο', key: 'phone', placeholder: '210 000 0000' },
              { label: 'Email', key: 'email', placeholder: 'info@supplier.gr' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-white/60">{label}</label>
                <input
                  value={form[key as keyof WhSupplierForm] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
                />
              </div>
            ))}

            <div>
              <label className="mb-1 block text-xs text-white/60">Σημειώσεις</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs text-white/60">Ημέρες Παράδοσης</label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_LABELS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-semibold border transition',
                      form.delivery_days.includes(i)
                        ? 'border-brand-orange bg-brand-orange/20 text-brand-orange'
                        : 'border-glass-border text-white/40 hover:text-white',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-white/60">Προθεσμία παραγγελίας</label>
                <input
                  type="time"
                  value={form.order_deadline_time}
                  onChange={(e) => setForm((f) => ({ ...f, order_deadline_time: e.target.value }))}
                  className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Ημέρες προετοιμασίας</label>
                <input
                  type="number"
                  min={0}
                  value={form.order_lead_days}
                  onChange={(e) => setForm((f) => ({ ...f, order_lead_days: Math.max(0, +e.target.value) }))}
                  className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
                Άκυρο
              </button>
              <button
                onClick={() => void save()}
                disabled={saving || !form.name.trim()}
                className={cn(
                  'flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                  saving || !form.name.trim()
                    ? 'bg-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-brand-orange text-white hover:bg-brand-orange/90',
                )}
              >
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
