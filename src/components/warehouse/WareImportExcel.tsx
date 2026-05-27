import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import { useAuth } from '../../hooks/useAuth'
import { whLog } from '../../lib/warehouseLog'

interface ParsedRow {
  name: string
  product_code: string | null
  unit: string
  purchase_price: number | null
  min_quantity: number
  current_stock: number
  notes: string | null
  _ok: boolean
  _error?: string
}

const UNITS = ['kg', 'g', 'lt', 'ml', 'τεμ', 'κιβ', 'συσκ', 'μερίδα', 'λίτρο']

// Column mapping: normalised header → field
const HEADER_MAP: Record<string, keyof ParsedRow | null> = {
  'όνομα': 'name', 'name': 'name', 'προϊόν': 'name', 'product': 'name',
  'κωδικός': 'product_code', 'κωδ': 'product_code', 'code': 'product_code',
  'μονάδα': 'unit', 'unit': 'unit', 'μον': 'unit',
  'τιμή': 'purchase_price', 'price': 'purchase_price', 'τιμη': 'purchase_price',
  'ελάχιστο': 'min_quantity', 'min': 'min_quantity', 'ελαχιστο': 'min_quantity',
  'απόθεμα': 'current_stock', 'stock': 'current_stock', 'αποθεμα': 'current_stock',
  'σημειώσεις': 'notes', 'notes': 'notes', 'σημειωσεις': 'notes',
}

function normalise(s: string) {
  return s.toString().toLowerCase().trim().replace(/\s+/g, ' ')
}

function parseRows(sheet: XLSX.WorkSheet): ParsedRow[] {
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
  if (json.length < 2) return []

  const headers = (json[0] as string[]).map(normalise)
  const fieldMap: Record<number, keyof ParsedRow | null> = {}
  headers.forEach((h, i) => { fieldMap[i] = HEADER_MAP[h] ?? null })

  return json.slice(1).map((row) => {
    const r: Partial<ParsedRow> & { _ok: boolean } = { _ok: true }
    ;(row as unknown[]).forEach((cell, i) => {
      const field = fieldMap[i]
      if (!field) return
      const val = cell == null ? '' : String(cell).trim()
      if (field === 'name')           r.name           = val
      if (field === 'product_code')   r.product_code   = val || null
      if (field === 'unit')           r.unit           = val || 'τεμ'
      if (field === 'purchase_price') r.purchase_price = val ? parseFloat(val.replace(',', '.')) : null
      if (field === 'min_quantity')   r.min_quantity   = val ? parseFloat(val.replace(',', '.')) : 0
      if (field === 'current_stock')  r.current_stock  = val ? parseFloat(val.replace(',', '.')) : 0
      if (field === 'notes')          r.notes          = val || null
    })
    if (!r.name) { r._ok = false; r._error = 'Λείπει το όνομα' }
    return {
      name: r.name ?? '',
      product_code: r.product_code ?? null,
      unit: r.unit ?? 'τεμ',
      purchase_price: r.purchase_price ?? null,
      min_quantity: r.min_quantity ?? 0,
      current_stock: r.current_stock ?? 0,
      notes: r.notes ?? null,
      _ok: r._ok,
      _error: r._error,
    } as ParsedRow
  }).filter((r) => r.name !== '')
}

