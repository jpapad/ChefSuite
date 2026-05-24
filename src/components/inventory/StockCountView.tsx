import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Save, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import type { InventoryItem, InventoryLocation } from '../../types/database.types'

// ── Types ─────────────────────────────────────────────────────────────────────

type CountMap = Record<string, number>   // item.id → counted quantity

// ── Quick-add step heuristic based on unit ───────────────────────────────────

function quickStep(unit: string): number {
  const u = unit.toLowerCase()
  if (/^(kg|κιλ|kilo)/.test(u)) return 5
  if (/^(lt|λιτ|liter|litr)/.test(u)) return 5
  if (/^(gr|γρ|gram)/.test(u)) return 100
  if (/^(ml|μλ)/.test(u)) return 500
  if (/^(box|κιβ|carton|κούτ)/.test(u)) return 1
  return 1   // pcs, τεμ, etc.
}

// ── Per-item count card ───────────────────────────────────────────────────────

interface CountCardProps {
  item: InventoryItem
  counted: number
  blind: boolean
  onChange: (id: string, value: number) => void
}

function CountCard({ item, counted, blind, onChange }: CountCardProps) {
  const step = quickStep(item.unit)
  const diff = counted - item.quantity

  function clamp(v: number) { return Math.max(0, +v.toFixed(3)) }
  function decrement() { onChange(item.id, clamp(counted - 1)) }
  function increment() { onChange(item.id, clamp(counted + 1)) }
  function quickAdd()  { onChange(item.id, clamp(counted + step)) }
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value)
    if (!isNaN(v)) onChange(item.id, clamp(v))
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-glass-border bg-white/5 px-3 py-3">
      {/* Name + theoretical */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <p className={cn('text-xs mt-0.5 transition-all', blind ? 'blur-sm select-none text-white/20' : 'text-white/40')}>
          {item.quantity} {item.unit}
        </p>
      </div>

      {/* Diff badge */}
      {diff !== 0 && (
        <span className={cn(
          'shrink-0 text-xs font-bold rounded-md px-1.5 py-0.5',
          diff > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400',
        )}>
          {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
        </span>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Decrement */}
        <button
          type="button"
          onClick={decrement}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20 text-lg font-bold select-none"
          aria-label="minus"
        >−</button>

        {/* Numeric input */}
        <input
          type="number"
          min={0}
          step={1}
          value={counted}
          onChange={handleInput}
          className="h-11 w-16 rounded-xl text-center text-sm font-semibold bg-white/10 border border-glass-border text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
        />

        {/* Increment */}
        <button
          type="button"
          onClick={increment}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20 text-lg font-bold select-none"
          aria-label="plus"
        >+</button>

        {/* Quick-add */}
        {step > 1 && (
          <button
            type="button"
            onClick={quickAdd}
            className="flex h-11 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange px-2 text-xs font-semibold hover:bg-brand-orange/25 active:bg-brand-orange/30 select-none"
            aria-label={`+${step}`}
          >+{step}</button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface StockCountViewProps {
  items: InventoryItem[]
  locations: InventoryLocation[]
  teamId: string | null
  onSave: (counts: CountMap) => Promise<void>
  onExit: () => void
}

export function StockCountView({ items, locations, teamId, onSave, onExit }: StockCountViewProps) {
  const storageKey = teamId ? `chefsuite_sc_${teamId}` : null

  // Load persisted counts from localStorage
  const [counts, setCounts] = useState<CountMap>(() => {
    if (!storageKey) return {}
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as CountMap) : {}
    } catch { return {} }
  })

  const [locationTab, setLocationTab] = useState<string | null>(null)  // null = All
  const [blind, setBlind] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autosave to localStorage with 800 ms debounce
  useEffect(() => {
    if (!storageKey) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(counts))
    }, 800)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [counts, storageKey])

  function handleChange(id: string, value: number) {
    setCounts((prev) => ({ ...prev, [id]: value }))
  }

  // Location tabs
  const locationOptions = useMemo(() => {
    const all = { id: null as string | null, name: 'Όλα', count: items.length }
    const locs = locations.map((l) => ({
      id: l.id,
      name: l.name,
      count: items.filter((i) => i.location_id === l.id).length,
    }))
    const unassigned = items.filter((i) => i.location_id == null).length
    return unassigned > 0
      ? [...[all], ...locs, { id: '__unassigned__', name: 'Χωρίς θέση', count: unassigned }]
      : [...[all], ...locs]
  }, [items, locations])

  const visibleItems = useMemo(() => {
    if (locationTab === null) return items
    if (locationTab === '__unassigned__') return items.filter((i) => i.location_id == null)
    return items.filter((i) => i.location_id === locationTab)
  }, [items, locationTab])

  const countedTotal = Object.keys(counts).length
  const changedTotal = items.filter((i) => counts[i.id] !== undefined && counts[i.id] !== i.quantity).length

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(counts)
      // Clear autosave after successful commit
      if (storageKey) localStorage.removeItem(storageKey)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-glass-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-base">Απογραφή</h2>
            <p className="text-xs text-white/40">
              {countedTotal} καταμετρημένα · {changedTotal} αλλαγές
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBlind((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition',
                blind
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-white/10 text-white/60 hover:bg-white/15',
              )}
              title="Blind Count — κρύβει τα θεωρητικά αποθέματα"
            >
              {blind ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {blind ? 'Blind' : 'Ορατό'}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10"
              aria-label="Έξοδος"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Location tabs */}
        {locationOptions.length > 1 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {locationOptions.map((opt) => (
              <button
                key={String(opt.id)}
                type="button"
                onClick={() => setLocationTab(opt.id)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition whitespace-nowrap',
                  locationTab === opt.id
                    ? 'bg-brand-orange text-white-fixed'
                    : 'bg-white/10 text-white/60 hover:bg-white/15',
                )}
              >
                {opt.name} ({opt.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Item list */}
      <div className="flex-1 px-4 py-4 space-y-2">
        {visibleItems.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-12">Δεν υπάρχουν είδη σε αυτή τη θέση</p>
        ) : (
          visibleItems.map((item) => (
            <CountCard
              key={item.id}
              item={item}
              counted={counts[item.id] ?? item.quantity}
              blind={blind}
              onChange={handleChange}
            />
          ))
        )}
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-glass-border bg-[#0f0f0f]/95 backdrop-blur-md px-4 py-3 safe-area-pb">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onExit}
          >
            Ακύρωση
          </Button>
          <Button
            className="flex-1"
            leftIcon={<Save className="h-4 w-4" />}
            disabled={saving || changedTotal === 0}
            onClick={() => void handleSave()}
          >
            {saving ? 'Αποθήκευση…' : `Αποθήκευση (${changedTotal})`}
          </Button>
        </div>
      </div>
    </div>
  )
}
