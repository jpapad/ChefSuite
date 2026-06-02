import { useEffect, useState, useMemo } from 'react'
import {
  Package, Plus, Pencil, Trash2, Search, AlertTriangle,
  ChevronDown, ChevronUp, ArrowUpDown,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import type {
  WhProduct, WhCategory, WhStorageLocation, WhSupplier, WhProductForm,
} from '../../types/warehouse.types'

const EMPTY_FORM: WhProductForm = {
  name: '', product_code: '', category_id: '', supplier_id: '',
  storage_unit_id: '', unit: 'kg', purchase_price: '',
  min_quantity: '0', current_stock: '0', notes: '',
}

const UNITS = ['kg', 'g', 'lt', 'ml', 'τεμ', 'κιβ', 'συσκ', 'μερίδα', 'λίτρο']

type SortKey = 'name' | 'current_stock' | 'purchase_price'

interface Filter { category_id?: string; supplier_id?: string; storage_unit_id?: string }

interface Props { initialFilter?: Filter }

export function WareProducts({ initialFilter }: Props) {
  const { t } = useTranslation()
  const [products, setProducts]     = useState<WhProduct[]>([])
  const [categories, setCategories] = useState<WhCategory[]>([])
  const [suppliers, setSuppliers]   = useState<WhSupplier[]>([])
  const [locations, setLocations]   = useState<WhStorageLocation[]>([])
  const [loading, setLoading]       = useState(true)

  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState(initialFilter?.category_id ?? '')
  const [filterSup, setFilterSup]   = useState(initialFilter?.supplier_id ?? '')
  const [filterStu, setFilterStu]   = useState(initialFilter?.storage_unit_id ?? '')
  const [showLowStock, setShowLowStock] = useState(false)
  const [sort, setSort]             = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true })

  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<WhProduct | null>(null)
  const [form, setForm]             = useState<WhProductForm>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  useEffect(() => { void fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: prods }, { data: cats }, { data: sups }, { data: locs }] = await Promise.all([
      supabase.from('wh_products')
        .select('*, wh_categories:category_id(id,name), wh_suppliers:supplier_id(id,name), wh_storage_locations:storage_unit_id(id,name)')
        .order('name'),
      supabase.from('wh_categories').select('id,name,group_name').order('name'),
      supabase.from('wh_suppliers').select('id,name').order('name'),
      supabase.from('wh_storage_locations').select('id,name').order('name'),
    ])
    setProducts((prods ?? []) as WhProduct[])
    setCategories((cats ?? []) as WhCategory[])
    setSuppliers((sups ?? []) as WhSupplier[])
    setLocations((locs ?? []) as WhStorageLocation[])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(p: WhProduct) {
    setEditing(p)
    setForm({
      name: p.name,
      product_code: p.product_code ?? '',
      category_id: p.category_id ?? '',
      supplier_id: p.supplier_id ?? '',
      storage_unit_id: p.storage_unit_id ?? '',
      unit: p.unit,
      purchase_price: p.purchase_price != null ? String(p.purchase_price) : '',
      min_quantity: String(p.min_quantity),
      current_stock: String(p.current_stock),
      notes: p.notes ?? '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      product_code: form.product_code.trim() || null,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      storage_unit_id: form.storage_unit_id || null,
      unit: form.unit,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      min_quantity: parseFloat(form.min_quantity) || 0,
      current_stock: parseFloat(form.current_stock) || 0,
      notes: form.notes.trim() || null,
    }
    if (editing) {
      await supabase.from('wh_products').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('wh_products').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    void fetchAll()
  }

  async function del(id: string) {
    if (!confirm(t('wareProducts.deleteConfirm'))) return
    await supabase.from('wh_products').delete().eq('id', id)
    void fetchAll()
  }

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, asc: !s.asc } : { key, asc: true })
  }

  const filtered = useMemo(() => {
    let list = products
    if (search)        list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.product_code ?? '').toLowerCase().includes(search.toLowerCase()))
    if (filterCat)     list = list.filter((p) => p.category_id === filterCat)
    if (filterSup)     list = list.filter((p) => p.supplier_id === filterSup)
    if (filterStu)     list = list.filter((p) => p.storage_unit_id === filterStu)
    if (showLowStock)  list = list.filter((p) => p.current_stock <= p.min_quantity)
    list = [...list].sort((a, b) => {
      const dir = sort.asc ? 1 : -1
      if (sort.key === 'name') return dir * a.name.localeCompare(b.name)
      if (sort.key === 'current_stock') return dir * ((a.current_stock ?? 0) - (b.current_stock ?? 0))
      if (sort.key === 'purchase_price') return dir * ((a.purchase_price ?? 0) - (b.purchase_price ?? 0))
      return 0
    })
    return list
  }, [products, search, filterCat, filterSup, filterStu, showLowStock, sort])

  const lowStockCount = products.filter((p) => p.current_stock <= p.min_quantity).length

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sort.key === k
    return (
      <button onClick={() => toggleSort(k)} className={cn('flex items-center gap-1 text-xs font-semibold transition', active ? 'text-brand-orange' : 'text-white/40 hover:text-white')}>
        {label}
        {active ? (sort.asc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
      </button>
    )
  }

  const selectCls = 'w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50'
  const inputCls  = 'w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{t('wareProducts.title')}</h2>
          <p className="text-xs text-white/40">{products.length} {t('wareProducts.title').toLowerCase()}{lowStockCount > 0 && <span className="text-amber-400 ml-2">· {lowStockCount} {t('wareProducts.lowStockCount')}</span>}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition">
          <Plus className="h-4 w-4" /> {t('wareProducts.new')}
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('wareProducts.searchPlaceholder')}
            className="w-full rounded-xl border border-glass-border bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-xl border border-glass-border bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none min-w-[130px]">
          <option value="">{t('wareProducts.filterCategory')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterSup} onChange={(e) => setFilterSup(e.target.value)}
          className="rounded-xl border border-glass-border bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none min-w-[130px]">
          <option value="">{t('wareProducts.filterSupplier')}</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterStu} onChange={(e) => setFilterStu(e.target.value)}
          className="rounded-xl border border-glass-border bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none min-w-[120px]">
          <option value="">{t('wareProducts.filterLocation')}</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button
          onClick={() => setShowLowStock((v) => !v)}
          className={cn('rounded-xl px-3 py-2 text-sm font-medium border transition flex items-center gap-1.5',
            showLowStock ? 'border-amber-500/60 bg-amber-500/10 text-amber-400' : 'border-glass-border text-white/40 hover:text-white')}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> {t('wareProducts.lowStock')}
        </button>
      </div>

      {/* Sort bar */}
      <div className="flex gap-4 px-1">
        <SortBtn k="name" label={t('wareProducts.sortName')} />
        <SortBtn k="current_stock" label={t('wareProducts.sortStock')} />
        <SortBtn k="purchase_price" label={t('wareProducts.sortPrice')} />
        <span className="ml-auto text-xs text-white/30">{filtered.length} {t('wareProducts.results')}</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-white/30 text-sm">{t('wareProducts.loading')}</div>
      ) : (
        <div className="rounded-xl border border-glass-border divide-y divide-glass-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-white/30 text-sm">{t('wareProducts.empty')}</div>
          ) : filtered.map((p) => {
            const isLow = p.current_stock <= p.min_quantity
            const cat = p.wh_categories
            const sup = p.wh_suppliers
            const loc = p.wh_storage_locations
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-white/3 hover:bg-white/5 transition">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isLow ? 'bg-amber-500/10' : 'bg-white/5')}>
                  <Package className={cn('h-4 w-4', isLow ? 'text-amber-400' : 'text-white/30')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    {p.product_code && <span className="text-[10px] font-mono text-white/30 bg-white/5 px-1.5 rounded">{p.product_code}</span>}
                    {isLow && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{t('wareProducts.lowBadge')}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5">
                    {cat && <span className="text-xs text-white/35">{cat.name}</span>}
                    {sup && <span className="text-xs text-white/35">{sup.name}</span>}
                    {loc && <span className="text-xs text-white/35">📍{loc.name}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className={cn('text-sm font-bold tabular-nums', isLow ? 'text-amber-400' : 'text-white')}>
                    {p.current_stock} <span className="text-xs font-normal text-white/40">{p.unit}</span>
                  </p>
                  {p.purchase_price != null && (
                    <p className="text-xs text-white/35">€{p.purchase_price.toFixed(2)}/{p.unit}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-white/30 hover:text-white transition rounded-lg hover:bg-white/10">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => void del(p.id)} className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-glass-border bg-[#1a1a2e] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-white">{editing ? t('wareProducts.editTitle') : t('wareProducts.newTitle')}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-white/60">{t('wareProducts.nameLbl')}</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('wareProducts.namePlaceholder')} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Κωδικός</label>
                <input value={form.product_code} onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))}
                  placeholder="SKU / κωδικός" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Μονάδα *</label>
                <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className={selectCls}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Κατηγορία</label>
                <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))} className={selectCls}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Προμηθευτής</label>
                <select value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))} className={selectCls}>
                  <option value="">—</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Θέση αποθήκης</label>
                <select value={form.storage_unit_id} onChange={(e) => setForm((f) => ({ ...f, storage_unit_id: e.target.value }))} className={selectCls}>
                  <option value="">—</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Τιμή αγοράς (€)</label>
                <input type="number" step="0.0001" min="0" value={form.purchase_price}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
                  className={cn(inputCls, '[appearance:textfield]')} placeholder="0.0000" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Τρέχον απόθεμα</label>
                <input type="number" step="0.001" min="0" value={form.current_stock}
                  onChange={(e) => setForm((f) => ({ ...f, current_stock: e.target.value }))}
                  className={cn(inputCls, '[appearance:textfield]')} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Ελάχιστο απόθεμα</label>
                <input type="number" step="0.001" min="0" value={form.min_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, min_quantity: e.target.value }))}
                  className={cn(inputCls, '[appearance:textfield]')} />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-white/60">Σημειώσεις</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2} className={cn(inputCls, 'resize-none')} />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
                {t('common.cancel')}
              </button>
              <button onClick={() => void save()} disabled={saving || !form.name.trim()}
                className={cn('flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                  saving || !form.name.trim() ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-brand-orange text-white hover:bg-brand-orange/90')}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
