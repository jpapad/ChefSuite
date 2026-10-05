import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  PartyPopper, Plus, CalendarDays, Users, Euro, Wallet, X, Pencil, Trash2, Printer, ChefHat,
  ClipboardList, ShoppingCart, FileText, CheckCircle2, Layers, Loader2, MapPin, Phone,
} from 'lucide-react'
import { Page, PageHeader, PillButton, StatRow, StatTile, EmptyState, Notice, Segmented } from '../components/ui/page'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { useEvents } from '../hooks/useEvents'
import { useRecipes } from '../hooks/useRecipes'
import { useRecipeIngredients } from '../hooks/useRecipeIngredients'
import { useRecipeSubRecipes } from '../hooks/useRecipeSubRecipes'
import { useInventory } from '../hooks/useInventory'
import { useSuppliers } from '../hooks/useSuppliers'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import { useTeam } from '../hooks/useTeam'
import { useTeamSettings } from '../hooks/useTeamSettings'
import { useAuth } from '../contexts/AuthContext'
import { expandedNeeds, recipePortionCost } from '../lib/recipeTree'
import { printDoc, esc } from '../lib/printDoc'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { CateringEvent, CateringEventDraft, EventItemDraft, EventStatus } from '../types/database.types'

const PIPELINE: EventStatus[] = ['inquiry', 'quoted', 'confirmed', 'completed']
const STATUS_TONE: Record<EventStatus, string> = {
  inquiry: 'bg-white/[0.06] text-white/70',
  quoted: 'bg-sky-500/10 text-sky-500',
  confirmed: 'bg-lime text-ink',
  completed: 'bg-ink text-white-fixed',
  cancelled: 'bg-red-500/10 text-red-500',
}

const BLANK: CateringEventDraft = {
  title: '', client_name: null, client_phone: null, client_email: null, event_date: null, event_time: null,
  venue: null, guests: 50, status: 'inquiry', price_per_person: null, deposit: null, deposit_paid: false, terms: null, notes: null,
}

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const num = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2))

