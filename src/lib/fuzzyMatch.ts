/**
 * Fuzzy matching for ingredient names.
 * Handles Greek, Latin, and Greeklish input via phonetic normalization
 * followed by Levenshtein distance similarity scoring (0–100).
 */

// ── Phonetic normalization ──────────────────────────────────────────────────

/** Map Greek accented vowels to their base form */
function stripGreekAccents(s: string): string {
  return s
    .replace(/[άΆ]/g, 'α').replace(/[έΈ]/g, 'ε').replace(/[ήΉ]/g, 'η')
    .replace(/[ίΊϊΪΐ]/g, 'ι').replace(/[όΌ]/g, 'ο').replace(/[ύΎϋΫΰ]/g, 'υ')
    .replace(/[ώΏ]/g, 'ω')
}

/**
 * Ordered list of Greek → phoneme substitutions.
 * Digraphs must come before singles so they match first.
 */
const GREEK_PHONEMES: [RegExp, string][] = [
  // digraphs
  [/αι/g, 'e'],  [/ει/g, 'i'],  [/οι/g, 'i'],  [/υι/g, 'i'],
  [/αυ/g, 'av'], [/ευ/g, 'ev'], [/ου/g, 'u'],
  [/γγ/g, 'ng'], [/γκ/g, 'gk'], [/μπ/g, 'b'],  [/ντ/g, 'd'],
  [/τζ/g, 'tz'], [/τσ/g, 'ts'],
  // singles
  [/α/g, 'a'],  [/β/g, 'v'],  [/γ/g, 'g'],  [/δ/g, 'd'],
  [/ε/g, 'e'],  [/ζ/g, 'z'],  [/η/g, 'i'],  [/θ/g, 'th'],
  [/ι/g, 'i'],  [/κ/g, 'k'],  [/λ/g, 'l'],  [/μ/g, 'm'],
  [/ν/g, 'n'],  [/ξ/g, 'ks'], [/ο/g, 'o'],  [/π/g, 'p'],
  [/ρ/g, 'r'],  [/σ/g, 's'],  [/ς/g, 's'],  [/τ/g, 't'],
  [/υ/g, 'i'],  [/φ/g, 'f'],  [/χ/g, 'h'],  [/ψ/g, 'ps'],
  [/ω/g, 'o'],
]

/** Common Greeklish (Latin-typed Greek) patterns → normalized phoneme */
const GREEKLISH_PHONEMES: [RegExp, string][] = [
  [/th/g, 't'],     // θ
  [/ph/g, 'f'],     // φ
  [/ch/g, 'h'],     // χ
  [/ks/g, 'k'],     // ξ
  [/ps/g, 'p'],     // ψ (simplified)
  [/ts/g, 'ts'],    // τσ
  [/tz/g, 'tz'],    // τζ
  [/[yw]/g, 'i'],   // υ/η written as y or w
  [/[qu]/g, 'k'],   // κ written as q or u
  [/c(?=[ei])/g, 's'], // soft c
  [/c/g, 'k'],      // hard c
]

/**
 * Converts any ingredient name (Greek / Latin / Greeklish) into a
 * normalized phoneme string for comparison.
 */
export function toPhoneme(raw: string): string {
  let s = raw.toLowerCase().trim()

  // Strip Greek accents
  s = stripGreekAccents(s)

  // Greek → phoneme (digraphs first)
  for (const [re, ph] of GREEK_PHONEMES) s = s.replace(re, ph)

  // Strip Latin diacritics (é, ü, etc.)
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '')

  // Greeklish patterns
  for (const [re, ph] of GREEKLISH_PHONEMES) s = s.replace(re, ph)

  // Collapse repeated characters ("kk" → "k")
  s = s.replace(/(.)\1+/g, '$1')

  // Keep only a-z
  return s.replace(/[^a-z]/g, '')
}

// ── Levenshtein distance ───────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  // Use two-row rolling array for O(min(m,n)) space
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...Array(n).fill(0)]
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev = curr
  }
  return prev[n]
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns a similarity score 0–100 between two ingredient name strings.
 * 100 = identical (after normalization), 0 = completely different.
 * Handles Greek, Greeklish, and Latin characters.
 */
export function fuzzyScore(a: string, b: string): number {
  const pa = toPhoneme(a)
  const pb = toPhoneme(b)
  if (!pa && !pb) return 100
  if (!pa || !pb) return 0
  const maxLen = Math.max(pa.length, pb.length)
  const dist = levenshtein(pa, pb)
  return Math.round((1 - dist / maxLen) * 100)
}

export interface FuzzyMatch {
  id: string
  name: string
  score: number
}

/**
 * Finds existing items that are likely duplicates of the candidate name.
 *
 * @param candidate  Name being checked (new item)
 * @param existing   Current inventory items
 * @param threshold  Minimum score to report (default 75)
 */
export function findDuplicates(
  candidate: string,
  existing: { id: string; name: string }[],
  threshold = 75,
): FuzzyMatch[] {
  return existing
    .map((item) => ({ id: item.id, name: item.name, score: fuzzyScore(candidate, item.name) }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
}
