import { useEffect, useRef, useState } from 'react'
import {
  FileSpreadsheet, Loader2, ArrowLeft, Check, AlertCircle,
  ChevronRight, Tag, UtensilsCrossed, Layers, CopyX, Sparkles, Languages,
} from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import {
  parseExcelFile, suggestColumnMapping, applyMapping,
  collectAllergenTokens, resolveAllergenToken,
  ALLERGEN_KEYS, ALLERGEN_LABEL_EL,
  type ColumnMapping, type ExcelMenuRow, type ParsedExcelData,
} from '../../lib/excelMenu'
import { BuffetLabelsDrawer } from '../menus/BuffetLabelsDrawer'
import { suggestMultipleRecipeDetails, translateMenuItems, generateDescriptions, type ImportedRecipe } from '../../lib/gemini'
import type { MenuItem, MenuWithSections, Recipe } from '../../types/database.types'

type DuplicateReason = 'existing' | 'infile'

interface Props {
  open: boolean
  onClose: () => void
  onBatchImport: (rows: ImportedRecipe[]) => void
  existingTitles?: string[]
}

type Step = 'upload' | 'sheet' | 'mapping' | 'preview'
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
        name_el: row.name_el ?? null,
        description_el: row.description_el ?? null,
        name_bg: row.name_bg ?? null,
        description_bg: row.description_bg ?? null,
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

