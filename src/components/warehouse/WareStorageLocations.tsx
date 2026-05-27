import { useEffect, useState } from 'react'
import { MapPin, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import type { WhStorageLocation } from '../../types/warehouse.types'

interface Props { onNavigate: (page: 'products', filter: Record<string, string>) => void }

export function WareStorageLocations({ onNavigate }: Props) {
  const [locations, setLocations]   = useState<WhStorageLocation[]>([])
  const [counts, setCounts]         = useState<Record<string, number>>({})
  const [search, setSearch]         = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<WhStorageLocation | null>(null)
  const [name, setName]             = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => { void fetch() }, [])

  async function fetch() {
    const [{ data: locs }, { data: prods }] = await Promise.all([
      supabase.from('wh_storage_locations').select('*').order('name'),
      supabase.from('wh_products').select('storage_unit_id'),
    ])
    setLocations(locs ?? [])
    const c: Record<string, number> = {}
    ;(prods ?? []).forEach((p) => { if (p.storage_unit_id) c[p.storage_unit_id] = (c[p.storage_unit_id] ?? 0) + 1 })
    setCounts(c)
  }

  function openNew() { setEditing(null); setName(''); setShowModal(true) }
  function openEdit(loc: WhStorageLocation) { setEditing(loc); setName(loc.name); setShowModal(true) }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const payload = { name: name.trim() }
    if (editing) {
      await supabase.from('wh_storage_locations').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('wh_storage_locations').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    void fetch()
  }

  async function del(id: string) {
    if (!confirm('Διαγραφή θέσης αποθήκης;')) return
    await supabase.from('wh_storage_locations').delete().eq('id', id)
    void fetch()
  }

  const filtered = locations.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Θέσεις Αποθήκης</h2>
          <p className="text-xs text-white/40">{locations.length} θέσεις</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition"
        >
          <Plus className="h-4 w-4" /> Νέα
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση θέσης…"
          className="w-full rounded-xl border border-glass-border bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
        />
      </div>

      <div className="rounded-xl border border-glass-border divide-y divide-glass-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-white/30 text-sm">Καμία θέση αποθήκης</div>
        ) : filtered.map((loc) => {
          const count = counts[loc.id] ?? 0
          return (
            <div key={loc.id} className="flex items-center gap-3 px-4 py-3 bg-white/3 hover:bg-white/5 transition">
              <MapPin className="h-4 w-4 text-sky-400/70 shrink-0" />
              <span className="flex-1 text-sm font-medium text-white">{loc.name}</span>
              {count > 0 && (
                <button
                  onClick={() => onNavigate('products', { storage_unit_id: loc.id })}
                  className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/25 transition"
                >
                  {count} προϊόντα
                </button>
              )}
              <button onClick={() => openEdit(loc)} className="p-1.5 text-white/30 hover:text-white transition rounded-lg hover:bg-white/10">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => void del(loc.id)} className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-glass-border bg-[#1a1a2e] p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white">{editing ? 'Επεξεργασία' : 'Νέα Θέση'}</h3>
            <div>
              <label className="mb-1 block text-xs text-white/60">Όνομα θέσης *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="π.χ. Ψυγείο Α, Αποθήκη 1ου"
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
                Άκυρο
              </button>
              <button
                onClick={() => void save()}
                disabled={saving || !name.trim()}
                className={cn(
                  'flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                  saving || !name.trim()
                    ? 'bg-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-brand-orange text-white hover:bg-brand-orange/90',
                )}
              >
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
