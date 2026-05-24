import { useMemo } from 'react'
import { AlertTriangle, Clock, CalendarClock, CheckCircle2, Package } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useInventory } from '../../hooks/useInventory'
import { useSuppliers } from '../../hooks/useSuppliers'
import { useIngredientSuppliers } from '../../hooks/useIngredientSuppliers'
import { getOrderingChecklist, DAY_LABELS } from '../../lib/smartInventory'
import type { OrderUrgency, SupplierOrderSlot } from '../../lib/smartInventory'

// ── Urgency config ─────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<
  OrderUrgency,
  { label: string; icon: React.ElementType; bg: string; border: string; badge: string; text: string }
> = {
  overdue: {
    label: 'Εκπρόθεσμη',
    icon: AlertTriangle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    badge: 'bg-red-500/20 text-red-400 border border-red-500/30',
    text: 'text-red-400',
  },
  today: {
    label: 'Σήμερα',
    icon: Clock,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    text: 'text-amber-400',
  },
  tomorrow: {
    label: 'Αύριο',
    icon: CalendarClock,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    text: 'text-blue-400',
  },
  later: {
    label: 'Αργότερα',
    icon: CalendarClock,
    bg: 'bg-white/[0.03]',
    border: 'border-white/10',
    badge: 'bg-white/10 text-white/50 border border-white/10',
    text: 'text-white/50',
  },
}

// ── Supplier card ──────────────────────────────────────────────────────────────

function SupplierOrderCard({ slot }: { slot: SupplierOrderSlot }) {
  const cfg = URGENCY_CONFIG[slot.urgency]
  const Icon = cfg.icon

  return (
    <div className={cn('rounded-xl border p-4 space-y-3 transition-colors', cfg.bg, cfg.border)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', cfg.bg)}>
          <Icon className={cn('h-4 w-4', cfg.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{slot.supplier.name}</span>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', cfg.badge)}>
              {cfg.label}
            </span>
            {slot.cutoffPassed && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-600/30 text-red-300 border border-red-500/30">
                Cutoff παρήλθε
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40 flex-wrap">
            {slot.nextDeliveryDay && (
              <span>Παράδοση: <span className="text-white/60">{DAY_LABELS[slot.nextDeliveryDay]}</span></span>
            )}
            {slot.daysUntilDelivery != null && (
              <span>σε {slot.daysUntilDelivery} {slot.daysUntilDelivery === 1 ? 'ημέρα' : 'ημέρες'}</span>
            )}
            {slot.orderDeadlineDate && (
              <span>Deadline: <span className="text-white/60">{slot.orderDeadlineDate}</span></span>
            )}
            {slot.supplier.order_cutoff_time && (
              <span>έως {slot.supplier.order_cutoff_time.slice(0, 5)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Low-stock items */}
      <div className="space-y-1.5 pl-11">
        {slot.lowStockItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Package className="h-3 w-3 text-white/30 shrink-0" />
            <span className="text-sm text-white/80 flex-1 truncate">{item.name}</span>
            <span className="text-xs text-white/40 shrink-0">
              {item.quantity} / {item.min_stock_level} {item.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OrderingChecklist() {
  const { items, loading: itemsLoading } = useInventory()
  const { suppliers, loading: suppliersLoading } = useSuppliers()
  const { links, loading: linksLoading } = useIngredientSuppliers()

  const loading = itemsLoading || suppliersLoading || linksLoading

  const checklist = useMemo(
    () => (loading ? [] : getOrderingChecklist(suppliers, items, links)),
    [loading, suppliers, items, links],
  )

  const urgentCount = checklist.filter((s) => s.urgency === 'overdue' || s.urgency === 'today').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-white/40">Φόρτωση checklist…</span>
      </div>
    )
  }

  if (checklist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <p className="font-semibold text-white">Δεν υπάρχουν εκκρεμείς παραγγελίες</p>
        <p className="text-sm text-white/40 max-w-xs">
          Όλα τα αποθέματα βρίσκονται πάνω από το ελάχιστο επίπεδο, ή δεν έχουν ρυθμιστεί προμηθευτές.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm font-semibold text-red-300">
            {urgentCount} {urgentCount === 1 ? 'παραγγελία απαιτεί' : 'παραγγελίες απαιτούν'} άμεση ενέργεια σήμερα
          </p>
        </div>
      )}

      {/* Grouped by urgency */}
      {(['overdue', 'today', 'tomorrow', 'later'] as OrderUrgency[]).map((urgency) => {
        const group = checklist.filter((s) => s.urgency === urgency)
        if (group.length === 0) return null
        const cfg = URGENCY_CONFIG[urgency]
        return (
          <div key={urgency} className="space-y-2">
            <p className={cn('text-[11px] font-bold uppercase tracking-widest', cfg.text)}>
              {cfg.label} · {group.length}
            </p>
            {group.map((slot) => (
              <SupplierOrderCard key={slot.supplier.id} slot={slot} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
