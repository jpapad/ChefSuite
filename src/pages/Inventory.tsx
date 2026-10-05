import { useEffect, useMemo, useState } from 'react'
import { Plus, Package, Search, AlertTriangle, MapPin, Trash2, Settings2, ShoppingCart, Copy, Check, Zap, Clock, ScanLine, PackagePlus, CalendarClock, FileSpreadsheet, ClipboardList, ClipboardCheck } from 'lucide-react'
import { ReceivingScanner } from '../components/inventory/ReceivingScanner'
import { StockCountView } from '../components/inventory/StockCountView'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { Page, PageHeader, PillButton, ActionMenu, StatRow, StatTile, Segmented, SearchField, Chip, ChipRow, Panel, EmptyState, Notice } from '../components/ui/page'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { InventoryList } from '../components/inventory/InventoryList'
import { InventoryMovementsDrawer } from '../components/inventory/InventoryMovementsDrawer'
import { InventoryQRDrawer } from '../components/inventory/InventoryQRDrawer'
import { IngredientSuppliersDrawer } from '../components/inventory/IngredientSuppliersDrawer'
import { OrderingChecklist } from '../components/inventory/OrderingChecklist'
import { ExcelImportWizard } from '../components/inventory/ExcelImportWizard'
import { OrderWatchlistDrawer } from '../components/inventory/OrderWatchlistDrawer'
import { useOrderWatchlist } from '../hooks/useOrderWatchlist'
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
  const { profile } = useAuth()
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
  const [view, setView] = useState<'stock' | 'reorder' | 'checklist'>('stock')
  const [orderCopied, setOrderCopied] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState<string | null>(null)
  const [forecast, setForecast] = useState<ForecastItem[]>([])
  const [scanMode, setScanMode] = useState<'check' | 'receive' | null>(null)
  const [viewingSuppliers, setViewingSuppliers] = useState<InventoryItem | null>(null)
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [countMode, setCountMode] = useState(false)
  const { total: watchlistTotal } = useOrderWatchlist()

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

  async function handleCountSave(counts: Record<string, number>) {
    const changed = items.filter((i) => counts[i.id] !== undefined && counts[i.id] !== i.quantity)
    await Promise.all(changed.map((item) => update(item.id, { quantity: counts[item.id] }, 'count')))
    setCountMode(false)
  }

  // Full-screen stock count mode
  if (countMode) {
    return (
      <StockCountView
        items={items}
        locations={locations}
        teamId={profile?.team_id ?? null}
        onSave={handleCountSave}
        onExit={() => setCountMode(false)}
      />
    )
  }

  const stockValue = items.reduce((sum, i) => sum + (i.cost_per_unit ?? 0) * Math.max(0, i.quantity), 0)
  const urgent = forecast.filter((f) => f.daysLeft <= 3).length

  return (
    <Page>
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        actions={
          <>
            <ActionMenu
              label={t('inventory.v2.scan')}
              icon={ScanLine}
              actions={[
                { label: t('inventory.scanReceive'), hint: t('inventory.v2.receiveHint'), icon: PackagePlus, onClick: () => setScanMode('receive') },
                { label: t('inventory.scanCheck'), hint: t('inventory.v2.checkHint'), icon: ScanLine, onClick: () => setScanMode('check') },
              ]}
            />
            <ActionMenu
              label={t('inventory.v2.tools')}
              icon={Settings2}
              actions={[
                { label: t('inventory.v2.count'), hint: t('inventory.v2.countHint'), icon: ClipboardCheck, onClick: () => setCountMode(true) },
                { label: `Watchlist${watchlistTotal > 0 ? ` (${watchlistTotal})` : ''}`, hint: t('inventory.v2.watchlistHint'), icon: ClipboardList, onClick: () => setShowWatchlist(true) },
                { label: t('inventory.v2.importExcel'), icon: FileSpreadsheet, onClick: () => setShowImportWizard(true) },
                { label: t('inventory.locations'), icon: MapPin, onClick: () => setLocDrawerOpen(true) },
              ]}
            />
            <PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('inventory.addItem')}</PillButton>
          </>
        }
      />

      {error && <Notice>{error}</Notice>}

      {items.length > 0 && (
        <StatRow>
          <StatTile tone="ink" label={t('inventory.v2.items')} value={items.length} hint={t('inventory.v2.locationsCount', { count: locations.length })} />
          <StatTile
            label={t('inventory.v2.low')}
            value={lowCount}
            tone={lowCount ? 'warn' : 'good'}
            hint={lowCount ? t('inventory.v2.lowHint') : t('home.lowStockNone')}
            onClick={() => { setView('stock'); setOnlyLow((v) => !v) }}
          />
          <StatTile label={t('inventory.v2.value')} value={`€${stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} hint={t('inventory.v2.valueHint')} />
          <StatTile tone="lime" label={t('inventory.v2.urgent')} value={urgent} hint={t('inventory.v2.urgentHint')} onClick={lowStockItems.length ? () => setView('reorder') : undefined} />
        </StatRow>
      )}

      {items.length > 0 && (
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'stock', label: t('inventory.v2.stock'), icon: Package },
            { value: 'reorder', label: t('inventory.reorder.button', { count: lowStockItems.length }), icon: ShoppingCart },
            { value: 'checklist', label: t('inventory.v2.daily'), icon: CalendarClock },
          ]}
        />
      )}

      {/* ── Daily ordering checklist ── */}
      {view === 'checklist' && (
        <Panel title={t('inventory.v2.daily')} actions={<span className="text-sm text-white/55">{t('inventory.v2.dailyHint')}</span>}>
          <OrderingChecklist />
        </Panel>
      )}

      {/* ── Reorder ── */}
      {view === 'reorder' && (
        <Panel
          title={t('inventory.reorder.title')}
          actions={
            <PillButton icon={orderCopied ? Check : Copy} onClick={() => void copyReorderList()}>
              {orderCopied ? t('inventory.reorder.copied') : t('inventory.reorder.copyList')}
            </PillButton>
          }
        >
          <p className="-mt-2 text-sm text-white/55">{t('inventory.reorder.subtitle', { count: lowStockItems.length })}</p>
          {reorderBySupplier.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/55">{t('home.lowStockNone')}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {reorderBySupplier.map((group) => {
                const supplierId = suppliers.find((s) => s.name === group.supplierName)?.id ?? '__none__'
                return (
                  <div key={group.supplierName} className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{group.supplierName}</p>
                      <button
                        type="button"
                        disabled={!!creatingOrder}
                        onClick={() => void createAutoOrder(supplierId, group.supplierName, group.items)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-1.5 text-xs font-medium text-on-accent disabled:opacity-50"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {creatingOrder === supplierId ? t('common.saving') : t('inventory.autoOrder')}
                      </button>
                    </div>
                    <ul className="divide-y divide-white/[0.06]">
                      {group.items.map((item) => {
                        const needed = Math.max(0, item.min_stock_level - item.quantity)
                        return (
                          <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                            <span className="flex-1 truncate font-medium">{item.name}</span>
                            <span className="text-xs text-white/50">{t('inventory.reorder.has', { qty: item.quantity, unit: item.unit })}</span>
                            <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-xs font-medium text-amber-500">
                              {t('inventory.reorder.need', { qty: needed, unit: item.unit })}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ── Stock ── */}
      {view === 'stock' && (
        <div className={cn('grid items-start gap-4', forecast.length > 0 && 'xl:grid-cols-[minmax(0,1fr)_320px]')}>
          <div className="flex min-w-0 flex-col gap-4">
            {items.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <SearchField value={query} onChange={setQuery} placeholder={t('inventory.searchPlaceholder')} className="flex-1 max-w-md" />
                  <Chip active={onlyLow} onClick={() => setOnlyLow((v) => !v)}>
                    <AlertTriangle className="h-4 w-4" />{t('inventory.lowStock', { count: lowCount })}
                  </Chip>
                </div>
                {locations.length > 0 && (
                  <ChipRow>
                    <Chip active={locationFilter === null} onClick={() => setLocationFilter(null)} count={items.length}>{t('recipes.v2.all')}</Chip>
                    {locations.map((loc) => (
                      <Chip key={loc.id} active={locationFilter === loc.id} onClick={() => setLocationFilter(loc.id)} count={items.filter((i) => i.location_id === loc.id).length}>
                        <MapPin className="h-3.5 w-3.5" />{loc.name}
                      </Chip>
                    ))}
                    {unassignedCount > 0 && (
                      <Chip active={locationFilter === '__unassigned__'} onClick={() => setLocationFilter('__unassigned__')} count={unassignedCount}>
                        {t('inventory.v2.unassigned')}
                      </Chip>
                    )}
                  </ChipRow>
                )}
              </div>
            )}

            {loading ? (
              <Panel><p className="text-white/55">{t('inventory.loadingInventory')}</p></Panel>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t('inventory.empty.title')}
                body={t('inventory.empty.description')}
                action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('inventory.empty.cta')}</PillButton>}
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Search} title={t('inventory.noMatch')} />
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
                onSuppliers={setViewingSuppliers}
              />
            )}
          </div>

          {forecast.length > 0 && (
            <Panel title={<span className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" />{t('inventory.forecast.title')}</span>} className="xl:sticky xl:top-24">
              <ul className="flex flex-col gap-2">
                {forecast.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 text-sm">
                    <span className={cn('flex h-8 w-14 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                      f.daysLeft <= 3 ? 'bg-red-500/10 text-red-500'
                      : f.daysLeft <= 7 ? 'bg-amber-500/12 text-amber-500'
                      : 'bg-white/[0.06] text-white/60')}>
                      {f.daysLeft <= 0 ? t('inventory.forecast.now') : `${f.daysLeft}d`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block text-xs text-white/50 tabular-nums">{f.quantity.toFixed(1)} {f.unit} · {f.avgDaily.toFixed(1)}/day</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
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

      <OrderWatchlistDrawer
        open={showWatchlist}
        onClose={() => setShowWatchlist(false)}
        inventoryItems={items}
        suppliers={suppliers}
      />

      <Drawer
        open={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        title="Import από Excel"
      >
        <ExcelImportWizard onClose={() => setShowImportWizard(false)} />
      </Drawer>

      {viewingSuppliers && (
        <IngredientSuppliersDrawer
          open={viewingSuppliers != null}
          onClose={() => setViewingSuppliers(null)}
          item={viewingSuppliers}
          allSuppliers={suppliers}
        />
      )}

      <InventoryMovementsDrawer
        item={viewingHistory}
        onClose={() => setViewingHistory(null)}
      />

      <InventoryQRDrawer
        item={viewingQR}
        onClose={() => setViewingQR(null)}
      />
    </Page>
  )
}