export function ImportExcelMenuDrawer({ open, onClose, onBatchImport, existingTitles = [] }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoFillTriggeredRef = useRef(false)

  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  // Sheet selection
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')

  const [parsed, setParsed] = useState<ParsedExcelData | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: null, description: null, category: null,
    price: null, allergens: null, ingredients: null,
  })
  const [rows, setRows] = useState<ExcelMenuRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [duplicates, setDuplicates] = useState<Map<number, DuplicateReason>>(new Map())

  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [buffetMenu, setBuffetMenu] = useState<MenuWithSections | null>(null)
  const [buffetRecipes, setBuffetRecipes] = useState<Recipe[]>([])

  const [customAllergenMap, setCustomAllergenMap] = useState<Record<string, string>>({})
  const [allergenTokens, setAllergenTokens] = useState<string[]>([])

  const [aiFillingRows, setAiFillingRows] = useState(false)
  const [aiFillProgress, setAiFillProgress] = useState<{ done: number; total: number } | null>(null)
  const [aiFillDone, setAiFillDone] = useState(false)
  const [aiFillDoneMsg, setAiFillDoneMsg] = useState('')

  const [translating, setTranslating] = useState(false)
  const [translateDone, setTranslateDone] = useState(false)
  const [translateDoneMsg, setTranslateDoneMsg] = useState('')

  const [translatingDesc, setTranslatingDesc] = useState(false)
  const [translateDescDone, setTranslateDescDone] = useState(false)
  const [translateDescDoneMsg, setTranslateDescDoneMsg] = useState('')

  // Auto-trigger AI fill when entering preview if any selected row is missing a description
  useEffect(() => {
    if (step !== 'preview' || autoFillTriggeredRef.current) return
    const hasMissingDesc = Array.from(selected).some((i) => !rows[i]?.description?.trim())
    if (!hasMissingDesc) return
    autoFillTriggeredRef.current = true
    void handleAIFillRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function reset() {
    setStep('upload')
    setLoading(false)
    setError(null)
    setFileName('')
    setUploadedFile(null)
    setSheetNames([])
    setSelectedSheet('')
    setParsed(null)
    setMapping({ name: null, description: null, category: null, price: null, allergens: null, ingredients: null })
    setRows([])
    setSelected(new Set())
    setDuplicates(new Map())
    setActionMode(null)
    setBuffetMenu(null)
    setBuffetRecipes([])
    setCustomAllergenMap({})
    setAllergenTokens([])
    setAiFillingRows(false)
    setAiFillProgress(null)
    setAiFillDone(false)
    setAiFillDoneMsg('')
    setTranslating(false)
    setTranslateDone(false)
    setTranslateDoneMsg('')
    setTranslatingDesc(false)
    setTranslateDescDone(false)
    setTranslateDescDoneMsg('')
    autoFillTriggeredRef.current = false
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
      if (data.sheetNames.length === 0) throw new Error('The file appears to be empty.')

      setUploadedFile(file)
      setSheetNames(data.sheetNames)
      setSelectedSheet(data.sheetName)

      if (data.sheetNames.length > 1) {
        // Let the user pick a sheet first
        setLoading(false)
        setStep('sheet')
        return
      }

      // Single sheet — go straight to mapping
      if (data.headers.length === 0) throw new Error('The sheet appears to be empty or has no columns.')
      setParsed(data)
      const suggested = await suggestColumnMapping(data.headers, data.rows)
      setMapping(suggested)
      setAllergenTokens(collectAllergenTokens(data.rows, suggested.allergens))
      setCustomAllergenMap({})
      setStep('mapping')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file. Make sure it is a valid Excel or CSV file.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSheetConfirm() {
    if (!uploadedFile) return
    setError(null)
    setLoading(true)
    try {
      const data = await parseExcelFile(uploadedFile, selectedSheet)
      if (data.headers.length === 0) throw new Error('The selected sheet appears to be empty or has no columns.')
      setParsed(data)
      const suggested = await suggestColumnMapping(data.headers, data.rows)
      setMapping(suggested)
      setAllergenTokens(collectAllergenTokens(data.rows, suggested.allergens))
      setCustomAllergenMap({})
      setStep('mapping')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the sheet.')
    } finally {
      setLoading(false)
    }
  }

  function applyAndPreview() {
    if (!parsed || !mapping.name) {
      setError('Please select at least the "Dish Name" column.')
      return
    }
    const result = applyMapping(parsed.rows, mapping, customAllergenMap)
    if (result.length === 0) {
      setError('No rows with a dish name were found. Check the column mapping.')
      return
    }

    // Detect duplicates
    const existingLower = new Set(existingTitles.map((t) => t.trim().toLowerCase()))
    const seenInFile = new Set<string>()
    const dupMap = new Map<number, DuplicateReason>()

    result.forEach((row, i) => {
      const key = row.name.trim().toLowerCase()
      if (existingLower.has(key)) {
        dupMap.set(i, 'existing')
      } else if (seenInFile.has(key)) {
        dupMap.set(i, 'infile')
      } else {
        seenInFile.add(key)
      }
    })

    setRows(result)
    setDuplicates(dupMap)
    // Pre-select only non-duplicates
    setSelected(new Set(result.map((_, i) => i).filter((i) => !dupMap.has(i))))
    setError(null)
    autoFillTriggeredRef.current = false
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

  async function handleAIFillRows() {
    const indices = Array.from(selected).filter((i) => {
      const r = rows[i]
      return !r.description?.trim() || r.allergens.length === 0 || r.difficulty == null || r.prep_time == null || !r.instructions?.trim()
    })
    if (indices.length === 0) {
      setAiFillDone(true)
      setTimeout(() => setAiFillDone(false), 2000)
      return
    }
    setAiFillingRows(true)
    setAiFillDone(false)
    setError(null)
    setAiFillProgress({ done: 0, total: indices.length })
    try {
      const titles = indices.map((i) => rows[i].name)
      const suggestions = await suggestMultipleRecipeDetails(titles)
      setAiFillProgress({ done: indices.length, total: indices.length })
      const updatedRows = [...rows]
      let filledCount = 0
      indices.forEach((rowIdx, si) => {
        const s = suggestions[si]
        const row = updatedRows[rowIdx]
        const next = {
          ...row,
          name_el:      row.name_el == null         ? (s.name_en ?? row.name_el)          : row.name_el,
          name_bg:      row.name_bg == null         ? (s.name_bg ?? row.name_bg)          : row.name_bg,
          description:  !row.description?.trim()    ? (s.description  ?? row.description) : row.description,
          allergens:    row.allergens.length === 0  ? s.allergens                         : row.allergens,
          difficulty:   row.difficulty  == null     ? s.difficulty                        : row.difficulty,
          prep_time:    row.prep_time   == null     ? s.prep_time                         : row.prep_time,
          cook_time:    row.cook_time   == null     ? s.cook_time                         : row.cook_time,
          servings:     row.servings    == null     ? s.servings                          : row.servings,
          instructions: !row.instructions?.trim()   ? (s.instructions ?? row.instructions): row.instructions,
        }
        if (JSON.stringify(next) !== JSON.stringify(row)) filledCount++
        updatedRows[rowIdx] = next
      })
      setRows(updatedRows)
      setAiFillDoneMsg(filledCount > 0
        ? `Συμπληρώθηκαν ${filledCount} πεδία ✓`
        : 'Όλα τα πεδία ήταν ήδη συμπληρωμένα')
      setAiFillDone(true)
      setTimeout(() => setAiFillDone(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI συμπλήρωση απέτυχε — έλεγξε τη σύνδεση')
    } finally {
      setAiFillingRows(false)
      setAiFillProgress(null)
    }
  }

  async function handleTranslateNames() {
    const indices = Array.from(selected).filter((i) => !rows[i].name_el)
    if (indices.length === 0) {
      setTranslateDoneMsg('Όλα τα ονόματα έχουν ήδη μεταφραστεί')
      setTranslateDone(true)
      setTimeout(() => setTranslateDone(false), 2500)
      return
    }
    setTranslating(true)
    setTranslateDone(false)
    setError(null)
    try {
      const CHUNK = 25
      const updatedRows = [...rows]
      for (let c = 0; c < indices.length; c += CHUNK) {
        const chunk = indices.slice(c, c + CHUNK)
        const items = chunk.map((i) => ({ name: rows[i].name, description: rows[i].description ?? null }))
        const translations = await translateMenuItems(items)
        chunk.forEach((rowIdx, j) => {
          const t = translations[j]
          updatedRows[rowIdx] = {
            ...updatedRows[rowIdx],
            name_el: updatedRows[rowIdx].name_el ?? t.name_el ?? null,
            name_bg: updatedRows[rowIdx].name_bg ?? t.name_bg ?? null,
          }
        })
      }
      setRows(updatedRows)
      setTranslateDoneMsg(`Μεταφράστηκαν ${indices.length} ονόματα ✓`)
      setTranslateDone(true)
      setTimeout(() => setTranslateDone(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Μετάφραση απέτυχε — έλεγξε τη σύνδεση')
    } finally {
      setTranslating(false)
    }
  }

  async function handleTranslateDescriptions() {
    // Rows needing translation (have Greek description, missing English)
    const toTranslate = Array.from(selected).filter((i) => rows[i].description?.trim() && !rows[i].description_el)
    // Rows needing generation (no description at all)
    const toGenerate  = Array.from(selected).filter((i) => !rows[i].description?.trim() && !rows[i].description_el)

    if (toTranslate.length === 0 && toGenerate.length === 0) {
      setTranslateDescDoneMsg('Όλες οι περιγραφές έχουν ήδη συμπληρωθεί')
      setTranslateDescDone(true)
      setTimeout(() => setTranslateDescDone(false), 2500)
      return
    }
    setTranslatingDesc(true)
    setTranslateDescDone(false)
    setError(null)
    try {
      const CHUNK = 15
      const updatedRows = [...rows]

      // Translate existing descriptions
      for (let c = 0; c < toTranslate.length; c += CHUNK) {
        const chunk = toTranslate.slice(c, c + CHUNK)
        const items = chunk.map((i) => ({ name: rows[i].name, description: rows[i].description ?? null }))
        const translations = await translateMenuItems(items)
        chunk.forEach((rowIdx, j) => {
          const t = translations[j]
          updatedRows[rowIdx] = {
            ...updatedRows[rowIdx],
            description_el: updatedRows[rowIdx].description_el ?? t.description_el ?? null,
            description_bg: updatedRows[rowIdx].description_bg ?? t.description_bg ?? null,
          }
        })
      }

      // Generate descriptions from name for rows with no description
      for (let c = 0; c < toGenerate.length; c += CHUNK) {
        const chunk = toGenerate.slice(c, c + CHUNK)
        const names = chunk.map((i) => rows[i].name)
        const generated = await generateDescriptions(names)
        chunk.forEach((rowIdx, j) => {
          if (generated[j]) {
            updatedRows[rowIdx] = { ...updatedRows[rowIdx], description_el: generated[j] }
          }
        })
      }

      setRows(updatedRows)
      const parts: string[] = []
      if (toTranslate.length > 0) parts.push(`${toTranslate.length} μεταφράστηκαν`)
      if (toGenerate.length > 0)  parts.push(`${toGenerate.length} δημιουργήθηκαν`)
      setTranslateDescDoneMsg(`${parts.join(', ')} ✓`)
      setTranslateDescDone(true)
      setTimeout(() => setTranslateDescDone(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Μετάφραση/δημιουργία απέτυχε — έλεγξε τη σύνδεση')
    } finally {
      setTranslatingDesc(false)
    }
  }

  function handleImportAsRecipes() {
    const selectedRows = rows.filter((_, i) => selected.has(i))
    const imported: ImportedRecipe[] = selectedRows.map((row) => ({
      title: row.name,
      description: row.description ?? '',
      instructions: row.instructions ?? (row.ingredients ? `Ingredients:\n${row.ingredients}` : null),
      allergens: row.allergens,
      cost_per_portion: null,
      ingredients: [],
      extractedIngredients: [],
      category: row.category,
      difficulty: row.difficulty,
      prep_time: row.prep_time,
      cook_time: row.cook_time,
      servings: row.servings,
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

      {/* ── Step 1b: Sheet Picker ── */}
      {step === 'sheet' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <Layers className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              The file <strong>{fileName}</strong> has {sheetNames.length} sheets. Select which one to import.
            </p>
          </div>

          <ul className="space-y-2">
            {sheetNames.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setSelectedSheet(name)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition',
                    selectedSheet === name
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-white/10 hover:border-white/25 text-white/60',
                  )}
                >
                  <div className={cn(
                    'h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition',
                    selectedSheet === name ? 'border-emerald-400 bg-emerald-400' : 'border-white/30',
                  )}>
                    {selectedSheet === name && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{name}</span>
                    <span className="ml-2 text-xs text-white/30">Sheet {i + 1}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

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
              leftIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              onClick={() => void handleSheetConfirm()}
              disabled={!selectedSheet || loading}
            >
              {loading ? 'Loading sheet…' : 'Use this sheet'}
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
                  onChange={(e) => {
                    const val = e.target.value || null
                    setMapping((prev) => ({ ...prev, [key]: val }))
                    if (key === 'allergens' && parsed) {
                      setAllergenTokens(collectAllergenTokens(parsed.rows, val))
                      setCustomAllergenMap({})
                    }
                  }}
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

          {/* Allergen value mapping */}
          {mapping.allergens && allergenTokens.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-300/70 uppercase tracking-wider">
                Αντιστοίχιση αλλεργιογόνων στη στήλη "{mapping.allergens}"
              </p>
              <div className="space-y-2">
                {allergenTokens.map((token) => {
                  const auto = resolveAllergenToken(token)
                  const chosen = customAllergenMap[token]
                  const effective = chosen !== undefined ? chosen : (auto ?? '')
                  return (
                    <div key={token} className="flex items-center gap-3">
                      <span className="flex-1 text-sm text-white/80 truncate font-mono">{token}</span>
                      <span className="text-white/20">→</span>
                      <select
                        value={effective}
                        onChange={(e) => setCustomAllergenMap((prev) => ({ ...prev, [token]: e.target.value }))}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 bg-white/5',
                          effective ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/30 text-red-400',
                        )}
                      >
                        <option value="">— αγνόησε —</option>
                        {ALLERGEN_KEYS.map((k) => (
                          <option key={k} value={k}>{ALLERGEN_LABEL_EL[k]} ({k})</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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

          {/* Duplicate summary banner */}
          {duplicates.size > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              <CopyX className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {duplicates.size} διπλότυπ{duplicates.size === 1 ? 'ο' : 'α'} βρέθηκ{duplicates.size === 1 ? 'ε' : 'αν'} και αποεπιλέχτηκ{duplicates.size === 1 ? 'ε' : 'αν'} αυτόματα.
                </p>
                <p className="text-amber-300/60 text-xs mt-0.5">
                  Μπορείς να τα επιλέξεις χειροκίνητα αν θέλεις να τα περάσεις ξανά.
                </p>
              </div>
            </div>
          )}

          {/* Error display (AI fill or other) */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* AI Fill button */}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => void handleAIFillRows()}
              disabled={aiFillingRows || translating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-orange/40 bg-brand-orange/5 px-4 py-2.5 text-sm font-medium text-brand-orange transition hover:border-brand-orange hover:bg-brand-orange/10 disabled:opacity-60 disabled:pointer-events-none"
            >
              {aiFillingRows ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI ανάλυση {aiFillProgress?.done}/{aiFillProgress?.total}…
                </>
              ) : aiFillDone ? (
                <>
                  <Check className="h-4 w-4" />
                  {aiFillDoneMsg || 'Συμπληρώθηκε!'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI Συμπλήρωση κενών πεδίων ({selected.size} επιλεγμένα)
                </>
              )}
            </button>
          )}

          {/* Translate names button */}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => void handleTranslateNames()}
              disabled={translating || translatingDesc || aiFillingRows}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-400/40 bg-sky-400/5 px-4 py-2.5 text-sm font-medium text-sky-300 transition hover:border-sky-400 hover:bg-sky-400/10 disabled:opacity-60 disabled:pointer-events-none"
            >
              {translating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Μετάφραση ονομάτων…
                </>
              ) : translateDone ? (
                <>
                  <Check className="h-4 w-4" />
                  {translateDoneMsg}
                </>
              ) : (
                <>
                  <Languages className="h-4 w-4" />
                  Μετάφραση ονομάτων → Αγγλικά + Βουλγαρικά
                </>
              )}
            </button>
          )}

          {/* Translate descriptions button */}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => void handleTranslateDescriptions()}
              disabled={translatingDesc || translating || aiFillingRows}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-400/40 bg-violet-400/5 px-4 py-2.5 text-sm font-medium text-violet-300 transition hover:border-violet-400 hover:bg-violet-400/10 disabled:opacity-60 disabled:pointer-events-none"
            >
              {translatingDesc ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Μετάφραση περιγραφών…
                </>
              ) : translateDescDone ? (
                <>
                  <Check className="h-4 w-4" />
                  {translateDescDoneMsg}
                </>
              ) : (
                <>
                  <Languages className="h-4 w-4" />
                  Μετάφραση / δημιουργία περιγραφών (Αγγλικά)
                </>
              )}
            </button>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">
              {selected.size} από {rows.length} γραμμές επιλεγμένες
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              {selected.size === rows.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
            </button>
          </div>

          {/* Row list */}
          <ul className="glass rounded-xl divide-y divide-glass-border max-h-80 overflow-y-auto">
            {rows.map((row, i) => {
              const dupReason = duplicates.get(i)
              return (
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-white truncate">{row.name}</span>
                      {row.name_el && (
                        <span className="text-xs text-sky-300/70 shrink-0 italic">{row.name_el}</span>
                      )}
                      {row.price != null && (
                        <span className="text-xs text-white/50 shrink-0">€{row.price.toFixed(2)}</span>
                      )}
                      {dupReason === 'existing' && (
                        <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-300 shrink-0">
                          Υπάρχει ήδη
                        </span>
                      )}
                      {dupReason === 'infile' && (
                        <span className="rounded-full bg-orange-500/20 border border-orange-500/40 px-2 py-0.5 text-[10px] text-orange-300 shrink-0">
                          Διπλότυπο στο αρχείο
                        </span>
                      )}
                    </div>
                    {row.category && (
                      <span className="text-xs text-emerald-400/80">{row.category}</span>
                    )}
                    {row.description && (
                      <p className="text-xs text-white/50 truncate mt-0.5">{row.description}</p>
                    )}
                    {(row.difficulty || row.prep_time != null || row.servings != null) && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {row.difficulty && (
                          <span className="rounded-full bg-brand-orange/15 border border-brand-orange/30 px-2 py-0.5 text-[10px] text-brand-orange/80">
                            ✦ {row.difficulty}
                          </span>
                        )}
                        {row.prep_time != null && (
                          <span className="rounded-full bg-brand-orange/15 border border-brand-orange/30 px-2 py-0.5 text-[10px] text-brand-orange/80">
                            ✦ {row.prep_time + (row.cook_time ?? 0)} λεπτά
                          </span>
                        )}
                        {row.servings != null && (
                          <span className="rounded-full bg-brand-orange/15 border border-brand-orange/30 px-2 py-0.5 text-[10px] text-brand-orange/80">
                            ✦ {row.servings} μερίδες
                          </span>
                        )}
                      </div>
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
              )
            })}
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
