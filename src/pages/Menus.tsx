import { useState, useEffect } from 'react'
import { Plus, UtensilsCrossed, BookOpen, ChefHat, CalendarDays, Pencil, Trash2, ExternalLink, ToggleLeft, ToggleRight, Copy, LayoutTemplate, Sparkles, Sun, QrCode, Globe, CheckCircle2, FileSearch, BarChart2 } from 'lucide-react'
import { translateMenuItems } from '../lib/gemini'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import QRCodeLib from 'qrcode'
import { Page, PageHeader, PillButton, ActionMenu, StatRow, StatTile, Panel, EmptyState } from '../components/ui/page'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { AIMenuGeneratorDrawer } from '../components/menus/AIMenuGeneratorDrawer'
import { MenuPdfImportDrawer } from '../components/menus/MenuPdfImportDrawer'
import { MenuScanAnalytics } from '../components/menus/MenuScanAnalytics'
import { useMenus } from '../hooks/useMenus'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { Menu, MenuType, PrintTemplate } from '../types/database.types'

const TYPE_ICONS: Record<MenuType, React.ReactNode> = {
  a_la_carte: <UtensilsCrossed className="h-4 w-4" />,
  buffet:     <BookOpen className="h-4 w-4" />,
  tasting:    <ChefHat className="h-4 w-4" />,
  daily:      <CalendarDays className="h-4 w-4" />,
}

const TYPE_COLORS: Record<MenuType, string> = {
  a_la_carte: 'bg-white/[0.06] text-white',
  buffet:     'bg-sky-500/10 text-sky-500',
  tasting:    'bg-violet-500/10 text-violet-500',
  daily:      'bg-emerald-500/10 text-emerald-500',
}

interface MenuFormValues {
  name: string
  type: MenuType
  description: string
  price_per_person: string
  show_prices: boolean
  active: boolean
  valid_from: string
  valid_to: string
  print_template: PrintTemplate
  logo_url: string
  custom_footer: string
}

