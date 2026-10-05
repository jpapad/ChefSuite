import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Truck, Sparkles, Loader2 } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Notice } from '../ui/page'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import type { SupplierSuggestion } from '../../lib/autoOrder'
import type { PurchaseOrder, PurchaseOrderInsert } from '../../types/database.types'

interface AutoOrderDrawerProps {
  open: boolean
  onClose: () => void
  suggestions: SupplierSuggestion[]
  createOrder: (payload: Omit<PurchaseOrderInsert, 'team_id'>) => Promise<PurchaseOrder>
  onCreated: (count: number) => void
}

function fmtQty(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

export function AutoOrderDrawer({ open, onClose, suggestions, createOrder, onCreated }: AutoOrderDrawerProps) {
  const { t } = useTranslation()
  // key = item id → quantity (0 / missing = skip)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [skipSuppliers, setSkipSuppliers] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const init: Record<string, string> = {}
    for (const g of suggestions) for (const l of g.lines) init[l.item.id] = fmtQty(l.quantity)
    setQty(init)
    setSkipSuppliers(new Set(suggestions.filter((g) => !g.supplier).map(() => '_none')))
    setError(null)
  }, [open, suggestions])

  const keyOf = (g: SupplierSuggestion) => g.supplier?.id ?? '_none'
  const chosen = suggestions.filter((g) => g.supplier && !skipSuppliers.has(keyOf(g)))

  async function create() {
    setSaving(true); setError(null)
    try {
      let n = 0
      for (const g of chosen) {
        const lines = g.lines.filter((l) => Number(qty[l.item.id]) > 0)
        if (lines.length === 0) continue
        const order = await createOrder({ supplier_id: g.supplier!.id, status: 'draft', notes: t('autoOrder.note'), ordered_at: null })
        const { error: err } = await supabase.from('purchase_order_items').insert(lines.map((l) => ({
          order_id: order.id,
          inventory_item_id: l.item.id,
          name: l.item.name,
          quantity: Number(qty[l.item.id]),
          unit: l.item.unit,
          unit_price: l.item.cost_per_unit,
        })))
        if (err) throw err
        n++
      }
      onCreated(n)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.saveFailed'))
    } finally { setSaving(false) }
  }

  const deliveryLabel = (g: SupplierSuggestion) =>
    g.daysToDelivery == null ? t('autoOrder.noSchedule')
      : g.daysToDelivery === 1 ? t('autoOrder.deliveryTomorrow')
      : t('autoOrder.deliveryIn', { count: g.daysToDelivery })

  return (
    <Drawer open={open} onClose={() => !saving && onClose()} title={t('autoOrder.title')}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-white/55">{t('autoOrder.willCreate', { count: chosen.length })}</span>
          <button type="button" onClick={() => void create()} disabled={saving || chosen.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-medium text-on-accent disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t('autoOrder.create')}
          </button>
        </div>
      }>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-white/60">{t('autoOrder.explain')}</p>
        {error && <Notice>{error}</Notice>}
        {suggestions.length === 0 && <p className="rounded-2xl bg-bg-input px-4 py-6 text-center text-sm text-white/55">{t('autoOrder.nothing')}</p>}
        {suggestions.map((g) => {
          const key = keyOf(g)
          const skipped = skipSuppliers.has(key)
          return (
            <section key={key} className={cn('flex flex-col gap-2 rounded-3xl bg-bg-input p-4', skipped && 'opacity-50')}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-lime"><Truck className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{g.supplier?.name ?? t('autoOrder.noSupplier')}</span>
                  <span className="block text-xs text-white/55">{g.supplier ? deliveryLabel(g) : t('autoOrder.noSupplierHint')} · ≈ €{g.estimatedCost.toFixed(2)}</span>
                </span>
                {g.supplier && (
                  <label className="flex shrink-0 items-center gap-2 text-sm">
                    <input type="checkbox" checked={!skipped} className="h-4 w-4 accent-[#0F1210]"
                      onChange={() => setSkipSuppliers((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })} />
                    {t('autoOrder.include')}
                  </label>
                )}
              </div>
              <ul className="flex flex-col">
                {g.lines.map((l) => (
                  <li key={l.item.id} className="flex items-center gap-3 border-t border-white/[0.06] py-2 first:border-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{l.item.name}</span>
                      <span className="block text-[11px] text-white/50">
                        {t(`autoOrder.reason.${l.reason}`)} · {t('autoOrder.stockLine', { qty: fmtQty(l.item.quantity), min: fmtQty(l.item.min_stock_level), unit: l.item.unit })}
                        {l.avgDaily > 0 && ` · ${t('autoOrder.perDay', { qty: fmtQty(l.avgDaily), unit: l.item.unit })}`}
                      </span>
                    </span>
                    <input type="number" min={0} step="0.5" value={qty[l.item.id] ?? ''} disabled={skipped || !g.supplier}
                      onChange={(e) => setQty((q) => ({ ...q, [l.item.id]: e.target.value }))}
                      className="h-9 w-20 rounded-xl bg-bg-card px-2 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-brand-orange/40" />
                    <span className="w-10 shrink-0 text-xs text-white/50">{l.item.unit}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Drawer>
  )
}
