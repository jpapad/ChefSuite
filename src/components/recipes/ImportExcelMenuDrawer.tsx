import { useRef, useState } from 'react'
import {
  FileSpreadsheet, Loader2, ArrowLeft, Check, AlertCircle,
  ChevronRight, Tag, UtensilsCrossed,
} from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import {
  parseExcelFile, suggestColumnMapping, applyMapping,
  type ColumnMapping, type ExcelMenuRow, type ParsedExcelData,
} from '../../lib/excelMenu'
import { BuffetLabelsDrawer } from '../menus/BuffetLabelsDrawer'
import type { ImportedRecipe } from '../../lib/gemini'
import type { MenuItem, MenuWithSections, Recipe } from '../../types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  onBatchImport: (rows: ImportedRecipe[]) => void
}

type Step = 'upload' | 'mapping' | 'preview'
type ActionMode = 'recipes' | 'labels' | null

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: 'name',        label: 'Dish Name',    required: true },
  { key: 'description', label: 'Description' },
  { key: 'category',    label: 'Category / Section' },
  { key: 'price',       label: 'Price' },
  { key: 'allergens',   label: 'Allergens' },
  { key: 'ingredients', label: 'Ingredients' },
]

function buildSyntheticMenu(rows: ExcelMenuRow[]): { menu: MenuWithSections; recipes: Recipe[] } {
  const now = new Date().toISOString()
  const syntheticRecipes: Recipe[] = []
  const menuId = crypto.randomUUID()

  // Group by category → sections
  const sectionMap = new Map<string, ExcelMenuRow[]>()
  for (const row of rows) {
    const sec = row.category ?? 'Menu'
    if (!sectionMap.has(sec)) sectionMap.set(sec, [])
    sectionMap.get(sec)!.push(row)
  }

  let sortOrder = 0
  const sections = Array.from(sectionMap.entries()).map(([sectionName, sectionRows], si) => {
    const sectionId = crypto.randomUUID()

    const items: MenuItem[] = sectionRows.map((row, ri) => {
      const itemId = crypto.randomUUID()
      const recipeId = row.allergens.length > 0 ? crypto.randomUUID() : null

      if (recipeId) {
        syntheticRecipes.push({
          id: recipeId,
          team_id: '',
          title: row.name,
          description: row.description,
          instructions: null,
          allergens: row.allergens,
          category: null,
          image_url: null,
          prep_time: null,
          cook_time: null,
          servings: null,
          difficulty: null,
          cost_per_portion: null,
          selling_price: row.price,
          parent_recipe_id: null,
          variation_label: null,
          calories: null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          fiber_g: null,
          sodium_mg: null,
          created_at: now,
          updated_at: now,
        } as Recipe)
      }

      return {
        id: itemId,
        section_id: sectionId,
        recipe_id: recipeId,
        name: row.name,
        description: row.description,
        name_el: null,
        description_el: null,
        price: row.price,
        available: true,
        tags: [],
        sort_order: sortOrder++ + ri,
        created_at: now,
      } as MenuItem
    })

    return {
      id: sectionId,
      menu_id: menuId,
      name: sectionName,
      sort_order: si,
      created_at: now,
      items,
    }
  })

  const menu: MenuWithSections = {
    id: menuId,
    team_id: '',
    name: 'Imported Menu',
    type: 'buffet',
    description: null,
    price_per_person: null,
    active: true,
    show_prices: true,
    valid_from: null,
    valid_to: null,
    print_template: 'classic',
    logo_url: null,
    custom_footer: null,
    created_at: now,
    updated_at: now,
    sections,
  }

  return { menu, recipes: syntheticRecipes }
}