export default function Catering() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { team } = useTeam()
  const { targetFoodCostPct } = useTeamSettings()
  const { events, loading, error, saveEvent, patchEvent, removeEvent, saveItems, itemsOf } = useEvents()
  const { recipes } = useRecipes()
  const { getFor: ingOf } = useRecipeIngredients()
  const { getFor: subsOf } = useRecipeSubRecipes()
  const { items: inventory } = useInventory()
  const { suppliers } = useSuppliers()
  const { create: createPO } = usePurchaseOrders()

  const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const portionCost = (recipeId: string | null) => recipeId ? recipePortionCost(recipeId, recipes, ingOf, subsOf, inventory) : null

  function eventCost(eventId: string) {
    let total = 0; let complete = true
    for (const it of itemsOf(eventId)) {
      const c = portionCost(it.recipe_id)
      if (c == null) { complete = false; continue }
      total += c * it.portions
    }
    return { total, complete }
  }
  const revenueOf = (e: CateringEvent) => (e.price_per_person ?? 0) * e.guests

  // ── Overview ──
  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const active = events.filter((e) => e.status !== 'cancelled')
  const upcoming = active.filter((e) => e.event_date && e.event_date >= today && e.event_date <= in30 && e.status !== 'completed')
  const confirmedRevenue = active.filter((e) => e.status === 'confirmed').reduce((s, e) => s + revenueOf(e), 0)
  const pipelineValue = active.filter((e) => e.status === 'inquiry' || e.status === 'quoted').reduce((s, e) => s + revenueOf(e), 0)
  const depositsDue = active.filter((e) => e.status === 'confirmed' && (e.deposit ?? 0) > 0 && !e.deposit_paid)

  // ── Event form ──
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CateringEvent | null>(null)
  const [draft, setDraft] = useState<CateringEventDraft>(BLANK)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const set = <K extends keyof CateringEventDraft>(k: K, v: CateringEventDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  function openForm(e?: CateringEvent) {
    setEditing(e ?? null)
    setDraft(e ? Object.fromEntries(Object.keys(BLANK).map((k) => [k, e[k as keyof CateringEventDraft]])) as CateringEventDraft : BLANK)
    setFormError(null)
    setFormOpen(true)
  }
  async function onSave(ev: FormEvent) {
    ev.preventDefault()
    if (!draft.title.trim()) { setFormError(t('events.titleRequired')); return }
    setSaving(true)
    try {
      const id = await saveEvent({ ...draft, title: draft.title.trim() }, editing?.id)
      setFormOpen(false)
      if (!editing) setOpenId(id)
    } catch (err) { setFormError(err instanceof Error ? err.message : t('common.saveFailed')) }
    finally { setSaving(false) }
  }

  // ── Detail ──
  const [openId, setOpenId] = useState<string | null>(null)
  const open = events.find((e) => e.id === openId) ?? null
  const [tab, setTab] = useState<'quote' | 'production' | 'shopping'>('quote')
  const [menu, setMenu] = useState<EventItemDraft[]>([])
  const [menuDirty, setMenuDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [recipeToAdd, setRecipeToAdd] = useState('')

  useEffect(() => {
    if (!openId) return
    setMenu(itemsOf(openId).map((i) => ({ recipe_id: i.recipe_id, name: i.name, portions: i.portions, course: i.course })))
    setMenuDirty(false); setFlash(null); setTab('quote')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  const menuCost = menu.reduce((s, m) => s + (portionCost(m.recipe_id) ?? 0) * m.portions, 0)
  const unpriced = menu.filter((m) => portionCost(m.recipe_id) == null).length
  const guests = open?.guests ?? 0
  const ppp = open?.price_per_person ?? 0
  const revenue = ppp * guests
  const fcPct = revenue > 0 ? (menuCost / revenue) * 100 : null
  const suggestedPpp = guests > 0 && menuCost > 0 ? menuCost / guests / (targetFoodCostPct / 100) : null

  async function persistMenu() {
    if (!open) return
    setBusy('menu')
    try { await saveItems(open.id, menu); setMenuDirty(false) } finally { setBusy(null) }
  }

  function addRecipe(id: string) {
    const r = recipes.find((x) => x.id === id)
    if (!r) return
    setMenu((m) => [...m, { recipe_id: r.id, name: r.title, portions: guests || 1, course: r.category ? t(`recipes.categories.${r.category}`) : null }])
    setMenuDirty(true); setRecipeToAdd('')
  }

  // Production: dishes × batches, then bases needed across the whole menu
  const production = useMemo(() => {
    const dishes = menu.filter((m) => m.recipe_id && m.portions > 0).map((m) => {
      const r = recipes.find((x) => x.id === m.recipe_id)
      return { ...m, servings: r?.servings ?? null, batches: r?.servings ? Math.ceil(m.portions / r.servings) : null }
    })
    const bases = new Map<string, number>()
    function walk(id: string, mult: number, depth: number) {
      if (depth > 10) return
      for (const s of subsOf(id)) {
        bases.set(s.sub_recipe_id, (bases.get(s.sub_recipe_id) ?? 0) + s.quantity * mult)
        walk(s.sub_recipe_id, s.quantity * mult, depth + 1)
      }
    }
    for (const d of dishes) walk(d.recipe_id!, d.portions, 0)
    return { dishes, bases: [...bases].map(([id, q]) => ({ recipe: recipes.find((r) => r.id === id), qty: q })) }
  }, [menu, recipes, subsOf])

  // Shopping: raw needs for the whole menu vs stock
  const shopping = useMemo(() => {
    const total = new Map<string, number>()
    for (const m of menu) {
      if (!m.recipe_id || m.portions <= 0) continue
      for (const [itemId, q] of expandedNeeds(m.recipe_id, m.portions, ingOf, subsOf)) total.set(itemId, (total.get(itemId) ?? 0) + q)
    }
    return [...total].map(([id, need]) => {
      const item = inventory.find((i) => i.id === id)
      const short = Math.max(0, need - (item?.quantity ?? 0))
      return { id, item, need, short }
    }).sort((a, b) => b.short - a.short || (a.item?.name ?? '').localeCompare(b.item?.name ?? ''))
  }, [menu, ingOf, subsOf, inventory])
  const shortLines = shopping.filter((s) => s.short > 0 && s.item)

  async function createPrepTasks() {
    if (!open || !profile?.team_id || !profile.id) return
    const prepDate = open.event_date
      ? new Date(new Date(open.event_date + 'T00:00:00').getTime() - 86400000).toISOString().slice(0, 10)
      : today
    setBusy('prep')
    try {
      const rows = [
        ...production.bases.filter((b) => b.recipe).map((b) => ({
          title: `${b.recipe!.title} — ${open.title}`, recipe_id: b.recipe!.id, quantity: Math.round(b.qty * 100) / 100,
          description: `${t('events.prod.base')} · ${num(b.qty)} ${b.recipe!.yield_unit ?? t('recipes.sub.portionShort')}`,
        })),
        ...production.dishes.map((d) => ({
          title: `${d.name} — ${open.title}`, recipe_id: d.recipe_id, quantity: d.portions,
          description: `${t('events.prod.forEvent', { guests: open.guests, date: fmtDate(open.event_date) })}`,
        })),
      ].map((r) => ({ ...r, team_id: profile.team_id, created_by: profile.id, prep_for: prepDate, status: 'pending', assignee_id: null, workstation_id: null }))
      const { error: err } = await supabase.from('prep_tasks').insert(rows)
      if (err) throw err
      setFlash(t('events.prod.created', { count: rows.length, date: fmtDate(prepDate) }))
    } catch (e) { setFlash(e instanceof Error ? e.message : 'Error') }
    finally { setBusy(null) }
  }

  async function createOrders() {
    if (!open) return
    setBusy('orders')
    try {
      const bySupplier = new Map<string, typeof shortLines>()
      for (const l of shortLines) {
        const sid = l.item!.supplier_id ?? '_none'
        bySupplier.set(sid, [...(bySupplier.get(sid) ?? []), l])
      }
      let n = 0
      for (const [sid, lines] of bySupplier) {
        if (sid === '_none') continue
        const po = await createPO({ supplier_id: sid, status: 'draft', notes: t('events.shop.poNote', { title: open.title, date: fmtDate(open.event_date) }), ordered_at: null })
        const { error: err } = await supabase.from('purchase_order_items').insert(lines.map((l) => ({
          order_id: po.id, inventory_item_id: l.id, name: l.item!.name, quantity: Math.ceil(l.short * 100) / 100, unit: l.item!.unit, unit_price: l.item!.cost_per_unit,
        })))
        if (err) throw err
        n++
      }
      const orphan = bySupplier.get('_none')?.length ?? 0
      setFlash(t('events.shop.created', { count: n }) + (orphan ? ' ' + t('events.shop.noSupplier', { count: orphan }) : ''))
    } catch (e) { setFlash(e instanceof Error ? e.message : 'Error') }
    finally { setBusy(null) }
  }

  function printQuote(kind: 'quote' | 'confirmation') {
    if (!open) return
    const courses = new Map<string, EventItemDraft[]>()
    for (const m of menu) courses.set(m.course ?? '', [...(courses.get(m.course ?? '') ?? []), m])
    const menuHtml = [...courses].map(([c, list]) => `${c ? `<h2>${esc(c)}</h2>` : ''}<p>${list.map((m) => esc(m.name)).join('<br>')}</p>`).join('')
    const total = revenue
    const body = `
      <span class="lime">${esc(kind === 'quote' ? t('events.doc.quote') : t('events.doc.confirmation'))}</span>
      <h1>${esc(open.title)}</h1>
      <p class="muted">${esc(team?.name ?? '')} · ${esc(new Date().toLocaleDateString(i18n.language))}</p>
      <table>
        <tr><th>${esc(t('events.client'))}</th><td>${esc(open.client_name)}${open.client_phone ? ' · ' + esc(open.client_phone) : ''}${open.client_email ? ' · ' + esc(open.client_email) : ''}</td></tr>
        <tr><th>${esc(t('events.date'))}</th><td>${esc(fmtDate(open.event_date))}${open.event_time ? ' · ' + esc(open.event_time) : ''}</td></tr>
        <tr><th>${esc(t('events.venue'))}</th><td>${esc(open.venue ?? '—')}</td></tr>
        <tr><th>${esc(t('events.guests'))}</th><td>${open.guests}</td></tr>
      </table>
      <h2>${esc(t('events.doc.menu'))}</h2>${menuHtml || '<p class="muted">—</p>'}
      <h2>${esc(t('events.doc.price'))}</h2>
      <table>
        <tr><td>${esc(t('events.pricePP'))}</td><td class="n">${money(ppp)}</td></tr>
        <tr><td>${esc(t('events.guests'))}</td><td class="n">× ${open.guests}</td></tr>
        <tr class="total"><td>${esc(t('events.doc.total'))}</td><td class="n">${money(total)}</td></tr>
        ${open.deposit ? `<tr><td>${esc(t('events.deposit'))}${open.deposit_paid ? ' ✓' : ''}</td><td class="n">${money(open.deposit)}</td></tr>` : ''}
      </table>
      ${open.terms ? `<div class="box">${esc(open.terms)}</div>` : ''}
      ${kind === 'confirmation' ? `<div class="sign"><div>${esc(team?.name ?? '')}</div><div>${esc(open.client_name ?? t('events.client'))}</div></div>` : ''}`
    printDoc(`${open.title} — ${kind}`, body)
  }

  function printProduction() {
    if (!open) return
    const body = `
      <span class="lime">${esc(t('events.tabs.production'))}</span>
      <h1>${esc(open.title)}</h1>
      <p class="muted">${esc(fmtDate(open.event_date))} · ${open.guests} ${esc(t('events.guests'))}</p>
      <h2>${esc(t('events.prod.dishes'))}</h2>
      <table><tr><th>${esc(t('events.prod.dish'))}</th><th class="n">${esc(t('events.prod.portions'))}</th><th class="n">${esc(t('events.prod.batches'))}</th></tr>
      ${production.dishes.map((d) => `<tr><td>${esc(d.name)}</td><td class="n">${num(d.portions)}</td><td class="n">${d.batches ?? '—'}</td></tr>`).join('')}</table>
      ${production.bases.length ? `<h2>${esc(t('events.prod.bases'))}</h2><table>${production.bases.map((b) => `<tr><td>${esc(b.recipe?.title ?? '—')}</td><td class="n">${num(b.qty)} ${esc(b.recipe?.yield_unit ?? '')}</td></tr>`).join('')}</table>` : ''}
      <h2>${esc(t('events.tabs.shopping'))}</h2>
      <table><tr><th></th><th class="n">${esc(t('events.shop.need'))}</th><th class="n">${esc(t('events.shop.stock'))}</th><th class="n">${esc(t('events.shop.short'))}</th></tr>
      ${shopping.map((s) => `<tr><td>${esc(s.item?.name ?? '—')}</td><td class="n">${num(s.need)} ${esc(s.item?.unit)}</td><td class="n">${num(s.item?.quantity ?? 0)}</td><td class="n">${s.short > 0 ? num(s.short) : '✓'}</td></tr>`).join('')}</table>`
    printDoc(`${open.title} — production`, body)
  }

  // ── Render ──
  return (
    <Page>
      <PageHeader
        title={t('events.title')}
        subtitle={t('events.subtitle')}
        actions={<PillButton variant="primary" icon={Plus} onClick={() => openForm()}>{t('events.add')}</PillButton>}
      />
      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile label={t('events.stat.upcoming')} value={upcoming.length} icon={CalendarDays} tone="ink" hint={t('events.stat.upcomingHint')} />
        <StatTile label={t('events.stat.confirmed')} value={money(confirmedRevenue)} icon={Euro} />
        <StatTile label={t('events.stat.pipeline')} value={money(pipelineValue)} icon={Wallet} hint={t('events.stat.pipelineHint')} />
        <StatTile label={t('events.stat.deposits')} value={depositsDue.length} icon={FileText} tone={depositsDue.length ? 'warn' : 'default'} hint={t('events.stat.depositsHint')} />
      </StatRow>

      {loading ? null : events.length === 0 ? (
        <EmptyState icon={PartyPopper} title={t('events.empty')} body={t('events.emptyHint')}
          action={<PillButton variant="primary" icon={Plus} onClick={() => openForm()}>{t('events.add')}</PillButton>} />
      ) : (
        <section className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          {PIPELINE.map((st) => {
            const list = events.filter((e) => e.status === st)
            return (
              <div key={st} className="flex w-[82vw] shrink-0 snap-start flex-col gap-2 rounded-3xl bg-bg-card-2/60 p-2 sm:w-auto">
                <div className="flex items-center justify-between px-3 pt-2">
                  <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', STATUS_TONE[st])}>{t(`events.status.${st}`)}</span>
                  <span className="text-sm tabular-nums text-white/50">{list.length}</span>
                </div>
                {list.length === 0 && <p className="px-3 py-6 text-center text-xs text-white/40">—</p>}
                {list.map((e) => {
                  const { total } = eventCost(e.id)
                  const rev = revenueOf(e)
                  return (
                    <button key={e.id} type="button" onClick={() => setOpenId(e.id)}
                      className="flex flex-col gap-3 rounded-2xl bg-bg-card p-4 text-left shadow-card transition hover:-translate-y-0.5">
                      <div>
                        <p className="font-medium leading-tight">{e.title}</p>
                        <p className="text-xs text-white/55">{e.client_name ?? '—'}</p>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(e.event_date)}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{e.guests}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-xl font-medium tabular-nums">{rev ? money(rev) : '—'}</span>
                        {rev > 0 && total > 0 && <span className={cn('text-xs font-medium tabular-nums', (total / rev) * 100 <= targetFoodCostPct ? 'text-emerald-500' : 'text-amber-500')}>FC {((total / rev) * 100).toFixed(0)}%</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </section>
      )}

      {events.some((e) => e.status === 'cancelled') && (
        <p className="text-sm text-white/45">{t('events.cancelledCount', { count: events.filter((e) => e.status === 'cancelled').length })}</p>
      )}

      {/* ── Event detail ── */}
      {open && createPortal(
        <div role="dialog" aria-modal="true" aria-label={open.title} className="fixed inset-0 z-50 overflow-y-auto bg-bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-5">
            <header className="flex flex-col gap-5 rounded-[2rem] bg-ink p-6 text-white-fixed sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', open.status === 'confirmed' ? 'bg-lime text-ink' : 'bg-white-fixed/10')}>{t(`events.status.${open.status}`)}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openForm(open)} aria-label={t('common.edit')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white-fixed/10 hover:bg-white-fixed/20"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setOpenId(null)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white-fixed/10 hover:bg-white-fixed/20"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{open.title}</h1>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-white-fixed/60">
                  {open.client_name && <span>{open.client_name}</span>}
                  {open.client_phone && <a href={`tel:${open.client_phone}`} className="inline-flex items-center gap-1 hover:text-white-fixed"><Phone className="h-3.5 w-3.5" />{open.client_phone}</a>}
                  {open.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{open.venue}</span>}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { k: t('events.date'), v: fmtDate(open.event_date) + (open.event_time ? ` · ${open.event_time}` : '') },
                  { k: t('events.guests'), v: String(open.guests) },
                  { k: t('events.revenue'), v: revenue ? money(revenue) : '—' },
                  { k: t('events.foodCost'), v: fcPct != null ? `${fcPct.toFixed(1)}%` : '—' },
                ].map(({ k, v }) => (
                  <div key={k} className="rounded-2xl bg-white-fixed/[0.06] px-4 py-3">
                    <dt className="text-xs text-white-fixed/50">{k}</dt>
                    <dd className="mt-1 text-xl font-medium tabular-nums text-lime">{v}</dd>
                  </div>
                ))}
              </dl>
              {/* status steps */}
              <div className="flex flex-wrap gap-2">
                {PIPELINE.map((s) => (
                  <button key={s} type="button" onClick={() => void patchEvent(open.id, { status: s })}
                    className={cn('h-9 rounded-full px-3.5 text-sm font-medium transition', open.status === s ? 'bg-lime text-ink' : 'bg-white-fixed/10 text-white-fixed/70 hover:text-white-fixed')}>
                    {t(`events.status.${s}`)}
                  </button>
                ))}
                <button type="button" onClick={() => void patchEvent(open.id, { status: 'cancelled' })}
                  className={cn('h-9 rounded-full px-3.5 text-sm font-medium', open.status === 'cancelled' ? 'bg-red-500 text-white-fixed' : 'text-white-fixed/50 hover:text-white-fixed')}>
                  {t('events.status.cancelled')}
                </button>
              </div>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented value={tab} onChange={setTab} options={[
                { value: 'quote', label: t('events.tabs.quote'), icon: FileText },
                { value: 'production', label: t('events.tabs.production'), icon: ChefHat },
                { value: 'shopping', label: t('events.tabs.shopping'), icon: ShoppingCart },
              ]} />
              {menuDirty && (
                <button type="button" onClick={() => void persistMenu()} disabled={busy === 'menu'}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-medium text-on-accent">
                  {busy === 'menu' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{t('events.saveMenu')}
                </button>
              )}
            </div>
            {flash && <Notice tone="info">{flash}</Notice>}

            {tab === 'quote' && (
              <div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <section className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6">
                  <h2 className="text-lg font-medium">{t('events.menu')}</h2>
                  {menu.length === 0 && <p className="rounded-2xl bg-bg-input px-4 py-4 text-sm text-white/55">{t('events.menuEmpty')}</p>}
                  <ul className="flex flex-col gap-1.5">
                    {menu.map((m, i) => {
                      const c = portionCost(m.recipe_id)
                      return (
                        <li key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-2xl bg-bg-input p-2 pl-4 sm:grid-cols-[120px_1fr_auto_auto_auto]">
                          <input value={m.course ?? ''} placeholder={t('events.course')} aria-label={t('events.course')}
                            onChange={(e) => { setMenu((ms) => ms.map((x, j) => j === i ? { ...x, course: e.target.value || null } : x)); setMenuDirty(true) }}
                            className="hidden h-9 rounded-xl bg-bg-card px-2 text-xs outline-none sm:block" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{m.name}</span>
                            <span className="block text-[11px] text-white/50">{c != null ? `${money(c)} / ${t('events.portion')} · ${money(c * m.portions)}` : t('events.noCost')}</span>
                          </span>
                          <input type="number" min={0} value={m.portions} aria-label={t('events.prod.portions')}
                            onChange={(e) => { setMenu((ms) => ms.map((x, j) => j === i ? { ...x, portions: Number(e.target.value) || 0 } : x)); setMenuDirty(true) }}
                            className="h-9 w-20 rounded-xl bg-bg-card px-2 text-right text-sm tabular-nums outline-none" />
                          <span className="hidden text-xs text-white/45 sm:block">{t('events.portionsShort')}</span>
                          <button type="button" aria-label={t('common.delete')} onClick={() => { setMenu((ms) => ms.filter((_, j) => j !== i)); setMenuDirty(true) }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 hover:bg-bg-card hover:text-red-500"><X className="h-4 w-4" /></button>
                        </li>
                      )
                    })}
                  </ul>
                  <select value={recipeToAdd} onChange={(e) => addRecipe(e.target.value)}
                    className="h-11 rounded-xl border border-inv-border bg-bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange/40">
                    <option value="">{t('events.addDish')}</option>
                    {[...recipes].filter((r) => !r.is_base).sort((a, b) => a.title.localeCompare(b.title)).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </section>

                <section className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-4">
                  <h2 className="text-lg font-medium">{t('events.pricing')}</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-bg-input px-4 py-3"><p className="text-xs text-white/55">{t('events.menuCost')}</p><p className="text-xl font-medium tabular-nums">{money(menuCost)}</p></div>
                    <div className="rounded-2xl bg-bg-input px-4 py-3"><p className="text-xs text-white/55">{t('events.costPP')}</p><p className="text-xl font-medium tabular-nums">{guests ? money(menuCost / guests) : '—'}</p></div>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/55">{t('events.pricePP')}</span>
                    <input type="number" min={0} step="0.5" value={open.price_per_person ?? ''}
                      onChange={(e) => void patchEvent(open.id, { price_per_person: e.target.value === '' ? null : Number(e.target.value) })}
                      className="h-12 rounded-2xl bg-bg-input px-4 text-lg font-medium tabular-nums outline-none focus:ring-2 focus:ring-brand-orange/40" />
                  </label>
                  {suggestedPpp != null && (
                    <button type="button" onClick={() => void patchEvent(open.id, { price_per_person: Math.ceil(suggestedPpp) })}
                      className="rounded-2xl bg-lime/40 px-4 py-2.5 text-left text-sm text-ink">
                      {t('events.suggested', { pct: targetFoodCostPct, price: money(Math.ceil(suggestedPpp)) })}
                    </button>
                  )}
                  <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white-fixed">
                    <span className="text-sm text-white-fixed/60">{t('events.doc.total')}</span>
                    <span className="text-2xl font-medium tabular-nums text-lime">{money(revenue)}</span>
                  </div>
                  <p className={cn('text-sm', fcPct == null ? 'text-white/50' : fcPct <= targetFoodCostPct ? 'text-emerald-500' : 'text-amber-500')}>
                    {fcPct != null ? t('events.fcLine', { pct: fcPct.toFixed(1), margin: money(revenue - menuCost) }) : t('events.setPrice')}
                    {unpriced > 0 && ` · ${t('events.unpriced', { count: unpriced })}`}
                  </p>
                  <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-white/55">{t('events.deposit')}</span>
                      <input type="number" min={0} value={open.deposit ?? ''}
                        onChange={(e) => void patchEvent(open.id, { deposit: e.target.value === '' ? null : Number(e.target.value) })}
                        className="h-11 rounded-2xl bg-bg-input px-4 tabular-nums outline-none" />
                    </label>
                    <label className="flex h-11 items-center gap-2 rounded-2xl bg-bg-input px-3 text-sm">
                      <input type="checkbox" checked={open.deposit_paid} onChange={(e) => void patchEvent(open.id, { deposit_paid: e.target.checked })} className="h-4 w-4 accent-[#0F1210]" />
                      {t('events.paid')}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { printQuote('quote'); if (open.status === 'inquiry') void patchEvent(open.id, { status: 'quoted' }) }}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-bg-input text-sm font-medium hover:bg-white/[0.08]"><Printer className="h-4 w-4" />{t('events.doc.quote')}</button>
                    <button type="button" onClick={() => printQuote('confirmation')}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-bg-input text-sm font-medium hover:bg-white/[0.08]"><FileText className="h-4 w-4" />{t('events.doc.confirmation')}</button>
                  </div>
                </section>
              </div>
            )}

            {tab === 'production' && (
              <div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <section className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6">
                  <h2 className="text-lg font-medium">{t('events.prod.dishes')}</h2>
                  {production.dishes.length === 0 ? <p className="text-sm text-white/55">{t('events.menuEmpty')}</p> : (
                    <ul className="flex flex-col divide-y divide-white/[0.06]">
                      {production.dishes.map((d, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 py-3">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-right text-sm tabular-nums">
                            <span className="block font-medium">{num(d.portions)} {t('events.portionsShort')}</span>
                            {d.batches != null && <span className="block text-xs text-white/50">{t('events.prod.batchesOf', { count: d.batches, size: d.servings })}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {production.bases.length > 0 && (
                    <>
                      <h3 className="mt-2 flex items-center gap-2 text-sm font-medium text-white/60"><Layers className="h-4 w-4" />{t('events.prod.bases')}</h3>
                      <ul className="flex flex-col gap-1.5">
                        {production.bases.map((b, i) => (
                          <li key={i} className="flex items-center justify-between rounded-2xl bg-lime/30 px-4 py-2.5 text-sm text-ink">
                            <span className="font-medium">{b.recipe?.title ?? '—'}</span>
                            <span className="tabular-nums">{num(b.qty)} {b.recipe?.yield_unit ?? t('recipes.sub.portionShort')}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
                <section className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6">
                  <h2 className="text-lg font-medium">{t('events.prod.actions')}</h2>
                  <p className="text-sm text-white/55">{t('events.prod.hint')}</p>
                  <button type="button" onClick={() => void createPrepTasks()} disabled={busy === 'prep' || production.dishes.length === 0 || menuDirty}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-orange text-sm font-medium text-on-accent disabled:opacity-40">
                    {busy === 'prep' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}{t('events.prod.createTasks')}
                  </button>
                  <button type="button" onClick={printProduction} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-bg-input text-sm font-medium">
                    <Printer className="h-4 w-4" />{t('events.prod.print')}
                  </button>
                  {menuDirty && <p className="text-xs text-amber-500">{t('events.saveFirst')}</p>}
                </section>
              </div>
            )}

            {tab === 'shopping' && (
              <section className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">{t('events.tabs.shopping')}</h2>
                    <p className="text-sm text-white/55">{t('events.shop.summary', { short: shortLines.length, total: shopping.length })}</p>
                  </div>
                  <button type="button" onClick={() => void createOrders()} disabled={busy === 'orders' || shortLines.length === 0 || menuDirty}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-medium text-on-accent disabled:opacity-40">
                    {busy === 'orders' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}{t('events.shop.createOrders')}
                  </button>
                </div>
                {shopping.length === 0 ? <p className="text-sm text-white/55">{t('events.menuEmpty')}</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead><tr className="text-left text-xs text-white/50">
                        <th className="py-2 font-medium">{t('lots.item')}</th>
                        <th className="py-2 text-right font-medium">{t('events.shop.need')}</th>
                        <th className="py-2 text-right font-medium">{t('events.shop.stock')}</th>
                        <th className="py-2 text-right font-medium">{t('events.shop.short')}</th>
                        <th className="py-2 pl-4 font-medium">{t('lots.supplier')}</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {shopping.map((s) => (
                          <tr key={s.id}>
                            <td className="py-2.5 font-medium">{s.item?.name ?? '—'}</td>
                            <td className="py-2.5 text-right tabular-nums">{num(s.need)} {s.item?.unit}</td>
                            <td className="py-2.5 text-right tabular-nums text-white/60">{num(s.item?.quantity ?? 0)}</td>
                            <td className={cn('py-2.5 text-right tabular-nums font-medium', s.short > 0 ? 'text-red-500' : 'text-emerald-500')}>{s.short > 0 ? num(s.short) : '✓'}</td>
                            <td className="py-2.5 pl-4 text-white/60">{suppliers.find((x) => x.id === s.item?.supplier_id)?.name ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            <div className="flex justify-end pb-6">
              <button type="button" onClick={() => { if (window.confirm(t('events.deleteConfirm', { title: open.title }))) { void removeEvent(open.id); setOpenId(null) } }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:underline"><Trash2 className="h-4 w-4" />{t('events.delete')}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Create / edit ── */}
      <Drawer open={formOpen} onClose={() => !saving && setFormOpen(false)} title={editing ? t('events.edit') : t('events.add')}>
        <form onSubmit={(ev) => void onSave(ev)} className="flex flex-col gap-5">
          <Input name="title" label={t('events.titleLabel')} placeholder={t('events.titlePlaceholder')} required value={draft.title} onChange={(e) => set('title', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" name="event_date" label={t('events.date')} value={draft.event_date ?? ''} onChange={(e) => set('event_date', e.target.value || null)} />
            <Input type="time" name="event_time" label={t('events.time')} value={draft.event_time ?? ''} onChange={(e) => set('event_time', e.target.value || null)} />
            <Input type="number" min={0} name="guests" label={t('events.guests')} value={draft.guests} onChange={(e) => set('guests', Number(e.target.value) || 0)} />
            <Input name="venue" label={t('events.venue')} value={draft.venue ?? ''} onChange={(e) => set('venue', e.target.value || null)} />
            <Input name="client_name" label={t('events.client')} value={draft.client_name ?? ''} onChange={(e) => set('client_name', e.target.value || null)} />
            <Input type="tel" name="client_phone" label={t('events.phone')} value={draft.client_phone ?? ''} onChange={(e) => set('client_phone', e.target.value || null)} />
          </div>
          <Input type="email" name="client_email" label="Email" value={draft.client_email ?? ''} onChange={(e) => set('client_email', e.target.value || null)} />
          <Textarea name="terms" label={t('events.terms')} rows={3} placeholder={t('events.termsPlaceholder')} value={draft.terms ?? ''} onChange={(e) => set('terms', e.target.value || null)} />
          <Textarea name="notes" label={t('events.notes')} rows={2} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
          {formError && <Notice>{formError}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </div>
        </form>
      </Drawer>
    </Page>
  )
}