const EMPTY: MenuFormValues = {
  name: '', type: 'a_la_carte', description: '',
  price_per_person: '', show_prices: true, active: true,
  valid_from: '', valid_to: '',
  print_template: 'classic', logo_url: '', custom_footer: '',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function isExpired(validTo: string | null) {
  if (!validTo) return false
  return new Date(validTo) < new Date(new Date().toDateString())
}

export default function Menus() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const { menus, loading, create, update, remove, duplicate } = useMenus()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
  const [editing, setEditing] = useState<Menu | null>(null)
  const [form, setForm] = useState<MenuFormValues>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [dailyMenuId, setDailyMenuId] = useState<string | null>(null)
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, string>>({})
  const [todayQr, setTodayQr] = useState<{ url: string; dataUrl: string } | null>(null)
  const [todayQrOpen, setTodayQrOpen] = useState(false)
  const [scanAnalyticsOpen, setScanAnalyticsOpen] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translateDone, setTranslateDone] = useState(false)

  // Load current daily menu + weekly schedule
  useEffect(() => {
    if (!teamId) return
    supabase.from('teams').select('daily_menu_id').eq('id', teamId).single()
      .then(({ data }) => setDailyMenuId(data?.daily_menu_id ?? null))
    supabase.from('menu_weekly_schedule').select('day_of_week, menu_id').eq('team_id', teamId)
      .then(({ data }) => {
        const map: Record<number, string> = {}
        for (const row of data ?? []) map[row.day_of_week] = row.menu_id
        setWeeklySchedule(map)
      })
  }, [teamId])

  async function setWeeklyDay(dayOfWeek: number, menuId: string | null) {
    if (!teamId) return
    if (menuId) {
      await supabase.from('menu_weekly_schedule').upsert(
        { team_id: teamId, day_of_week: dayOfWeek, menu_id: menuId },
        { onConflict: 'team_id,day_of_week' },
      )
      setWeeklySchedule(prev => ({ ...prev, [dayOfWeek]: menuId }))
    } else {
      await supabase.from('menu_weekly_schedule')
        .delete().eq('team_id', teamId).eq('day_of_week', dayOfWeek)
      setWeeklySchedule(prev => { const n = { ...prev }; delete n[dayOfWeek]; return n })
    }
  }

  async function setDailyMenu(menuId: string | null) {
    if (!teamId) return
    await supabase.from('teams').update({ daily_menu_id: menuId }).eq('id', teamId)
    setDailyMenuId(menuId)
  }

  async function openTodayQr() {
    if (!teamId) return
    const url = `${window.location.origin}/menu/today/${teamId}`
    const dataUrl = await QRCodeLib.toDataURL(url, { width: 512, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    setTodayQr({ url, dataUrl })
    setTodayQrOpen(true)
  }

  function downloadTodayQr() {
    if (!todayQr) return
    const a = document.createElement('a')
    a.href = todayQr.dataUrl
    a.download = 'menu-today-qr.png'
    a.click()
  }

  async function translateDailyMenu() {
    if (!dailyMenuId) return
    setTranslating(true)
    setTranslateDone(false)
    try {
      const { data } = await supabase
        .from('menus')
        .select('id, name, menu_sections(id, name, menu_items(id, name, description, name_el, description_el))')
        .eq('id', dailyMenuId)
        .single()
      if (!data) return
      const sections = ((data as any).menu_sections ?? []) as Array<{ id: string; name: string; menu_items?: any[] }>
      const items = sections.flatMap((s) => s.menu_items ?? []) as Array<{
        id: string; name: string; description?: string | null
        name_el?: string | null; description_el?: string | null
      }>

      // Translate menu name + section names + all items in one batch
      const nameBatch = [
        { name: (data as any).name as string, description: null },
        ...sections.map((s) => ({ name: s.name, description: null })),
        ...items.map((it) => ({ name: it.name, description: it.description ?? null })),
      ]
      const allResults = await translateMenuItems(nameBatch)

      const menuNameResult = allResults[0]
      const sectionResults = allResults.slice(1, 1 + sections.length)
      const itemResults = allResults.slice(1 + sections.length)

      await Promise.all([
        supabase.from('menus').update({ name_el: menuNameResult?.name_el, name_bg: menuNameResult?.name_bg }).eq('id', dailyMenuId),
        ...sectionResults.map((r, i) => {
          const section = sections[i]
          if (!section) return Promise.resolve()
          return supabase.from('menu_sections').update({ name_el: r.name_el, name_bg: r.name_bg }).eq('id', section.id)
        }),
        ...itemResults.map((r, i) => {
          const item = items[i]
          if (!item) return Promise.resolve()
          return supabase.from('menu_items').update({
            name_el: r.name_el, description_el: r.description_el,
            name_bg: r.name_bg, description_bg: r.description_bg,
          }).eq('id', item.id)
        }),
      ])
      setTranslateDone(true)
    } finally {
      setTranslating(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setDrawerOpen(true)
  }

  function openEdit(menu: Menu) {
    setEditing(menu)
    setForm({
      name: menu.name,
      type: menu.type,
      description: menu.description ?? '',
      price_per_person: menu.price_per_person != null ? String(menu.price_per_person) : '',
      show_prices: menu.show_prices,
      active: menu.active,
      valid_from: menu.valid_from ?? '',
      valid_to: menu.valid_to ?? '',
      print_template: menu.print_template ?? 'classic',
      logo_url: menu.logo_url ?? '',
      custom_footer: menu.custom_footer ?? '',
    })
    setDrawerOpen(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || null,
        price_per_person: form.price_per_person ? parseFloat(form.price_per_person) : null,
        show_prices: form.show_prices,
        active: form.active,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        print_template: form.print_template,
        logo_url: form.logo_url.trim() || null,
        custom_footer: form.custom_footer.trim() || null,
      }
      if (editing) {
        await update(editing.id, payload)
      } else {
        await create(payload)
      }
      setDrawerOpen(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(menu: Menu) {
    const ok = window.confirm(t('menus.deleteConfirm', { name: menu.name }))
    if (!ok) return
    await remove(menu.id)
  }

  async function onDuplicate(menu: Menu) {
    setDuplicatingId(menu.id)
    try {
      await duplicate(menu.id)
    } finally {
      setDuplicatingId(null)
    }
  }

  async function toggleActive(menu: Menu) {
    await update(menu.id, { active: !menu.active })
  }

  function typeLabel(type: MenuType): string {
    return t(`menus.types.${type}`)
  }

  const DAYS = t('menus.v2.days', { returnObjects: true }) as string[]
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay()
  const todayMenuId = weeklySchedule[todayDow] ?? dailyMenuId
  const todayMenu = menus.find((m) => m.id === todayMenuId)
  const activeCount = menus.filter((m) => m.active).length
  const expiredCount = menus.filter((m) => isExpired(m.valid_to)).length
  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.06] hover:text-white transition disabled:opacity-40'

  return (
    <Page>
      <PageHeader
        title={t('menus.title')}
        subtitle={t('menus.subtitle')}
        actions={
          <>
            <ActionMenu
              label={t('menus.v2.more')}
              actions={[
                { label: t('menus.v2.scans'), hint: t('menus.v2.scansHint'), icon: BarChart2, onClick: () => setScanAnalyticsOpen(true) },
                { label: t('menus.v2.todayQr'), hint: t('menus.v2.todayQrHint'), icon: QrCode, onClick: () => void openTodayQr(), hidden: !dailyMenuId },
                { label: t('menuPdf.buttonLabel'), icon: FileSearch, onClick: () => setPdfImportOpen(true) },
              ]}
            />
            <PillButton icon={Sparkles} variant="ai" onClick={() => setAiGeneratorOpen(true)}>{t('menus.aiGenerator.button')}</PillButton>
            <PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('menus.newMenu')}</PillButton>
          </>
        }
      />

      {!loading && menus.length > 0 && (
        <StatRow>
          <StatTile tone="ink" label={t('menus.v2.today')} value={todayMenu?.name ?? '—'} hint={DAYS[todayDow - 1]} className="[&>span:nth-child(2)]:text-2xl [&>span:nth-child(2)]:truncate" />
          <StatTile label={t('menus.v2.activeMenus')} value={activeCount} hint={t('menus.v2.ofTotal', { total: menus.length })} />
          <StatTile label={t('menus.v2.scheduledDays')} value={`${Object.keys(weeklySchedule).length}/7`} hint={t('menus.v2.scheduledHint')} />
          <StatTile label={t('menus.expired')} value={expiredCount} tone={expiredCount ? 'warn' : 'default'} hint={t('menus.v2.expiredHint')} />
        </StatRow>
      )}

      {/* ── Weekly schedule: the active menu switches automatically every day ── */}
      {!loading && menus.length > 0 && (
        <Panel title={t('menus.v2.week')} actions={<span className="text-xs text-white/50">{t('menus.v2.weekHint')}</span>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {DAYS.map((day, i) => {
              const dow = i + 1
              const isToday = dow === todayDow
              const selectedId = weeklySchedule[dow] ?? ''
              return (
                <div key={dow} className={cn('flex flex-col gap-2 rounded-2xl p-3', isToday ? 'bg-ink text-white-fixed' : 'bg-white/[0.04]')}>
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn('text-xs font-medium', isToday ? 'text-lime' : 'text-white/55')}>{day}</span>
                    {selectedId && (
                      <button
                        type="button"
                        aria-label={t('common.delete')}
                        onClick={() => void setWeeklyDay(dow, null)}
                        className={cn('text-xs', isToday ? 'text-white-fixed/50 hover:text-white-fixed' : 'text-white/35 hover:text-red-500')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedId}
                    onChange={(e) => void setWeeklyDay(dow, e.target.value || null)}
                    aria-label={day}
                    className={cn(
                      'w-full truncate rounded-xl px-2 py-2 text-sm font-medium appearance-none focus:outline-none',
                      isToday ? 'bg-white-fixed/10 text-white-fixed' : 'bg-bg-card text-white',
                    )}
                  >
                    <option value="">{t('menus.v2.none')}</option>
                    {menus.filter((m) => m.active).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : menus.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title={t('menus.empty.title')}
          body={t('menus.empty.description')}
          action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('menus.empty.cta')}</PillButton>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {menus.map((menu) => {
            const expired = isExpired(menu.valid_to)
            const isDaily = dailyMenuId === menu.id
            return (
              <article key={menu.id} className={cn('flex flex-col gap-4 rounded-3xl bg-bg-card p-5 shadow-card', !menu.active && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', TYPE_COLORS[menu.type])}>
                    {TYPE_ICONS[menu.type]}{typeLabel(menu.type)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleActive(menu)}
                    aria-label={menu.active ? t('menus.deactivate') : t('menus.activate')}
                    className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition', menu.active ? 'bg-emerald-500/12 text-emerald-500' : 'bg-white/[0.06] text-white/50')}
                  >
                    {menu.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    {menu.active ? t('menus.active') : t('menus.inactive')}
                  </button>
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-medium tracking-[-0.02em] truncate">{menu.name}</h2>
                  {menu.description && <p className="mt-1 text-sm text-white/55 line-clamp-2">{menu.description}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {(menu.type === 'buffet' || menu.type === 'tasting') && menu.price_per_person != null && (
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-medium tabular-nums">
                      €{menu.price_per_person.toFixed(2)} / {t('menus.v2.person')}
                    </span>
                  )}
                  {isDaily && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 font-medium text-ink">
                      <Sun className="h-3 w-3" /> {t('menus.v2.dailyMenu')}
                    </span>
                  )}
                  {!menu.show_prices && <span className="rounded-full bg-amber-500/12 px-2.5 py-1 font-medium text-amber-500">{t('menus.pricesHidden')}</span>}
                  {expired && <span className="rounded-full bg-red-500/10 px-2.5 py-1 font-medium text-red-500">{t('menus.expired')}</span>}
                  {menu.valid_from && menu.valid_to && !expired && (
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-medium text-white/60">{t('menus.validRange', { from: formatDate(menu.valid_from), to: formatDate(menu.valid_to) })}</span>
                  )}
                  {menu.valid_to && !menu.valid_from && !expired && (
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-medium text-white/60">{t('menus.validTo_short', { date: formatDate(menu.valid_to) })}</span>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-1 pt-1">
                  <Link
                    to={`/menus/${menu.id}`}
                    className="mr-auto inline-flex h-10 items-center gap-2 rounded-full bg-brand-orange px-4 text-sm font-medium text-on-accent hover:bg-brand-orange/85"
                  >
                    {t('menus.editMenu')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDailyMenu(isDaily ? null : menu.id)}
                    title={t(isDaily ? 'menus.v2.unsetDaily' : 'menus.v2.setDaily')}
                    aria-label={t(isDaily ? 'menus.v2.unsetDaily' : 'menus.v2.setDaily')}
                    className={cn(iconBtn, isDaily && 'bg-lime text-ink hover:bg-lime hover:text-ink')}
                  >
                    <Sun className="h-4 w-4" />
                  </button>
                  <a href={`/menu/${menu.id}`} target="_blank" rel="noopener noreferrer" title={t('menus.publicView')} aria-label={t('menus.publicView')} className={iconBtn}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button type="button" onClick={() => openEdit(menu)} title={t('common.edit')} aria-label={t('common.edit')} className={iconBtn}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onDuplicate(menu)} disabled={duplicatingId === menu.id} title={t('menus.duplicate')} aria-label={t('menus.duplicate')} className={iconBtn}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(menu)} title={t('common.delete')} aria-label={t('common.delete')} className={cn(iconBtn, 'hover:text-red-500')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Create / Edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { if (!saving) { setDrawerOpen(false); setEditing(null) } }}
        title={editing ? t('menus.editMenuDrawer') : t('menus.newMenuDrawer')}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            name="name"
            label={t('menus.form.name')}
            placeholder={t('menus.form.namePlaceholder')}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          {/* Type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">{t('menus.form.type')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['a_la_carte', 'buffet', 'tasting', 'daily'] as MenuType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type }))}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition',
                    form.type === type
                      ? 'bg-brand-orange border-brand-orange text-on-accent'
                      : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5',
                  )}
                >
                  {TYPE_ICONS[type]}
                  {t(`menus.types.${type}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">{t('menus.form.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('menus.form.descriptionPlaceholder')}
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/5 border border-glass-border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none"
            />
          </div>

          {(form.type === 'buffet' || form.type === 'tasting') && (
            <Input
              name="price_per_person"
              type="number"
              step="0.01"
              min="0"
              label={t('menus.form.pricePerPerson')}
              placeholder="e.g. 35.00"
              value={form.price_per_person}
              onChange={(e) => setForm((f) => ({ ...f, price_per_person: e.target.value }))}
            />
          )}

          {/* Print template */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70 flex items-center gap-1.5">
              <LayoutTemplate className="h-4 w-4" />
              {t('menus.print.templateLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['classic', 'modern', 'elegant'] as PrintTemplate[]).map((tmpl) => (
                <button key={tmpl} type="button"
                  onClick={() => setForm((f) => ({ ...f, print_template: tmpl }))}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-medium capitalize transition',
                    form.print_template === tmpl
                      ? 'bg-brand-orange border-brand-orange text-on-accent'
                      : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5',
                  )}>
                  {t(`menus.print.${tmpl}`)}
                </button>
              ))}
            </div>
          </div>

          <Input
            name="logo_url"
            label={t('menus.print.logoLabel')}
            placeholder={t('menus.print.logoPlaceholder')}
            value={form.logo_url}
            onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">{t('menus.print.footerLabel')}</label>
            <textarea
              value={form.custom_footer}
              onChange={(e) => setForm((f) => ({ ...f, custom_footer: e.target.value }))}
              placeholder={t('menus.print.footerPlaceholder')}
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/5 border border-glass-border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none"
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="valid_from"
              type="date"
              label={t('menus.form.validFrom')}
              value={form.valid_from}
              onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
            />
            <Input
              name="valid_to"
              type="date"
              label={t('menus.form.validTo')}
              value={form.valid_to}
              onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-white/70">{t('menus.form.showPrices')}</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, show_prices: !f.show_prices }))}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  form.show_prices ? 'bg-brand-orange' : 'bg-white/20',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white-fixed transition-transform',
                  form.show_prices ? 'translate-x-6' : 'translate-x-1',
                )} />
              </button>
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-white/70">{t('menus.form.active')}</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  form.active ? 'bg-brand-orange' : 'bg-white/20',
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white-fixed transition-transform',
                  form.active ? 'translate-x-6' : 'translate-x-1',
                )} />
              </button>
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setDrawerOpen(false); setEditing(null) }}
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Drawer>

      <AIMenuGeneratorDrawer
        open={aiGeneratorOpen}
        onClose={() => setAiGeneratorOpen(false)}
        onCreated={() => {}}
      />

      <MenuPdfImportDrawer
        open={pdfImportOpen}
        onClose={() => setPdfImportOpen(false)}
      />

      {/* ── Today's Menu QR Drawer ── */}
      <Drawer open={todayQrOpen} onClose={() => { setTodayQrOpen(false); setTranslateDone(false) }} title="QR Μενού Ημέρας">
        <div className="space-y-5">
          <p className="text-sm text-white/60">
            Εκτύπωσε αυτό το QR μια φορά και τοποθέτησέ το στα τραπέζια. Κάθε μέρα αλλάζεις ποιο μενού είναι "μενού ημέρας" και το QR δείχνει αυτόματα το νέο.
          </p>

          {todayQr ? (
            <div className="flex justify-center">
              <img src={todayQr.dataUrl} alt="QR Μενού Ημέρας" className="w-56 h-56 rounded-2xl bg-white-fixed p-3" />
            </div>
          ) : (
            <div className="flex justify-center items-center h-56">
              <p className="text-white/50 text-sm">{t('common.loading')}</p>
            </div>
          )}

          {todayQr && (
            <p className="text-xs text-white/40 text-center break-all">{todayQr.url}</p>
          )}

          {/* AI Translation */}
          {dailyMenuId && (
            <button
              onClick={() => void translateDailyMenu()}
              disabled={translating}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 disabled:opacity-50"
            >
              {translateDone
                ? <><CheckCircle2 className="h-4 w-4 text-green-400" /><span className="text-green-400">Μεταφράστηκαν! Ξαναμετάφραση;</span></>
                : translating
                  ? <><Globe className="h-4 w-4 animate-spin" />Μετάφραση σε εξέλιξη…</>
                  : <><Globe className="h-4 w-4" />AI Μετάφραση πιάτων 🇬🇷 🇬🇧 🇧🇬</>}
            </button>
          )}

          <div className="flex gap-2">
            <Button onClick={downloadTodayQr} disabled={!todayQr} className="flex-1">
              Κατέβασμα QR
            </Button>
            <Button variant="secondary" onClick={() => { setTodayQrOpen(false); setTranslateDone(false) }}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Drawer>

      {/* ── Scan Analytics Drawer ── */}
      <Drawer
        open={scanAnalyticsOpen}
        onClose={() => setScanAnalyticsOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-brand-orange" />
            <span>Αναλυτικά Scans QR Μενού</span>
          </div>
        }
      >
        <MenuScanAnalytics currentMenuName={menus.find(m => m.id === dailyMenuId)?.name ?? null} />
      </Drawer>
    </Page>
  )
}
