import { useState } from 'react'
import { Check, ChefHat, Loader2, MapPin, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/cn'
import { generateRegionalRecipes, type RegionalRecipe } from '../lib/gemini'
import { useRecipes } from '../hooks/useRecipes'

// ── Greek regions ─────────────────────────────────────────────────────────────

interface Region { id: string; label: string; emoji: string; group: string }

const REGIONS: Region[] = [
  { id: 'Κρήτη',             label: 'Κρήτη',             emoji: '🫒', group: 'Νησιά' },
  { id: 'Κυκλάδες',          label: 'Κυκλάδες',          emoji: '🏛️', group: 'Νησιά' },
  { id: 'Δωδεκάνησα',        label: 'Δωδεκάνησα',        emoji: '🌊', group: 'Νησιά' },
  { id: 'Ιόνια Νησιά',       label: 'Ιόνια Νησιά',       emoji: '🫧', group: 'Νησιά' },
  { id: 'Βόρειο Αιγαίο',     label: 'Βόρειο Αιγαίο',     emoji: '🐟', group: 'Νησιά' },
  { id: 'Μακεδονία',         label: 'Μακεδονία',         emoji: '🫑', group: 'Βόρεια' },
  { id: 'Θεσσαλονίκη',       label: 'Θεσσαλονίκη',       emoji: '🥙', group: 'Βόρεια' },
  { id: 'Θράκη',             label: 'Θράκη',             emoji: '🌾', group: 'Βόρεια' },
  { id: 'Ήπειρος',           label: 'Ήπειρος',           emoji: '🧀', group: 'Βόρεια' },
  { id: 'Θεσσαλία',          label: 'Θεσσαλία',          emoji: '🥩', group: 'Κεντρική' },
  { id: 'Στερεά Ελλάδα',     label: 'Στερεά Ελλάδα',     emoji: '🫕', group: 'Κεντρική' },
  { id: 'Πελοπόννησος',      label: 'Πελοπόννησος',      emoji: '🫐', group: 'Νότια' },
  { id: 'Αττική',            label: 'Αττική',            emoji: '🍋', group: 'Νότια' },
]

const GROUPS = ['Νησιά', 'Βόρεια', 'Κεντρική', 'Νότια']
const COUNT_OPTIONS = [8, 12, 16, 20]

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegionalRecipes() {
  const { create } = useRecipes()

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [count, setCount] = useState(12)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<RegionalRecipe[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  async function handleGenerate() {
    if (!selectedRegion) return
    setLoading(true)
    setError(null)
    setResults([])
    setSelected(new Set())
    setImportDone(false)
    setExpandedIdx(null)
    try {
      const recipes = await generateRegionalRecipes(selectedRegion, count)
      setResults(recipes)
      setSelected(new Set(recipes.map((_, i) => i)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία — έλεγξε τη σύνδεση')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    const toImport = results.filter((_, i) => selected.has(i))
    if (toImport.length === 0) return
    setImporting(true)
    setError(null)
    try {
      for (const r of toImport) {
        await create({
          title: r.title,
          description: r.description ?? null,
          instructions: r.instructions ?? null,
          allergens: r.allergens,
          name_el: r.name_el ?? null,
          description_el: r.description_el ?? null,
          name_bg: null,
          description_bg: null,
          category: (r.category as 'appetizer' | 'soup' | 'salad' | 'main' | 'side' | 'sauce' | 'bread' | 'dessert' | 'beverage' | null) ?? null,
          prep_time: r.prep_time ?? null,
          cook_time: r.cook_time ?? null,
          servings: r.servings ?? null,
          difficulty: null,
          cost_per_portion: null,
          selling_price: null,
          image_url: null,
          parent_recipe_id: null,
          variation_label: null,
        })
      }
      setImportDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία εισαγωγής')
    } finally {
      setImporting(false)
    }
  }

  function toggleSelect(i: number) {
    setSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  const CATEGORY_LABELS: Record<string, string> = {
    appetizer: 'Ορεκτικό', soup: 'Σούπα', salad: 'Σαλάτα',
    main: 'Κυρίως', side: 'Συνοδευτικό', sauce: 'Σάλτσα',
    bread: 'Ψωμί', dessert: 'Επιδόρπιο', beverage: 'Ρόφημα', other: 'Άλλο',
  }

  return (
    <div className="min-h-screen p-6 space-y-8 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <MapPin className="h-7 w-7 text-brand-orange" />
          <h1 className="text-3xl font-semibold text-white">Τοπικές Συνταγές Ελλάδος</h1>
        </div>
        <p className="text-white/50 ml-10">Επέλεξε μια περιοχή και το AI θα δημιουργήσει παραδοσιακές συνταγές με πλήρη στοιχεία.</p>
      </div>

      {/* Region picker */}
      <div className="space-y-4">
        {GROUPS.map((group) => (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">{group}</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.filter((r) => r.group === group).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelectedRegion(r.id); setResults([]); setImportDone(false) }}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition',
                    selectedRegion === r.id
                      ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                      : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white',
                  )}
                >
                  <span>{r.emoji}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Count + Generate */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">Αριθμός συνταγών:</span>
          <div className="flex gap-1">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                  count === n
                    ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                    : 'border-white/10 text-white/40 hover:text-white',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <Button
          disabled={!selectedRegion || loading}
          onClick={() => void handleGenerate()}
          leftIcon={loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Sparkles className="h-4 w-4" />}
        >
          {loading ? `Δημιουργία ${count} συνταγών από ${selectedRegion}…` : 'Δημιούργησε συνταγές'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Loader2 className="h-10 w-10 text-brand-orange animate-spin" />
          <p className="text-white/60 text-sm">Το AI αναζητά παραδοσιακές συνταγές από {selectedRegion}…<br /><span className="text-white/30 text-xs">Αυτό μπορεί να πάρει ~30 δευτερόλεπτα</span></p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/70 font-medium">
              {results.length} παραδοσιακές συνταγές από <span className="text-brand-orange">{selectedRegion}</span>
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelected(
                  selected.size === results.length ? new Set() : new Set(results.map((_, i) => i))
                )}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition"
              >
                {selected.size === results.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
              </button>
              {importDone ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <Check className="h-4 w-4" />
                  Εισήχθησαν στη βιβλιοθήκη!
                </div>
              ) : (
                <Button
                  disabled={selected.size === 0 || importing}
                  onClick={() => void handleImport()}
                  leftIcon={importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
                >
                  {importing ? 'Εισαγωγή…' : `Εισαγωγή ${selected.size} συνταγών`}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {results.map((r, i) => {
              const sel = selected.has(i)
              const expanded = expandedIdx === i
              return (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border transition',
                    sel ? 'border-white/15 bg-white/3' : 'border-white/5 opacity-50',
                  )}
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSelect(i)}
                      className="mt-0.5 shrink-0"
                    >
                      <div className={cn(
                        'h-4 w-4 rounded border-2 flex items-center justify-center transition',
                        sel ? 'border-emerald-400 bg-emerald-400' : 'border-white/30',
                      )}>
                        {sel && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </div>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">{r.title}</span>
                        {r.name_el && <span className="text-xs text-sky-300/70">{r.name_el}</span>}
                        {r.category && (
                          <span className="rounded-full bg-brand-orange/15 border border-brand-orange/30 px-2 py-0.5 text-[10px] text-brand-orange/80">
                            {CATEGORY_LABELS[r.category] ?? r.category}
                          </span>
                        )}
                        {(r.prep_time || r.cook_time) && (
                          <span className="text-[10px] text-white/30">
                            ⏱ {(r.prep_time ?? 0) + (r.cook_time ?? 0)} λεπτά
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-sm text-white/55 mt-0.5 line-clamp-2">{r.description}</p>
                      )}
                      {r.allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {r.allergens.map((a) => (
                            <span key={a} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">{a}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedIdx(expanded ? null : i)}
                      className="shrink-0 text-xs text-white/30 hover:text-white/60 transition px-2 py-1"
                    >
                      {expanded ? '▲ Λιγότερα' : '▼ Υλικά & Οδηγίες'}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="border-t border-white/10 px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {r.ingredients && (
                        <div>
                          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Υλικά</p>
                          <p className="text-sm text-white/70 whitespace-pre-line">{r.ingredients}</p>
                        </div>
                      )}
                      {r.instructions && (
                        <div>
                          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Οδηγίες</p>
                          <p className="text-sm text-white/70 whitespace-pre-line">{r.instructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
