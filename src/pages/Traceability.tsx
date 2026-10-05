import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ScanLine, Plus, AlertTriangle, CalendarClock, PackageCheck, ShieldAlert, Search, Printer,
  Trash2, Undo2, ListChecks, History, Loader2,
} from 'lucide-react'
import {
  Page, PageHeader, PillButton, StatRow, StatTile, Panel, Segmented, EmptyState, Notice, SearchField,
} from '../components/ui/page'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useInventory } from '../hooks/useInventory'
import { useSuppliers } from '../hooks/useSuppliers'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { useRecipes } from '../hooks/useRecipes'
import { lotDaysLeft, useLots, type LotDraft } from '../hooks/useLots'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { InventoryLot, LotUsage, PurchaseOrderItem } from '../types/database.types'

const SOON_DAYS = 3

function fmtDate(d: string | null) {
  return d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

function qty(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

type View = 'active' | 'recall' | 'history'

export default function Traceability() {
  const { t } = useTranslation()
  const { items: inventory, update: updateInv } = useInventory()
  const { suppliers } = useSuppliers()
  const { orders } = usePurchaseOrders()
  const { recipes } = useRecipes()
  const { lots, loading, error, receive, setStatus, recall, usageFor } = useLots()

  const [view, setView] = useState<View>('active')
  const [query, setQuery] = useState('')
  const [selectedLot, setSelectedLot] = useState<InventoryLot | null>(null)
  const [usage, setUsage] = useState<LotUsage[] | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  const itemOf = (id: string) => inventory.find((i) => i.id === id)
  const supplierName = (id: string | null) => (id && suppliers.find((s) => s.id === id)?.name) || '—'

  const active = lots.filter((l) => l.status === 'active')
  const expired = active.filter((l) => (lotDaysLeft(l.expires_on) ?? 1) < 0)
  const soon = active.filter((l) => { const d = lotDaysLeft(l.expires_on); return d != null && d >= 0 && d <= SOON_DAYS })
  const recalled = lots.filter((l) => l.status === 'recalled')

  const activeSorted = [...active].sort((a, b) => (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999'))
  const q = query.trim().toLowerCase()
  const matches = (l: InventoryLot) => !q || (l.lot_number ?? '').toLowerCase().includes(q) || (itemOf(l.inventory_item_id)?.name ?? '').toLowerCase().includes(q)

  async function selectLot(lot: InventoryLot) {
    setSelectedLot(lot)
    setUsage(null)
    setUsageLoading(true)
    try { setUsage(await usageFor([lot.id])) } finally { setUsageLoading(false) }
  }

  // Recall report: dishes made with the selected lot
  const usageByRecipe = useMemo(() => {
    const map = new Map<string, { recipeId: string | null; qty: number; portions: number; first: string; last: string; times: number }>()
    for (const u of usage ?? []) {
      const key = u.recipe_id ?? '_'
      const e = map.get(key) ?? { recipeId: u.recipe_id, qty: 0, portions: 0, first: u.used_at, last: u.used_at, times: 0 }
      e.qty += u.quantity; e.portions += u.portions ?? 0; e.times += 1
      if (u.used_at < e.first) e.first = u.used_at
      if (u.used_at > e.last) e.last = u.used_at
      map.set(key, e)
    }
    return [...map.values()].sort((a, b) => b.last.localeCompare(a.last))
  }, [usage])

  async function doRecall(lot: InventoryLot) {
    if (!window.confirm(t('lots.recallConfirm', { lot: lot.lot_number ?? '—', item: itemOf(lot.inventory_item_id)?.name ?? '' }))) return
    await recall(lot.id, true)
    setSelectedLot((s) => s && s.id === lot.id ? { ...s, status: 'recalled', quantity_remaining: 0 } : s)
  }

  function ExpiryPill({ lot }: { lot: InventoryLot }) {
    const d = lotDaysLeft(lot.expires_on)
    if (lot.status !== 'active') {
      return <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', lot.status === 'recalled' ? 'bg-red-500/10 text-red-500' : 'bg-white/[0.06] text-white/55')}>{t(`lots.status.${lot.status}`)}</span>
    }
    if (d == null) return <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/55">{t('lots.noExpiry')}</span>
    const tone = d < 0 ? 'bg-red-500/10 text-red-500' : d <= SOON_DAYS ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
    const label = d < 0 ? t('lots.expiredAgo', { count: -d }) : d === 0 ? t('lots.today') : d <= SOON_DAYS ? t('lots.inDays', { count: d }) : fmtDate(lot.expires_on)
    return <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium tabular-nums', tone)}>{label}</span>
  }

  function LotRow({ lot, onClick }: { lot: InventoryLot; onClick?: () => void }) {
    const item = itemOf(lot.inventory_item_id)
    const pct = lot.quantity_received > 0 ? (lot.quantity_remaining / lot.quantity_received) * 100 : 0
    return (
      <li>
        <button type="button" onClick={onClick}
          className={cn('grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]',
            onClick && 'hover:bg-white/[0.03]', selectedLot?.id === lot.id && 'bg-white/[0.04]')}>
          <span className="min-w-0">
            <span className="block truncate font-medium">{item?.name ?? '—'}</span>
            <span className="block truncate text-xs text-white/50">
              {t('lots.lot')} <span className="font-mono">{lot.lot_number || '—'}</span> · {supplierName(lot.supplier_id)}
            </span>
          </span>
          <span className="hidden text-sm text-white/60 sm:block">{fmtDate(lot.received_at)}</span>
          <span className="hidden flex-col gap-1 sm:flex">
            <span className="text-sm tabular-nums">{qty(lot.quantity_remaining)} / {qty(lot.quantity_received)} {item?.unit}</span>
            <span className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-bg-input">
              <span className="block h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
            </span>
          </span>
          <ExpiryPill lot={lot} />
        </button>
      </li>
    )
  }

  // ── Receive drawer ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode, setMode] = useState<'manual' | 'po'>('manual')
  const [manual, setManual] = useState({ inventory_item_id: '', quantity: '', lot_number: '', expires_on: '', supplier_id: '', addStock: true })
  const [poId, setPoId] = useState('')
  const [poLines, setPoLines] = useState<(PurchaseOrderItem & { lot_number: string; expires_on: string; take: string })[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const recentOrders = orders.filter((o) => o.status === 'sent' || o.status === 'received').slice(0, 30)
  const selectedPo = orders.find((o) => o.id === poId)

  async function pickPo(id: string) {
    setPoId(id)
    setPoLines([])
    if (!id) return
    const { data } = await supabase.from('purchase_order_items').select('*').eq('order_id', id)
    setPoLines(((data ?? []) as PurchaseOrderItem[])
      .filter((r) => r.inventory_item_id)
      .map((r) => ({ ...r, lot_number: '', expires_on: '', take: String(r.quantity) })))
  }

  function openReceive() {
    setManual({ inventory_item_id: '', quantity: '', lot_number: '', expires_on: '', supplier_id: '', addStock: true })
    setPoId(''); setPoLines([]); setFormError(null); setMode('manual'); setDrawerOpen(true)
  }

  async function onReceive(e: FormEvent) {
    e.preventDefault()
    setSaving(true); setFormError(null)
    try {
      if (mode === 'manual') {
        const q = Number(manual.quantity)
        if (!manual.inventory_item_id || !(q > 0)) throw new Error(t('lots.needItemQty'))
        await receive([{
          inventory_item_id: manual.inventory_item_id, quantity: q,
          lot_number: manual.lot_number.trim() || null, expires_on: manual.expires_on || null,
          supplier_id: manual.supplier_id || itemOf(manual.inventory_item_id)?.supplier_id || null,
          purchase_order_id: null, notes: null,
        }])
        const item = itemOf(manual.inventory_item_id)
        if (manual.addStock && item) await updateInv(item.id, { quantity: item.quantity + q }, 'receiving')
      } else {
        const drafts: LotDraft[] = poLines.map((l) => ({
          inventory_item_id: l.inventory_item_id!, quantity: Number(l.take) || 0,
          lot_number: l.lot_number.trim() || null, expires_on: l.expires_on || null,
          supplier_id: selectedPo?.supplier_id ?? null, purchase_order_id: poId, notes: null,
        }))
        await receive(drafts)
        // A PO already marked "received" has added its stock — only add for "sent" ones
        if (selectedPo?.status === 'sent') {
          for (const d of drafts) {
            const item = itemOf(d.inventory_item_id)
            if (item && d.quantity > 0) await updateInv(item.id, { quantity: item.quantity + d.quantity }, 'receiving')
          }
        }
      }
      setDrawerOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.saveFailed'))
    } finally { setSaving(false) }
  }

  const selectCls = 'h-12 w-full rounded-xl border border-inv-border bg-bg-input px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-orange/40'

  return (
    <Page>
      <PageHeader
        title={t('lots.title')}
        subtitle={t('lots.subtitle')}
        actions={<PillButton variant="primary" icon={Plus} onClick={openReceive}>{t('lots.receive')}</PillButton>}
      />

      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile label={t('lots.stat.active')} value={active.length} icon={PackageCheck} tone="ink" />
        <StatTile label={t('lots.stat.soon')} value={soon.length} icon={CalendarClock} tone={soon.length ? 'warn' : 'default'} hint={t('lots.stat.soonHint', { count: SOON_DAYS })} />
        <StatTile label={t('lots.stat.expired')} value={expired.length} icon={AlertTriangle} tone={expired.length ? 'bad' : 'default'} hint={t('lots.stat.expiredHint')} />
        <StatTile label={t('lots.stat.recalled')} value={recalled.length} icon={ShieldAlert} />
      </StatRow>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={view} onChange={(v) => { setView(v); setSelectedLot(null) }} options={[
          { value: 'active', label: t('lots.view.active'), icon: ListChecks },
          { value: 'recall', label: t('lots.view.recall'), icon: ShieldAlert },
          { value: 'history', label: t('lots.view.history'), icon: History },
        ]} />
        {view !== 'active' && <SearchField value={query} onChange={setQuery} placeholder={t('lots.searchPlaceholder')} className="w-full sm:w-80" />}
      </div>

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : lots.length === 0 ? (
        <EmptyState icon={ScanLine} title={t('lots.empty')} body={t('lots.emptyHint')}
          action={<PillButton variant="primary" icon={Plus} onClick={openReceive}>{t('lots.receive')}</PillButton>} />
      ) : view === 'active' ? (
        <Panel padded={false}>
          {expired.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-red-500/[0.06] px-5 py-3">
              <span className="text-sm font-medium text-red-500">{t('lots.expiredBanner', { count: expired.length })}</span>
              <button type="button" onClick={() => { if (window.confirm(t('lots.discardAllConfirm'))) void Promise.all(expired.map((l) => setStatus(l.id, 'discarded'))) }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-bg-card px-3.5 text-sm font-medium shadow-card">
                <Trash2 className="h-4 w-4" />{t('lots.discardExpired')}
              </button>
            </div>
          )}
          <ul className="divide-y divide-white/[0.06]">
            {activeSorted.map((l) => <LotRow key={l.id} lot={l} />)}
          </ul>
        </Panel>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Panel padded={false}>
            <ul className="divide-y divide-white/[0.06]">
              {(view === 'recall' ? lots.filter((l) => l.status !== 'discarded') : lots).filter(matches).slice(0, 200)
                .map((l) => <LotRow key={l.id} lot={l} onClick={() => void selectLot(l)} />)}
            </ul>
          </Panel>

          {selectedLot ? (
            <section className="flex flex-col gap-4 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-24 print:shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-white/55">{t('lots.lot')} <span className="font-mono">{selectedLot.lot_number || '—'}</span></p>
                  <h2 className="text-2xl font-medium tracking-[-0.02em]">{itemOf(selectedLot.inventory_item_id)?.name ?? '—'}</h2>
                  <p className="mt-1 text-sm text-white/55">
                    {supplierName(selectedLot.supplier_id)} · {t('lots.received')} {fmtDate(selectedLot.received_at)} · {t('lots.expires')} {fmtDate(selectedLot.expires_on)}
                  </p>
                </div>
                <ExpiryPill lot={selectedLot} />
              </div>

              <div className="flex flex-wrap gap-2 print:hidden">
                {selectedLot.status !== 'recalled' && (
                  <PillButton variant="danger" icon={ShieldAlert} onClick={() => void doRecall(selectedLot)}>{t('lots.recall')}</PillButton>
                )}
                {selectedLot.status === 'recalled' && (
                  <PillButton icon={Undo2} onClick={() => void setStatus(selectedLot.id, 'active').then(() => setSelectedLot({ ...selectedLot, status: 'active' }))}>{t('lots.undoRecall')}</PillButton>
                )}
                <PillButton icon={Printer} onClick={() => window.print()}>{t('lots.printReport')}</PillButton>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-white/60">{t('lots.usedIn')}</h3>
                {usageLoading ? (
                  <p className="flex items-center gap-2 text-sm text-white/55"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</p>
                ) : usageByRecipe.length === 0 ? (
                  <p className="rounded-2xl bg-bg-input px-4 py-3 text-sm text-white/55">{t('lots.notUsed')}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {usageByRecipe.map((u) => (
                      <li key={u.recipeId ?? '_'} className="flex items-center justify-between gap-3 rounded-2xl bg-bg-input px-4 py-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{recipes.find((r) => r.id === u.recipeId)?.title ?? t('common.unknown')}</span>
                          <span className="block text-xs text-white/50">
                            {fmtDate(u.first)}{u.first.slice(0, 10) !== u.last.slice(0, 10) ? ` – ${fmtDate(u.last)}` : ''} · {t('lots.times', { count: u.times })}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm tabular-nums">
                          <span className="block font-medium">{qty(u.portions)} {t('lots.portions')}</span>
                          <span className="block text-xs text-white/50">{qty(u.qty)} {itemOf(selectedLot.inventory_item_id)?.unit}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : (
            <section className="hidden flex-col items-center gap-3 rounded-3xl bg-bg-card p-10 text-center shadow-card lg:flex">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-ink"><Search className="h-5 w-5" /></span>
              <p className="max-w-xs text-sm text-white/55">{t('lots.pickHint')}</p>
            </section>
          )}
        </div>
      )}

      <Drawer open={drawerOpen} onClose={() => !saving && setDrawerOpen(false)} title={t('lots.receive')}>
        <form onSubmit={(e) => void onReceive(e)} className="flex flex-col gap-5">
          <Segmented value={mode} onChange={setMode} options={[
            { value: 'manual', label: t('lots.mode.manual') },
            { value: 'po', label: t('lots.mode.po') },
          ]} />

          {mode === 'manual' ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-white/80">{t('lots.item')}</span>
                <select className={selectCls} value={manual.inventory_item_id}
                  onChange={(e) => setManual((m) => ({ ...m, inventory_item_id: e.target.value }))}>
                  <option value="">{t('lots.pickItem')}</option>
                  {[...inventory].sort((a, b) => a.name.localeCompare(b.name)).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" step="0.001" min={0} name="quantity" label={t('lots.quantity')} value={manual.quantity}
                  onChange={(e) => setManual((m) => ({ ...m, quantity: e.target.value }))} />
                <Input name="lot_number" label={t('lots.lotNumber')} value={manual.lot_number}
                  onChange={(e) => setManual((m) => ({ ...m, lot_number: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" name="expires_on" label={t('lots.expires')} value={manual.expires_on}
                  onChange={(e) => setManual((m) => ({ ...m, expires_on: e.target.value }))} />
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-white/80">{t('lots.supplier')}</span>
                  <select className={selectCls} value={manual.supplier_id} onChange={(e) => setManual((m) => ({ ...m, supplier_id: e.target.value }))}>
                    <option value="">—</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-3 rounded-2xl bg-bg-input px-4 py-3 text-sm">
                <input type="checkbox" checked={manual.addStock} onChange={(e) => setManual((m) => ({ ...m, addStock: e.target.checked }))} className="h-4 w-4 accent-[#0F1210]" />
                {t('lots.addStock')}
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-white/80">{t('lots.order')}</span>
                <select className={selectCls} value={poId} onChange={(e) => void pickPo(e.target.value)}>
                  <option value="">{t('lots.pickOrder')}</option>
                  {recentOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.supplier_name ?? '—'} · {fmtDate(o.ordered_at ?? o.created_at)} · {t(`purchaseOrders.status.${o.status}`)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedPo && (
                <p className="text-xs text-white/50">{selectedPo.status === 'received' ? t('lots.poReceivedHint') : t('lots.poSentHint')}</p>
              )}
              {poLines.map((l, idx) => (
                <div key={l.id} className="flex flex-col gap-2 rounded-2xl bg-bg-input p-3">
                  <p className="text-sm font-medium">{l.name} <span className="font-normal text-white/50">· {qty(l.quantity)} {l.unit}</span></p>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={l.take} type="number" step="0.001" min={0} aria-label={t('lots.quantity')}
                      onChange={(e) => setPoLines((ls) => ls.map((x, i) => i === idx ? { ...x, take: e.target.value } : x))}
                      className="h-10 rounded-xl bg-bg-card px-3 text-sm tabular-nums outline-none" />
                    <input value={l.lot_number} placeholder={t('lots.lotNumber')}
                      onChange={(e) => setPoLines((ls) => ls.map((x, i) => i === idx ? { ...x, lot_number: e.target.value } : x))}
                      className="h-10 rounded-xl bg-bg-card px-3 text-sm outline-none placeholder:text-white/35" />
                    <input value={l.expires_on} type="date" aria-label={t('lots.expires')}
                      onChange={(e) => setPoLines((ls) => ls.map((x, i) => i === idx ? { ...x, expires_on: e.target.value } : x))}
                      className="h-10 rounded-xl bg-bg-card px-2 text-sm outline-none" />
                  </div>
                </div>
              ))}
            </>
          )}

          {formError && <Notice>{formError}</Notice>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving || (mode === 'po' && poLines.length === 0)}>{saving ? t('common.saving') : t('lots.save')}</Button>
          </div>
        </form>
      </Drawer>
    </Page>
  )
}