export function WareImportExcel() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows]         = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone]         = useState<{ imported: number; skipped: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function processFile(file: File) {
    setDone(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = e.target?.result
      if (!data) return
      const wb = XLSX.read(data, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      setRows(parseRows(sheet))
    }
    reader.readAsBinaryString(file)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  async function importRows() {
    const valid = rows.filter((r) => r._ok)
    if (valid.length === 0) return
    setImporting(true)

    const payload = valid.map((r) => ({
      name: r.name,
      product_code: r.product_code,
      unit: UNITS.includes(r.unit) ? r.unit : 'τεμ',
      purchase_price: isNaN(r.purchase_price ?? NaN) ? null : r.purchase_price,
      min_quantity: isNaN(r.min_quantity) ? 0 : r.min_quantity,
      current_stock: isNaN(r.current_stock) ? 0 : r.current_stock,
      notes: r.notes,
    }))

    const { error } = await supabase.from('wh_products').insert(payload)
    const skipped = rows.length - valid.length

    if (!error) {
      whLog(user?.id, user?.email, user?.role, 'IMPORT_PRODUCTS',
        fileName, `${valid.length} εισήχθηκαν, ${skipped} παρεστράφηκαν`)
      setDone({ imported: valid.length, skipped })
      setRows([])
      setFileName(null)
    }

    setImporting(false)
  }

  function reset() {
    setRows([])
    setFileName(null)
    setDone(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validCount   = rows.filter((r) => r._ok).length
  const invalidCount = rows.filter((r) => !r._ok).length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Εισαγωγή Excel</h2>
        <p className="text-xs text-white/40">Εισαγωγή προϊόντων από αρχείο Excel / CSV</p>
      </div>

      {/* Template hint */}
      <div className="rounded-xl border border-glass-border bg-white/3 p-4 text-xs text-white/50 space-y-1">
        <p className="font-semibold text-white/70">Αναμενόμενες στήλες (επικεφαλίδες):</p>
        <p className="font-mono text-white/40">Όνομα | Κωδικός | Μονάδα | Τιμή | Ελάχιστο | Απόθεμα | Σημειώσεις</p>
        <p>Μόνο το <span className="text-white/70 font-semibold">Όνομα</span> είναι υποχρεωτικό. Οι υπόλοιπες στήλες είναι προαιρετικές.</p>
      </div>

      {/* Drop zone */}
      {rows.length === 0 && !done && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition',
            dragOver
              ? 'border-brand-orange/60 bg-brand-orange/5'
              : 'border-glass-border bg-white/2 hover:border-white/20 hover:bg-white/5',
          )}
        >
          <Upload className={cn('h-8 w-8', dragOver ? 'text-brand-orange' : 'text-white/20')} />
          <div className="text-center">
            <p className="text-sm font-medium text-white/60">Σύρτε & Αφήστε ή Κάντε Κλικ</p>
            <p className="text-xs text-white/30 mt-1">.xlsx, .xls, .csv</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      )}

      {/* File loaded */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-glass-border bg-white/3 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">{fileName}</span>
            </div>
            <button onClick={reset} className="text-white/30 hover:text-white transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{validCount}</p>
              <p className="text-xs text-white/40 mt-0.5">Έγκυρα</p>
            </div>
            {invalidCount > 0 && (
              <div className="flex-1 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{invalidCount}</p>
                <p className="text-xs text-white/40 mt-0.5">Σφάλματα</p>
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="rounded-xl border border-glass-border overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/5 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-white/50 font-semibold">Όνομα</th>
                  <th className="px-3 py-2 text-left text-white/50 font-semibold">Κωδ.</th>
                  <th className="px-3 py-2 text-left text-white/50 font-semibold">Μον.</th>
                  <th className="px-3 py-2 text-right text-white/50 font-semibold">Τιμή</th>
                  <th className="px-3 py-2 text-right text-white/50 font-semibold">Απόθ.</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {rows.map((r, i) => (
                  <tr key={i} className={cn('transition', r._ok ? 'bg-white/2 hover:bg-white/5' : 'bg-red-500/5')}>
                    <td className="px-3 py-1.5 text-white truncate max-w-[120px]">{r.name}</td>
                    <td className="px-3 py-1.5 text-white/40">{r.product_code ?? '—'}</td>
                    <td className="px-3 py-1.5 text-white/40">{r.unit}</td>
                    <td className="px-3 py-1.5 text-right text-white/40">{r.purchase_price != null ? `${r.purchase_price}€` : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-white/40">{r.current_stock}</td>
                    <td className="px-2 py-1.5">
                      {r._ok
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-red-400" title={r._error} />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
              Ακύρωση
            </button>
            <button
              onClick={() => void importRows()}
              disabled={importing || validCount === 0}
              className={cn(
                'flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                importing || validCount === 0
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-brand-orange text-white hover:bg-brand-orange/90',
              )}
            >
              {importing ? 'Εισαγωγή…' : `Εισαγωγή ${validCount} Προϊόντων`}
            </button>
          </div>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <p className="text-lg font-bold text-emerald-400">{done.imported} προϊόντα εισήχθηκαν</p>
          {done.skipped > 0 && (
            <p className="text-xs text-white/40">{done.skipped} σειρές παρεστράφηκαν λόγω σφαλμάτων</p>
          )}
          <button
            onClick={reset}
            className="mt-2 rounded-xl bg-white/10 px-6 py-2 text-sm text-white hover:bg-white/15 transition"
          >
            Νέα Εισαγωγή
          </button>
        </div>
      )}
    </div>
  )
}
