import { AlertTriangle, Trophy, TrendingUp, Minus } from 'lucide-react'
import { checkUnitCompatibility } from '../../lib/unitCompatibility'

interface Props {
  /** Current price stored in the system */
  currentPrice: number | null
  /** Unit of the current price */
  currentUnit: string
  /** New price from invoice / catalog */
  newPrice: number | null
  /** Unit of the new price */
  newUnit: string
  /** Show percentage diff alongside badge (default true) */
  showPct?: boolean
}

/**
 * Compares two prices and renders the appropriate badge:
 * - ⚠ Ασύμβατη Μονάδα  — units are in different categories (kg vs box)
 * - 🏆 ΦΘΗΝΟΤΕΡΟ        — new price is strictly lower (same-category units)
 * - ↑ ΑΚΡΙΒΟΤΕΡΟ        — new price is strictly higher
 * - = ΙΔΙΑ ΤΙΜΗ         — prices are equal (within 0.01%)
 * - null                 — one of the prices is missing (renders nothing)
 */
export function PriceComparisonBadge({
  currentPrice,
  currentUnit,
  newPrice,
  newUnit,
  showPct = true,
}: Props) {
  if (currentPrice == null || newPrice == null) return null

  const compatibility = checkUnitCompatibility(currentUnit, newUnit)

  // Unit mismatch — always warn regardless of price direction
  if (compatibility === 'mismatch' || compatibility === 'unknown') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Ασύμβατη Μονάδα (Έλεγχος Συσκευασίας)
      </span>
    )
  }

  // Units compatible — compute price delta
  const delta = newPrice - currentPrice
  const pctRaw = currentPrice > 0 ? (delta / currentPrice) * 100 : 0
  const pct = Math.abs(pctRaw)
  const isEqual = pct < 0.01

  if (isEqual) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/60">
        <Minus className="h-3.5 w-3.5 shrink-0" />
        Ίδια Τιμή
      </span>
    )
  }

  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-400">
        <Trophy className="h-3.5 w-3.5 shrink-0" />
        ΦΘΗΝΟΤΕΡΟ{showPct && ` −${pct.toFixed(1)}%`}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">
      <TrendingUp className="h-3.5 w-3.5 shrink-0" />
      ΑΚΡΙΒΟΤΕΡΟ{showPct && ` +${pct.toFixed(1)}%`}
    </span>
  )
}
