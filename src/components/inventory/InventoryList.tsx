import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, PackagePlus, History, QrCode, MapPin, Printer, Truck, MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { isLowStock } from '../../hooks/useInventory'
import { useAutoTranslateMany } from '../../hooks/useAutoTranslate'
import type { InventoryItem } from '../../types/database.types'

interface InventoryListProps {
  items: InventoryItem[]
  locationMap?: Map<string, string>
  onEdit: (item: InventoryItem) => void
  onDelete: (item: InventoryItem) => void
  onRestock: (item: InventoryItem) => void
  onHistory: (item: InventoryItem) => void
  onQR: (item: InventoryItem) => void
  onPrint?: (item: InventoryItem) => void
  onSuppliers?: (item: InventoryItem) => void
}

function formatQty(n: number): string {
  const s = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return s.replace('.', ',')
}

/** Below 40% of the minimum is critical; below the minimum is low. */
function levelOf(item: InventoryItem) {
  const min = item.min_stock_level
  if (!isLowStock(item)) return 'ok' as const
  return min > 0 && item.quantity / min < 0.4 ? 'critical' as const : 'low' as const
}

const COLS = 'md:grid-cols-[minmax(0,2.2fr)_0.9fr_0.9fr_1.2fr_1fr_auto]'

interface RowAction { label: string; icon: LucideIcon; onClick: () => void; danger?: boolean }

function RowMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded hover:bg-white/[0.08]"
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={2.4} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-60 rounded bg-bg-card p-1.5 shadow-card">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); a.onClick() }}
              className={cn('flex w-full items-center gap-3 rounded px-3 py-2.5 text-left font-display text-[17px] font-bold',
                a.danger ? 'hover:bg-[#FF3B30] hover:text-white-fixed' : 'hover:bg-signal hover:text-ink')}
            >
              <a.icon className="h-5 w-5 shrink-0" strokeWidth={2.2} />{a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function InventoryList({ items, locationMap, onEdit, onDelete, onRestock, onHistory, onQR, onPrint, onSuppliers }: InventoryListProps) {
  const { t } = useTranslation()
  // Skip auto-translation for large lists to avoid 300+ concurrent API calls
  const trNames = useAutoTranslateMany(items.length <= 50 ? items.map((i) => i.name) : [])

  return (
    // No overflow-hidden here: the row menus must be able to open past the edge.
    <div className="rounded bg-bg-card shadow-card">
      <div className={cn('sb-label hidden min-h-[48px] items-center gap-4 border-b-2 border-inv-border px-5 text-white/60 md:grid', COLS)}>
        <span>{t('inventory.list.colItem')}</span>
        <span className="text-right">{t('inventory.list.colOnHand')}</span>
        <span className="text-right">{t('inventory.list.colReorder')}</span>
        <span>{t('station.colLevel')}</span>
        <span>{t('station.colStatus')}</span>
        <span className="w-[176px] text-right">{t('inventory.list.colActions')}</span>
      </div>

      <ul>
        {items.map((item, idx) => {
          const level = levelOf(item)
          const low = level !== 'ok'
          const displayName = trNames.length > 0 ? (trNames[idx] ?? item.name) : item.name
          // Bar runs to twice the minimum (≈ par); the tick marks the minimum.
          const fill = item.min_stock_level > 0 ? Math.min(100, (item.quantity / (item.min_stock_level * 2)) * 100) : 100
          const actions: RowAction[] = [
            { label: t('station.qrCode'), icon: QrCode, onClick: () => onQR(item) },
            ...(onPrint ? [{ label: t('station.printLabel'), icon: Printer, onClick: () => onPrint(item) }] : []),
            { label: t('station.history'), icon: History, onClick: () => onHistory(item) },
            ...(onSuppliers ? [{ label: t('station.suppliers'), icon: Truck, onClick: () => onSuppliers(item) }] : []),
            { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(item) },
            { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(item), danger: true },
          ]
          return (
            <li
              key={item.id}
              className={cn('grid items-center gap-x-4 gap-y-2 border-b border-glass-border px-5 py-3.5 last:border-b-0', COLS, low && 'bg-signal/[0.06]')}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-display text-[22px] font-extrabold leading-tight">{displayName}</span>
                {locationMap && item.location_id && locationMap.has(item.location_id) && (
                  <span className="sb-label mt-0.5 flex items-center gap-1 text-white/60">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {locationMap.get(item.location_id)}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-2 md:justify-end">
                <span className="sb-label text-white/60 md:hidden">{t('inventory.list.colOnHand')}</span>
                <span className="font-mono text-[22px] font-bold tabular-nums">
                  {formatQty(item.quantity)} <span className="text-[14px] font-medium">{item.unit}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 md:justify-end">
                <span className="sb-label text-white/60 md:hidden">{t('inventory.list.colReorder')}</span>
                <span className="font-mono text-[17px] tabular-nums text-white/70">{formatQty(item.min_stock_level)} {item.unit}</span>
              </div>
              <span className="relative h-3 bg-white/15" aria-hidden="true">
                <span className={cn('absolute inset-y-0 left-0', level === 'critical' ? 'bg-[#DC2626]' : level === 'low' ? 'bg-signal' : 'bg-white')} style={{ width: `${fill}%` }} />
                <b className="absolute -top-1.5 left-1/2 h-6 w-[3px] bg-white" />
              </span>
              <span>
                <span className={cn('sb-label inline-block rounded-sm px-2 py-1.5',
                  level === 'critical' ? 'bg-[#DC2626] text-white-fixed' : level === 'low' ? 'bg-signal text-ink' : 'bg-white/10 text-white')}>
                  {level === 'critical' ? t('station.stCritical') : level === 'low' ? t('station.stLow') : t('station.stOk')}
                </span>
              </span>
              <div className="flex items-center justify-end gap-1.5 md:w-[176px]">
                {low && (
                  <button
                    type="button"
                    onClick={() => onRestock(item)}
                    className="sb-label flex h-11 items-center gap-1.5 rounded bg-brand-orange px-3 text-on-accent hover:bg-brand-orange/85"
                  >
                    <PackagePlus className="h-4 w-4" />{t('station.restock')}
                  </button>
                )}
                <RowMenu label={`${t('station.moreActions')}: ${item.name}`} actions={actions} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
