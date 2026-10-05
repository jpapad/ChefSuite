import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Wrench, Plus, AlertTriangle, CalendarClock, Ban, Refrigerator, Snowflake, Flame, CookingPot,
  Droplets, Wind, Coffee, Box, Phone, Thermometer, CheckCircle2, Pencil, Trash2, X, ShieldCheck,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  Page, PageHeader, PillButton, StatRow, StatTile, EmptyState, Notice, Chip, ChipRow,
} from '../components/ui/page'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { useEquipment, nextServiceOn, daysUntil } from '../hooks/useEquipment'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type {
  Equipment, EquipmentCategory, EquipmentDraft, EquipmentLog, EquipmentLogKind, HACCPCheck, HACCPLocation,
} from '../types/database.types'

const CATEGORIES: EquipmentCategory[] = ['fridge', 'freezer', 'oven', 'stove', 'dishwasher', 'hood', 'coffee', 'ice', 'other']
const CAT_ICON: Record<EquipmentCategory, typeof Box> = {
  fridge: Refrigerator, freezer: Snowflake, oven: Flame, stove: CookingPot, dishwasher: Droplets,
  hood: Wind, coffee: Coffee, ice: Snowflake, other: Box,
}
const LOG_KINDS: EquipmentLogKind[] = ['issue', 'repair', 'service', 'inspection']

const BLANK: EquipmentDraft = {
  name: '', category: 'fridge', location: null, brand: null, model: null, serial_number: null,
  purchased_on: null, warranty_until: null, service_interval_days: 180, last_service_on: null,
  technician_name: null, technician_phone: null, haccp_location: null, status: 'ok', notes: null,
}

