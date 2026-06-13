import { useState, useEffect } from 'react'
import { Plus, UtensilsCrossed, BookOpen, ChefHat, CalendarDays, Pencil, Trash2, ExternalLink, ToggleLeft, ToggleRight, Copy, LayoutTemplate, Sparkles, Sun, QrCode, Globe, CheckCircle2, ChevronDown, ChevronUp, FileSearch } from 'lucide-react'
import { translateMenuItems } from '../lib/gemini'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import QRCodeLib from 'qrcode'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { AIMenuGeneratorDrawer } from '../components/menus/AIMenuGeneratorDrawer'
import { MenuPdfImportDrawer } from '../components/menus/MenuPdfImportDrawer'
import { useMenus } from '../hooks/useMenus'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { Menu, MenuType, PrintTemplate } from '../types/database.types'

const TYPE_ICONS: Record<MenuType, React.ReactNode> = {
  a_la_carte: <UtensilsCrossed className="h-5 w-5" />,
  buffet:     <BookOpen className="h-5 w-5" />,
  tasting:    <ChefHat className="h-5 w-5" />,
  daily:      <CalendarDays className="h-5 w-5" />,
}

const TYPE_COLORS: Record<MenuType, string> = {
  a_la_carte: 'bg-brand-orange/15 text-brand-orange',
  buffet:     'bg-blue-400/15 text-blue-400',
  tasting:    'bg-rose-400/15 text-rose-400',
  daily:      'bg-emerald-400/15 text-emerald-400',
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
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  const [todayQr, setTodayQr] = useState<{ url: string; dataUrl: string } | null>(null)
  const [todayQrOpen, setTodayQrOpen] = useState(false)
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

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('menus.title')}</h1>
          <p className="text-white/60 mt-1">{t('menus.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {dailyMenuId && (
            <Button variant="secondary" leftIcon={<QrCode className="h-4 w-4" />} onClick={openTodayQr}>
              QR Μενού Ημέρας
            </Button>
          )}
          <Button variant="secondary" leftIcon={<FileSearch className="h-4 w-4" />} onClick={() => setPdfImportOpen(true)}>
            {t('menuPdf.buttonLabel')}
          </Button>
          <Button variant="secondary" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => setAiGeneratorOpen(true)}>
            {t('menus.aiGenerator.button')}
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
            {t('menus.newMenu')}
          </Button>
        </div>
      </header>

      {/* ── Weekly schedule ─────────────────────────────────────────────────── */}
      {!loading && menus.length > 0 && (() => {
        const DAYS = ['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή']
        const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay()
        const hasSchedule = Object.keys(weeklySchedule).length > 0
        return (
          <GlassCard className="space-y-3">
            <button onClick={() => setWeeklyOpen(v => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-orange" />
                <span className="font-semibold text-sm">Πρόγραμμα Εβδομάδας</span>
                {hasSchedule && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                    Ενεργό
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!weeklyOpen && hasSchedule && (
                  <span className="text-xs text-white/40">
                    {weeklySchedule[todayDow]
                      ? menus.find(m => m.id === weeklySchedule[todayDow])?.name ?? '—'
                      : '— σήμερα χωρίς πρόγραμμα'}
                  </span>
                )}
                {weeklyOpen
                  ? <ChevronUp className="h-4 w-4 text-white/40" />
                  : <ChevronDown className="h-4 w-4 text-white/40" />}
              </div>
            </button>

            {weeklyOpen && (
              <div className="space-y-2 pt-1 border-t border-white/8">
                <p className="text-xs text-white/40">
                  Επίλεξε ποιο μενού ισχύει κάθε μέρα. Αλλάζει αυτόματα στο QR και σε όλες τις λειτουργίες.
                </p>
                <div className="grid gap-2">
                  {DAYS.map((day, i) => {
                    const dow = i + 1
                    const isToday = dow === todayDow
                    const selectedId = weeklySchedule[dow] ?? ''
                    return (
                      <div key={dow} className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2',
                        isToday ? 'bg-brand-orange/10 border border-brand-orange/25' : 'bg-white/3',
                      )}>
                        <span className={cn(
                          'text-sm font-medium w-24 shrink-0',
                          isToday ? 'text-brand-orange' : 'text-white/60',
                        )}>
                          {isToday ? `${day} ←` : day}
                        </span>
                        <select
                          value={selectedId}
                          onChange={(e) => void setWeeklyDay(dow, e.target.value || null)}
                          className="flex-1 rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-orange/60 appearance-none"
                        >
                          <option value="">— καμία αυτόματη επιλογή —</option>
                          {menus.filter(m => m.active).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        {selectedId && (
                          <button onClick={() => void setWeeklyDay(dow, null)}
                            className="shrink-0 text-white/25 hover:text-red-400 transition text-xs px-1">
                            ✕
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </GlassCard>
        )
      })()}

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : menus.length === 0 ? (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('menus.empty.title')}</h2>
          <p className="text-white/60 max-w-sm">{t('menus.empty.description')}</p>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate} className="mt-2">
            {t('menus.empty.cta')}
          </Button>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {menus.map((menu) => {
            const expired = isExpired(menu.valid_to)
            return (
              <GlassCard key={menu.id} className={cn('flex flex-col gap-3', !menu.active && 'opacity-60')}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TYPE_COLORS[menu.type])}>
                      {TYPE_ICONS[menu.type]}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-semibold truncate">{menu.name}</h2>
                      <span className="text-xs text-white/50">{typeLabel(menu.type)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleActive(menu)}
                      aria-label={menu.active ? t('menus.deactivate') : t('menus.activate')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition"
                    >
                      {menu.active
                        ? <ToggleRight className="h-5 w-5 text-emerald-400" />
                        : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(menu)}
                      aria-label={t('common.edit')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicate(menu)}
                      disabled={duplicatingId === menu.id}
                      aria-label={t('menus.duplicate')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition disabled:opacity-40"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(menu)}
                      aria-label={t('common.delete')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {menu.description && (
                  <p className="text-sm text-white/60 line-clamp-2">{menu.description}</p>
                )}

                {/* Buffet/tasting price */}
                {(menu.type === 'buffet' || menu.type === 'tasting') && menu.price_per_person != null && (
                  <div className="text-sm text-white/60">
                    {t('menus.pricePerPerson')}: <span className="text-white font-medium">€{menu.price_per_person.toFixed(2)}</span>
                  </div>
                )}

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {dailyMenuId === menu.id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-amber-400/20 text-amber-300">
                      <Sun className="h-3 w-3" /> Μενού Ημέρας
                    </span>
                  )}
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full font-medium',
                    menu.active ? 'bg-emerald-400/15 text-emerald-400' : 'bg-white/10 text-white/40',
                  )}>
                    {menu.active ? t('menus.active') : t('menus.inactive')}
                  </span>
                  {!menu.show_prices && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-amber-400/15 text-amber-400">
                      {t('menus.pricesHidden')}
                    </span>
                  )}
                  {expired && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400">
                      {t('menus.expired')}
                    </span>
                  )}
                  {menu.valid_from && menu.valid_to && !expired && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-white/10 text-white/50">
                      {t('menus.validRange', { from: formatDate(menu.valid_from), to: formatDate(menu.valid_to) })}
                    </span>
                  )}
                  {menu.valid_to && !menu.valid_from && !expired && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-white/10 text-white/50">
                      {t('menus.validTo_short', { date: formatDate(menu.valid_to) })}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-1">
                  <Link
                    to={`/menus/${menu.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-glass-border px-3 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('menus.editMenu')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDailyMenu(dailyMenuId === menu.id ? null : menu.id)}
                    title={dailyMenuId === menu.id ? 'Αφαίρεση ως μενού ημέρας' : 'Ορισμός ως μενού ημέρας'}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition',
                      dailyMenuId === menu.id
                        ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 hover:bg-amber-400/25'
                        : 'bg-white/5 border-glass-border text-white/70 hover:text-amber-300 hover:border-amber-400/40 hover:bg-amber-400/10',
                    )}
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={`/menu/${menu.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-glass-border px-3 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition"
                    title={t('menus.publicView')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </GlassCard>
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
                      ? 'bg-brand-orange border-brand-orange text-white-fixed'
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
                      ? 'bg-brand-orange border-brand-orange text-white-fixed'
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
    </div>
  )
}
