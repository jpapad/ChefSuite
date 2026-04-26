import { useState, useEffect, useRef } from 'react'
import {
  Plus, ShoppingCart, ChevronRight, Trash2, Check, Package,
  Send, RotateCcw, X, Euro, FileUp, Loader2, Sparkles, AlertTriangle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { usePurchaseOrders, usePurchaseOrderItems } from '../hooks/usePurchaseOrders'
import { useSuppliers } from '../hooks/useSuppliers'
import { useInventory } from '../hooks/useInventory'
import { supabase } from '../lib/supabase'

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
import { cn } from '../lib/cn'
import type { PurchaseOrderWithSupplier, PurchaseOrderStatus } from '../types/database.types'

const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  draft:     'bg-white/10 text-white/60',
  sent:      'bg-blue-500/20 text-blue-300',
  received:  'bg-emerald-500/20 text-emerald-300',
  cancelled: 'bg-red-500/20 text-red-300',
}

interface ItemDraft {
  inventory_item_id: string | null
  name: string
  quantity: string
  unit: string
  unit_price: string
}

const BLANK_ITEM: ItemDraft = { inventory_item_id: null, name: '', quantity: '', unit: '', unit_price: '' }

interface ParsedItem {
  name: string
  quantity: number
  unit: string
  unit_price: number | null
}

interface ParsedPreview {
  supplier_name: string | null
  matched_supplier_id: string | null
  file_name: string
  items: Array<ParsedItem & { matched_inv_id: string | null; matched_inv_name: string | null }>
}

