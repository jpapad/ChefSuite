import { useState, useMemo } from 'react'
import { Check, Loader2, Search, Sparkles, X } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import { translateMenuItems, suggestMultipleRecipeDetails, generateDescriptions, detectAllergensForRecipes } from '../../lib/gemini'
import type { Recipe, RecipeUpdate } from '../../types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  recipes: Recipe[]
  onUpdate: (id: string, patch: RecipeUpdate) => Promise<Recipe>
  initialFillOptions?: Partial<FillOptions>
  initialOnlyEmpty?: boolean
}

interface FillOptions {
  nameEl: boolean
  nameBg: boolean
  descriptionEl: boolean
  allergens: boolean
}

const CHUNK = 15

export function BulkAIUpdateDrawer({ open, onClose, recipes, onUpdate, initialFillOptions, initialOnlyEmpty }: Props) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(recipes.map((r) => r.id)))
  const [onlyEmpty, setOnlyEmpty] = useState(initialOnlyEmpty ?? true)
  const [fillOptions, setFillOptions] = useState<FillOptions>({
    nameEl: true, nameBg: true, descriptionEl: true, allergens: true,
    ...initialFillOptions,
  })
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null)
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() =>
    recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase())),
    [recipes, search],
  )

  function toggleRecipe(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === recipes.length ? new Set() : new Set(recipes.map((r) => r.id))
    )
  }

  function toggleFill(key: keyof FillOptions) {
    setFillOptions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleRun() {
    const selected = recipes.filter((r) => selectedIds.has(r.id))
    if (selected.length === 0) return
    setRunning(true)
    setError(null)
    setResult(null)
    let updated = 0
    let skipped = 0

    try {
      for (let c = 0; c < selected.length; c += CHUNK) {
        const chunk = selected.slice(c, c + CHUNK)
        setProgress({ done: c, total: selected.length, current: chunk[0].title })

        const patches: (RecipeUpdate | null)[] = chunk.map(() => null)

        // ── Translations (name + description) ───────────────────────────────
        const needsTranslation = chunk.some((r) =>
          (fillOptions.nameEl       && (onlyEmpty ? !r.name_el       : true)) ||
          (fillOptions.nameBg       && (onlyEmpty ? !r.name_bg       : true)) ||
          (fillOptions.descriptionEl && (onlyEmpty ? !r.description_el : true))
        )

        if (needsTranslation) {
          const items = chunk.map((r) => ({ name: r.title, description: r.description ?? null }))
          const translations = await translateMenuItems(items)
          chunk.forEach((r, i) => {
            const t = translations[i]
            const patch: RecipeUpdate = {}
            if (fillOptions.nameEl        && (!onlyEmpty || !r.name_el))        patch.name_el        = t.name_el        ?? undefined
            if (fillOptions.nameBg        && (!onlyEmpty || !r.name_bg))        patch.name_bg        = t.name_bg        ?? undefined
            if (fillOptions.descriptionEl && (!onlyEmpty || !r.description_el)) patch.description_el = t.description_el ?? undefined
            patches[i] = Object.keys(patch).length > 0 ? patch : patches[i]
          })
        }

        // ── Descriptions (generate if no description at all) ─────────────
        if (fillOptions.descriptionEl) {
          const noDescIdx = chunk
            .map((r, i) => (!r.description && (!onlyEmpty || !r.description_el) ? i : -1))
            .filter((i) => i >= 0)
          if (noDescIdx.length > 0) {
            const names = noDescIdx.map((i) => chunk[i].title)
            const generated = await generateDescriptions(names)
            noDescIdx.forEach((idx, j) => {
              if (generated[j]) {
                patches[idx] = { ...(patches[idx] ?? {}), description_el: generated[j]! }
              }
            })
          }
        }

        // ── Allergens (use full recipe text for accurate detection) ─────
        if (fillOptions.allergens) {
          const allergenIdx = chunk
            .map((r, i) => (!onlyEmpty || r.allergens.filter(a => !a.startsWith('no_')).length === 0 ? i : -1))
            .filter((i) => i >= 0)
          if (allergenIdx.length > 0) {
            const items = allergenIdx.map((i) => ({
              title: chunk[i].title,
              description: chunk[i].description,
              instructions: chunk[i].instructions,
            }))
            const detected = await detectAllergensForRecipes(items)
            allergenIdx.forEach((idx, j) => {
              const found = detected[j] ?? []
              // Keep existing positive tags (no_gluten, vegan, etc.) and merge with detected
              const existing = chunk[idx].allergens.filter(a => a.startsWith('no_') || ['vegan','vegetarian','spicy'].includes(a))
              const merged = [...new Set([...existing, ...found])]
              patches[idx] = { ...(patches[idx] ?? {}), allergens: merged }
            })
          }
        }

        // ── Apply patches ────────────────────────────────────────────────
        for (let i = 0; i < chunk.length; i++) {
          const patch = patches[i]
          if (patch && Object.keys(patch).length > 0) {
            await onUpdate(chunk[i].id, patch)
            updated++
          } else {
            skipped++
          }
          setProgress({ done: c + i + 1, total: selected.length, current: chunk[i].title })
        }
      }

      setResult({ updated, skipped })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία — έλεγξε τη σύνδεση')
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const selectedCount = recipes.filter((r) => selectedIds.has(r.id)).length

  return (
    <Drawer open={open} onClose={onClose} title="✨ Bulk AI Update συνταγών">
      <div className="space-y-5">

        {/* What to fill */}
        <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-brand-orange/70 uppercase tracking-wider">Τι να ανανεωθεί</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'nameEl',        label: '🇬🇧 Αγγλικό όνομα' },
              { key: 'nameBg',        label: '🇧🇬 Βουλγαρικό όνομα' },
              { key: 'descriptionEl', label: '🇬🇧 Αγγλική περιγραφή' },
              { key: 'allergens',     label: '⚠️ Αλλεργιογόνα' },
            ] as { key: keyof FillOptions; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleFill(key)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition text-left',
                  fillOptions[key]
                    ? 'border-brand-orange/50 bg-brand-orange/10 text-brand-orange'
                    : 'border-white/10 text-white/40 hover:text-white/60',
                )}
              >
                <div className={cn(
                  'h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center',
                  fillOptions[key] ? 'border-brand-orange bg-brand-orange' : 'border-white/30',
                )}>
                  {fillOptions[key] && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>
                {label}
              </button>
            ))}
          </div>

          {/* Only empty toggle */}
          <button
            type="button"
            onClick={() => setOnlyEmpty((v) => !v)}
            className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition"
          >
            <div className={cn(
              'h-4 w-4 rounded border-2 flex items-center justify-center transition',
              onlyEmpty ? 'border-emerald-400 bg-emerald-400' : 'border-white/30',
            )}>
              {onlyEmpty && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </div>
            Μόνο κενά πεδία (μην αντικαταστήσεις υπάρχοντα)
          </button>
        </div>

        {/* Recipe list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">{selectedCount} / {recipes.length} συνταγές</p>
            <button type="button" onClick={toggleAll} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
              {selectedIds.size === recipes.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση συνταγής…"
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ul className="glass rounded-xl divide-y divide-glass-border max-h-64 overflow-y-auto">
            {filtered.map((r) => {
              const sel = selectedIds.has(r.id)
              const hasNameEl = !!r.name_el
              const hasAllergens = r.allergens.length > 0
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => toggleRecipe(r.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition',
                      sel ? 'bg-emerald-500/5' : 'opacity-40',
                    )}
                  >
                    <div className={cn(
                      'h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition',
                      sel ? 'border-emerald-400 bg-emerald-400' : 'border-white/30',
                    )}>
                      {sel && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className="flex-1 text-sm text-white truncate">{r.title}</span>
                    <div className="flex gap-1 shrink-0">
                      {hasNameEl     && <span className="text-[10px] text-sky-400/60">EN</span>}
                      {hasAllergens  && <span className="text-[10px] text-amber-400/60">⚠</span>}
                    </div>
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-white/30">Δεν βρέθηκαν συνταγές</li>
            )}
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Progress */}
        {running && progress && (
          <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-brand-orange font-medium">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              {progress.done}/{progress.total} — {progress.current}
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-orange transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-4 space-y-1">
            <div className="flex items-center gap-2 text-emerald-300 font-medium text-sm">
              <Check className="h-5 w-5 shrink-0" />
              Ολοκληρώθηκε
            </div>
            <p className="text-sm text-white/60">
              ✓ {result.updated} ενημερώθηκαν
              {result.skipped > 0 && <span className="text-white/30"> · {result.skipped} παραλείφθηκαν</span>}
            </p>
          </div>
        )}

        {/* Actions */}
        {!running && (
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              {result ? 'Κλείσιμο' : 'Άκυρο'}
            </Button>
            {!result && (
              <Button
                type="button"
                className="flex-1"
                disabled={selectedCount === 0 || !Object.values(fillOptions).some(Boolean)}
                onClick={() => void handleRun()}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Εκτέλεση ({selectedCount})
              </Button>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
