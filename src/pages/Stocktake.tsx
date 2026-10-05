import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck, Save, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { Page, PageHeader, PillButton, StatRow, StatTile, SearchField, Segmented, Panel } from '../components/ui/page'
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
    void supabase
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

  const deltas = changedItems.map((i) => getDelta(i) ?? 0)
  const surplus = deltas.filter((d) => d > 0).length
  const shortage = deltas.filter((d) => d < 0).length

  return (
    <Page>
      <PageHeader
        title={t('stocktake.title')}
        subtitle={t('stocktake.subtitle')}
        actions={
          <>
            {savedAt && (
              <span className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-medium text-emerald-500">
                ✓ {t('stocktake.saved')} · {savedAt.toLocaleTimeString()}
              </span>
            )}
            <PillButton icon={Save} variant="primary" onClick={() => void handleSave()} disabled={saving || changedItems.length === 0}>
              {saving ? t('stocktake.saving') : `${t('stocktake.save')}${changedItems.length > 0 ? ` (${changedItems.length})` : ''}`}
            </PillButton>
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      <StatRow>
        <StatTile tone="ink" label={t('stocktake.v2.items')} value={items.length} hint={t('stocktake.v2.itemsHint')} />
        <StatTile label={t('stocktake.v2.changed')} value={changedItems.length} tone={changedItems.length ? 'warn' : 'default'} hint={t('stocktake.v2.changedHint')} onClick={() => setChangesOnly(true)} />
        <StatTile label={t('stocktake.v2.surplus')} value={surplus} tone={surplus ? 'good' : 'default'} hint={t('stocktake.v2.surplusHint')} />
        <StatTile label={t('stocktake.v2.shortage')} value={shortage} tone={shortage ? 'bad' : 'default'} hint={t('stocktake.v2.shortageHint')} />
      </StatRow>

      <div className="flex flex-wrap items-center gap-3">
        <SearchField value={search} onChange={setSearch} placeholder={t('stocktake.search')} className="flex-1 max-w-md" />
        <Segmented
          value={changesOnly ? 'changes' : 'all'}
          onChange={(v) => setChangesOnly(v === 'changes')}
          options={[
            { value: 'all', label: t('stocktake.allItems') },
            { value: 'changes', label: `${t('stocktake.changesOnly')}${changedItems.length > 0 ? ` (${changedItems.length})` : ''}` },
          ]}
        />
      </div>

      <Panel padded={false}>
        {loading ? (
          <div className="flex flex-col gap-2 p-6">
            {[...Array(8)].map((_, i) => <div key={i} className="h-11 rounded-2xl bg-white/[0.05] animate-pulse" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <ClipboardCheck className="h-10 w-10 text-white/25" />
            <p className="text-sm text-white/55">{t('stocktake.noItems')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-xs text-white/50">
                  <th className="px-4 py-3 text-left font-medium">{t('stocktake.item')}</th>
                  <th className="w-32 px-4 py-3 text-right font-medium">{t('stocktake.systemQty')}</th>
                  <th className="w-44 px-4 py-3 text-right font-medium">{t('stocktake.countedQty')}</th>
                  <th className="w-32 px-4 py-3 text-right font-medium">{t('stocktake.delta')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {displayed.map((item) => {
                  const delta = getDelta(item)
                  const hasChange = delta !== null && delta !== 0
                  return (
                    <tr key={item.id} className={cn(hasChange && 'bg-lime/15')}>
                      <td className="px-4 py-2.5 font-medium">{item.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-white/55">
                        {item.quantity} <span className="text-xs text-white/40">{item.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            aria-label={`${item.name} ${t('stocktake.countedQty')}`}
                            value={counted[item.id] ?? ''}
                            onChange={(e) => setCounted((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className={cn(
                              'h-10 w-28 rounded-full px-4 text-right text-sm tabular-nums outline-none transition focus:ring-2 focus:ring-brand-orange/40',
                              hasChange ? 'bg-ink text-white-fixed' : 'bg-white/[0.06]',
                            )}
                          />
                          <span className="w-8 text-left text-xs text-white/45">{item.unit}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {delta === null || delta === 0 ? (
                          <Minus className="inline h-4 w-4 text-white/25" />
                        ) : delta > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                            <ArrowUp className="h-3.5 w-3.5" />+{delta.toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-500">
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
      </Panel>
    </Page>
  )
}
