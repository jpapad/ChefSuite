import { useEffect, useState } from 'react'
import { FolderOpen, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import type { WhCategory } from '../../types/warehouse.types'

interface Props { onNavigate: (page: 'products', filter: Record<string, string>) => void }

const EMPTY: Omit<WhCategory, 'id' | 'created_at'> = { name: '', group_name: null }

export function WareCategories({ onNavigate }: Props) {
  const [categories, setCategories]   = useState<WhCategory[]>([])
  const [counts, setCounts]           = useState<Record<string, number>>({})
  const [search, setSearch]           = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<WhCategory | null>(null)
  const [form, setForm]               = useState({ name: '', group_name: '' })
  const [saving, setSaving]           = useState(false)

  useEffect(() => { void fetch() }, [])

  async function fetch() {
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('wh_categories').select('*').order('name'),
      supabase.from('wh_products').select('category_id'),
    ])
    setCategories(cats ?? [])
    const c: Record<string, number> = {}
    ;(prods ?? []).forEach((p) => { if (p.category_id) c[p.category_id] = (c[p.category_id] ?? 0) + 1 })
    setCounts(c)
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', group_name: '' })
    setShowModal(true)
  }

  function openEdit(cat: WhCategory) {
    setEditing(cat)
    setForm({ name: cat.name, group_name: cat.group_name ?? '' })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { name: form.name.trim(), group_name: form.group_name.trim() || null }
    if (editing) {
      await supabase.from('wh_categories').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('wh_categories').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    void fetch()
  }

  async function del(id: string) {
    if (!confirm('Διαγραφή κατηγορίας;')) return
    await supabase.from('wh_categories').delete().eq('id', id)
    void fetch()
  }

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.group_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // Group by group_name
  const groups = [...new Set(filtered.map((c) => c.group_name ?? ''))].sort()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Κατηγορίες</h2>
          <p className="text-xs text-white/40">{categories.length} κατηγορίες</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition"
        >
          <Plus className="h-4 w-4" /> Νέα
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση κατηγορίας…"
          className="w-full rounded-xl border border-glass-border bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
        />
      </div>

      {/* List grouped */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group} className="space-y-2">
            {group && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 px-1">{group}</p>
            )}
            <div className="rounded-xl border border-glass-border divide-y divide-glass-border overflow-hidden">
              {filtered.filter((c) => (c.group_name ?? '') === group).map((cat) => {
                const count = counts[cat.id] ?? 0
                return (
                  <div key={cat.id} className="flex items-center gap-3 px-4 py-3 bg-white/3 hover:bg-white/5 transition">
                    <FolderOpen className="h-4 w-4 text-brand-orange/70 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-white">{cat.name}</span>
                    {count > 0 && (
                      <button
                        onClick={() => onNavigate('products', { category_id: cat.id })}
                        className="rounded-full bg-brand-orange/15 px-2.5 py-0.5 text-xs font-semibold text-brand-orange hover:bg-brand-orange/25 transition"
                      >
                        {count}
                      </button>
                    )}
                    <button onClick={() => openEdit(cat)} className="p-1.5 text-white/30 hover:text-white transition rounded-lg hover:bg-white/10">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => void del(cat.id)} className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-red-500/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-white/30 text-sm">Καμία κατηγορία</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-glass-border bg-[#1a1a2e] p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white">{editing ? 'Επεξεργασία' : 'Νέα Κατηγορία'}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-white/60">Όνομα *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="π.χ. Γαλακτοκομικά"
                  className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Ομάδα (προαιρετικό)</label>
                <input
                  value={form.group_name}
                  onChange={(e) => setForm((f) => ({ ...f, group_name: e.target.value }))}
                  placeholder="π.χ. Τρόφιμα"
                  className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition">
                Άκυρο
              </button>
              <button
                onClick={() => void save()}
                disabled={saving || !form.name.trim()}
                className={cn(
                  'flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                  saving || !form.name.trim()
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
