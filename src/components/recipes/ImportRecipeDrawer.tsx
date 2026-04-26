import { type FormEvent, useState } from 'react'
import { Sparkles, AlertCircle, CheckCircle2, XCircle, ArrowLeft, Plus, Loader2 } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { importRecipeFromText, type ImportedRecipe, type ExtractedIngredient } from '../../lib/gemini'
import { useInventory } from '../../contexts/InventoryContext'
import type { InventoryItem, RecipeIngredientDraft } from '../../types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  onImported: (recipe: ImportedRecipe) => void
}

interface MatchResult {
  extracted: ExtractedIngredient
  matched: InventoryItem | null
  quantity: number
}

function matchToInventory(extracted: ExtractedIngredient[], inventory: InventoryItem[]): MatchResult[] {
  return extracted.map((ing) => {
    const nameLower = ing.name.toLowerCase().trim()
    let matched = inventory.find((i) => i.name.toLowerCase() === nameLower)
    if (!matched) {
      matched = inventory.find(
        (i) =>
          i.name.toLowerCase().includes(nameLower) ||
          nameLower.includes(i.name.toLowerCase()),
      )
    }
    return { extracted: ing, matched: matched ?? null, quantity: ing.quantity }
  })
}

export function ImportRecipeDrawer({ open, onClose, onImported }: Props) {
  const { items: inventory, create: createInventoryItem } = useInventory()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ recipe: ImportedRecipe; matches: MatchResult[] } | null>(null)
  const [addingIdx, setAddingIdx] = useState<number | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await importRecipeFromText(text.trim())
      const matches = matchToInventory(result.extractedIngredients, inventory)
      setPreview({ recipe: result, matches })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddToInventory(idx: number) {
    if (!preview || addingIdx !== null) return
    const m = preview.matches[idx]
    if (m.matched) return
    setAddingIdx(idx)
    try {
      const newItem = await createInventoryItem({
        name: m.extracted.name,
        quantity: 0,
        unit: m.extracted.unit,
        min_stock_level: 0,
        cost_per_unit: null,
        location_id: null,
        supplier_id: null,
      })
      setPreview((prev) => {
        if (!prev) return prev
        const matches = prev.matches.map((match, i) =>
          i === idx ? { ...match, matched: newItem } : match,
        )
        return { ...prev, matches }
      })
    } finally {
      setAddingIdx(null)
    }
  }

  function handleConfirm() {
    if (!preview) return
    const ingredients: RecipeIngredientDraft[] = preview.matches
      .filter((m): m is MatchResult & { matched: InventoryItem } => m.matched !== null)
      .map((m) => ({ inventory_item_id: m.matched.id, quantity: m.quantity }))
    onImported({ ...preview.recipe, ingredients })
  }

  function handleClose() {
    if (loading) return
    setText('')
    setError(null)
    setPreview(null)
    onClose()
  }

  return (
    <Drawer open={open} onClose={handleClose} title="Import recipe with AI">
      {preview ? (
        <div className="space-y-5">
          <div className="space-y-1">
            <h3 className="font-semibold text-white">{preview.recipe.title}</h3>
            {preview.recipe.description && (
              <p className="text-sm text-white/60">{preview.recipe.description}</p>
            )}
          </div>

          {preview.matches.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-white/80">Ingredients</p>
              <ul className="glass rounded-xl divide-y divide-glass-border">
                {preview.matches.map((m, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    {m.matched ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-white/30" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">
                        {m.matched ? m.matched.name : m.extracted.name}
                      </div>
                      <div className="text-xs text-white/50">
                        {m.quantity} {m.extracted.unit}
                        {!m.matched && ' · not in inventory'}
                      </div>
                    </div>
                    {!m.matched && (
                      <button
                        type="button"
                        onClick={() => handleAddToInventory(i)}
                        disabled={addingIdx !== null}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-orange/40 px-2.5 py-1.5 text-xs font-medium text-brand-orange transition hover:bg-brand-orange/10 disabled:opacity-50"
                      >
                        {addingIdx === i ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Add to inventory
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => setPreview(null)}
              disabled={addingIdx !== null}
            >
              Back
            </Button>
            <Button
              type="button"
              leftIcon={<Sparkles className="h-4 w-4" />}
              onClick={handleConfirm}
              disabled={addingIdx !== null}
            >
              Import recipe
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange">
            <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Paste the full recipe text below — from a website, PDF, or anywhere. AI will extract the title, instructions, allergens and more.</p>
          </div>

          <Textarea
            name="recipe_text"
            label="Recipe text"
            placeholder="Paste the recipe here…"
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              leftIcon={<Sparkles className="h-4 w-4" />}
              disabled={loading || !text.trim()}
            >
              {loading ? 'Importing…' : 'Import recipe'}
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  )
}