function fmtDate(d: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function EquipmentPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { equipment, logs, loading, error, saveEquipment, removeEquipment, addLog, resolveLog, setStatus } = useEquipment()

  // HACCP: locations for linking + failures of the last 7 days
  const [haccpLocations, setHaccpLocations] = useState<HACCPLocation[]>([])
  const [failsByLocation, setFailsByLocation] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!profile?.team_id) return
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    void Promise.all([
      supabase.from('haccp_locations').select('*').eq('team_id', profile.team_id).order('name'),
      supabase.from('haccp_checks').select('location, temperature, min_temp, max_temp').eq('team_id', profile.team_id).gte('created_at', since),
    ]).then(([locs, checks]) => {
      setHaccpLocations((locs.data ?? []) as HACCPLocation[])
      const fails: Record<string, number> = {}
      for (const c of (checks.data ?? []) as Pick<HACCPCheck, 'location' | 'temperature' | 'min_temp' | 'max_temp'>[]) {
        if (c.temperature < c.min_temp || c.temperature > c.max_temp) fails[c.location] = (fails[c.location] ?? 0) + 1
      }
      setFailsByLocation(fails)
    })
  }, [profile?.team_id])

  const [filter, setFilter] = useState<'all' | 'due' | 'issues'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const open = equipment.find((e) => e.id === openId) ?? null

  const openIssues = (id: string) => logs.filter((l) => l.equipment_id === id && l.kind === 'issue' && !l.resolved)
  const dueIn = (e: Equipment) => daysUntil(nextServiceOn(e))
  const isDue = (e: Equipment) => { const d = dueIn(e); return d != null && d <= 14 }

  const counts = {
    due: equipment.filter(isDue).length,
    issues: logs.filter((l) => l.kind === 'issue' && !l.resolved).length,
    down: equipment.filter((e) => e.status === 'out_of_order').length,
  }
  const yearCost = logs
    .filter((l) => l.cost != null && l.performed_on >= `${new Date().getFullYear()}-01-01`)
    .reduce((s, l) => s + (l.cost ?? 0), 0)

  const visible = useMemo(() => {
    const list = equipment.filter((e) => filter === 'all' || (filter === 'due' ? isDue(e) : openIssues(e.id).length > 0 || e.status !== 'ok'))
    const rank = (e: Equipment) => (e.status === 'out_of_order' ? 0 : openIssues(e.id).length ? 1 : isDue(e) ? 2 : 3)
    return list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment, logs, filter])

  // ── Equipment form ─────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [draft, setDraft] = useState<EquipmentDraft>(BLANK)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openForm(e?: Equipment) {
    setEditing(e ?? null)
    setDraft(e ? { ...e } : BLANK)
    setFormError(null)
    setFormOpen(true)
  }
  async function onSave(ev: FormEvent) {
    ev.preventDefault()
    if (!draft.name.trim()) { setFormError(t('equip.nameRequired')); return }
    setSaving(true)
    try {
      // Only the editable columns (draft may carry id/team_id when editing)
      const payload = Object.fromEntries(
        Object.keys(BLANK).map((k) => [k, draft[k as keyof EquipmentDraft]]),
      ) as EquipmentDraft
      await saveEquipment({ ...payload, name: draft.name.trim() }, editing?.id)
      setFormOpen(false)
    } catch (err) { setFormError(err instanceof Error ? err.message : t('common.saveFailed')) }
    finally { setSaving(false) }
  }

  // ── Log form (inside the detail sheet) ─────────────────────────────────────
  const [logKind, setLogKind] = useState<EquipmentLogKind>('issue')
  const [logTitle, setLogTitle] = useState('')
  const [logCost, setLogCost] = useState('')
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [logNote, setLogNote] = useState('')
  const [logSaving, setLogSaving] = useState(false)

  async function onAddLog(ev: FormEvent) {
    ev.preventDefault()
    if (!open || !logTitle.trim()) return
    setLogSaving(true)
    try {
      await addLog({
        equipment_id: open.id, kind: logKind, title: logTitle.trim(), description: logNote.trim() || null,
        cost: logCost ? Number(logCost) : null, performed_on: logDate, resolved: logKind !== 'issue',
      })
      setLogTitle(''); setLogCost(''); setLogNote('')
    } finally { setLogSaving(false) }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function ServiceBar({ e }: { e: Equipment }) {
    const next = nextServiceOn(e)
    const d = daysUntil(next)
    if (d == null || !e.service_interval_days) return <span className="text-xs text-white/45">{t('equip.noSchedule')}</span>
    const pct = Math.max(0, Math.min(100, 100 - (d / e.service_interval_days) * 100))
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/55">{t('equip.nextService')}</span>
          <span className={cn('font-medium tabular-nums', d < 0 ? 'text-red-500' : d <= 14 ? 'text-amber-500' : '')}>
            {d < 0 ? t('equip.overdue', { count: -d }) : d === 0 ? t('equip.today') : t('equip.inDays', { count: d })}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-input">
          <div className={cn('h-full rounded-full', d < 0 ? 'bg-red-500' : d <= 14 ? 'bg-amber-500' : 'bg-ink')} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  const selectCls = 'h-12 w-full rounded-xl border border-inv-border bg-bg-input px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-orange/40'
  const set = <K extends keyof EquipmentDraft>(k: K, v: EquipmentDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <Page>
      <PageHeader
        title={t('equip.title')}
        subtitle={t('equip.subtitle')}
        actions={<PillButton variant="primary" icon={Plus} onClick={() => openForm()}>{t('equip.add')}</PillButton>}
      />
      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile label={t('equip.stat.issues')} value={counts.issues} icon={AlertTriangle} tone={counts.issues ? 'bad' : 'default'} onClick={() => setFilter('issues')} />
        <StatTile label={t('equip.stat.due')} value={counts.due} icon={CalendarClock} tone={counts.due ? 'warn' : 'default'} hint={t('equip.stat.dueHint')} onClick={() => setFilter('due')} />
        <StatTile label={t('equip.stat.down')} value={counts.down} icon={Ban} tone={counts.down ? 'bad' : 'default'} />
        <StatTile label={t('equip.stat.cost')} value={`€${yearCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={Wrench} tone="ink" hint={t('equip.stat.costHint')} />
      </StatRow>

      <ChipRow>
        <Chip active={filter === 'all'} count={equipment.length} onClick={() => setFilter('all')}>{t('equip.filter.all')}</Chip>
        <Chip active={filter === 'issues'} onClick={() => setFilter('issues')}>{t('equip.filter.issues')}</Chip>
        <Chip active={filter === 'due'} onClick={() => setFilter('due')}>{t('equip.filter.due')}</Chip>
      </ChipRow>

      {loading ? null : equipment.length === 0 ? (
        <EmptyState icon={Wrench} title={t('equip.empty')} body={t('equip.emptyHint')}
          action={<PillButton variant="primary" icon={Plus} onClick={() => openForm()}>{t('equip.add')}</PillButton>} />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {visible.map((e) => {
            const Icon = CAT_ICON[e.category]
            const issues = openIssues(e.id)
            const fails = e.haccp_location ? failsByLocation[e.haccp_location] ?? 0 : 0
            return (
              <button key={e.id} type="button" onClick={() => setOpenId(e.id)}
                className={cn('flex flex-col gap-4 rounded-3xl p-5 text-left shadow-card transition hover:-translate-y-0.5',
                  e.status === 'out_of_order' ? 'bg-ink text-white-fixed' : 'bg-bg-card')}>
                <div className="flex items-start gap-3">
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                    e.status === 'out_of_order' ? 'bg-red-500 text-white-fixed' : issues.length ? 'bg-amber-500/15 text-amber-500' : 'bg-lime text-ink')}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-medium leading-tight">{e.name}</span>
                    <span className={cn('block truncate text-sm', e.status === 'out_of_order' ? 'text-white-fixed/55' : 'text-white/55')}>
                      {[t(`equip.cat.${e.category}`), e.location].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {e.status !== 'ok' && (
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      e.status === 'out_of_order' ? 'bg-red-500 text-white-fixed' : 'bg-amber-500/15 text-amber-500')}>
                      {t(`equip.status.${e.status}`)}
                    </span>
                  )}
                </div>
                {e.status === 'out_of_order' ? (
                  <p className="text-sm text-white-fixed/60">{issues[0]?.title ?? t('equip.status.out_of_order')}</p>
                ) : <ServiceBar e={e} />}
                {(issues.length > 0 || fails > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {issues.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500">
                        <AlertTriangle className="h-3.5 w-3.5" />{t('equip.openIssues', { count: issues.length })}
                      </span>
                    )}
                    {fails > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-500">
                        <Thermometer className="h-3.5 w-3.5" />{t('equip.haccpFails', { count: fails })}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </section>
      )}

      {/* ── Detail sheet ── */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpenId(null)}>
          <aside role="dialog" aria-modal="true" aria-label={open.name} onClick={(ev) => ev.stopPropagation()}
            className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-bg-surface p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <header className="flex flex-col gap-5 rounded-[2rem] bg-ink p-6 text-white-fixed">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-ink">
                    {(() => { const I = CAT_ICON[open.category]; return <I className="h-5 w-5" /> })()}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openForm(open)} aria-label={t('common.edit')}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white-fixed/10 hover:bg-white-fixed/20"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setOpenId(null)} aria-label="Close"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white-fixed/10 hover:bg-white-fixed/20"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-medium tracking-[-0.03em]">{open.name}</h2>
                  <p className="mt-1 text-white-fixed/55">{[t(`equip.cat.${open.category}`), open.location, [open.brand, open.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['ok', 'attention', 'out_of_order'] as const).map((s) => (
                    <button key={s} type="button" onClick={() => void setStatus(open.id, s)}
                      className={cn('h-9 rounded-full px-3.5 text-sm font-medium transition',
                        open.status === s ? (s === 'out_of_order' ? 'bg-red-500 text-white-fixed' : s === 'attention' ? 'bg-amber-400 text-ink' : 'bg-lime text-ink') : 'bg-white-fixed/10 text-white-fixed/70 hover:text-white-fixed')}>
                      {t(`equip.status.${s}`)}
                    </button>
                  ))}
                </div>
              </header>

              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl bg-bg-card p-4 shadow-card"><ServiceBar e={open} /></div>
                <div className="flex flex-col gap-1 rounded-3xl bg-bg-card p-4 shadow-card">
                  <span className="text-xs text-white/55">{t('equip.warranty')}</span>
                  <span className={cn('text-sm font-medium', (daysUntil(open.warranty_until) ?? 1) < 0 && 'text-white/45')}>
                    {open.warranty_until ? fmtDate(open.warranty_until) : '—'}
                  </span>
                  {open.serial_number && <span className="truncate font-mono text-[11px] text-white/45">S/N {open.serial_number}</span>}
                </div>
                {(open.technician_name || open.technician_phone) && (
                  <a href={open.technician_phone ? `tel:${open.technician_phone}` : undefined}
                    className="col-span-2 flex items-center gap-3 rounded-3xl bg-bg-card p-4 shadow-card hover:bg-white/[0.03]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-lime"><Phone className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-white/55">{t('equip.technician')}</span>
                      <span className="block truncate font-medium">{open.technician_name ?? '—'} {open.technician_phone && <span className="font-normal text-white/60">· {open.technician_phone}</span>}</span>
                    </span>
                  </a>
                )}
                {open.haccp_location && (
                  <div className="col-span-2 flex items-center gap-3 rounded-3xl bg-bg-card p-4 shadow-card">
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', (failsByLocation[open.haccp_location] ?? 0) ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/10 text-emerald-500')}>
                      {(failsByLocation[open.haccp_location] ?? 0) ? <Thermometer className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </span>
                    <span className="text-sm">
                      <span className="block text-xs text-white/55">HACCP · {open.haccp_location}</span>
                      {(failsByLocation[open.haccp_location] ?? 0)
                        ? t('equip.haccpFailsLong', { count: failsByLocation[open.haccp_location] })
                        : t('equip.haccpOk')}
                    </span>
                  </div>
                )}
              </section>

              {/* Log something */}
              <form onSubmit={(ev) => void onAddLog(ev)} className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card">
                <h3 className="text-lg font-medium">{t('equip.log.title')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {LOG_KINDS.map((k) => (
                    <button key={k} type="button" onClick={() => setLogKind(k)}
                      className={cn('h-9 rounded-full px-3.5 text-sm font-medium', logKind === k ? 'bg-ink text-white-fixed' : 'bg-bg-input text-white/65 hover:text-white')}>
                      {t(`equip.log.kinds.${k}`)}
                    </button>
                  ))}
                </div>
                <input value={logTitle} onChange={(ev) => setLogTitle(ev.target.value)} placeholder={t(`equip.log.placeholder.${logKind}`)}
                  className="h-12 rounded-2xl bg-bg-input px-4 text-[15px] outline-none placeholder:text-white/35 focus:ring-2 focus:ring-brand-orange/40" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={logDate} onChange={(ev) => setLogDate(ev.target.value)} aria-label={t('equip.log.date')}
                    className="h-11 rounded-2xl bg-bg-input px-3 text-sm outline-none" />
                  <input type="number" min={0} step="0.01" value={logCost} onChange={(ev) => setLogCost(ev.target.value)} placeholder={t('equip.log.cost')}
                    className="h-11 rounded-2xl bg-bg-input px-3 text-sm tabular-nums outline-none placeholder:text-white/35" />
                </div>
                <textarea rows={2} value={logNote} onChange={(ev) => setLogNote(ev.target.value)} placeholder={t('equip.log.notes')}
                  className="resize-none rounded-2xl bg-bg-input px-4 py-3 text-sm outline-none placeholder:text-white/35" />
                <button type="submit" disabled={!logTitle.trim() || logSaving}
                  className="h-11 self-end rounded-full bg-brand-orange px-5 text-sm font-medium text-on-accent disabled:opacity-40">
                  {logSaving ? t('common.saving') : t('equip.log.save')}
                </button>
              </form>

              {/* History */}
              <section className="flex flex-col gap-2 rounded-3xl bg-bg-card p-5 shadow-card">
                <h3 className="text-lg font-medium">{t('equip.history')}</h3>
                {logs.filter((l) => l.equipment_id === open.id).length === 0 ? (
                  <p className="text-sm text-white/55">{t('equip.noHistory')}</p>
                ) : (
                  <ol className="flex flex-col">
                    {logs.filter((l) => l.equipment_id === open.id).map((l: EquipmentLog) => (
                      <li key={l.id} className="flex gap-3 border-t border-white/[0.06] py-3 first:border-0">
                        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          l.kind === 'issue' && !l.resolved ? 'bg-red-500/10 text-red-500' : l.kind === 'service' ? 'bg-lime text-ink' : 'bg-bg-input text-white/60')}>
                          {l.kind === 'issue' && !l.resolved ? <AlertTriangle className="h-4 w-4" /> : l.kind === 'service' ? <Wrench className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{l.title}</p>
                          <p className="text-xs text-white/50">
                            {t(`equip.log.kinds.${l.kind}`)} · {fmtDate(l.performed_on)}{l.cost != null ? ` · €${l.cost.toFixed(2)}` : ''}{l.auto ? ` · ${t('equip.auto')}` : ''}
                          </p>
                          {l.description && <p className="mt-1 text-sm text-white/70">{l.description}</p>}
                        </div>
                        {l.kind === 'issue' && !l.resolved && (
                          <button type="button" onClick={() => void resolveLog(l)}
                            className="h-9 shrink-0 self-start rounded-full bg-bg-input px-3 text-xs font-medium hover:bg-white/[0.08]">
                            {t('equip.resolve')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </aside>
        </div>,
        document.body,
      )}

      {/* ── Add / edit equipment ── */}
      <Drawer open={formOpen} onClose={() => !saving && setFormOpen(false)} title={editing ? t('equip.edit') : t('equip.add')}>
        <form onSubmit={(ev) => void onSave(ev)} className="flex flex-col gap-5">
          <Input name="name" label={t('equip.name')} required value={draft.name} onChange={(ev) => set('name', ev.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const I = CAT_ICON[c]
              return (
                <button key={c} type="button" onClick={() => set('category', c)}
                  className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium', draft.category === c ? 'bg-ink text-white-fixed' : 'bg-bg-input text-white/65 hover:text-white')}>
                  <I className="h-4 w-4" />{t(`equip.cat.${c}`)}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="location" label={t('equip.location')} value={draft.location ?? ''} onChange={(ev) => set('location', ev.target.value || null)} />
            <Input name="serial" label={t('equip.serial')} value={draft.serial_number ?? ''} onChange={(ev) => set('serial_number', ev.target.value || null)} />
            <Input name="brand" label={t('equip.brand')} value={draft.brand ?? ''} onChange={(ev) => set('brand', ev.target.value || null)} />
            <Input name="model" label={t('equip.model')} value={draft.model ?? ''} onChange={(ev) => set('model', ev.target.value || null)} />
            <Input type="date" name="purchased_on" label={t('equip.purchased')} value={draft.purchased_on ?? ''} onChange={(ev) => set('purchased_on', ev.target.value || null)} />
            <Input type="date" name="warranty_until" label={t('equip.warranty')} value={draft.warranty_until ?? ''} onChange={(ev) => set('warranty_until', ev.target.value || null)} />
            <Input type="number" min={1} name="interval" label={t('equip.interval')} value={draft.service_interval_days ?? ''} onChange={(ev) => set('service_interval_days', ev.target.value ? Number(ev.target.value) : null)} />
            <Input type="date" name="last_service_on" label={t('equip.lastService')} value={draft.last_service_on ?? ''} onChange={(ev) => set('last_service_on', ev.target.value || null)} />
            <Input name="tech" label={t('equip.technician')} value={draft.technician_name ?? ''} onChange={(ev) => set('technician_name', ev.target.value || null)} />
            <Input type="tel" name="tech_phone" label={t('equip.techPhone')} value={draft.technician_phone ?? ''} onChange={(ev) => set('technician_phone', ev.target.value || null)} />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-white/80">{t('equip.haccpLink')}</span>
            <select className={selectCls} value={draft.haccp_location ?? ''} onChange={(ev) => set('haccp_location', ev.target.value || null)}>
              <option value="">{t('equip.haccpNone')}</option>
              {haccpLocations.map((l) => <option key={l.id} value={l.name}>{l.name} ({l.min_temp}–{l.max_temp}°{l.unit})</option>)}
            </select>
            <span className="text-xs text-white/50">{t('equip.haccpLinkHint')}</span>
          </label>
          <Textarea name="notes" label={t('equip.notes')} rows={2} value={draft.notes ?? ''} onChange={(ev) => set('notes', ev.target.value || null)} />
          {formError && <Notice>{formError}</Notice>}
          <div className="flex items-center justify-between gap-2">
            {editing ? (
              <button type="button" onClick={() => { if (window.confirm(t('equip.deleteConfirm', { name: editing.name }))) { void removeEquipment(editing.id); setFormOpen(false); setOpenId(null) } }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:underline"><Trash2 className="h-4 w-4" />{t('common.delete')}</button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
            </div>
          </div>
        </form>
      </Drawer>
    </Page>
  )
}
