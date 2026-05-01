import { useEffect, useMemo, useState } from 'react'
import { Plus, Package, Search, AlertTriangle, MapPin, Trash2, Settings2, ShoppingCart, Copy, Check, Zap, Clock, ScanLine, PackagePlus } from 'lucide-react'
import { ReceivingScanner } from '../components/inventory/ReceivingScanner'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Drawer } from '../components/ui/Drawer'
import { InventoryList } from '../components/inventory/InventoryList'
import { InventoryMovementsDrawer } from '../components/inventory/InventoryMovementsDrawer'
import { InventoryQRDrawer } from '../components/inventory/InventoryQRDrawer'
import {
  InventoryForm,
  type InventoryFormValues,
} from '../components/inventory/InventoryForm'
import { useInventory, isLowStock } from '../hooks/useInventory'
import { useInventoryLocations } from '../hooks/useInventoryLocations'
import { useSuppliers } from '../hooks/useSuppliers'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { InventoryItem } from '../types/database.types'

interface ForecastItem { id: string; name: string; unit: string; quantity: number; minStock: number; avgDaily: number; daysLeft: number }

export default function Inventory() {
  const { t } = useTranslation()
  const { items, loading, error, create, update, remove } = useInventory()
  const { locations, create: createLocation, remove: removeLocation } = useInventoryLocations()
  const { suppliers } = useSuppliers()
  const { create: createOrder } = usePurchaseOrders()
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [onlyLow, setOnlyLow] = useState(false)
  const [locationFilter, setLocationFilter] = useState<string | null>(null)
  const [viewingHistory, setViewingHistory] = useState<InventoryItem | null>(null)
  const [viewingQR, setViewingQR] = useState<InventoryItem | null>(null)
  const [locDrawerOpen, setLocDrawerOpen] = useState(false)
  const [newLocName, setNewLocName] = useState('')
  const [locSaving, setLocSaving] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [showReorder, setShowReorder] = useState(false)
  const [orderCopied, setOrderCopied] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState<string | null>(null)
  const [forecast, setForecast] = useState<ForecastItem[]>([])
  const [scanMode, setScanMode] = useState<'check' | 'receive' | null>(null)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); setSearchParams({}, { replace: true }) }
    const itemId = searchParams.get('item')
    if (itemId && items.length > 0) {
      const found = items.find((i) => i.id === itemId)
      if (found) { setViewingQR(found); setSearchParams({}, { replace: true }) }
    }
  }, [searchParams, setSearchParams, items])

  // Inventory forecasting: avg daily consumption from movements
  useEffect(() => {
    if (items.length === 0) return
    const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 29)
    supabase
      .from('inventory_movements')
      .select('item_id, delta, created_at')
      .lt('delta', 0)
      .gte('created_at', thirtyAgo.toISOString())
      .then(({ data }) => {
        const rows = (data ?? []) as { item_id: string; delta: number; created_at: string }[]
        const map = new Map<string, number>()
        for (const r of rows) map.set(r.item_id, (map.get(r.item_id) ?? 0) + Math.abs(r.delta))
        const result: ForecastItem[] = []
        for (const [item_id, totalConsumed] of map) {
          const inv = items.find((i) => i.id === item_id)
          if (!inv) continue
          const avgDaily = totalConsumed / 30
          if (avgDaily <= 0) continue
          const daysLeft = Math.floor((inv.quantity - inv.min_stock_level) / avgDaily)
          if (daysLeft <= 14) result.push({ id: item_id, name: inv.name, unit: inv.unit, quantity: inv.quantity, minStock: inv.min_stock_level, avgDaily, daysLeft })
        }
        result.sort((a, b) => a.daysLeft - b.daysLeft)
        setForecast(result)
      })
  }, [items])

  // Label printing
  function printLabel(item: InventoryItem) {
    const location = item.location_id ? locationMap.get(item.location_id) : null
    const supplier = item.supplier_id ? suppliers.find((s) => s.id === item.supplier_id)?.name : null
    const win = window.open('', '_blank', 'width=400,height=300')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Label</title>
    <style>body{font-family:sans-serif;padding:16px;margin:0}h1{font-size:22px;margin:0 0 6px}p{margin:2px 0;font-size:13px;color:#555}hr{border:none;border-top:1px solid #ddd;margin:8px 0}.qty{font-size:28px;font-weight:bold;color:#f97316}.date{font-size:11px;color:#999}</style>
    </head><body>
    <h1>${item.name}</h1>
    <hr/>
    <p class="qty">${item.quantity} ${item.unit}</p>
    ${location ? `<p>📍 ${location}</p>` : ''}
    ${supplier ? `<p>🚚 ${supplier}</p>` : ''}
    ${item.min_stock_level > 0 ? `<p>Min stock: ${item.min_stock_level} ${item.unit}</p>` : ''}
    <hr/>
    <p class="date">Printed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
    <script>window.onload=()=>{window.print();window.close()}<\/script>
    </body></html>`)
    win.document.close()
  }

  // Supplier auto-order
  async function createAutoOrder(supplierId: string, supplierName: string, orderItems: InventoryItem[]) {
    setCreatingOrder(supplierId)
    try {
      const order = await createOrder({ supplier_id: supplierId === '__none__' ? null : supplierId, status: 'draft', notes: `🤖 Auto-generated from low stock`, ordered_at: null })
      await supabase.from('purchase_order_items').insert(
        orderItems.map((item) => ({
          order_id: order.id,
          inventory_item_id: item.id,
          name: item.name,
          quantity: Math.max(item.min_stock_level - item.quantity, 1),
          unit: item.unit,
          unit_price: item.cost_per_unit,
        }))
      )
      window.alert(t('inventory.autoOrderCreated', { supplier: supplierName }))
    } finally {
      setCreatingOrder(null)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (onlyLow && !isLowStock(i)) return false
      if (q && !i.name.toLowerCase().includes(q)) return false
      if (locationFilter === '__unassigned__') return i.location_id == null
      if (locationFilter != null && i.location_id !== locationFilter) return false
      return true
    })
  }, [items, query, onlyLow, locationFilter])

  const lowCount = useMemo(() => items.filter(isLowStock).length, [items])

  function openCreate() { setEditing(null); setDrawerOpen(true) }
  function openEdit(item: InventoryItem) { setEditing(item); setDrawerOpen(true) }

  async function onSubmit(values: InventoryFormValues) {
    setSaving(true)
    try {
      if (editing) {
        await update(editing.id, values)
      } else {
        await create(values)
      }
      setDrawerOpen(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function receiveItem(item: InventoryItem, qty: number) {
    await update(item.id, { quantity: item.quantity + qty }, 'receiving')
  }

  function onBarcodeNotFound(_barcode: string) {
    setScanMode(null)
    setEditing(null)
    setDrawerOpen(true)
    // Pre-fill barcode in form via a small trick — store it in state
    // InventoryForm will pick it up via its own scanner flow
    // Just open the drawer; user will re-scan inside the form to fill
  }

  async function onDelete(item: InventoryItem) {
    const ok = window.confirm(t('inventory.deleteConfirm', { name: item.name }))
    if (!ok) return
    await remove(item.id)
  }

  async function onRestock(item: InventoryItem) {
    const input = window.prompt(
      t('inventory.restockPrompt', { name: item.name, qty: item.quantity, unit: item.unit }),
      '',
    )
    if (input === null) return
    const qty = parseFloat(input)
    if (isNaN(qty) || qty <= 0) { window.alert(t('inventory.restockInvalid')); return }
    await update(item.id, { quantity: item.quantity + qty }, 'restock')
  }

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!newLocName.trim()) return
    setLocSaving(true)
    setLocError(null)
    try {
      await createLocation(newLocName)
      setNewLocName('')
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLocSaving(false)
    }
  }

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations],
  )

  const unassignedCount = items.filter((i) => i.location_id == null).length

  const lowStockItems = useMemo(() => items.filter(isLowStock), [items])

  const reorderBySupplier = useMemo(() => {
    const map = new Map<string, { supplierName: string; items: InventoryItem[] }>()
    for (const item of lowStockItems) {
      const supplierId = item.supplier_id ?? '__none__'
      const supplier = suppliers.find((s) => s.id === item.supplier_id)
      const supplierName = supplier?.name ?? t('inventory.reorder.noSupplier')
      if (!map.has(supplierId)) map.set(supplierId, { supplierName, items: [] })
      map.get(supplierId)!.items.push(item)
    }
    return [...map.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName))
  }, [lowStockItems, suppliers, t])

  async function copyReorderList() {
    const lines: string[] = [t('inventory.reorder.copyHeader'), '']
    for (const group of reorderBySupplier) {
      lines.push(`== ${group.supplierName} ==`)
      for (const item of group.items) {
        const needed = Math.max(0, item.min_stock_level - item.quantity)
        lines.push(`  ${item.name}: ${t('inventory.reorder.copyNeeded', { qty: needed, unit: item.unit })} (${t('inventory.reorder.copyHas', { qty: item.quantity })})`)
      }
      lines.push('')
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    setOrderCopied(true)
    setTimeout(() => setOrderCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('inventory.title')}</h1>
          <p className="text-white/60 mt-1">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {lowStockItems.length > 0 && (
            <Button
              variant={showReorder ? 'primary' : 'secondary'}
              leftIcon={<ShoppingCart className="h-5 w-5" />}
              onClick={() => setShowReorder((v) => !v)}
            >
              {t('inventory.reorder.button', { count: lowStockItems.length })}
            </Button>
          )}
          <Button
            variant="secondary"
            leftIcon={<ScanLine className="h-4 w-4" />}
            onClick={() => setScanMode('check')}
            title={t('inventory.scanCheck')}
          >
            {t('inventory.scanCheck')}
          </Button>
          <Button
            variant="secondary"
            leftIcon={<PackagePlus className="h-4 w-4" />}
            onClick={() => setScanMode('receive')}
            title={t('inventory.scanReceive')}
          >
            {t('inventory.scanReceive')}
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Settings2 className="h-5 w-5" />}
            onClick={() => setLocDrawerOpen(true)}
          >
            {t('inventory.locations')}
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
            {t('inventory.addItem')}
          </Button>
        </div>
      </header>

      {error && (
        <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>
      )}

      {/* ── Reorder panel ── */}
      {showReorder && (
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg">{t('inventory.reorder.title')}</h2>
              <p className="text-sm text-white/50">{t('inventory.reorder.subtitle', { count: lowStockItems.length })}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={orderCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              onClick={() => void copyReorderList()}
            >
              {orderCopied ? t('inventory.reorder.copied') : t('inventory.reorder.copyList')}
            </Button>
          </div>
          <div className="space-y-4">
            {reorderBySupplier.map((group) => {
              const supplierId = suppliers.find((s) => s.name === group.supplierName)?.id ?? '__none__'
              return (
              <div key={group.supplierName}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">{group.supplierName}</p>
                  <button type="button" disabled={!!creatingOrder}
                    onClick={() => void createAutoOrder(supplierId, group.supplierName, group.items)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-brand-orange/15 text-brand-orange hover:bg-brand-orange/25 transition disabled:opacity-50">
                    <Zap className="h-3 w-3" />
                    {creatingOrder === supplierId ? t('common.saving') : t('inventory.autoOrder')}
                  </button>
                </div>
                <div className="rounded-xl border border-glass-border overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {group.items.map((item) => {
                        const needed = Math.max(0, item.min_stock_level - item.quantity)
                        return (
                          <tr key={item.id} className="border-b border-glass-border/50 last:border-0">
                            <td className="px-4 py-2.5 font-medium">{item.name}</td>
                            <td className="px-4 py-2.5 text-white/50 text-xs">
                              {t('inventory.reorder.has', { qty: item.quantity, unit: item.unit })}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-xs font-semibold text-amber-400">
                                {t('inventory.reorder.need', { qty: needed, unit: item.unit })}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )})}
          </div>
        </GlassCard>
      )}

      {/* Stockout forecast */}
      {forecast.length > 0 && (
        <GlassCard className="border border-amber-500/20">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            {t('inventory.forecast.title')}
          </h2>
          <div className="space-y-2">
            {forecast.map((f) => (
              <div key={f.id} className="flex items-center gap-3 text-sm">
                <div className={cn('flex h-7 w-14 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                  f.daysLeft <= 0 ? 'bg-red-500/20 text-red-400'
                  : f.daysLeft <= 3 ? 'bg-red-500/15 text-red-400'
                  : f.daysLeft <= 7 ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-white/10 text-white/60')}>
                  {f.daysLeft <= 0 ? t('inventory.forecast.now') : `${f.daysLeft}d`}
                </div>
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-white/40 text-xs shrink-0">{f.quantity.toFixed(1)} {f.unit} · {f.avgDaily.toFixed(1)}/day</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px] max-w-md">
              <Input
                name="search"
                placeholder={t('inventory.searchPlaceholder')}
                leftIcon={<Search className="h-5 w-5" />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button
              variant={onlyLow ? 'primary' : 'secondary'}
              leftIcon={<AlertTriangle className="h-5 w-5" />}
              onClick={() => setOnlyLow((v) => !v)}
            >
              {t('inventory.lowStock', { count: lowCount })}
            </Button>
          </div>

          {locations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLocationFilter(null)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition',
                  locationFilter === null
                    ? 'bg-brand-orange text-white-fixed'
                    : 'bg-white/10 text-white/70 hover:bg-white/15',
                )}
              >
                {t('inventory.all', { count: items.length })}
              </button>
              {locations.map((loc) => {
                const count = items.filter((i) => i.location_id === loc.id).length
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setLocationFilter(loc.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition',
                      locationFilter === loc.id
                        ? 'bg-brand-orange text-white-fixed'
                        : 'bg-white/10 text-white/70 hover:bg-white/15',
                    )}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {loc.name} ({count})
                  </button>
                )
              })}
              {unassignedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setLocationFilter('__unassigned__')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition',
                    locationFilter === '__unassigned__'
                      ? 'bg-brand-orange text-white-fixed'
                      : 'bg-white/10 text-white/70 hover:bg-white/15',
                  )}
                >
                  {t('inventory.unassigned', { count: unassignedCount })}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <GlassCard><p className="text-white/60">{t('inventory.loadingInventory')}</p></GlassCard>
      ) : items.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <Package className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('inventory.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('inventory.empty.description')}</p>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate} className="mt-2">
            {t('inventory.empty.cta')}
          </Button>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard><p className="text-white/60">{t('inventory.noMatch')}</p></GlassCard>
      ) : (
        <InventoryList
          items={filtered}
          locationMap={locationMap}
          onEdit={openEdit}
          onDelete={onDelete}
          onRestock={onRestock}
          onHistory={setViewingHistory}
          onQR={setViewingQR}
          onPrint={printLabel}
        />
      )}

      {/* Scan — Check stock */}
      <Drawer
        open={scanMode === 'check'}
        onClose={() => setScanMode(null)}
        title={t('inventory.scanCheck')}
      >
        <ReceivingScanner
          mode="check"
          items={items}
          onReceive={receiveItem}
          onNotFound={onBarcodeNotFound}
          onClose={() => setScanMode(null)}
        />
      </Drawer>

      {/* Scan — Receive delivery */}
      <Drawer
        open={scanMode === 'receive'}
        onClose={() => setScanMode(null)}
        title={t('inventory.scanReceive')}
      >
        <ReceivingScanner
          mode="receive"
          items={items}
          onReceive={receiveItem}
          onNotFound={onBarcodeNotFound}
          onClose={() => setScanMode(null)}
        />
      </Drawer>

      <Drawer
        open={drawerOpen}
        onClose={() => { if (!saving) { setDrawerOpen(false); setEditing(null) } }}
        title={editing ? t('inventory.editItem') : t('inventory.addItemDrawer')}
      >
        <InventoryForm
          initial={editing ?? undefined}
          locations={locations}
          submitting={saving}
          onSubmit={onSubmit}
          onCancel={() => { setDrawerOpen(false); setEditing(null) }}
        />
      </Drawer>

      <Drawer
        open={locDrawerOpen}
        onClose={() => setLocDrawerOpen(false)}
        title={t('inventory.storageLocations')}
      >
        <div className="space-y-4">
          <p className="text-sm text-white/50">{t('inventory.locationsDescription')}</p>

          <form onSubmit={handleAddLocation} className="flex gap-2">
            <input
              type="text"
              placeholder={t('inventory.newLocationName')}
              value={newLocName}
              onChange={(e) => setNewLocName(e.target.value)}
              maxLength={60}
              className="flex-1 h-11 rounded-xl px-3 text-sm bg-white/5 border border-glass-border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            />
            <Button type="submit" disabled={locSaving || !newLocName.trim()}>
              {t('common.add')}
            </Button>
          </form>

          {locError && (
            <p className="text-sm text-red-300">{locError}</p>
          )}

          {locations.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-6">{t('inventory.noLocationsYet')}</p>
          ) : (
            <ul className="space-y-2">
              {locations.map((loc) => {
                const count = items.filter((i) => i.location_id === loc.id).length
                return (
                  <li
                    key={loc.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-white/5 border border-glass-border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-4 w-4 text-brand-orange shrink-0" />
                      <span className="font-medium truncate">{loc.name}</span>
                      <span className="text-xs text-white/40 shrink-0">
                        {t(`inventory.items_${count === 1 ? 'one' : 'other'}`, { count })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLocation(loc.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                      aria-label={`Delete ${loc.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Drawer>

      <InventoryMovementsDrawer
        item={viewingHistory}
        onClose={() => setViewingHistory(null)}
      />

      <InventoryQRDrawer
        item={viewingQR}
        onClose={() => setViewingQR(null)}
      />
    </div>
  )
}
