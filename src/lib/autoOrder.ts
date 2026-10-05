import type { DeliveryDay, IngredientSupplier, InventoryItem, Supplier } from '../types/database.types'
import { DAY_ORDER } from './smartInventory'

// Automatic order suggestions.
// For every item: how much stock do we need to last until the delivery after
// the next one, and how far is that from the par level? Items are grouped by
// their preferred supplier (ingredient_suppliers) or inventory.supplier_id.

export interface SuggestedLine {
  item: InventoryItem
  /** Suggested order quantity, rounded up */
  quantity: number
  avgDaily: number
  target: number
  reason: 'below_min' | 'runs_out' | 'below_par'
}

export interface SupplierSuggestion {
  supplier: Supplier | null
  /** Days until this supplier's next delivery (null = no schedule) */
  daysToDelivery: number | null
  nextDeliveryDay: DeliveryDay | null
  lines: SuggestedLine[]
  estimatedCost: number
}

const DEFAULT_COVER_DAYS = 3

function daysUntil(day: DeliveryDay, from: Date): number {
  let d = DAY_ORDER.indexOf(day) - from.getDay()
  if (d <= 0) d += 7
  return d
}

/** Days to the next delivery and how many days that delivery must cover. */
function schedule(supplier: Supplier | null, now: Date) {
  const days = supplier?.delivery_days ?? []
  if (days.length === 0) return { next: null as DeliveryDay | null, toNext: null as number | null, cover: DEFAULT_COVER_DAYS }
  const sorted = [...days].map((d) => ({ d, n: daysUntil(d, now) })).sort((a, b) => a.n - b.n)
  const first = sorted[0]!
  const second = sorted[1]?.n ?? first.n + 7
  // Stock has to last until the delivery after the next one arrives
  return { next: first.d, toNext: first.n, cover: second }
}

function roundUp(q: number, unit: string) {
  const u = unit.toLowerCase()
  if (['piece', 'pcs', 'τεμ', 'pack', 'box', 'τεμάχιο'].includes(u)) return Math.ceil(q)
  if (q >= 10) return Math.ceil(q)
  return Math.ceil(q * 2) / 2
}

export function buildOrderSuggestions(
  items: InventoryItem[],
  suppliers: Supplier[],
  ingredientSuppliers: IngredientSupplier[],
  avgDailyById: Map<string, number>,
  now: Date = new Date(),
): SupplierSuggestion[] {
  const preferred = new Map<string, string>()
  for (const l of ingredientSuppliers) if (l.is_preferred) preferred.set(l.inventory_item_id, l.supplier_id)
  const supplierById = new Map(suppliers.map((s) => [s.id, s]))

  const groups = new Map<string, SupplierSuggestion>()

  for (const item of items) {
    const supplierId = preferred.get(item.id) ?? item.supplier_id ?? null
    const supplier = supplierId ? supplierById.get(supplierId) ?? null : null
    const { next, toNext, cover } = schedule(supplier, now)

    const avgDaily = avgDailyById.get(item.id) ?? 0
    const par = item.par_level ?? (item.min_stock_level > 0 ? item.min_stock_level * 2 : 0)
    const usageUntilRestock = avgDaily * cover
    // Enough to stay above the minimum until the following delivery, and at least par
    const target = Math.max(par, item.min_stock_level + usageUntilRestock)
    // What will be left when the next delivery arrives
    const atDelivery = item.quantity - avgDaily * (toNext ?? 1)

    let reason: SuggestedLine['reason'] | null = null
    if (item.quantity <= item.min_stock_level) reason = 'below_min'
    else if (avgDaily > 0 && item.quantity - usageUntilRestock < item.min_stock_level) reason = 'runs_out'
    else if (item.par_level != null && item.quantity < item.par_level * 0.5) reason = 'below_par'
    if (!reason || target <= 0) continue

    const need = target - Math.max(0, atDelivery)
    if (need <= 0) continue

    const key = supplier?.id ?? '_none'
    const g = groups.get(key) ?? { supplier, daysToDelivery: toNext, nextDeliveryDay: next, lines: [], estimatedCost: 0 }
    const quantity = roundUp(need, item.unit)
    g.lines.push({ item, quantity, avgDaily, target, reason })
    g.estimatedCost += quantity * (item.cost_per_unit ?? 0)
    groups.set(key, g)
  }

  return [...groups.values()]
    .map((g) => ({ ...g, lines: g.lines.sort((a, b) => (a.reason === 'below_min' ? -1 : 0) - (b.reason === 'below_min' ? -1 : 0) || a.item.name.localeCompare(b.item.name)) }))
    .sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1) || (a.daysToDelivery ?? 99) - (b.daysToDelivery ?? 99))
}