function fuzzyMatch(a: string, b: string) {
  const la = a.toLowerCase().trim()
  const lb = b.toLowerCase().trim()
  return la.includes(lb) || lb.includes(la)
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PurchaseOrders() {
  const { t } = useTranslation()
  const { orders, loading, error, create, update, remove } = usePurchaseOrders()
  const { suppliers } = useSuppliers()
  const { items: inventoryItems, update: updateInv } = useInventory()

  // Invoice parsing
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedPreview | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Create / view order drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeOrder, setActiveOrder] = useState<PurchaseOrderWithSupplier | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Line item draft
  const [itemDraft, setItemDraft] = useState<ItemDraft>(BLANK_ITEM)
  const [addingItem, setAddingItem] = useState(false)

  const { items: orderItems, addItem, removeItem, reload: reloadItems } = usePurchaseOrderItems(
    activeOrder?.id ?? null,
  )

  useEffect(() => {
    if (!drawerOpen) { setActiveOrder(null); setItemDraft(BLANK_ITEM) }
  }, [drawerOpen])

  function openCreate() {
    setActiveOrder(null)
    setSupplierId('')
    setOrderNotes('')
    setFormError(null)
    setDrawerOpen(true)
  }

  function openOrder(order: PurchaseOrderWithSupplier) {
    setActiveOrder(order)
    setSupplierId(order.supplier_id ?? '')
    setOrderNotes(order.notes ?? '')
    setFormError(null)
    setDrawerOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const created = await create({
        supplier_id: supplierId || null,
        status: 'draft',
        notes: orderNotes.trim() || null,
        ordered_at: null,
      })
      setActiveOrder(created)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!activeOrder || !itemDraft.name.trim() || !itemDraft.quantity || !itemDraft.unit.trim()) return
    setAddingItem(true)
    try {
      await addItem({
        inventory_item_id: itemDraft.inventory_item_id || null,
        name: itemDraft.name.trim(),
        quantity: parseFloat(itemDraft.quantity),
        unit: itemDraft.unit.trim(),
        unit_price: itemDraft.unit_price ? parseFloat(itemDraft.unit_price) : null,
      })
      setItemDraft(BLANK_ITEM)
    } finally {
      setAddingItem(false)
    }
  }

  function onInventoryItemSelect(invId: string) {
    const inv = inventoryItems.find((i) => i.id === invId)
    if (inv) {
      setItemDraft((d) => ({
        ...d,
        inventory_item_id: invId,
        name: inv.name,
        unit: inv.unit,
        unit_price: inv.cost_per_unit != null ? String(inv.cost_per_unit) : d.unit_price,
      }))
    }
  }

  async function handleStatusChange(order: PurchaseOrderWithSupplier, status: PurchaseOrderStatus) {
    const patch: Parameters<typeof update>[1] = { status }
    if (status === 'sent') patch.ordered_at = new Date().toISOString()
    if (status === 'received') {
      patch.received_at = new Date().toISOString()
      // Update inventory quantities
      const items = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('order_id', order.id)
      const rows = items.data ?? []
      await Promise.all(
        rows
          .filter((r: { inventory_item_id: string | null }) => r.inventory_item_id)
          .map(async (r: { inventory_item_id: string; quantity: number }) => {
            const inv = inventoryItems.find((i) => i.id === r.inventory_item_id)
            if (inv) {
              await updateInv(inv.id, { quantity: inv.quantity + r.quantity })
            }
          }),
      )
    }
    await update(order.id, patch)
    if (activeOrder?.id === order.id) setActiveOrder((prev) => prev ? { ...prev, status } : prev)
  }

  async function handleInvoiceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true)
    setParseError(null)
    try {
      const file_base64 = await fileToBase64(file)
      const { data, error: fnErr } = await supabase.functions.invoke('parse-invoice', {
        body: { file_base64, media_type: file.type },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error)

      const matchedSupplier = data.supplier_name
        ? suppliers.find((s) => fuzzyMatch(s.name, data.supplier_name as string))
        : null

      const rawItems = (data.items ?? []) as ParsedItem[]
      const enriched = rawItems.map((item) => {
        const match = inventoryItems.find((inv) => fuzzyMatch(inv.name, item.name))
        return {
          ...item,
          matched_inv_id: match?.id ?? null,
          matched_inv_name: match?.name ?? null,
        }
      })

      setPreview({
        supplier_name: data.supplier_name ?? null,
        matched_supplier_id: matchedSupplier?.id ?? null,
        file_name: file.name,
        items: enriched,
      })
      setPreviewOpen(true)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('purchaseOrders.invoiceError'))
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirmImport() {
    if (!preview) return
    setConfirming(true)
    try {
      // 1. Update matched inventory items
      await Promise.all(
        preview.items
          .filter((item) => item.matched_inv_id)
          .map(async (item) => {
            const inv = inventoryItems.find((i) => i.id === item.matched_inv_id)
            if (inv) {
              await updateInv(inv.id, { quantity: inv.quantity + item.quantity })
            }
          }),
      )

      // 2. Create new inventory items for unmatched
      const unmatched = preview.items.filter((item) => !item.matched_inv_id)
      const newInvIds: Record<string, string> = {}
      if (unmatched.length > 0) {
        const { data: created } = await supabase
          .from('inventory')
          .insert(
            unmatched.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              cost_per_unit: item.unit_price,
              min_stock_level: 0,
              location_id: null,
              supplier_id: preview.matched_supplier_id,
            })),
          )
          .select('id, name')
        ;(created ?? []).forEach((row: { id: string; name: string }) => {
          const orig = unmatched.find((i) => i.name === row.name)
          if (orig) newInvIds[orig.name] = row.id
        })
      }

      // 3. Create the purchase order as "received"
      const newOrder = await create({
        supplier_id: preview.matched_supplier_id,
        status: 'received',
        notes: `📄 Imported from: ${preview.file_name}`,
        ordered_at: new Date().toISOString(),
      })
      await supabase.from('purchase_orders').update({ received_at: new Date().toISOString() }).eq('id', newOrder.id)

      // 4. Insert order items with inventory links
      if (preview.items.length > 0) {
        await supabase.from('purchase_order_items').insert(
          preview.items.map((item) => ({
            order_id: newOrder.id,
            inventory_item_id: item.matched_inv_id ?? newInvIds[item.name] ?? null,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
          })),
        )
      }

      setPreviewOpen(false)
      setPreview(null)
      setSupplierId(newOrder.supplier_id ?? '')
      setOrderNotes(newOrder.notes ?? '')
      setActiveOrder(newOrder)
      setDrawerOpen(true)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('purchaseOrders.invoiceError'))
      setPreviewOpen(false)
    } finally {
      setConfirming(false)
    }
  }

  const totalValue = orderItems.reduce(
    (sum, i) => sum + (i.unit_price ?? 0) * i.quantity,
    0,
  )

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('purchaseOrders.title')}</h1>
          <p className="text-white/60 mt-1">{t('purchaseOrders.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void handleInvoiceFile(e)}
          />
          <Button
            variant="ghost"
            leftIcon={parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-brand-orange" />}
            disabled={parsing}
            onClick={() => fileInputRef.current?.click()}
            className="border border-white/20"
          >
            {parsing ? t('purchaseOrders.parsing') : t('purchaseOrders.uploadInvoice')}
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
            {t('purchaseOrders.newOrder')}
          </Button>
        </div>
      </header>

      {parseError && (
        <GlassCard className="border border-red-500/40 flex items-center gap-3">
          <X className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{parseError}</p>
          <button type="button" onClick={() => setParseError(null)} className="ml-auto text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </GlassCard>
      )}

      {error && <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>}

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : orders.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <ShoppingCart className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('purchaseOrders.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('purchaseOrders.empty.description')}</p>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate} className="mt-2">
            {t('purchaseOrders.empty.cta')}
          </Button>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusKey = `purchaseOrders.status.${order.status}` as const
            return (
              <GlassCard
                key={order.id}
                className="flex items-center gap-4 cursor-pointer hover:bg-white/[.03] transition"
                onClick={() => openOrder(order)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {order.supplier_name ?? t('purchaseOrders.noSupplier')}
                    </span>
                    <span className={cn('text-xs rounded-full px-2 py-0.5 font-medium', STATUS_STYLES[order.status])}>
                      {t(statusKey)}
                    </span>
                  </div>
                  <p className="text-sm text-white/50 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString()}
                    {order.notes && ` · ${order.notes.slice(0, 50)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {order.status === 'draft' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleStatusChange(order, 'sent') }}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 transition"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {t('purchaseOrders.markSent')}
                    </button>
                  )}
                  {order.status === 'sent' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleStatusChange(order, 'received') }}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t('purchaseOrders.markReceived')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (window.confirm(t('purchaseOrders.deleteConfirm'))) void remove(order.id) }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {/* Invoice preview drawer */}
      <Drawer
        open={previewOpen}
        onClose={() => { if (!confirming) { setPreviewOpen(false); setPreview(null) } }}
        title={t('purchaseOrders.invoicePreview')}
      >
        {preview && (
          <div className="space-y-5">
            <div className="glass rounded-xl px-4 py-3 space-y-1 text-sm">
              <p className="text-white/50">{t('purchaseOrders.file')}: <span className="text-white">{preview.file_name}</span></p>
              {preview.supplier_name && (
                <p className="text-white/50">{t('purchaseOrders.supplier')}: <span className="text-white">{preview.supplier_name}</span>
                  {preview.matched_supplier_id
                    ? <span className="ml-2 text-xs text-emerald-400">✓ {t('purchaseOrders.matched')}</span>
                    : <span className="ml-2 text-xs text-amber-400">({t('purchaseOrders.notMatched')})</span>}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-white/60 mb-3">{t('purchaseOrders.extractedItems')} ({preview.items.length})</p>
              <ul className="space-y-2">
                {preview.items.map((item, i) => (
                  <li key={i} className={cn(
                    'rounded-xl border px-4 py-3 text-sm',
                    item.matched_inv_id
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-amber-500/30 bg-amber-500/5',
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-white/50 mt-0.5">
                          {item.quantity} {item.unit}
                          {item.unit_price != null && ` · €${item.unit_price.toFixed(2)}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {item.matched_inv_id ? (
                          <span className="text-xs text-emerald-400">
                            <Check className="inline h-3 w-3 mr-1" />
                            {t('purchaseOrders.willUpdate')}: {item.matched_inv_name}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-400">
                            <AlertTriangle className="inline h-3 w-3 mr-1" />
                            {t('purchaseOrders.willCreate')}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass rounded-xl px-4 py-3 text-xs text-white/50 space-y-1">
              <p><span className="text-emerald-400">■</span> {t('purchaseOrders.legendUpdate')}</p>
              <p><span className="text-amber-400">■</span> {t('purchaseOrders.legendCreate')}</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setPreviewOpen(false); setPreview(null) }}
                disabled={confirming}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirmImport()}
                disabled={confirming}
                leftIcon={confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              >
                {confirming ? t('common.saving') : t('purchaseOrders.confirmImport')}
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Order drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { if (!saving) setDrawerOpen(false) }}
        title={activeOrder ? t('purchaseOrders.orderDetails') : t('purchaseOrders.newOrder')}
      >
        {!activeOrder ? (
          /* ── New order form ── */
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-medium text-white/80">{t('purchaseOrders.supplier')}</span>
              <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-base text-white"
                >
                  <option value="" className="bg-[#f5ede0]">{t('purchaseOrders.noSupplier')}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#f5ede0]">{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <Textarea
              name="notes"
              label={t('purchaseOrders.notes')}
              placeholder={t('purchaseOrders.notesPlaceholder')}
              rows={2}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
            {formError && (
              <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">{formError}</div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t('common.saving') : t('purchaseOrders.createOrder')}
              </Button>
            </div>
          </form>
        ) : (
          /* ── Order details ── */
          <div className="space-y-6">
            {/* Status + actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn('text-sm rounded-full px-3 py-1 font-medium', STATUS_STYLES[activeOrder.status])}>
                {t(`purchaseOrders.status.${activeOrder.status}`)}
              </span>
              {activeOrder.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => void handleStatusChange(activeOrder, 'sent')}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 transition"
                >
                  <Send className="h-4 w-4" />{t('purchaseOrders.markSent')}
                </button>
              )}
              {activeOrder.status === 'sent' && (
                <button
                  type="button"
                  onClick={() => void handleStatusChange(activeOrder, 'received')}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition"
                >
                  <Check className="h-4 w-4" />{t('purchaseOrders.markReceived')}
                </button>
              )}
              {(activeOrder.status === 'draft' || activeOrder.status === 'sent') && (
                <button
                  type="button"
                  onClick={() => void handleStatusChange(activeOrder, 'cancelled')}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-red-500/15 text-red-300 hover:bg-red-500/25 transition"
                >
                  <RotateCcw className="h-4 w-4" />{t('purchaseOrders.cancel')}
                </button>
              )}
            </div>

            {activeOrder.supplier_name && (
              <p className="text-sm text-white/60">{t('purchaseOrders.supplier')}: <span className="text-white">{activeOrder.supplier_name}</span></p>
            )}
            {activeOrder.notes && (
              <p className="text-sm text-white/60">{activeOrder.notes}</p>
            )}

            {/* Items list */}
            <div>
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand-orange" />
                {t('purchaseOrders.items')}
                {orderItems.length > 0 && (
                  <span className="ml-auto text-sm font-normal text-white/50">
                    {t('purchaseOrders.total')}: <span className="text-white font-semibold">€{fmt(totalValue)}</span>
                  </span>
                )}
              </h3>

              {orderItems.length === 0 ? (
                <p className="text-sm text-white/40">{t('purchaseOrders.noItems')}</p>
              ) : (
                <ul className="divide-y divide-glass-border rounded-xl border border-glass-border overflow-hidden mb-4">
                  {orderItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.name}</span>
                        <span className="ml-2 text-white/50">{item.quantity} {item.unit}</span>
                      </div>
                      {item.unit_price != null && (
                        <span className="text-white/60 shrink-0">
                          €{fmt(item.unit_price * item.quantity)}
                        </span>
                      )}
                      {activeOrder.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => void removeItem(item.id)}
                          className="text-white/30 hover:text-red-400 transition shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Add item form (only for draft) */}
              {activeOrder.status === 'draft' && (
                <form onSubmit={handleAddItem} className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{t('purchaseOrders.addItem')}</p>

                  {/* Quick pick from inventory */}
                  <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
                    <select
                      value={itemDraft.inventory_item_id ?? ''}
                      onChange={(e) => { if (e.target.value) onInventoryItemSelect(e.target.value) }}
                      className="flex-1 bg-transparent outline-none text-sm text-white/70"
                    >
                      <option value="" className="bg-[#f5ede0]">{t('purchaseOrders.pickFromInventory')}</option>
                      {inventoryItems.map((i) => (
                        <option key={i.id} value={i.id} className="bg-[#f5ede0]">{i.name}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    name="item_name"
                    label={t('purchaseOrders.itemName')}
                    value={itemDraft.name}
                    onChange={(e) => setItemDraft((d) => ({ ...d, name: e.target.value }))}
                    required
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      name="qty"
                      label={t('purchaseOrders.qty')}
                      type="number"
                      min="0.001"
                      step="any"
                      value={itemDraft.quantity}
                      onChange={(e) => setItemDraft((d) => ({ ...d, quantity: e.target.value }))}
                      required
                    />
                    <Input
                      name="unit"
                      label={t('purchaseOrders.unit')}
                      value={itemDraft.unit}
                      onChange={(e) => setItemDraft((d) => ({ ...d, unit: e.target.value }))}
                      required
                    />
                    <Input
                      name="unit_price"
                      label={t('purchaseOrders.unitPrice')}
                      type="number"
                      min="0"
                      step="0.01"
                      leftIcon={<Euro className="h-4 w-4" />}
                      value={itemDraft.unit_price}
                      onChange={(e) => setItemDraft((d) => ({ ...d, unit_price: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" disabled={addingItem} className="w-full">
                    {addingItem ? t('common.saving') : t('purchaseOrders.addItemBtn')}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
