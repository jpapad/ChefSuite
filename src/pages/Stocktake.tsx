import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck, Search, Save, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { ErrorState } from '../components/ui/ErrorState'

interface StockItem {
  id: string
  name: string
  quantity: number
  unit: string
  category?: string | null
}

export default function Stocktake() {
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const teamId = profile?.team_id

  const [items, setItems] = useState<StockItem[]>([])
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [changesOnly, setChangesOnly] = useState(false)

  function load() {
    if (!teamId) return
    setLoading(true)
    setError(null)
    supabase
      .from('inventory')
      .select('id, name, quantity, unit')
      .eq('team_id', teamId)
      .order('name')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        const rows = (data ?? []) as StockItem[]
        setItems(rows)
        const init: Record<string, string> = {}
        rows.forEach((r) => { init[r.id] = String(r.quantity) })
        setCounted(init)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load inventory')
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [teamId])

  const changedItems = useMemo(
    () => items.filter((i) => {
      const val = parseFloat(counted[i.id] ?? String(i.quantity))
      return !isNaN(val) && val !== i.quantity
    }),
    [items, counted],
  )

  const displayed = useMemo(() => {
    let list = changesOnly ? changedItems : items
    if (search) list = list.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [items, changedItems, changesOnly, search])

  function getDelta(item: StockItem): number | null {
    const val = parseFloat(counted[item.id] ?? '')
    if (isNaN(val)) return null
    return val - item.quantity
  }

  async function handleSave() {
    if (!teamId || !user || changedItems.length === 0) return
    setSaving(true)
    try {
      await Promise.all(
        changedItems.map(async (item) => {
          const newQty = parseFloat(counted[item.id] ?? '')
          if (isNaN(newQty)) return
          const delta = newQty - item.quantity

          await supabase
            .from('inventory')
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', item.id)

          await supabase.from('inventory_movements').insert({
            team_id: teamId,
            item_id: item.id,
            delta,
            reason: t('stocktake.reason'),
            user_id: user.id,
          })
        }),
      )
      // Refresh system quantities
      setItems((prev) =>
        prev.map((i) => {
          const val = parseFloat(counted[i.id] ?? '')
          return isNaN(val) ? i : { ...i, quantity: val }
        }),
      )
      setSavedAt(new Date())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/15">
            <ClipboardCheck className="h-5 w-5 text-brand-orange" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t('stocktake.title')}</h1>
            <p className="text-xs text-white/40 mt-0.5">{t('stocktake.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-xs text-green-400">
              ✓ {t('stocktake.saved')} · {savedAt.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || changedItems.length === 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving
              ? t('stocktake.saving')
              : `${t('stocktake.save')}${changedItems.length > 0 ? ` (${changedItems.length})` : ''}`}
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {/* Toolbar */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('stocktake.search')}
            className="w-full rounded-xl bg-white-fixed/55 border border-white/50 text-white text-sm pl-9 pr-3 py-2 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/40"
          />
        </div>
        <div className="flex gap-1.5">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setChangesOnly(v)}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-medium transition-all',
                changesOnly === v ? 'bg-brand-orange text-white-fixed' : 'glass text-white/55 hover:text-white/80',
              )}
            >
              {v ? `${t('stocktake.changesOnly')} ${changedItems.length > 0 ? `(${changedItems.length})` : ''}` : t('stocktake.allItems')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass gradient-border rounded-2xl overflow-hidden flex-1">
        {loading ? (
          <div className="p-8 space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-10 glass rounded-xl animate-pulse" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-white/20" />
            <p className="text-white/40">{t('stocktake.noItems')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">{t('stocktake.item')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-32">{t('stocktake.systemQty')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-40">{t('stocktake.countedQty')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 w-32">{t('stocktake.delta')}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((item) => {
                  const delta = getDelta(item)
                  const hasChange = delta !== null && delta !== 0
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'border-b border-white/5 transition-colors',
                        hasChange ? 'bg-brand-orange/5' : 'hover:bg-white/3',
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-white/90">{item.name}</td>
                      <td className="px-4 py-3 text-right text-white/50 tabular-nums">
                        {item.quantity} <span className="text-white/30 text-xs">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={counted[item.id] ?? ''}
                            onChange={(e) => setCounted((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className={cn(
                              'w-24 rounded-lg text-right text-sm px-2 py-1.5 outline-none transition-all',
                              hasChange
                                ? 'bg-brand-orange/20 border border-brand-orange/50 text-white focus:ring-1 focus:ring-brand-orange/60'
                                : 'bg-white-fixed/55 border border-white/40 text-white focus:ring-1 focus:ring-brand-orange/40',
                            )}
                          />
                          <span className="text-white/30 text-xs w-8">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {delta === null || delta === 0 ? (
                          <span className="text-white/20"><Minus className="h-3.5 w-3.5 inline" /></span>
                        ) : delta > 0 ? (
                          <span className="flex items-center justify-end gap-1 text-green-400 font-semibold">
                            <ArrowUp className="h-3.5 w-3.5" />+{delta.toFixed(2)}
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-1 text-red-400 font-semibold">
                            <ArrowDown className="h-3.5 w-3.5" />{delta.toFixed(2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
