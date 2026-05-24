/**
 * Unit compatibility checks for price comparison safety.
 *
 * A "unit mismatch" occurs when comparing prices across incompatible measurement
 * categories (e.g. kg vs box, lt vs piece). The numbers are not directly comparable
 * in that case, so no automatic price badge should be shown.
 */

// ── Normalization map ──────────────────────────────────────────────────────
// Maps raw unit strings (lowercase, no accents) → canonical unit key

const NORMALIZE_MAP: [RegExp, string][] = [
  // Weight
  [/^(kg|kilo|kilos|κιλ[οά]?|κιλά|χγρ)$/,           'kg'],
  [/^(g|gr|gram|grams|γραμ[μ]?[αά]ρι[αο]?|γρ)$/,    'g'],
  [/^(lb|lbs|pound|pounds)$/,                          'lb'],
  [/^(oz|ounce|ounces)$/,                              'oz'],
  [/^(t|tonne|τόνο[ς]?)$/,                             't'],
  // Volume
  [/^(l|lt|ltr|liter|litre|λίτρ[αο]?|λτ)$/,          'lt'],
  [/^(ml|milliliter|millilitre|χιλιοστόλιτρ[αο]?)$/,  'ml'],
  [/^(cl|centiliter|centilitre)$/,                     'cl'],
  [/^(dl|deciliter|decilitre)$/,                       'dl'],
  // Count / pieces
  [/^(pcs?|piece|pieces|τεμ[αά]χι[αο]?|τεμ\.?|tem)$/, 'pcs'],
  [/^(box|boxes|κιβώτι[αο]?|κιβ\.?)$/,                'box'],
  [/^(bag|bags|σακούλ[αε]?|σακ)$/,                    'bag'],
  [/^(bottle|bottles|μπουκάλι[αο]?|μπουκ)$/,          'bottle'],
  [/^(can|cans|κονσέρβ[αε]?|κουτί|κουτιά)$/,          'can'],
  [/^(pack|packs|πακέτο|πακέτα|pak)$/,                 'pack'],
  [/^(portion|portions|μερίδ[αε]?|μεριδ)$/,           'portion'],
  [/^(bunch|bunches|ματσάκι|ματσάκια|bouquet)$/,       'bunch'],
]

/** Measurement category groups — units within the same group are compatible */
const UNIT_GROUPS: Record<string, string> = {
  kg: 'weight', g: 'weight', lb: 'weight', oz: 'weight', t: 'weight',
  lt: 'volume', ml: 'volume', cl: 'volume', dl: 'volume',
  pcs: 'count', box: 'count', bag: 'count', bottle: 'count',
  can: 'count', pack: 'count', portion: 'count', bunch: 'count',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function stripGreekAccents(s: string): string {
  return s
    .replace(/[άΆ]/g, 'α').replace(/[έΈ]/g, 'ε').replace(/[ήΉ]/g, 'η')
    .replace(/[ίΊϊΪΐ]/g, 'ι').replace(/[όΌ]/g, 'ο').replace(/[ύΎϋΫΰ]/g, 'υ')
    .replace(/[ώΏ]/g, 'ω')
}

/**
 * Normalizes a unit string to a canonical key (e.g. "Κιλό" → "kg").
 * Returns the lowercased input if no mapping found.
 */
export function normalizeUnit(raw: string): string {
  const s = stripGreekAccents(raw.trim().toLowerCase())
  for (const [re, key] of NORMALIZE_MAP) {
    if (re.test(s)) return key
  }
  return s
}

/**
 * Returns the measurement category for a unit ("weight" | "volume" | "count" | null).
 */
export function unitCategory(raw: string): string | null {
  return UNIT_GROUPS[normalizeUnit(raw)] ?? null
}

export type UnitCompatibility = 'compatible' | 'mismatch' | 'unknown'

/**
 * Checks whether two unit strings are compatible for direct price comparison.
 *
 * - "compatible": same category (kg vs g, lt vs ml) — price diff badge is safe
 * - "mismatch":   different categories (kg vs box) — show warning, no badge
 * - "unknown":    one or both units are unrecognized — show warning to be safe
 */
export function checkUnitCompatibility(unitA: string, unitB: string): UnitCompatibility {
  const catA = unitCategory(unitA)
  const catB = unitCategory(unitB)
  if (!catA || !catB) return 'unknown'
  return catA === catB ? 'compatible' : 'mismatch'
}
