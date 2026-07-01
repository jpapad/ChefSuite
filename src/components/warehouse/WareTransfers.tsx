import { useEffect, useState, useMemo } from 'react'
import {
  Plus, X, Check, ChevronDown, ChevronUp, ArrowRight,
  Clock, CheckCircle2, AlertTriangle, XCircle, Loader2,
  PackageCheck, Pencil, Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/cn'
import type { WhTransfer, WhTransferItem, WhStorageLocation, WhProduct } from '../../types/warehouse.types'

type TabKey = 'active' | 'completed'

const STATUS_LABEL: Record<WhTransfer['status'], string> = {
  pending:   'Εκκρεμεί',
  sent:      'Εστάλη',
  partial:   'Μερική',
  rejected:  'Απορρίφθηκε',
  completed: 'Ολοκληρώθηκε',
}

const STATUS_COLOR: Record<WhTransfer['status'], string> = {
  pending:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  sent:      'text-sky-400 bg-sky-500/10 border-sky-500/20',
  partial:   'text-orange-400 bg-orange-500/10 border-orange-500/20',
  rejected:  'text-red-400 bg-red-500/10 border-red-500/20',
  completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

interface DraftItem { product_id: string; product_name: string; unit: string; requested_quantity: string }

const inputCls  = 'w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50'
const selectCls = 'w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50'

export function WareTransfers() {
  const { profile } = useAuth()
  const [tab, setTab]               = useState<TabKey>('active')
  const [transfers, setTransfers]   = useState<WhTransfer[]>([])
  const [locations, setLocations]   = useState<WhStorageLocation[]>([])
  const [products, setProducts]     = useState<WhProduct[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)

  // New transfer form
  const [showForm, setShowForm]     = useState(false)
  const [fromLoc, setFromLoc]       = useState('')
  const [toLoc, setToLoc]           = useState('')
  const [neededBy, setNeededBy]     = useState('')
  const [notes, setNotes]           = useState('')
  const [requestedBy, setRequestedBy] = useState(profile?.full_name ?? '')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ product_id: '', product_name: '', unit: 'τεμ', requested_quantity: '' }])
  const [saving, setSaving]         = useState(false)

  // Fulfill state
  const [fulfillId, setFulfillId]   = useState<string | null>(null)
  const [fulfillQtys, setFulfillQtys] = useState<Record<string, string>>({})
  const [rejectId, setRejectId]     = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing]         = useState(false)

  useEffect(() => { void fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: tr }, { data: locs }, { data: prods }] = await Promise.all([
      supabase
        .from('wh_transfers')
        .select('*, from_location:from_location_id(id,name), to_location:to_location_id(id,name), wh_transfer_items(*)')
        .order('created_at', { ascending: false }),
      supabase.from('wh_storage_locations').select('id,name').order('name'),
      supabase.from('wh_products').select('id,name,unit,current_stock').eq('discontinued', false).order('name'),
    ])
    setTransfers((tr ?? []) as unknown as WhTransfer[])
    setLocations((locs ?? []) as WhStorageLocation[])
    setProducts((prods ?? []) as WhProduct[])
    setLoading(false)
  }

  const active    = useMemo(() => transfers.filter((t) => t.status !== 'completed' && t.status !== 'rejected'), [transfers])
  const completed = useMemo(() => transfers.filter((t) => t.status === 'completed' || t.status === 'rejected'), [transfers])
  const shown     = tab === 'active' ? active : completed

  function addDraftItem() {
    setDraftItems((d) => [...d, { product_id: '', product_name: '', unit: 'τεμ', requested_quantity: '' }])
  }

  function removeDraftItem(i: number) {
    setDraftItems((d) => d.filter((_, idx) => idx !== i))
  }

  function updateDraftItem(i: number, field: keyof DraftItem, value: string) {
    setDraftItems((d) => d.map((item, idx) => {
      if (idx !== i) return item
      if (field === 'product_id') {
        const prod = products.find((p) => p.id === value)
        return { ...item, product_id: value, product_name: prod?.name ?? '', unit: prod?.unit ?? 'τεμ' }
      }
      return { ...item, [field]: value }
    }))
  }

  async function createTransfer() {
    const validItems = draftItems.filter((i) => i.product_id && parseFloat(i.requested_quantity) > 0)
    if (!fromLoc || !toLoc || validItems.length === 0) return
    setSaving(true)
    const { data: tr, error } = await supabase
      .from('wh_transfers')
      .insert({
        from_location_id: fromLoc,
        to_location_id: toLoc,
        requested_by: requestedBy || null,
        notes: notes.trim() || null,
        needed_by: neededBy || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (!error && tr) {
      await supabase.from('wh_transfer_items').insert(
        validItems.map((i) => ({
          transfer_id: tr.id,
          product_id: i.product_id,
          product_name: i.product_name,
          unit: i.unit,
          requested_quantity: parseFloat(i.requested_quantity),
          fulfilled_quantity: 0,
        }))
      )
    }
    setSaving(false)
    setShowForm(false)
    resetForm()
    void fetchAll()
  }

  function resetForm() {
    setFromLoc(''); setToLoc(''); setNeededBy(''); setNotes('')
    setRequestedBy(profile?.full_name ?? '')
    setDraftItems([{ product_id: '', product_name: '', unit: 'τεμ', requested_quantity: '' }])
  }

  function startFulfill(t: WhTransfer) {
    const init: Record<string, string> = {}
    ;(t.wh_transfer_items ?? []).forEach((item) => {
      init[item.id] = String(item.requested_quantity - item.fulfilled_quantity)
    })
    setFulfillQtys(init)
    setFulfillId(t.id)
  }

  async function submitFulfill() {
    if (!fulfillId) return
    setActing(true)
    const transfer = transfers.find((t) => t.id === fulfillId)
    if (!transfer) { setActing(false); return }

    const items = transfer.wh_transfer_items ?? []
    for (const item of items) {
      const qty = parseFloat(fulfillQtys[item.id] ?? '0') || 0
      if (qty <= 0) continue
      const newFulfilled = item.fulfilled_quantity + qty
      await supabase.from('wh_transfer_items').update({ fulfilled_quantity: newFulfilled }).eq('id', item.id)
      // Update current_stock: deduct from source, add to target
      if (item.product_id) {
        const prod = products.find((p) => p.id === item.product_id)
        if (prod != null) {
          await supabase.from('wh_products').update({ current_stock: Math.max(0, prod.current_stock - qty) }).eq('id', item.product_id)
        }
      }
    }

    // Determine new status
    const allFulfilled = items.every((item) => {
      const qty = parseFloat(fulfillQtys[item.id] ?? '0') || 0
      return item.fulfilled_quantity + qty >= item.requested_quantity
    })
    const anyFulfilled = items.some((item) => (parseFloat(fulfillQtys[item.id] ?? '0') || 0) > 0)
    const newStatus = allFulfilled ? 'completed' : anyFulfilled ? 'partial' : 'sent'
    await supabase.from('wh_transfers').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', fulfillId)

    setFulfillId(null)
    setActing(false)
    void fetchAll()
  }

  async function submitReject() {
    if (!rejectId) return
    setActing(true)
    await supabase.from('wh_transfers')
      .update({ status: 'rejected', rejection_reason: rejectReason.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', rejectId)
    setRejectId(null)
    setRejectReason('')
    setActing(false)
    void fetchAll()
  }

  async function deleteTransfer(id: string) {
    if (!confirm('Διαγραφή μεταφοράς;')) return
    await supabase.from('wh_transfers').delete().eq('id', id)
    void fetchAll()
  }

  function StatusBadge({ status }: { status: WhTransfer['status'] }) {
    return (
      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', STATUS_COLOR[status])}>
        {STATUS_LABEL[status]}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Μεταφορές</h2>
          <p className="text-xs text-white/40">Εσωτερικές μεταφορές μεταξύ θέσεων αποθήκης</p>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm() }}
          className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition"
        >
          <Plus className="h-4 w-4" /> Νέα Μεταφορά
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {([['active', `Ενεργές (${active.length})`], ['completed', `Ιστορικό (${completed.length})`]] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn('rounded-xl px-4 py-2 text-sm font-medium transition',
              tab === key ? 'bg-brand-orange text-white' : 'border border-glass-border text-white/40 hover:text-white')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-white/30 text-sm">Φόρτωση…</div>
      ) : shown.length === 0 ? (
        <div className="py-12 text-center text-white/30 text-sm">Δεν υπάρχουν μεταφορές</div>
      ) : (
        <div className="space-y-2">
          {shown.map((tr) => {
            const isExp = expanded === tr.id
            const items = tr.wh_transfer_items ?? []
            return (
              <div key={tr.id} className="rounded-xl border border-glass-border overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-white/3 hover:bg-white/5 transition cursor-pointer"
                  onClick={() => setExpanded(isExp ? null : tr.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">
                        {tr.from_location?.name ?? '—'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                      <span className="text-sm font-semibold text-white">
                        {tr.to_location?.name ?? '—'}
                      </span>
                      <StatusBadge status={tr.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-white/35">{items.length} είδη</span>
                      {tr.requested_by && <span className="text-xs text-white/35">από {tr.requested_by}</span>}
                      {tr.needed_by && <span className="text-xs text-white/35 flex items-center gap-1"><Clock className="h-3 w-3" />{tr.needed_by}</span>}
                      <span className="text-xs text-white/25">{new Date(tr.created_at).toLocaleDateString('el-GR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {tr.status === 'pending' && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); startFulfill(tr) }}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
                        >
                          <PackageCheck className="h-3.5 w-3.5" /> Εκτέλεση
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRejectId(tr.id) }}
                          className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-red-500/10"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {tr.status === 'partial' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startFulfill(tr) }}
                        className="flex items-center gap-1 rounded-lg bg-orange-500/10 border border-orange-500/20 px-2.5 py-1.5 text-xs font-medium text-orange-400 hover:bg-orange-500/20 transition"
                      >
                        <PackageCheck className="h-3.5 w-3.5" /> Συνέχεια
                      </button>
                    )}
                    {(tr.status === 'rejected' || tr.status === 'completed') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void deleteTransfer(tr.id) }}
                        className="p-1.5 text-white/20 hover:text-red-400 transition rounded-lg hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isExp ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
                  </div>
                </div>

                {/* Expanded items */}
                {isExp && (
                  <div className="border-t border-glass-border bg-white/2 px-4 py-3 space-y-2">
                    {tr.rejection_reason && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-300">
                        Απόρριψη: {tr.rejection_reason}
                      </div>
                    )}
                    {tr.notes && (
                      <div className="text-xs text-white/40 italic">{tr.notes}</div>
                    )}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/30 uppercase tracking-wide">
                          <th className="text-left pb-1.5">Προϊόν</th>
                          <th className="text-right pb-1.5">Ζητήθηκε</th>
                          <th className="text-right pb-1.5">Εκτελέστηκε</th>
                          <th className="text-right pb-1.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-glass-border">
                        {items.map((item) => {
                          const done = item.fulfilled_quantity >= item.requested_quantity
                          return (
                            <tr key={item.id}>
                              <td className="py-1.5 text-white/80">{item.product_name}</td>
                              <td className="py-1.5 text-right text-white/60">{item.requested_quantity} {item.unit}</td>
                              <td className={cn('py-1.5 text-right font-semibold', done ? 'text-emerald-400' : item.fulfilled_quantity > 0 ? 'text-orange-400' : 'text-white/30')}>
                                {item.fulfilled_quantity} {item.unit}
                              </td>
                              <td className="py-1.5 text-right">
                                {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400/50 ml-auto" />}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New Transfer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-glass-border bg-[#1a1a2e] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Νέα Μεταφορά</h3>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-white/60">Από θέση *</label>
                <select value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} className={selectCls}>
                  <option value="">—</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Προς θέση *</label>
                <select value={toLoc} onChange={(e) => setToLoc(e.target.value)} className={selectCls}>
                  <option value="">—</option>
                  {locations.filter((l) => l.id !== fromLoc).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Αιτών</label>
                <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Όνομα" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Απαιτείται έως</label>
                <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-white/60">Σημειώσεις</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Προαιρετικά" className={inputCls} />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Είδη</p>
              {draftItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <select
                      value={item.product_id}
                      onChange={(e) => updateDraftItem(i, 'product_id', e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Επιλογή προϊόντος…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.current_stock} {p.unit})</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <input
                      type="number" min="0" step="0.001"
                      value={item.requested_quantity}
                      onChange={(e) => updateDraftItem(i, 'requested_quantity', e.target.value)}
                      placeholder="Ποσότητα"
                      className={cn(inputCls, '[appearance:textfield]')}
                    />
                  </div>
                  <div className="w-16 text-xs text-white/40 pb-3">{item.unit}</div>
                  {draftItems.length > 1 && (
                    <button onClick={() => removeDraftItem(i)} className="p-2 text-white/30 hover:text-red-400 transition pb-3">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addDraftItem} className="text-xs text-brand-orange hover:text-white transition flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Προσθήκη είδους
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
                Ακύρωση
              </button>
              <button
                onClick={() => void createTransfer()}
                disabled={saving || !fromLoc || !toLoc || draftItems.every((i) => !i.product_id)}
                className={cn('flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                  saving || !fromLoc || !toLoc ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-brand-orange text-white hover:bg-brand-orange/90')}
              >
                {saving ? 'Αποθήκευση…' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fulfill Modal */}
      {fulfillId && (() => {
        const tr = transfers.find((t) => t.id === fulfillId)
        if (!tr) return null
        const items = tr.wh_transfer_items ?? []
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-glass-border bg-[#1a1a2e] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">Εκτέλεση Μεταφοράς</h3>
                <button onClick={() => setFulfillId(null)} className="text-white/30 hover:text-white transition"><X className="h-5 w-5" /></button>
              </div>
              <p className="text-xs text-white/40">{tr.from_location?.name} → {tr.to_location?.name}</p>

              <div className="space-y-3">
                {items.map((item) => {
                  const remaining = item.requested_quantity - item.fulfilled_quantity
                  return (
                    <div key={item.id} className="rounded-xl bg-white/5 px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">{item.product_name}</p>
                        <span className="text-xs text-white/40">Απομένουν: {remaining} {item.unit}</span>
                      </div>
                      <input
                        type="number" min="0" step="0.001" max={remaining}
                        value={fulfillQtys[item.id] ?? ''}
                        onChange={(e) => setFulfillQtys((q) => ({ ...q, [item.id]: e.target.value }))}
                        placeholder={`Ποσότητα (max ${remaining})`}
                        className={cn(inputCls, '[appearance:textfield]')}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setFulfillId(null)} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
                  Ακύρωση
                </button>
                <button
                  onClick={() => void submitFulfill()}
                  disabled={acting}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition flex items-center justify-center gap-2"
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {acting ? 'Αποθήκευση…' : 'Επιβεβαίωση'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-glass-border bg-[#1a1a2e] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-5 w-5" />
              <h3 className="font-bold text-white">Απόρριψη Μεταφοράς</h3>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Αιτιολογία (προαιρετικά)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className={cn(inputCls, 'resize-none')}
                placeholder="π.χ. Δεν υπάρχει διαθέσιμο απόθεμα"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setRejectId(null); setRejectReason('') }} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
                Ακύρωση
              </button>
              <button
                onClick={() => void submitReject()}
                disabled={acting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition flex items-center justify-center gap-2"
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Απόρριψη
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
