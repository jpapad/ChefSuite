/**
 * Excel Import Wizard for Inventory items.
 *
 * Flow:
 *   1. Upload .xlsx / .csv  → parse with SheetJS
 *   2. Auto-detect column → field mappings (editable by user)
 *   3. Preview first 8 rows + duplicate warnings (fuzzyScore ≥ 75)
 *   4. Confirm → batch-import to Supabase via useInventory.create
 */

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { ChevronRight, AlertTriangle, CheckCircle2, X, Loader2, FileSpreadsheet } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useInventory } from '../../hooks/useInventory'
import { useAuth } from '../../contexts/AuthContext'
import { findDuplicates } from '../../lib/fuzzyMatch'
import { logActivity } from '../../lib/activityLog'
import type { InventoryInsert } from '../../types/database.types'

// ── Field definitions ──────────────────────────────────────────────────────

export type ImportField =
  | 'name' | 'unit' | 'quantity' | 'min_stock_level'
  | 'cost_per_unit' | 'category' | 'subcategory' | 'ignore'

interface FieldMeta {
  label: string
  required: boolean
  type: 'string' | 'number'
}

const FIELD_META: Record<ImportField, FieldMeta> = {
  name:            { label: 'Όνομα *',        required: true,  type: 'string' },
  unit:            { label: 'Μονάδα *',        required: true,  type: 'string' },
  quantity:        { label: 'Ποσότητα',         required: false, type: 'number' },
  min_stock_level: { label: 'Ελάχιστο Stock',   required: false, type: 'number' },
  cost_per_unit:   { label: 'Κόστος/Μονάδα',    required: false, type: 'number' },
  category:        { label: 'Κατηγορία',         required: false, type: 'string' },
  subcategory:     { label: 'Υποκατηγορία',      required: false, type: 'string' },
  ignore:          { label: '— Αγνόησε —',       required: false, type: 'string' },
}

/** Keywords (lowercase) that map a header string to an ImportField */
const HEADER_HINTS: [ImportField, string[]][] = [
  ['name',            ['ονομα', 'ονομ', 'name', 'item', 'product', 'ingredient', 'υλικο', 'περιγραφη', 'description']],
  ['unit',            ['μοναδα', 'μμ', 'unit', 'uom', 'measure', 'um']],
  ['quantity',        ['ποσοτητα', 'ποσ', 'qty', 'quantity', 'stock', 'amount', 'αποθεμα']],
  ['min_stock_level', ['ελαχιστο', 'min', 'minimum', 'reorder', 'κατωφλι', 'minstock']],
  ['cost_per_unit',   ['τιμη', 'κοστος', 'price', 'cost', 'unitprice', 'τιμαγορας', 'τιμα']],
  ['category',        ['κατηγορια', 'category', 'cat', 'type', 'τυπος']],
  ['subcategory',     ['υποκατηγορια', 'subcategory', 'subcat', 'subtype']],
]

function detectField(header: string): ImportField {
  const normalized = header
    .toLowerCase()
    .replace(/[άΆ]/g, 'α').replace(/[έΈ]/g, 'ε').replace(/[ήΉ]/g, 'η')
    .replace(/[ίΊϊΪΐ]/g, 'ι').replace(/[όΌ]/g, 'ο').replace(/[ύΎϋΫΰ]/g, 'υ')
    .replace(/[ώΏ]/g, 'ω')
    .replace(/\s+/g, '')
  for (const [field, hints] of HEADER_HINTS) {
    if (hints.some((h) => normalized.includes(h))) return field
  }
  return 'ignore'
}

// ── Types ──────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'preview' | 'done'

interface ParsedRow { [col: string]: string }