export function ImportExcelMenuDrawer({ open, onClose, onBatchImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  const [parsed, setParsed] = useState<ParsedExcelData | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: null, description: null, category: null,
    price: null, allergens: null, ingredients: null,
  })
  const [rows, setRows] = useState<ExcelMenuRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [buffetMenu, setBuffetMenu] = useState<MenuWithSections | null>(null)
  const [buffetRecipes, setBuffetRecipes] = useState<Recipe[]>([])

  function reset() {
    setStep('upload')
    setLoading(false)
    setError(null)
    setFileName('')
    setParsed(null)
    setMapping({ name: null, description: null, category: null, price: null, allergens: null, ingredients: null })
    setRows([])
    setSelected(new Set())
    setActionMode(null)
    setBuffetMenu(null)
    setBuffetRecipes([])
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setFileName(file.name)
    setError(null)
    setLoading(true)
    try {
      const data = await parseExcelFile(file)
      if (data.headers.length === 0) throw new Error('The file appears to be empty or has no columns.')
      setParsed(data)

      const suggested = await suggestColumnMapping(data.headers, data.rows)
      setMapping(suggested)
      setStep('mapping')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file. Make sure it is a valid Excel or CSV file.')
    } finally {
      setLoading(false)
    }
  }

  function applyAndPreview() {
    if (!parsed || !mapping.name) {
      setError('Please select at least the "Dish Name" column.')
      return
    }
    const result = applyMapping(parsed.rows, mapping)
    if (result.length === 0) {
      setError('No rows with a dish name were found. Check the column mapping.')
      return
    }
    setRows(result)
    setSelected(new Set(result.map((_, i) => i)))
    setError(null)
    setStep('preview')
  }

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((_, i) => i))
    )
  }

  function handleImportAsRecipes() {
    const selectedRows = rows.filter((_, i) => selected.has(i))
    const imported: ImportedRecipe[] = selectedRows.map((row) => ({
      title: row.name,
      description: row.description ?? '',
      instructions: row.ingredients ? `Ingredients:\n${row.ingredients}` : null,
      allergens: row.allergens,
      cost_per_portion: null,
      ingredients: [],
      extractedIngredients: [],
    }))
    onBatchImport(imported)
    reset()
    onClose()
  }

  function handleOpenBuffetLabels() {
    const selectedRows = rows.filter((_, i) => selected.has(i))
    const { menu, recipes } = buildSyntheticMenu(selectedRows)
    setBuffetMenu(menu)
    setBuffetRecipes(recipes)
    setActionMode('labels')
  }

  // If buffet labels drawer is open, render it on top
  if (actionMode === 'labels' && buffetMenu) {
    return (
      <BuffetLabelsDrawer
        open
        onClose={() => { setActionMode(null); handleClose() }}
        menu={buffetMenu}
        recipes={buffetRecipes}
      />
    )
  }

  const headers = parsed?.headers ?? []
  const sampleRows = parsed?.rows.slice(0, 3) ?? []

  return (
    <Drawer open={open} onClose={handleClose} title="Import Excel Menu">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <FileSpreadsheet className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Upload an Excel (.xlsx, .xls) or CSV file with your menu. AI will suggest which column is the dish name, description, category, price and allergens.</p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className={cn(
              'w-full flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition',
              loading
                ? 'border-emerald-500/40 bg-emerald-500/5 cursor-wait'
                : 'border-white/15 hover:border-emerald-500/50 hover:bg-white/3 cursor-pointer',
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                <span className="text-sm text-white/60">Reading file and detecting columns…</span>
                {fileName && <span className="text-xs text-white/35">{fileName}</span>}
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-8 w-8 text-white/30" />
                <span className="text-sm font-medium text-white/60">Click to upload Excel / CSV</span>
                <span className="text-xs text-white/30">.xlsx · .xls · .csv</span>
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
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Column Mapping ── */}
      {step === 'mapping' && parsed && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <FileSpreadsheet className="h-4 w-4 mt-0.5 shrink-0" />
            <p>AI detected {parsed.rows.length} rows in <strong>{fileName}</strong>. Confirm the column mapping below.</p>
          </div>

          {/* Sample data table */}
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-white/50 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-white/5">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-white/70 whitespace-nowrap max-w-[160px] truncate">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mapping selects */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-white/80">Column Mapping</p>
            {MAPPING_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="flex items-center gap-3">
                <span className={cn('w-40 shrink-0 text-sm', required ? 'text-white/80' : 'text-white/50')}>
                  {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                </span>
                <select
                  value={mapping[key] ?? ''}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [key]: e.target.value || null }))}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                >
                  <option value="">— not in file —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={reset}>
              Back
            </Button>
            <Button
              type="button"
              leftIcon={<ChevronRight className="h-4 w-4" />}
              onClick={applyAndPreview}
              disabled={!mapping.name}
            >
              Preview Rows
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview + Action ── */}
      {step === 'preview' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">
              {selected.size} of {rows.length} rows selected
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              {selected.size === rows.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {/* Row list */}
          <ul className="glass rounded-xl divide-y divide-glass-border max-h-80 overflow-y-auto">
            {rows.map((row, i) => (
              <li
                key={i}
                onClick={() => toggleRow(i)}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 cursor-pointer transition',
                  selected.has(i) ? 'bg-emerald-500/5' : 'opacity-40',
                )}
              >
                <div className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition',
                  selected.has(i) ? 'border-emerald-400 bg-emerald-400' : 'border-white/30',
                )}>
                  {selected.has(i) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm text-white truncate">{row.name}</span>
                    {row.price != null && (
                      <span className="text-xs text-white/50 shrink-0">€{row.price.toFixed(2)}</span>
                    )}
                  </div>
                  {row.category && (
                    <span className="text-xs text-emerald-400/80">{row.category}</span>
                  )}
                  {row.description && (
                    <p className="text-xs text-white/50 truncate mt-0.5">{row.description}</p>
                  )}
                  {row.allergens.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.allergens.map((a) => (
                        <span key={a} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Action choice */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/80">What would you like to do?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleImportAsRecipes}
                disabled={selected.size === 0}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition',
                  selected.size > 0
                    ? 'border-brand-orange/40 hover:border-brand-orange hover:bg-brand-orange/5 cursor-pointer'
                    : 'border-white/10 opacity-40 cursor-not-allowed',
                )}
              >
                <UtensilsCrossed className="h-6 w-6 text-brand-orange" />
                <span className="text-sm font-medium text-white">Import as Recipes</span>
                <span className="text-xs text-white/40 text-center">Add to your recipe library</span>
              </button>

              <button
                type="button"
                onClick={handleOpenBuffetLabels}
                disabled={selected.size === 0}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition',
                  selected.size > 0
                    ? 'border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-500/5 cursor-pointer'
                    : 'border-white/10 opacity-40 cursor-not-allowed',
                )}
              >
                <Tag className="h-6 w-6 text-emerald-400" />
                <span className="text-sm font-medium text-white">Buffet Labels</span>
                <span className="text-xs text-white/40 text-center">Print labels for your buffet</span>
              </button>
            </div>
          </div>

          <div className="flex justify-start pt-1">
            <Button
              type="button"
              variant="ghost"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => setStep('mapping')}
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  )
}
