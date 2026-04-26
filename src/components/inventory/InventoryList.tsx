import { Pencil, Trash2, AlertTriangle, PackagePlus, History, QrCode, MapPin, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../ui/GlassCard'
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
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function InventoryList({ items, locationMap, onEdit, onDelete, onRestock, onHistory, onQR, onPrint }: InventoryListProps) {
  const { t } = useTranslation()
  const trNames = useAutoTranslateMany(items.map((i) => i.name))

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="hidden md:grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto] gap-4 px-5 py-3 text-xs uppercase tracking-wide text-white/50 border-b border-glass-border">
        <span>{t('inventory.list.colItem')}</span>
        <span>{t('inventory.list.colUnit')}</span>
        <span>{t('inventory.list.colOnHand')}</span>
        <span>{t('inventory.list.colReorder')}</span>
        <span className="text-right">{t('inventory.list.colActions')}</span>
      </div>

      <ul className="divide-y divide-glass-border">
        {items.map((item, idx) => {
          const low = isLowStock(item)
          const displayName = trNames[idx] ?? item.name
          return (
            <li
              key={item.id}
              className={cn(
                'grid gap-2 md:gap-4 px-5 py-4 items-center',
                'md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_auto]',
                low && 'bg-amber-500/5',
              )}
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  {low && (
                    <AlertTriangle
                      className="h-5 w-5 text-amber-400 shrink-0"
                      aria-label={t('inventory.lowStock', { count: 0 }).replace(' (0)', '')}
                    />
                  )}
                  <span className="font-medium truncate">{displayName}</span>
                </div>
                {locationMap && item.location_id && locationMap.has(item.location_id) && (
                  <span className="flex items-center gap-1 text-xs text-white/40 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {locationMap.get(item.location_id)}
                  </span>
                )}
              </div>
              <div className="text-white/70">
                <span className="md:hidden text-xs text-white/50 mr-2">Unit:</span>
                {item.unit}
              </div>
              <div className={cn(low ? 'text-amber-300' : 'text-white')}>
                <span className="md:hidden text-xs text-white/50 mr-2">
                  On hand:
                </span>
                {formatQty(item.quantity)} {item.unit}
              </div>
              <div className="text-white/70">
                <span className="md:hidden text-xs text-white/50 mr-2">
                  Reorder:
                </span>
                {formatQty(item.min_stock_level)} {item.unit}
              </div>
              <div className="flex justify-start md:justify-end gap-1 pt-2 md:pt-0">
                {low && (
                  <button
                    type="button"
                    onClick={() => onRestock(item)}
                    aria-label={`Restock ${item.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-amber-400 hover:text-white hover:bg-amber-500/20"
                    title="Restock"
                  >
                    <PackagePlus className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onQR(item)}
                  aria-label={`QR code for ${item.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5"
                  title="QR code"
                >
                  <QrCode className="h-5 w-5" />
                </button>
                {onPrint && (
                  <button
                    type="button"
                    onClick={() => onPrint(item)}
                    aria-label={`Print label for ${item.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5"
                    title="Print label"
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onHistory(item)}
                  aria-label={`View history for ${item.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5"
                  title="Movement history"
                >
                  <History className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  aria-label={`Edit ${item.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5"
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  aria-label={`Delete ${item.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </GlassCard>
  )
}
