import { useState, useEffect, useRef } from 'react'
import {
  Plus, ShoppingCart, FileUp, Trash2, Check, Package,
  Send, RotateCcw, X, Euro, Loader2, Sparkles, AlertTriangle, ClipboardList,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { Page, PageHeader, PillButton, Panel, EmptyState, Notice } from '../components/ui/page'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { usePurchaseOrders, usePurchaseOrderItems } from '../hooks/usePurchaseOrders'
import { useSuppliers } from '../hooks/useSuppliers'
import { useInventory } from '../hooks/useInventory'
import { useOrderWatchlist } from '../hooks/useOrderWatchlist'
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
import { PriceComparisonBadge } from '../components/ui/PriceComparisonBadge'
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

interface SupplierInfo {
  name: string | null
  afm: string | null
  address: string | null
  phone: string | null
  invoice_number: string | null
  invoice_date: string | null
}

interface ParsedPreview {
  supplier_name: string | null
  matched_supplier_id: string | null
  file_name: string
  items: Array<ParsedItem & { matched_inv_id: string | null; matched_inv_name: string | null }>
  supplier_info: SupplierInfo | null
  is_new_supplier: boolean
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
  const { profile } = useAuth()
  const { orders, loading, error, create, update, remove } = usePurchaseOrders()
  const { suppliers } = useSuppliers()
  const { items: inventoryItems, update: updateInv } = useInventory()
  const { getItemsForSupplier, bulkRemove: watchlistBulkRemove } = useOrderWatchlist()

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

  const { items: orderItems, addItem, removeItem } = usePurchaseOrderItems(
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
      const watchlistItems = supplierId ? getItemsForSupplier(supplierId) : []

      const created = await create({
        supplier_id: supplierId || null,
        status: 'draft',
        notes: orderNotes.trim() || null,
        ordered_at: null,
      })

      // Pre-fill from watchlist — insert before setting active order so hook loads them
      if (watchlistItems.length > 0) {
        await supabase.from('purchase_order_items').insert(
          watchlistItems.map((w) => ({
            order_id: created.id,
            inventory_item_id: w.ingredient_id,
            name: w.ingredient_name,
            quantity: w.requested_quantity,
            unit: w.ingredient_unit,
            unit_price: null,
          })),
        )
        await watchlistBulkRemove(watchlistItems.map((w) => w.id))
      }

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
        body: { file_base64, media_type: file.type, team_id: profile?.team_id ?? undefined },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error)

      const supplierInfo = (data.supplier_info ?? null) as SupplierInfo | null

      // Prefer DB-resolved supplier_id (from AFM lookup); fall back to fuzzy name match
      const resolvedSupplierId = (data.supplier_id as string | null) ?? null
      const matchedSupplier = resolvedSupplierId
        ? null  // already resolved server-side
        : (supplierInfo?.name ?? data.supplier_name)
          ? suppliers.find((s) => fuzzyMatch(s.name, (supplierInfo?.name ?? data.supplier_name) as string))
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
        supplier_name: supplierInfo?.name ?? data.supplier_name ?? null,
        matched_supplier_id: resolvedSupplierId ?? matchedSupplier?.id ?? null,
        file_name: file.name,
        items: enriched,
        supplier_info: supplierInfo,
        is_new_supplier: (data.is_new_supplier as boolean) ?? false,
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

  const COLUMNS: { status: PurchaseOrderStatus; tone: string }[] = [
    { status: 'draft', tone: 'bg-white/[0.06] text-white/70' },
    { status: 'sent', tone: 'bg-sky-500/10 text-sky-500' },
    { status: 'received', tone: 'bg-emerald-500/12 text-emerald-500' },
  ]
  const byStatus = (st: PurchaseOrderStatus) => orders.filter((o) => o.status === st)
  const cancelled = byStatus('cancelled')

  function renderOrder(order: (typeof orders)[number]) {
    return (
      <div
        key={order.id}
        role="button"
        tabIndex={0}
        onClick={() => openOrder(order)}
        onKeyDown={(e) => { if (e.key === 'Enter') openOrder(order) }}
        className="group flex cursor-pointer flex-col gap-2 rounded-2xl bg-bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium leading-snug">{order.supplier_name ?? t('purchaseOrders.noSupplier')}</span>
          <button
            type="button"
            aria-label={t('common.delete')}
            onClick={(e) => { e.stopPropagation(); if (window.confirm(t('purchaseOrders.deleteConfirm'))) void remove(order.id) }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/35 opacity-0 transition hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-white/50">
          {new Date(order.created_at).toLocaleDateString()}
          {order.notes && ` · ${order.notes.slice(0, 60)}`}
        </p>
        {order.status === 'draft' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void handleStatusChange(order, 'sent') }}
            className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-orange px-3 py-2 text-xs font-medium text-on-accent"
          >
            <Send className="h-3.5 w-3.5" />{t('purchaseOrders.markSent')}
          </button>
        )}
        {order.status === 'sent' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void handleStatusChange(order, 'received') }}
            className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-lime px-3 py-2 text-xs font-medium text-ink"
          >
            <Check className="h-3.5 w-3.5" />{t('purchaseOrders.markReceived')}
          </button>
        )}
      </div>
    )
  }

  return (
    <Page>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleInvoiceFile(e)}
      />
      <PageHeader
        title={t('purchaseOrders.title')}
        subtitle={t('purchaseOrders.subtitle')}
        actions={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('purchaseOrders.newOrder')}</PillButton>}
      />

      {/* ── AI invoice reader ── */}
      <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-ink p-5 sm:p-6 text-white-fixed">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime text-ink">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-[200px] flex-1">
          <p className="text-lg font-medium">{t('purchaseOrders.uploadInvoice')}</p>
          <p className="text-sm text-[#C9CEC8]">{t('purchaseOrders.v2.invoiceHint')}</p>
        </div>
        <button
          type="button"
          disabled={parsing}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-medium text-ink disabled:opacity-50"
        >
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {parsing ? t('purchaseOrders.parsing') : t('purchaseOrders.v2.chooseFile')}
        </button>
      </section>

      {parseError && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <X className="h-4 w-4 shrink-0" />
          <p className="flex-1">{parseError}</p>
          <button type="button" aria-label={t('common.close', 'Close')} onClick={() => setParseError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && <Notice>{error}</Notice>}

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={t('purchaseOrders.empty.title')}
          body={t('purchaseOrders.empty.description')}
          action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('purchaseOrders.empty.cta')}</PillButton>}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNS.map(({ status, tone }) => {
              const list = byStatus(status)
              return (
                <section key={status} className="flex flex-col gap-3 rounded-3xl bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className={cn('rounded-full px-3 py-1 text-sm font-medium', tone)}>{t(`purchaseOrders.status.${status}`)}</span>
                    <span className="text-sm tabular-nums text-white/50">{list.length}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="px-2 py-8 text-center text-sm text-white/40">—</p>
                  ) : (
                    list.map(renderOrder)
                  )}
                </section>
              )
            })}
          </div>
          {cancelled.length > 0 && (
            <Panel title={<span className="flex items-center gap-2">{t('purchaseOrders.status.cancelled')}<span className="text-sm text-white/45">{cancelled.length}</span></span>}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cancelled.map(renderOrder)}</div>
            </Panel>
          )}
        </>
      )}

      {/* Invoice preview drawer */}
      <Drawer
        open={previewOpen}
        onClose={() => { if (!confirming) { setPreviewOpen(false); setPreview(null) } }}
        title={t('purchaseOrders.invoicePreview')}
      >
        {preview && (
          <div className="space-y-5">
            {/* ── Supplier info card ── */}
            {preview.supplier_info && (
              <div className={cn(
                'rounded-xl border p-4 space-y-3',
                preview.is_new_supplier
                  ? 'border-brand-orange/40 bg-brand-orange/10'
                  : preview.matched_supplier_id
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/20 bg-white/[0.03]',
              )}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                    Στοιχεία Προμηθευτή
                  </p>
                  {preview.is_new_supplier && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-orange/20 text-brand-orange border border-brand-orange/30">
                      🤖 Νέος — Δημιουργήθηκε αυτόματα
                    </span>
                  )}
                  {!preview.is_new_supplier && preview.matched_supplier_id && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ Αναγνωρίστηκε
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {preview.supplier_info.name && (
                    <div>
                      <p className="text-[11px] text-white/40 uppercase tracking-wide">Επωνυμία</p>
                      <p className="font-semibold text-white">{preview.supplier_info.name}</p>
                    </div>
                  )}
                  {preview.supplier_info.afm && (
                    <div>
                      <p className="text-[11px] text-white/40 uppercase tracking-wide">ΑΦΜ</p>
                      <p className="font-semibold text-white">{preview.supplier_info.afm}</p>
                    </div>
                  )}
                  {preview.supplier_info.invoice_number && (
                    <div>
                      <p className="text-[11px] text-white/40 uppercase tracking-wide">Αρ. Παραστατικού</p>
                      <p className="font-medium text-white/80">{preview.supplier_info.invoice_number}</p>
                    </div>
                  )}
                  {preview.supplier_info.invoice_date && (
                    <div>
                      <p className="text-[11px] text-white/40 uppercase tracking-wide">Ημερομηνία</p>
                      <p className="font-medium text-white/80">{preview.supplier_info.invoice_date}</p>
                    </div>
                  )}
                  {preview.supplier_info.address && (
                    <div className="col-span-2">
                      <p className="text-[11px] text-white/40 uppercase tracking-wide">Διεύθυνση</p>
                      <p className="font-medium text-white/70 text-xs">{preview.supplier_info.address}</p>
                    </div>
                  )}
                  {preview.supplier_info.phone && (
                    <div>
                      <p className="text-[11px] text-white/40 uppercase tracking-wide">Τηλέφωνο</p>
                      <p className="font-medium text-white/70">{preview.supplier_info.phone}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="glass rounded-xl px-4 py-3 space-y-1 text-sm">
              <p className="text-white/50">{t('purchaseOrders.file')}: <span className="text-white">{preview.file_name}</span></p>
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
                    <div className="space-y-2">
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
                      {item.matched_inv_id && item.unit_price != null && (() => {
                        const inv = inventoryItems.find((i) => i.id === item.matched_inv_id)
                        if (!inv) return null
                        return (
                          <PriceComparisonBadge
                            currentPrice={inv.cost_per_unit}
                            currentUnit={inv.unit}
                            newPrice={item.unit_price}
                            newUnit={item.unit}
                          />
                        )
                      })()}
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
                  <option value="" className="bg-bg-card">{t('purchaseOrders.noSupplier')}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} className="bg-bg-card">{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Watchlist pre-fill banner */}
            {supplierId && getItemsForSupplier(supplierId).length > 0 && (() => {
              const wItems = getItemsForSupplier(supplierId)
              return (
                <div className="rounded-xl border border-brand-orange/40 bg-brand-orange/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-brand-orange shrink-0" />
                    <p className="text-sm font-semibold text-brand-orange">
                      {wItems.length} {wItems.length === 1 ? 'είδος' : 'είδη'} από το Watchlist
                    </p>
                  </div>
                  <ul className="space-y-1 pl-6">
                    {wItems.map((w) => (
                      <li key={w.id} className="text-xs text-white/70 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-white/30 shrink-0" />
                        {w.ingredient_name} — {w.requested_quantity} {w.ingredient_unit}
                        {w.notes && <span className="text-white/40">({w.notes})</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-brand-orange/70 pl-6">
                    Θα προ-συμπληρωθούν αυτόματα στις γραμμές της παραγγελίας.
                  </p>
                </div>
              )
            })()}

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
                      <option value="" className="bg-bg-card">{t('purchaseOrders.pickFromInventory')}</option>
                      {inventoryItems.map((i) => (
                        <option key={i.id} value={i.id} className="bg-bg-card">{i.name}</option>
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
    </Page>
  )
}
