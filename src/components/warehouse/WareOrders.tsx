import { useEffect, useState, useCallback } from 'react'
import {
  ShoppingCart, Plus, ChevronRight, ChevronLeft, Trash2, Search,
  CheckCircle2, Clock, XCircle, Package, ChevronDown, ChevronUp,
  ReceiptText, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import { useAuth } from '../../hooks/useAuth'
import { whLog } from '../../lib/warehouseLog'
import type { WhOrder, WhOrderItem, WhSupplier, WhProduct, WhOrderStatus } from '../../types/warehouse.types'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<WhOrderStatus, string> = {
  pending:   'Εκκρεμής',
  received:  'Παραλήφθηκε',
  cancelled: 'Ακυρώθηκε',
}

const STATUS_COLORS: Record<WhOrderStatus, string> = {
  pending:   'text-amber-400 bg-amber-500/10',
  received:  'text-emerald-400 bg-emerald-500/10',
  cancelled: 'text-red-400 bg-red-500/10',
}

const STATUS_ICON: Record<WhOrderStatus, React.ReactNode> = {
  pending:   <Clock className="h-3.5 w-3.5" />,
  received:  <CheckCircle2 className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
}

// ── Types ──────────────────────────────────────────────────────────────────────

type View = 'list' | 'new-order' | 'detail'

interface DraftItem {
  product_id: string
  product_name: string
  product_code: string | null
  unit: string
  quantity: string
  unit_price: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WareOrders() {
  const { user } = useAuth()

  // ── List view state ──
  const [orders, setOrders]       = useState<WhOrder[]>([])
  const [statusFilter, setStatusFilter] = useState<WhOrderStatus | 'all'>('all')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)

  // ── Detail view state ──
  const [view, setView]           = useState<View>('list')
  const [selectedOrder, setSelectedOrder] = useState<WhOrder | null>(null)
  const [orderItems, setOrderItems] = useState<WhOrderItem[]>([])
  const [expandedItems, setExpandedItems] = useState(false)

  // ── New-order wizard state ──
  const [suppliers, setSuppliers] = useState<WhSupplier[]>([])
  const [products, setProducts]   = useState<WhProduct[]>([])
  const [wizardSupplier, setWizardSupplier] = useState<WhSupplier | null>(null)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [orderNotes, setOrderNotes]  = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving]       = useState(false)

  // ── Receive-order state ──
  const [receiving, setReceiving]     = useState(false)
  const [invoiceTotal, setInvoiceTotal] = useState('')
  const [receiveItems, setReceiveItems] = useState<{ id: string; received: string; invoice_price: string }[]>([])

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('wh_orders')
      .select('*, wh_suppliers:supplier_id(id,name)')
      .order('created_at', { ascending: false })
    setOrders((data ?? []) as WhOrder[])
    setLoading(false)
  }, [])

  useEffect(() => { void fetchOrders() }, [fetchOrders])

  useEffect(() => {
    if (view !== 'new-order') return
    void (async () => {
      const [{ data: sups }, { data: prods }] = await Promise.all([
        supabase.from('wh_suppliers').select('*').order('name'),
        supabase.from('wh_products').select('id,name,product_code,unit,purchase_price,supplier_id').order('name'),
      ])
      setSuppliers((sups ?? []) as WhSupplier[])
      setProducts((prods ?? []) as WhProduct[])
    })()
  }, [view])

  async function openDetail(order: WhOrder) {
    setSelectedOrder(order)
    const { data } = await supabase
      .from('wh_order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('product_name')
    const items = (data ?? []) as WhOrderItem[]
    setOrderItems(items)
    setReceiveItems(items.map((it) => ({
      id: it.id,
      received: String(it.received_quantity ?? it.quantity),
      invoice_price: String(it.invoice_price ?? it.unit_price ?? ''),
    })))
    setInvoiceTotal(String(order.invoice_total ?? ''))
    setView('detail')
  }

  // ── New order wizard ───────────────────────────────────────────────────────

  function resetWizard() {
    setWizardSupplier(null)
    setDraftItems([])
    setOrderNotes('')
    setExpectedDate('')
    setProductSearch('')
  }

  function openNewOrder() {
    resetWizard()
    setView('new-order')
  }

  const supplierProducts = products.filter(
    (p) => !wizardSupplier || p.supplier_id === wizardSupplier.id
  )

  const filteredProducts = supplierProducts.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.product_code ?? '').toLowerCase().includes(productSearch.toLowerCase())
  )

  function addProduct(p: WhProduct) {
    if (draftItems.some((d) => d.product_id === p.id)) return
    setDraftItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        product_code: p.product_code,
        unit: p.unit,
        quantity: '1',
        unit_price: p.purchase_price != null ? String(p.purchase_price) : '',
      },
    ])
  }

  function removeProduct(id: string) {
    setDraftItems((prev) => prev.filter((d) => d.product_id !== id))
  }

  function updateDraft(id: string, field: 'quantity' | 'unit_price', value: string) {
    setDraftItems((prev) => prev.map((d) => d.product_id === id ? { ...d, [field]: value } : d))
  }

  async function saveOrder() {
    if (!wizardSupplier || draftItems.length === 0) return
    setSaving(true)
    const { data: newOrder, error } = await supabase.from('wh_orders').insert({
      supplier_id: wizardSupplier.id,
      status: 'pending',
      notes: orderNotes.trim() || null,
      order_date: new Date().toISOString().slice(0, 10),
      expected_delivery_date: expectedDate || null,
    }).select().single()

    if (error || !newOrder) { setSaving(false); return }

    await supabase.from('wh_order_items').insert(
      draftItems.map((d) => ({
        order_id: newOrder.id,
        product_id: d.product_id,
        product_name: d.product_name,
        product_code: d.product_code,
        quantity: parseFloat(d.quantity) || 1,
        unit: d.unit,
        unit_price: d.unit_price ? parseFloat(d.unit_price) : null,
      }))
    )

    whLog(user?.id, user?.email, user?.role, 'CREATE_ORDER', wizardSupplier.name,
      `${draftItems.length} προϊόντα`)
    setSaving(false)
    setView('list')
    void fetchOrders()
  }

  // ── Receive order ─────────────────────────────────────────────────────────

  async function receiveOrder() {
    if (!selectedOrder) return
    setReceiving(true)

    // Update each order item with received quantities + invoice prices
    await Promise.all(
      receiveItems.map((ri) => {
        const receivedQty = parseFloat(ri.received) || 0
        const invPrice    = ri.invoice_price ? parseFloat(ri.invoice_price) : null
        return supabase.from('wh_order_items').update({
          received_quantity: receivedQty,
          invoice_price: invPrice,
        }).eq('id', ri.id)
      })
    )

    // Update product stock for each item
    await Promise.all(
      receiveItems.map(async (ri) => {
        const item = orderItems.find((it) => it.id === ri.id)
        if (!item?.product_id) return
        const received = parseFloat(ri.received) || 0
        if (received === 0) return
        const { data: prod } = await supabase
          .from('wh_products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single()
        if (!prod) return
        await supabase.from('wh_products').update({
          current_stock: (prod.current_stock ?? 0) + received,
        }).eq('id', item.product_id)
      })
    )

    // Mark order received
    const total = invoiceTotal ? parseFloat(invoiceTotal) : null
    await supabase.from('wh_orders').update({
      status: 'received',
      received_at: new Date().toISOString(),
      invoice_total: total,
    }).eq('id', selectedOrder.id)

    whLog(user?.id, user?.email, user?.role, 'RECEIVE_ORDER',
      selectedOrder.wh_suppliers?.name ?? null,
      `Τιμολόγιο: ${total ?? '–'}€`)

    setReceiving(false)
    setView('list')
    void fetchOrders()
  }

  async function cancelOrder() {
    if (!selectedOrder) return
    if (!confirm('Ακύρωση παραγγελίας;')) return
    await supabase.from('wh_orders').update({ status: 'cancelled' }).eq('id', selectedOrder.id)
    whLog(user?.id, user?.email, user?.role, 'CANCEL_ORDER',
      selectedOrder.wh_suppliers?.name ?? null)
    setView('list')
    void fetchOrders()
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const matchSearch = search === '' ||
      (o.wh_suppliers?.name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // ── Render helpers ─────────────────────────────────────────────────────────

  function BackBtn({ label = 'Πίσω' }: { label?: string }) {
    return (
      <button
        onClick={() => setView('list')}
        className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition"
      >
        <ChevronLeft className="h-4 w-4" /> {label}
      </button>
    )
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Παραγγελίες</h2>
          <p className="text-xs text-white/40">{orders.length} παραγγελίες</p>
        </div>
        <button
          onClick={openNewOrder}
          className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition"
        >
          <Plus className="h-4 w-4" /> Νέα
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'received', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition',
              statusFilter === s
                ? 'bg-brand-orange text-white'
                : 'bg-white/5 text-white/40 hover:text-white',
            )}
          >
            {s === 'all' ? 'Όλες' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση προμηθευτή…"
          className="w-full rounded-xl border border-glass-border bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
        />
      </div>

      {/* Order list */}
      <div className="space-y-2">
        {loading && <p className="py-8 text-center text-sm text-white/30">Φόρτωση…</p>}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-white/30 text-sm">Καμία παραγγελία</div>
        )}
        {filtered.map((order) => (
          <button
            key={order.id}
            onClick={() => void openDetail(order)}
            className="w-full text-left rounded-xl border border-glass-border bg-white/3 p-4 hover:bg-white/5 transition"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                <ShoppingCart className="h-4 w-4 text-white/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">
                  {order.wh_suppliers?.name ?? 'Άγνωστος Προμηθευτής'}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {order.order_date ?? order.created_at.slice(0, 10)}
                  {order.expected_delivery_date && ` → ${order.expected_delivery_date}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {order.invoice_total != null && (
                  <span className="text-xs font-semibold text-white/60">
                    {order.invoice_total.toFixed(2)}€
                  </span>
                )}
                <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_COLORS[order.status])}>
                  {STATUS_ICON[order.status]} {STATUS_LABELS[order.status]}
                </span>
                <ChevronRight className="h-4 w-4 text-white/20" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // ── NEW ORDER VIEW ─────────────────────────────────────────────────────────

  if (view === 'new-order') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackBtn label="Ακύρωση" />
        <h2 className="text-lg font-bold text-white">Νέα Παραγγελία</h2>
      </div>

      {/* Step 1: Select supplier */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-white/40">
          Προμηθευτής
        </label>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
          {suppliers.map((s) => (
            <button
              key={s.id}
              onClick={() => { setWizardSupplier(s); setDraftItems([]) }}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm text-left transition',
                wizardSupplier?.id === s.id
                  ? 'border-brand-orange bg-brand-orange/10 text-white'
                  : 'border-glass-border bg-white/3 text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <span className="flex-1 font-medium">{s.name}</span>
              {wizardSupplier?.id === s.id && <CheckCircle2 className="h-4 w-4 text-brand-orange shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Add products */}
      {wizardSupplier && (
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
            Προϊόντα
          </label>

          {/* Product picker */}
          <div className="rounded-xl border border-glass-border bg-white/3 p-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Αναζήτηση προϊόντος…"
                className="w-full rounded-lg border border-glass-border bg-white/5 pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredProducts.length === 0 && (
                <p className="text-center text-xs text-white/30 py-3">Κανένα προϊόν</p>
              )}
              {filteredProducts.map((p) => {
                const added = draftItems.some((d) => d.product_id === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    disabled={added}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-left transition',
                      added
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-white/10 text-white/70 hover:text-white',
                    )}
                  >
                    <Package className="h-3.5 w-3.5 shrink-0 text-white/30" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.product_code && <span className="text-white/30 shrink-0">{p.product_code}</span>}
                    <Plus className={cn('h-3.5 w-3.5 shrink-0', added ? 'text-emerald-400' : 'text-white/20')} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Draft items list */}
          {draftItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Αντικείμενα ({draftItems.length})
              </p>
              {draftItems.map((d) => (
                <div key={d.product_id} className="rounded-xl border border-glass-border bg-white/3 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-medium text-white truncate">{d.product_name}</p>
                    <button
                      onClick={() => removeProduct(d.product_id)}
                      className="p-1 text-white/30 hover:text-red-400 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] text-white/40">Ποσότητα ({d.unit})</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={d.quantity}
                        onChange={(e) => updateDraft(d.product_id, 'quantity', e.target.value)}
                        className="w-full rounded-lg border border-glass-border bg-white/5 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] text-white/40">Τιμή/μονάδα (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={d.unit_price}
                        onChange={(e) => updateDraft(d.product_id, 'unit_price', e.target.value)}
                        placeholder="–"
                        className="w-full rounded-lg border border-glass-border bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Order metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-white/60">Αναμεν. παράδοση</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Σημειώσεις</label>
              <input
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Προαιρετικά…"
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              />
            </div>
          </div>

          <button
            onClick={() => void saveOrder()}
            disabled={saving || draftItems.length === 0}
            className={cn(
              'w-full rounded-xl py-3 text-sm font-semibold transition',
              saving || draftItems.length === 0
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-brand-orange text-white hover:bg-brand-orange/90',
            )}
          >
            {saving ? 'Αποθήκευση…' : `Αποστολή Παραγγελίας (${draftItems.length} προϊόντα)`}
          </button>
        </div>
      )}
    </div>
  )

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────

  if (view === 'detail' && selectedOrder) {
    const isPending = selectedOrder.status === 'pending'
    const subtotal = orderItems.reduce((s, it) => {
      const price = it.invoice_price ?? it.unit_price ?? 0
      return s + (it.received_quantity ?? it.quantity) * price
    }, 0)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <BackBtn />
          <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_COLORS[selectedOrder.status])}>
            {STATUS_ICON[selectedOrder.status]} {STATUS_LABELS[selectedOrder.status]}
          </span>
        </div>

        {/* Order header */}
        <div className="rounded-xl border border-glass-border bg-white/3 p-4 space-y-1">
          <p className="font-bold text-white">{selectedOrder.wh_suppliers?.name ?? '—'}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-white/40">
            {selectedOrder.order_date && <span>Παραγγελία: {selectedOrder.order_date}</span>}
            {selectedOrder.expected_delivery_date && <span>Παράδοση: {selectedOrder.expected_delivery_date}</span>}
            {selectedOrder.received_at && <span>Παρελήφθη: {selectedOrder.received_at.slice(0, 10)}</span>}
          </div>
          {selectedOrder.notes && <p className="text-xs text-white/40 italic">{selectedOrder.notes}</p>}
        </div>

        {/* Items list */}
        <div>
          <button
            onClick={() => setExpandedItems((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-glass-border bg-white/3 px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 transition"
          >
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-white/40" />
              Αντικείμενα ({orderItems.length})
            </span>
            {expandedItems ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
          </button>

          {expandedItems && (
            <div className="mt-2 rounded-xl border border-glass-border divide-y divide-glass-border overflow-hidden">
              {orderItems.map((item) => {
                const ri = receiveItems.find((r) => r.id === item.id)
                return (
                  <div key={item.id} className="px-4 py-3 bg-white/3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.product_name}</p>
                        {item.product_code && (
                          <p className="text-[11px] text-white/30">{item.product_code}</p>
                        )}
                      </div>
                      <span className="text-xs text-white/50 shrink-0">{item.quantity} {item.unit}</span>
                    </div>

                    {/* Receive inputs (only for pending orders) */}
                    {isPending && ri && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] text-white/40">Παρελήφθη ({item.unit})</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ri.received}
                            onChange={(e) => setReceiveItems((prev) =>
                              prev.map((r) => r.id === item.id ? { ...r, received: e.target.value } : r)
                            )}
                            className="w-full rounded-lg border border-glass-border bg-white/5 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] text-white/40">Τιμή τιμολ. (€)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={ri.invoice_price}
                            onChange={(e) => setReceiveItems((prev) =>
                              prev.map((r) => r.id === item.id ? { ...r, invoice_price: e.target.value } : r)
                            )}
                            placeholder="–"
                            className="w-full rounded-lg border border-glass-border bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Received info (for completed orders) */}
                    {!isPending && item.received_quantity != null && (
                      <div className="mt-1 flex gap-3 text-xs text-white/40">
                        <span>Παρελήφθη: {item.received_quantity} {item.unit}</span>
                        {item.invoice_price != null && <span>Τιμή: {item.invoice_price.toFixed(4)}€</span>}
                        {item.backorder_quantity != null && item.backorder_quantity > 0 && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Backorder: {item.backorder_quantity}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Invoice + receive */}
        {isPending && (
          <div className="rounded-xl border border-glass-border bg-white/3 p-4 space-y-3">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-white/40" /> Παραλαβή Παραγγελίας
            </p>
            <div>
              <label className="mb-1 block text-xs text-white/60">Σύνολο τιμολογίου (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={invoiceTotal}
                onChange={(e) => setInvoiceTotal(e.target.value)}
                placeholder={subtotal > 0 ? subtotal.toFixed(2) : '0.00'}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void cancelOrder()}
                className="flex-1 rounded-xl border border-red-500/30 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
              >
                Ακύρωση
              </button>
              <button
                onClick={() => void receiveOrder()}
                disabled={receiving}
                className={cn(
                  'flex-2 flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                  receiving
                    ? 'bg-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500',
                )}
              >
                {receiving ? 'Αποθήκευση…' : 'Παραλαβή & Ενημέρωση Αποθέματος'}
              </button>
            </div>
          </div>
        )}

        {/* Summary for received orders */}
        {selectedOrder.status === 'received' && selectedOrder.invoice_total != null && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between">
            <span className="text-sm text-emerald-400 font-semibold">Τιμολόγιο</span>
            <span className="text-lg font-bold text-emerald-400">{selectedOrder.invoice_total.toFixed(2)}€</span>
          </div>
        )}
      </div>
    )
  }

  return null
}