interface ImportRow {
  raw: ParsedRow
  mapped: Partial<Record<ImportField, string>>
  duplicates: { id: string; name: string; score: number }[]
  skip: boolean
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload',  label: 'Αρχείο'   },
    { key: 'mapping', label: 'Στήλες'   },
    { key: 'preview', label: 'Προεπισκόπηση' },
    { key: 'done',    label: 'Ολοκλήρωση' },
  ]
  const idx = steps.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
            i < idx  ? 'bg-emerald-500 text-white'
            : i === idx ? 'bg-brand-orange text-white'
            : 'bg-white/10 text-white/40',
          )}>
            {i < idx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={cn(
            'mx-2 text-xs font-medium',
            i === idx ? 'text-white' : 'text-white/40',
          )}>
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-white/20 mr-2" />}
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export function ExcelImportWizard({ onClose }: Props) {
  const { items: existingItems, create } = useInventory()
  const { profile } = useAuth()

  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')

  // Parsed data
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<ParsedRow[]>([])
  const [mappings, setMappings] = useState<Record<string, ImportField>>({})

  // Preview
  const [importRows, setImportRows] = useState<ImportRow[]>([])

  // Import progress
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ ok: number; skipped: number; errors: string[] } | null>(null)

  // ── Step 1: parse file ─────────────────────────────────────────────────

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })

      if (json.length < 2) return

      const hdrs = (json[0] as string[]).map((h) => String(h).trim()).filter(Boolean)
      const rows: ParsedRow[] = (json.slice(1) as string[][])
        .filter((r) => r.some((c) => c !== ''))
        .map((r) => Object.fromEntries(hdrs.map((h, i) => [h, String(r[i] ?? '').trim()])))

      const autoMap: Record<string, ImportField> = {}
      for (const h of hdrs) autoMap[h] = detectField(h)

      setHeaders(hdrs)
      setRawRows(rows)
      setMappings(autoMap)
      setStep('mapping')
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Step 2 → Step 3: build preview rows with duplicate check ──────────

  function buildPreview() {
    const rows: ImportRow[] = rawRows.slice(0, 200).map((raw) => {
      const mapped: Partial<Record<ImportField, string>> = {}
      for (const [col, field] of Object.entries(mappings)) {
        if (field !== 'ignore') mapped[field] = raw[col] ?? ''
      }
      const name = mapped.name?.trim() ?? ''
      const dups = name ? findDuplicates(name, existingItems) : []
      return { raw, mapped, duplicates: dups, skip: dups.length > 0 && dups[0].score >= 90 }
    })
    setImportRows(rows)
    setStep('preview')
  }

  // ── Step 3 → import ────────────────────────────────────────────────────

  async function runImport() {
    setImporting(true)
    let ok = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of importRows) {
      if (row.skip) { skipped++; continue }
      const name = row.mapped.name?.trim()
      const unit = row.mapped.unit?.trim()
      if (!name || !unit) { skipped++; continue }

      const payload: Omit<InventoryInsert, 'team_id'> = {
        name,
        unit,
        quantity:        parseFloat(row.mapped.quantity       ?? '0') || 0,
        min_stock_level: parseFloat(row.mapped.min_stock_level ?? '0') || 0,
        cost_per_unit:   row.mapped.cost_per_unit ? parseFloat(row.mapped.cost_per_unit) || null : null,
        category:        row.mapped.category    || null,
        subcategory:     row.mapped.subcategory || null,
        location_id:     null,
      }

      try {
        const created = await create(payload)
        if (profile?.team_id && profile.id) {
          void logActivity({
            teamId:     profile.team_id,
            userId:     profile.id,
            action:     'import',
            targetType: 'inventory',
            targetId:   created.id,
            targetName: created.name,
            details:    { source: 'excel_import' },
          })
        }
        ok++
      } catch (err) {
        errors.push(`${name}: ${err instanceof Error ? err.message : 'Error'}`)
      }
    }

    setResults({ ok, skipped, errors })
    setStep('done')
    setImporting(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.02] py-16 cursor-pointer hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors"
        >
          <FileSpreadsheet className="h-12 w-12 text-white/30" />
          <div className="text-center">
            <p className="font-semibold text-white">Σύρε το αρχείο εδώ ή κάνε κλικ</p>
            <p className="text-sm text-white/40 mt-1">.xlsx, .xls, .csv — έως 5 MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      )}

      {/* ── Step 2: Column mapping ── */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <p className="text-sm text-white/50">
            Βρέθηκαν <span className="text-white font-semibold">{rawRows.length} γραμμές</span> και{' '}
            <span className="text-white font-semibold">{headers.length} στήλες</span>.
            Επιβεβαίωσε τα mappings:
          </p>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-2.5 text-left text-xs text-white/50 font-semibold uppercase tracking-wide">Στήλη Excel</th>
                  <th className="px-4 py-2.5 text-left text-xs text-white/50 font-semibold uppercase tracking-wide">Δείγμα</th>
                  <th className="px-4 py-2.5 text-left text-xs text-white/50 font-semibold uppercase tracking-wide">Πεδίο</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {headers.map((h) => (
                  <tr key={h}>
                    <td className="px-4 py-2.5 font-medium text-white/80">{h}</td>
                    <td className="px-4 py-2.5 text-white/40 text-xs max-w-[140px] truncate">
                      {rawRows[0]?.[h] ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={mappings[h]}
                        onChange={(e) => setMappings((m) => ({ ...m, [h]: e.target.value as ImportField }))}
                        className="rounded-lg bg-white/10 border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-orange/60"
                      >
                        {(Object.keys(FIELD_META) as ImportField[]).map((f) => (
                          <option key={f} value={f} className="bg-gray-900">
                            {FIELD_META[f].label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setStep('upload')} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-white/70 transition-colors">
              Πίσω
            </button>
            <button
              onClick={buildPreview}
              disabled={!Object.values(mappings).includes('name') || !Object.values(mappings).includes('unit')}
              className="px-5 py-2 rounded-xl bg-brand-orange hover:bg-brand-orange/80 disabled:opacity-40 text-sm font-bold text-white transition-colors"
            >
              Προεπισκόπηση →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/50">
              <span className="text-white font-semibold">{importRows.filter((r) => !r.skip).length}</span> θα εισαχθούν ·{' '}
              <span className="text-amber-400 font-semibold">{importRows.filter((r) => r.skip).length}</span> θα παραλειφθούν ως πιθανά διπλότυπα
            </p>
            <p className="text-xs text-white/30">Εμφάνιση πρώτων {Math.min(importRows.length, 8)} από {importRows.length}</p>
          </div>

          <div className="rounded-xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-3 py-2 text-left text-xs text-white/50 uppercase tracking-wide">Αποδοχή</th>
                  <th className="px-3 py-2 text-left text-xs text-white/50 uppercase tracking-wide">Όνομα</th>
                  <th className="px-3 py-2 text-left text-xs text-white/50 uppercase tracking-wide">Μον.</th>
                  <th className="px-3 py-2 text-left text-xs text-white/50 uppercase tracking-wide">Ποσ.</th>
                  <th className="px-3 py-2 text-left text-xs text-white/50 uppercase tracking-wide">Κόστος</th>
                  <th className="px-3 py-2 text-left text-xs text-white/50 uppercase tracking-wide">Κατηγορία</th>
                  <th className="px-3 py-2 text-left text-xs text-white/50 uppercase tracking-wide">Διπλότυπο;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {importRows.slice(0, 8).map((row, i) => (
                  <tr key={i} className={cn(row.skip && 'opacity-50')}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!row.skip}
                        onChange={() =>
                          setImportRows((rows) =>
                            rows.map((r, j) => j === i ? { ...r, skip: !r.skip } : r),
                          )
                        }
                        className="accent-brand-orange"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-white">{row.mapped.name || '—'}</td>
                    <td className="px-3 py-2 text-white/60">{row.mapped.unit || '—'}</td>
                    <td className="px-3 py-2 text-white/60">{row.mapped.quantity || '0'}</td>
                    <td className="px-3 py-2 text-white/60">
                      {row.mapped.cost_per_unit ? `€${row.mapped.cost_per_unit}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-white/60 text-xs">{row.mapped.category || '—'}</td>
                    <td className="px-3 py-2">
                      {row.duplicates.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          {row.duplicates[0].name} ({row.duplicates[0].score}%)
                        </span>
                      ) : (
                        <span className="text-emerald-400/60 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importRows.length > 8 && (
            <p className="text-xs text-white/30 text-center">
              + {importRows.length - 8} ακόμα γραμμές (δεν εμφανίζονται)
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={() => setStep('mapping')} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-white/70 transition-colors">
              Πίσω
            </button>
            <button
              onClick={() => void runImport()}
              disabled={importing || importRows.filter((r) => !r.skip).length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-bold text-white transition-colors"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Εισαγωγή {importRows.filter((r) => !r.skip).length} αντικειμένων
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ── */}
      {step === 'done' && results && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Εισαγωγή Ολοκληρώθηκε</h3>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{results.ok}</p>
                <p className="text-white/50">Εισήχθησαν</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white/40">{results.skipped}</p>
                <p className="text-white/50">Παραλείφθηκαν</p>
              </div>
              {results.errors.length > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{results.errors.length}</p>
                  <p className="text-white/50">Σφάλματα</p>
                </div>
              )}
            </div>
          </div>

          {results.errors.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-1 max-h-40 overflow-y-auto">
              {results.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-300">{e}</p>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white transition-colors"
          >
            <X className="h-4 w-4 inline mr-1.5" /> Κλείσιμο
          </button>
        </div>
      )}
    </div>
  )
}
