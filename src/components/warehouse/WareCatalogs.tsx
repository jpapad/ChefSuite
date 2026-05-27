import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, FileText, ExternalLink, Upload, X, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import { useAuth } from '../../contexts/AuthContext'
import { whLog } from '../../lib/warehouseLog'
import { uploadWarehouseDoc, getWarehouseDocUrl, deleteWarehouseDoc } from '../../lib/warehouseStorage'
import type { WhSupplierCatalog, WhSupplier } from '../../types/warehouse.types'

export function WareCatalogs() {
  const { user, profile } = useAuth()

  const [catalogs, setCatalogs]     = useState<WhSupplierCatalog[]>([])
  const [suppliers, setSuppliers]   = useState<WhSupplier[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [catalogName, setCatalogName] = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [openingId, setOpeningId]   = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [{ data: cats }, { data: sups }] = await Promise.all([
      supabase.from('wh_supplier_catalogs')
        .select('*, wh_suppliers:supplier_id(id,name)')
        .order('uploaded_at', { ascending: false }),
      supabase.from('wh_suppliers').select('id,name').order('name'),
    ])
    setCatalogs((cats ?? []) as WhSupplierCatalog[])
    setSuppliers((sups ?? []) as WhSupplier[])
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  function resetForm() {
    setShowForm(false)
    setSelectedSupplier('')
    setCatalogName('')
    setFile(null)
  }

  async function upload() {
    if (!file || !catalogName.trim()) return
    setUploading(true)

    // Insert catalog record first to get the ID
    const { data: cat, error } = await supabase.from('wh_supplier_catalogs').insert({
      supplier_id: selectedSupplier || null,
      name: catalogName.trim(),
      source_filename: file.name,
      uploaded_by: user?.id ?? null,
      uploaded_by_name: user?.email ?? null,
      status: 'uploaded',
    }).select().single()

    if (error || !cat) { setUploading(false); return }

    // Upload the file
    const path = await uploadWarehouseDoc('catalogs', cat.id, file)

    if (path) {
      await supabase.from('wh_supplier_catalogs').update({ pdf_path: path }).eq('id', cat.id)
      whLog(user?.id, user?.email, profile?.role, 'UPLOAD_CATALOG',
        catalogName.trim(), file.name)
    } else {
      // Upload failed — remove the catalog record
      await supabase.from('wh_supplier_catalogs').delete().eq('id', cat.id)
    }

    setUploading(false)
    resetForm()
    void fetchAll()
  }

  async function openPdf(catalog: WhSupplierCatalog) {
    if (!catalog.pdf_path) return
    setOpeningId(catalog.id)
    const url = await getWarehouseDocUrl(catalog.pdf_path)
    setOpeningId(null)
    if (url) window.open(url, '_blank')
  }

  async function del(catalog: WhSupplierCatalog) {
    if (!confirm(`Διαγραφή "${catalog.name}";`)) return
    if (catalog.pdf_path) await deleteWarehouseDoc(catalog.pdf_path)
    await supabase.from('wh_supplier_catalogs').delete().eq('id', catalog.id)
    void fetchAll()
  }

  // Group catalogs by supplier
  const groups = [
    ...new Set(catalogs.map((c) => c.wh_suppliers?.name ?? 'Χωρίς Προμηθευτή'))
  ].sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Τιμοκατάλογοι</h2>
          <p className="text-xs text-white/40">{catalogs.length} αρχεία</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition"
        >
          <Plus className="h-4 w-4" /> Νέος
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="rounded-xl border border-glass-border bg-white/3 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Νέος Τιμοκατάλογος</p>
            <button onClick={resetForm} className="text-white/30 hover:text-white transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-white/60">Όνομα *</label>
              <input
                value={catalogName}
                onChange={(e) => setCatalogName(e.target.value)}
                placeholder="π.χ. Τιμοκατάλογος Μαΐου 2025"
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Προμηθευτής</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              >
                <option value="">— Χωρίς προμηθευτή —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* File drop zone */}
          <label className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer transition',
            file
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-glass-border bg-white/2 hover:border-white/20 hover:bg-white/5',
          )}>
            {file ? (
              <>
                <FileText className="h-6 w-6 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">{file.name}</p>
                <p className="text-xs text-white/30">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-white/20" />
                <p className="text-sm text-white/50">Σύρτε PDF ή κλικ για επιλογή</p>
                <p className="text-xs text-white/30">Μέχρι 50 MB</p>
              </>
            )}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
              Άκυρο
            </button>
            <button
              onClick={() => void upload()}
              disabled={uploading || !file || !catalogName.trim()}
              className={cn(
                'flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                uploading || !file || !catalogName.trim()
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-brand-orange text-white hover:bg-brand-orange/90',
              )}
            >
              {uploading ? 'Μεταφόρτωση…' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      )}

      {/* Catalog list grouped by supplier */}
      {catalogs.length === 0 && !showForm && (
        <div className="py-12 text-center text-white/30 text-sm">Κανένας τιμοκατάλογος</div>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const items = catalogs.filter((c) => (c.wh_suppliers?.name ?? 'Χωρίς Προμηθευτή') === group)
          return (
            <div key={group} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Building2 className="h-3.5 w-3.5 text-white/30" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">{group}</p>
              </div>
              <div className="rounded-xl border border-glass-border divide-y divide-glass-border overflow-hidden">
                {items.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-3 px-4 py-3 bg-white/3 hover:bg-white/5 transition">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                      <FileText className="h-4 w-4 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{cat.name}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">
                        {cat.source_filename && <span>{cat.source_filename} · </span>}
                        {new Date(cat.uploaded_at).toLocaleDateString('el-GR')}
                      </p>
                    </div>
                    {cat.pdf_path && (
                      <button
                        onClick={() => void openPdf(cat)}
                        disabled={openingId === cat.id}
                        className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-400 hover:bg-sky-500/20 transition"
                      >
                        {openingId === cat.id ? 'Φόρτωση…' : (
                          <><ExternalLink className="h-3 w-3" /> Άνοιγμα</>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => void del(cat)}
                      className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
