import { useRef, useState } from 'react'
import {
  ScanLine, Loader2, Check, XCircle, CheckCircle2, Plus,
  AlertCircle, ArrowLeft, FileImage,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useInventory } from '../../contexts/InventoryContext'
import type { ImportedRecipe, ExtractedIngredient } from '../../lib/gemini'
import type { InventoryItem, RecipeIngredientDraft } from '../../types/database.types'
import { cn } from '../../lib/cn'

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

interface ParsedRecipe {
  title: string
  description: string | null
  instructions: string | null
  allergens: string[]
  ingredients: ExtractedIngredient[]
}

function fuzzyMatch(a: string, b: string) {
  const la = a.toLowerCase().trim()
  const lb = b.toLowerCase().trim()
  return la === lb || la.includes(lb) || lb.includes(la)
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ScanRecipeDrawer({ open, onClose, onImported }: Props) {
  const { t } = useTranslation()
  const { items: inventory, create: createInventoryItem } = useInventory()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null)
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [addingIdx, setAddingIdx] = useState<number | null>(null)
  const [fileName, setFileName] = useState<string>('')

  function matchToInventory(ingredients: ExtractedIngredient[]): MatchResult[] {
    return ingredients.map((ing) => {
      const match = inventory.find((i) => fuzzyMatch(i.name, ing.name))
      return { extracted: ing, matched: match ?? null, quantity: ing.quantity }
    })
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setFileName(file.name)
    setScanning(true)
    setError(null)
    try {
      const file_base64 = await fileToBase64(file)
      const { data, error: fnErr } = await supabase.functions.invoke('parse-recipe', {
        body: { file_base64, media_type: file.type },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error as string)

      const result = data as ParsedRecipe
      setParsed(result)
      setMatches(matchToInventory(result.ingredients))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recipes.scan.error'))
    } finally {
      setScanning(false)
    }
  }

  async function handleAddToInventory(idx: number) {
    if (addingIdx !== null) return
    const m = matches[idx]
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
      setMatches((prev) =>
        prev.map((match, i) => (i === idx ? { ...match, matched: newItem } : match)),
      )
    } finally {
      setAddingIdx(null)
    }
  }

  function handleConfirm() {
    if (!parsed) return
    const ingredients: RecipeIngredientDraft[] = matches
      .filter((m): m is MatchResult & { matched: InventoryItem } => m.matched !== null)
      .map((m) => ({ inventory_item_id: m.matched.id, quantity: m.quantity }))

    onImported({
      title: parsed.title,
      description: parsed.description ?? '',
      instructions: parsed.instructions ?? '',
      allergens: parsed.allergens,
      cost_per_portion: null,
      ingredients,
      extractedIngredients: matches.map((m) => m.extracted),
    })
  }

  function handleClose() {
    if (scanning) return
    setParsed(null)
    setMatches([])
    setError(null)
    setFileName('')
    onClose()
  }

  return (
    <Drawer open={open} onClose={handleClose} title={t('recipes.scan.title')}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />

      {!parsed ? (
        /* ── Upload state ── */
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange">
            <ScanLine className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{t('recipes.scan.hint')}</p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className={cn(
              'w-full flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition',
              scanning
                ? 'border-brand-orange/40 bg-brand-orange/5 cursor-wait'
                : 'border-white/15 hover:border-brand-orange/50 hover:bg-white/3 cursor-pointer',
            )}
          >
            {scanning ? (
              <>
                <Loader2 className="h-8 w-8 text-brand-orange animate-spin" />
                <span className="text-sm text-white/60">{t('recipes.scan.scanning')}</span>
                {fileName && <span className="text-xs text-white/35">{fileName}</span>}
              </>
            ) : (
              <>
                <FileImage className="h-8 w-8 text-white/30" />
                <span className="text-sm font-medium text-white/60">{t('recipes.scan.upload')}</span>
                <span className="text-xs text-white/30">{t('recipes.scan.formats')}</span>
              </>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={scanning}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Preview state ── */
        <div className="space-y-5">
          {/* Recipe title + description */}
          <div className="space-y-1">
            <h3 className="font-semibold text-white text-lg">{parsed.title}</h3>
            {parsed.description && (
              <p className="text-sm text-white/60">{parsed.description}</p>
            )}
          </div>

          {/* Allergens */}
          {parsed.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.allergens.map((a) => (
                <span key={a} className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                  {a}
                </span>
              ))}
            </div>
          )}

          {/* Ingredients */}
          {matches.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-white/80">
                {t('recipes.import.ingredients')}
              </p>
              <ul className="glass rounded-xl divide-y divide-glass-border">
                {matches.map((m, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    {m.matched
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      : <XCircle className="h-4 w-4 shrink-0 text-white/30" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">
                        {m.matched ? m.matched.name : m.extracted.name}
                      </div>
                      <div className="text-xs text-white/50">
                        {m.quantity} {m.extracted.unit}
                        {!m.matched && (
                          <span className="text-white/30"> · {t('recipes.import.notInInventory')}</span>
                        )}
                      </div>
                    </div>
                    {!m.matched && (
                      <button
                        type="button"
                        onClick={() => void handleAddToInventory(i)}
                        disabled={addingIdx !== null}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-orange/40 px-2.5 py-1.5 text-xs font-medium text-brand-orange transition hover:bg-brand-orange/10 disabled:opacity-50"
                      >
                        {addingIdx === i
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Plus className="h-3 w-3" />
                        }
                        {t('recipes.import.addToInventory')}
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
              onClick={() => { setParsed(null); setMatches([]); setError(null) }}
              disabled={addingIdx !== null}
            >
              {t('common.back')}
            </Button>
            <Button
              type="button"
              leftIcon={<Check className="h-4 w-4" />}
              onClick={handleConfirm}
              disabled={addingIdx !== null}
            >
              {t('recipes.import.confirm')}
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
