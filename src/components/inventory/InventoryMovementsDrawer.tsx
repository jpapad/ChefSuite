import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { useInventoryMovements } from '../../hooks/useInventoryMovements'
import type { InventoryItem } from '../../types/database.types'

interface Props {
  item: InventoryItem | null
  onClose: () => void
}

function reasonLabel(reason: string): string {
  if (reason === 'restock') return 'Restock'
  if (reason === 'manual') return 'Manual edit'
  if (reason.startsWith('recipe:')) return `Recipe: ${reason.slice(7)}`
  return reason
}

export function InventoryMovementsDrawer({ item, onClose }: Props) {
  const { movements, loading } = useInventoryMovements(item?.id ?? null)

  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      title={item ? `${item.name} — History` : ''}
    >
      {item && (
        <div className="space-y-2">
          {loading ? (
            <p className="text-white/60 py-4 text-center">Loading…</p>
          ) : movements.length === 0 ? (
            <div className="py-10 text-center text-white/50">
              <Minus className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No movements recorded yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-glass-border">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {m.delta > 0 ? (
                      <TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{reasonLabel(m.reason)}</div>
                      <div className="text-xs text-white/50">
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span
                    className={
                      'text-sm font-semibold shrink-0 ' +
                      (m.delta > 0 ? 'text-emerald-400' : 'text-red-400')
                    }
                  >
                    {m.delta > 0 ? '+' : ''}{m.delta} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  )
}
