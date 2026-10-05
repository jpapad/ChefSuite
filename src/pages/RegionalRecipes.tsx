import { useState } from 'react'
import { Check, ChefHat, Loader2, MapPin, Sparkles } from 'lucide-react'
import { Page, PageHeader, PillButton, Panel, Notice } from '../components/ui/page'
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
  const [customRegion, setCustomRegion] = useState('')
  const activeRegion = customRegion.trim() || selectedRegion
  const [count, setCount] = useState(12)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<RegionalRecipe[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  async function handleGenerate() {
    if (!activeRegion) return
    setLoading(true)
    setLoadingMsg('')
    setError(null)
    setResults([])
    setSelected(new Set())
    setImportDone(false)
    setExpandedIdx(null)
    try {
      const recipes = await generateRegionalRecipes(activeRegion, count, setLoadingMsg)
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
    <Page>
      <PageHeader
        title="Τοπικές συνταγές"
        subtitle="Διάλεξε μια περιοχή και το AI βρίσκει παραδοσιακές συνταγές με υλικά, οδηγίες και αλλεργιογόνα."
      />

      {/* ── Search hero ── */}
      <section className="rounded-3xl bg-ink p-5 sm:p-7 text-white-fixed flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 min-w-[240px] flex-col gap-2">
            <span className="text-sm text-[#C9CEC8]">Από ποιο μέρος θέλεις συνταγές;</span>
            <span className="flex h-14 items-center gap-3 rounded-full bg-white-fixed/10 px-5">
              <MapPin className="h-5 w-5 text-lime" />
              <input
                type="text"
                placeholder={selectedRegion ?? 'π.χ. Σαντορίνη, Μεσσηνία, Λέσβος…'}
                value={customRegion}
                onChange={(e) => { setCustomRegion(e.target.value); if (e.target.value) { setSelectedRegion(null); setResults([]); setImportDone(false) } }}
                className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-white-fixed/45"
              />
            </span>
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-[#C9CEC8]">Συνταγές</span>
            <div className="inline-flex h-14 items-center rounded-full bg-white-fixed/10 p-1.5">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={count === n}
                  onClick={() => setCount(n)}
                  className={cn('h-11 min-w-11 rounded-full px-3 text-sm font-medium tabular-nums transition', count === n ? 'bg-lime text-ink' : 'text-white-fixed/70 hover:text-white-fixed')}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!activeRegion || loading}
            onClick={() => void handleGenerate()}
            className="inline-flex h-14 items-center gap-2 rounded-full bg-lime px-6 text-base font-medium text-ink disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {loading ? 'Αναζήτηση…' : 'Βρες συνταγές'}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {GROUPS.map((group) => (
            <div key={group} className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-[#A7ADA6]">{group}</span>
              {REGIONS.filter((r) => r.group === group).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={selectedRegion === r.id}
                  onClick={() => { setSelectedRegion(r.id); setCustomRegion(''); setResults([]); setImportDone(false) }}
                  className={cn(
                    'h-9 rounded-full px-3.5 text-[13px] font-medium transition',
                    selectedRegion === r.id ? 'bg-lime text-ink' : 'bg-white-fixed/10 text-white-fixed/80 hover:bg-white-fixed/15',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      {error && <Notice>{error}</Notice>}

      {loading && (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-sm text-white/70">{loadingMsg || `Αναζήτηση αυθεντικών συνταγών από ${activeRegion}…`}</p>
            <p className="text-xs text-white/45">Φόρτωση πραγματικών συνταγών από το διαδίκτυο</p>
          </div>
        </Panel>
      )}

      {results.length > 0 && !loading && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-medium tracking-[-0.02em]">
              {results.length} συνταγές από {activeRegion}
            </h2>
            <div className="flex items-center gap-2">
              <PillButton onClick={() => setSelected(selected.size === results.length ? new Set() : new Set(results.map((_, i) => i)))}>
                {selected.size === results.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
              </PillButton>
              {importDone ? (
                <span className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-500/12 px-5 text-sm font-medium text-emerald-500">
                  <Check className="h-4 w-4" /> Στη βιβλιοθήκη
                </span>
              ) : (
                <PillButton variant="primary" icon={importing ? Loader2 : ChefHat} disabled={selected.size === 0 || importing} onClick={() => void handleImport()}>
                  {importing ? 'Εισαγωγή…' : `Εισαγωγή ${selected.size}`}
                </PillButton>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {results.map((r, i) => {
              const sel = selected.has(i)
              const expanded = expandedIdx === i
              return (
                <article key={i} className={cn('flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card transition', !sel && 'opacity-55', expanded && 'md:col-span-2')}>
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-pressed={sel}
                      aria-label={r.title}
                      onClick={() => toggleSelect(i)}
                      className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition', sel ? 'border-ink bg-ink text-lime' : 'border-white/30')}
                    >
                      {sel && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-medium leading-snug">{r.title}</h3>
                      {r.name_el && r.name_el !== r.title && <p className="text-xs text-white/50">{r.name_el}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {r.category && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-medium">{CATEGORY_LABELS[r.category] ?? r.category}</span>}
                    {(r.prep_time || r.cook_time) && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-medium tabular-nums">{(r.prep_time ?? 0) + (r.cook_time ?? 0)}′</span>}
                    {r.allergens.map((a) => <span key={a} className="rounded-full bg-amber-500/12 px-2.5 py-1 font-medium text-amber-500">{a}</span>)}
                  </div>
                  {r.description && <p className={cn('text-sm text-white/60', !expanded && 'line-clamp-3')}>{r.description}</p>}
                  {expanded && (
                    <div className="grid gap-4 rounded-2xl bg-white/[0.04] p-4 md:grid-cols-2">
                      {r.ingredients && (
                        <div>
                          <p className="mb-2 text-sm font-medium">Υλικά</p>
                          <p className="whitespace-pre-line text-sm text-white/70">{r.ingredients}</p>
                        </div>
                      )}
                      {r.instructions && (
                        <div>
                          <p className="mb-2 text-sm font-medium">Οδηγίες</p>
                          <p className="whitespace-pre-line text-sm text-white/70">{r.instructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedIdx(expanded ? null : i)}
                    className="mt-auto self-start text-sm font-medium text-white/60 hover:text-white"
                  >
                    {expanded ? 'Λιγότερα' : 'Υλικά και οδηγίες'}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </Page>
  )
}
