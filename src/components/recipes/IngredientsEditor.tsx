import { useState } from 'react'
import { Plus, Trash2, Euro, Loader2, ClipboardList, X, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { useInventory } from '../../contexts/InventoryContext'
import { parseIngredientsList, type ExtractedIngredient } from '../../lib/gemini'
import type { InventoryItem, RecipeIngredientDraft } from '../../types/database.types'

interface IngredientsEditorProps {
  value: RecipeIngredientDraft[]
  onChange: (next: RecipeIngredientDraft[]) => void
  inventory: InventoryItem[]
}

interface ParseResult {
  extracted: ExtractedIngredient
  matched: InventoryItem | null
  qty: string
}

interface AddForm {
  unit: string
  costPerUnit: string
}

function fuzzyMatch(name: string, inventory: InventoryItem[]): InventoryItem | null {
  const q = name.toLowerCase().trim()
  return (
    inventory.find((i) => i.name.toLowerCase() === q) ??
    inventory.find((i) => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase())) ??
    null
  )
}

export function IngredientsEditor({ value, onChange, inventory }: IngredientsEditorProps) {
  const { create } = useInventory()

  // ── select-from-existing state ──────────────────────────────────────────────
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('')

  // ── paste-list state ────────────────────────────────────────────────────────
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const [parseError, setParseError] = useState<string | null>(null)
  const [results, setResults] = useState<ParseResult[] | null>(null)
  // per-result "add to inventory" inline forms
  const [addForms, setAddForms] = useState<Record<number, AddForm>>({})
  const [savingIdx, setSavingIdx] = useState<number | null>(null)

  const selectedIds = new Set(value.map((v) => v.inventory_item_id))
  const available = inventory.filter((i) => !selectedIds.has(i.id))

  // ── select helpers ──────────────────────────────────────────────────────────
  function addSelected() {
    const q = Number(qty)
    if (!itemId || !Number.isFinite(q) || q <= 0) return
    onChange([...value, { inventory_item_id: itemId, quantity: q }])
    setItemId('')
    setQty('')
  }

  function remove(id: string) {
    onChange(value.filter((v) => v.inventory_item_id !== id))
  }

  function itemFor(id: string): InventoryItem | undefined {
    return inventory.find((i) => i.id === id)
  }

  // ── paste helpers ───────────────────────────────────────────────────────────
  function handleParse() {
    if (!pasteText.trim()) return
    setParseError(null)
    try {
      const extracted = parseIngredientsList(pasteText.trim())
      setResults(
        extracted.map((e) => ({
          extracted: e,
          matched: fuzzyMatch(e.name, inventory),
          qty: e.quantity > 0 ? String(e.quantity) : '',
        })),
      )
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Parse failed.')
    }
  }

  function openAddForm(idx: number, extracted: ExtractedIngredient) {
    setAddForms((prev) => ({
      ...prev,
      [idx]: { unit: extracted.unit, costPerUnit: '' },
    }))
  }

  function closeAddForm(idx: number) {
    setAddForms((prev) => { const next = { ...prev }; delete next[idx]; return next })
  }

  async function saveToInventory(idx: number) {
    if (!results) return
    const result = results[idx]
    const form = addForms[idx]
    if (!form) return
    setSavingIdx(idx)
    try {
      const newItem = await create({
        name: result.extracted.name,
        unit: form.unit.trim() || result.extracted.unit,
        quantity: 0,
        min_stock_level: 0,
        cost_per_unit: form.costPerUnit !== '' ? Number(form.costPerUnit) : null,
        location_id: null,
        supplier_id: null,
      })
      setResults((prev) =>
        prev ? prev.map((r, i) => (i === idx ? { ...r, matched: newItem, qty: r.qty || '1' } : r)) : prev,
      )
      closeAddForm(idx)
    } finally {
      setSavingIdx(null)
    }
  }

  function addAllMatched() {
    if (!results) return
    const toAdd: RecipeIngredientDraft[] = results
      .filter((r) => r.matched && !selectedIds.has(r.matched.id) && Number(r.qty) > 0)
      .map((r) => ({ inventory_item_id: r.matched!.id, quantity: Number(r.qty) }))
    if (toAdd.length) onChange([...value, ...toAdd])
    setPasteOpen(false)
    setPasteText('')
    setResults(null)
    setAddForms({})
  }

  function closePaste() {
    setPasteOpen(false)
    setPasteText('')
    setResults(null)
    setParseError(null)
    setAddForms({})
  }

  // ── cost summary ────────────────────────────────────────────────────────────
  const rows = value.map((draft) => {
    const item = itemFor(draft.inventory_item_id)
    const cost = item?.cost_per_unit != null ? item.cost_per_unit * draft.quantity : null
    return { draft, item, cost }
  })
  const totalCost = rows.reduce((sum, r) => sum + (r.cost ?? 0), 0)
  const hasPartialCost = rows.some((r) => r.cost === null)

  const matchedCount = results?.filter((r) => r.matched && !selectedIds.has(r.matched.id) && Number(r.qty) > 0).length ?? 0

  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-white/80">Ingredients</span>

      {/* ── existing ingredients list ── */}
      {rows.length > 0 && (
        <ul className="glass rounded-xl divide-y divide-glass-border mb-3">
          {rows.map(({ draft, item, cost }) => (
            <li key={draft.inventory_item_id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item?.name ?? '(deleted item)'}</div>
                <div className="text-xs text-white/50">
                  {draft.quantity} {item?.unit ?? ''}
                  {cost != null && ` · €${cost.toFixed(2)}`}
                  {cost == null && item && ' · no cost set'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(draft.inventory_item_id)}
                aria-label="Remove ingredient"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── select from existing ── */}
      {available.length > 0 && !pasteOpen && (
        <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="flex-1 bg-transparent outline-none text-base text-white"
            >
              <option value="" className="bg-[#f5ede0]">Select ingredient…</option>
              {available.map((i) => (
                <option key={i.id} value={i.id} className="bg-[#f5ede0]">
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
            <input
              type="number"
              step="any"
              min={0}
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="flex-1 bg-transparent outline-none text-base text-white placeholder:text-white/40 w-full"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={addSelected}
            disabled={!itemId || !qty || Number(qty) <= 0}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add
          </Button>
        </div>
      )}

      {/* ── paste panel toggle ── */}
      {!pasteOpen ? (
        <button
          type="button"
          onClick={() => setPasteOpen(true)}
          className="mt-2 flex items-center gap-1.5 text-xs text-white/50 hover:text-brand-orange transition"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Paste ingredient list
        </button>
      ) : (
        <div className="mt-3 glass rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">Paste ingredient list</p>
            <button
              type="button"
              onClick={closePaste}
              className="text-white/40 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* textarea + parse button */}
          {!results && (
            <div className="space-y-2">
              <textarea
                rows={6}
                placeholder={"200g αλεύρι\n3 αυγά\n100ml γάλα\n50g βούτυρο…"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full glass rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-brand-orange resize-none"
              />
              {parseError && (
                <p className="text-xs text-red-300">{parseError}</p>
              )}
              <Button
                type="button"
                leftIcon={<ClipboardList className="h-4 w-4" />}
                disabled={!pasteText.trim()}
                onClick={handleParse}
              >
                Parse
              </Button>
            </div>
          )}

          {/* results list */}
          {results && (
            <div className="space-y-3">
              <ul className="space-y-2">
                {results.map((r, idx) => (
                  <li key={idx} className="glass rounded-xl px-4 py-3 space-y-3">
                    {/* result row */}
                    <div className="flex items-center gap-3">
                      {r.matched ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-white/30" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {r.matched ? r.matched.name : r.extracted.name}
                        </div>
                        <div className="text-xs text-white/50">
                          {!r.matched && 'not in inventory'}
                        </div>
                      </div>
                      {/* editable qty */}
                      <div className="glass flex items-center rounded-lg px-2 focus-within:ring-2 focus-within:ring-brand-orange shrink-0 w-28">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          placeholder="Qty"
                          value={r.qty}
                          onChange={(e) =>
                            setResults((prev) =>
                              prev ? prev.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x) : prev,
                            )
                          }
                          className="w-full bg-transparent py-1.5 text-sm text-white placeholder:text-white/30 outline-none"
                        />
                        {r.matched?.unit && (
                          <span className="text-xs text-white/40 ml-1 shrink-0">{r.matched.unit}</span>
                        )}
                      </div>
                      {!r.matched && !addForms[idx] && (
                        <button
                          type="button"
                          onClick={() => openAddForm(idx, r.extracted)}
                          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-brand-orange/40 px-2.5 py-1.5 text-xs font-medium text-brand-orange transition hover:bg-brand-orange/10"
                        >
                          <Plus className="h-3 w-3" />
                          Add to inventory
                        </button>
                      )}
                    </div>

                    {/* inline add-to-inventory form */}
                    {addForms[idx] && (
                      <div className="border-t border-glass-border pt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-white/50 mb-1 block">Unit</label>
                            <input
                              type="text"
                              value={addForms[idx].unit}
                              onChange={(e) =>
                                setAddForms((prev) => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], unit: e.target.value },
                                }))
                              }
                              className="w-full glass rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand-orange"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-white/50 mb-1 block">Cost/unit (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="optional"
                              value={addForms[idx].costPerUnit}
                              onChange={(e) =>
                                setAddForms((prev) => ({
                                  ...prev,
                                  [idx]: { ...prev[idx], costPerUnit: e.target.value },
                                }))
                              }
                              className="w-full glass rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-brand-orange"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => saveToInventory(idx)}
                            disabled={savingIdx === idx || !addForms[idx].unit.trim()}
                            leftIcon={savingIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : undefined}
                          >
                            {savingIdx === idx ? 'Saving…' : 'Save to inventory'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => closeAddForm(idx)}
                            disabled={savingIdx === idx}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  leftIcon={<Plus className="h-4 w-4" />}
                  disabled={matchedCount === 0}
                  onClick={addAllMatched}
                >
                  Add {matchedCount > 0 ? matchedCount : ''} matched to recipe
                </Button>
                <Button type="button" variant="ghost" onClick={() => setResults(null)}>
                  Re-paste
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── cost summary ── */}
      {rows.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-white/60">
            Computed cost
            {hasPartialCost && <span className="text-amber-300/80"> (partial)</span>}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-white">
            <Euro className="h-4 w-4" />
            {totalCost.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}
