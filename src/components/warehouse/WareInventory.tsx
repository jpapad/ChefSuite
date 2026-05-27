import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardList, Plus, ChevronLeft, ChevronRight, CheckCircle2,
  Clock, Trash2, Search, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import { useAuth } from '../../contexts/AuthContext'
import { whLog } from '../../lib/warehouseLog'
import type {
  WhInventorySession, WhInventorySessionItem,
} from '../../types/warehouse.types'

type View = 'list' | 'session'

export function WareInventory() {
  const { user, profile } = useAuth()

  const [sessions, setSessions]       = useState<WhInventorySession[]>([])
  const [view, setView]               = useState<View>('list')
  const [activeSession, setActiveSession] = useState<WhInventorySession | null>(null)
  const [sessionItems, setSessionItems]   = useState<WhInventorySessionItem[]>([])
  const [search, setSearch]           = useState('')
  const [creating, setCreating]       = useState(false)
  const [newName, setNewName]         = useState('')
  const [newMonth, setNewMonth]       = useState(() => new Date().toISOString().slice(0, 7))
  const [showNew, setShowNew]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from('wh_inventory_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    setSessions((data ?? []) as WhInventorySession[])
  }, [])

  useEffect(() => { void fetchSessions() }, [fetchSessions])

  async function openSession(s: WhInventorySession) {
    setActiveSession(s)
    const { data } = await supabase
      .from('wh_inventory_session_items')
      .select('*')
      .eq('session_id', s.id)
      .order('category_name', { nullsFirst: true })
    setSessionItems((data ?? []) as WhInventorySessionItem[])
    setView('session')
  }

  async function createSession() {
    if (!newName.trim()) return
    setCreating(true)

    // Fetch all products with category/storage info
    const { data: products } = await supabase
      .from('wh_products')
      .select('id,name,unit,current_stock,category_id,storage_unit_id,wh_categories:category_id(name),wh_storage_locations:storage_unit_id(name)')
      .order('name')

    const { data: session, error } = await supabase
      .from('wh_inventory_sessions')
      .insert({
        name: newName.trim(),
        month: newMonth,
        item_count: (products ?? []).length,
        is_draft: true,
        created_by: user?.id ?? null,
        created_by_name: user?.email ?? null,
      })
      .select()
      .single()

    if (error || !session) { setCreating(false); return }

    if ((products ?? []).length > 0) {
      type RawProduct = {
        id: string; name: string; unit: string; current_stock: number
        wh_categories?: { name: string } | null
        wh_storage_locations?: { name: string } | null
      }
      await supabase.from('wh_inventory_session_items').insert(
        (products as unknown as RawProduct[]).map((p) => ({
          session_id: session.id,
          product_id: p.id,
          product_name: p.name,
          category_name: p.wh_categories?.name ?? null,
          storage_unit_name: p.wh_storage_locations?.name ?? null,
          unit: p.unit,
          system_quantity: p.current_stock,
          counted_quantity: null,
          counted_unit: p.unit,
        }))
      )
    }

    whLog(user?.id, user?.email, profile?.role, 'CREATE_INVENTORY', newName.trim(),
      `${(products ?? []).length} προϊόντα`)
    setCreating(false)
    setShowNew(false)
    setNewName('')
    await fetchSessions()
    await openSession({ ...session, item_count: (products ?? []).length } as WhInventorySession)
  }

  async function publishSession() {
    if (!activeSession) return
    if (!confirm('Δημοσίευση απογραφής; Θα ενημερωθεί το τρέχον απόθεμα.')) return
    setSaving(true)

    // Update stock for each counted item
    await Promise.all(
      sessionItems.map(async (item) => {
        if (item.product_id == null || item.counted_quantity == null) return
        await supabase.from('wh_products').update({
          current_stock: item.counted_quantity,
        }).eq('id', item.product_id)
      })
    )

    await supabase.from('wh_inventory_sessions').update({ is_draft: false }).eq('id', activeSession.id)
    whLog(user?.id, user?.email, profile?.role, 'PUBLISH_INVENTORY', activeSession.name)
    setSaving(false)
    setView('list')
    void fetchSessions()
  }

  async function deleteSession(id: string) {
    if (!confirm('Διαγραφή απογραφής;')) return
    await supabase.from('wh_inventory_sessions').delete().eq('id', id)
    void fetchSessions()
  }

  function updateCount(itemId: string, value: string) {
    setSessionItems((prev) =>
      prev.map((it) => it.id === itemId
        ? { ...it, counted_quantity: value === '' ? null : parseFloat(value) }
        : it
      )
    )
    // Debounced DB save
    void supabase.from('wh_inventory_session_items').update({
      counted_quantity: value === '' ? null : parseFloat(value),
    }).eq('id', itemId)
  }

  function toggleGroup(group: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  // Group session items by category
  const filteredItems = sessionItems.filter((it) =>
    it.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (it.category_name ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const groups = [...new Set(filteredItems.map((it) => it.category_name ?? ''))].sort()

  const countedCount = sessionItems.filter((it) => it.counted_quantity != null).length

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Απογραφές</h2>
          <p className="text-xs text-white/40">{sessions.length} απογραφές</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange/90 transition"
        >
          <Plus className="h-4 w-4" /> Νέα
        </button>
      </div>

      {/* New session form */}
      {showNew && (
        <div className="rounded-xl border border-glass-border bg-white/3 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Νέα Απογραφή</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-white/60">Όνομα *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="π.χ. Μηνιαία Μαΐου"
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Μήνας</label>
              <input
                type="month"
                value={newMonth}
                onChange={(e) => setNewMonth(e.target.value)}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNew(false)}
              className="flex-1 rounded-xl border border-glass-border py-2.5 text-sm text-white/60 hover:text-white transition"
            >
              Άκυρο
            </button>
            <button
              onClick={() => void createSession()}
              disabled={creating || !newName.trim()}
              className={cn(
                'flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                creating || !newName.trim()
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-brand-orange text-white hover:bg-brand-orange/90',
              )}
            >
              {creating ? 'Δημιουργία…' : 'Δημιουργία'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sessions.length === 0 && (
          <div className="py-12 text-center text-white/30 text-sm">Καμία απογραφή</div>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="rounded-xl border border-glass-border bg-white/3 p-4 hover:bg-white/5 transition">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                <ClipboardList className="h-4 w-4 text-white/50" />
              </div>
              <button className="flex-1 min-w-0 text-left" onClick={() => void openSession(s)}>
                <p className="font-semibold text-white truncate">{s.name}</p>
                <p className="text-xs text-white/40 mt-0.5">{s.month} · {s.item_count} προϊόντα</p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  s.is_draft
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-emerald-400 bg-emerald-500/10',
                )}>
                  {s.is_draft
                    ? <><Clock className="h-3 w-3" /> Πρόχειρο</>
                    : <><CheckCircle2 className="h-3 w-3" /> Δημοσιευμένο</>
                  }
                </span>
                {s.is_draft && (
                  <button
                    onClick={() => void deleteSession(s.id)}
                    className="p-1.5 text-white/30 hover:text-red-400 transition rounded-lg hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-white/20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ── SESSION VIEW ───────────────────────────────────────────────────────────

  if (view === 'session' && activeSession) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition"
        >
          <ChevronLeft className="h-4 w-4" /> Πίσω
        </button>
        <span className={cn(
          'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
          activeSession.is_draft
            ? 'text-amber-400 bg-amber-500/10'
            : 'text-emerald-400 bg-emerald-500/10',
        )}>
          {activeSession.is_draft ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {activeSession.is_draft ? 'Πρόχειρο' : 'Δημοσιευμένο'}
        </span>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white">{activeSession.name}</h2>
        <p className="text-xs text-white/40">{activeSession.month} · {countedCount}/{sessionItems.length} καταμετρημένα</p>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-orange transition-all"
          style={{ width: sessionItems.length ? `${(countedCount / sessionItems.length) * 100}%` : '0%' }}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση προϊόντος…"
          className="w-full rounded-xl border border-glass-border bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
        />
      </div>

      {/* Grouped items */}
      <div className="space-y-3">
        {groups.map((group) => {
          const items = filteredItems.filter((it) => (it.category_name ?? '') === group)
          const isOpen = expandedGroups.has(group)
          return (
            <div key={group} className="rounded-xl border border-glass-border overflow-hidden">
              <button
                onClick={() => toggleGroup(group)}
                className="flex w-full items-center justify-between bg-white/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/50 hover:bg-white/10 transition"
              >
                <span>{group || 'Χωρίς Κατηγορία'} ({items.length})</span>
                {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {isOpen && (
                <div className="divide-y divide-glass-border">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 bg-white/3 hover:bg-white/5 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.product_name}</p>
                        {item.storage_unit_name && (
                          <p className="text-[11px] text-white/30">{item.storage_unit_name}</p>
                        )}
                      </div>
                      <span className="text-xs text-white/30 shrink-0">
                        Σύστ: {item.system_quantity ?? 0} {item.unit}
                      </span>
                      {activeSession.is_draft ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.counted_quantity ?? ''}
                            onChange={(e) => updateCount(item.id, e.target.value)}
                            placeholder="—"
                            className={cn(
                              'w-20 rounded-lg border px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]',
                              item.counted_quantity != null
                                ? 'border-brand-orange/50 bg-brand-orange/10'
                                : 'border-glass-border bg-white/5 placeholder:text-white/25',
                            )}
                          />
                          <span className="text-[11px] text-white/40 w-8">{item.unit}</span>
                        </div>
                      ) : (
                        <span className={cn(
                          'text-sm font-semibold shrink-0',
                          item.counted_quantity != null ? 'text-white' : 'text-white/20',
                        )}>
                          {item.counted_quantity ?? '—'} {item.unit}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Publish button */}
      {activeSession.is_draft && (
        <button
          onClick={() => void publishSession()}
          disabled={saving || countedCount === 0}
          className={cn(
            'w-full rounded-xl py-3 text-sm font-semibold transition',
            saving || countedCount === 0
              ? 'bg-white/10 text-white/30 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-500',
          )}
        >
          {saving ? 'Αποθήκευση…' : `Δημοσίευση & Ενημέρωση Αποθέματος (${countedCount} αντικείμενα)`}
        </button>
      )}
    </div>
  )

  return null
}
