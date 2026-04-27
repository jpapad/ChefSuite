import { useState } from 'react'
import { Plus, UtensilsCrossed, BookOpen, ChefHat, CalendarDays, Pencil, Trash2, ExternalLink, ToggleLeft, ToggleRight, Copy, LayoutTemplate, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { AIMenuGeneratorDrawer } from '../components/menus/AIMenuGeneratorDrawer'
import { useMenus } from '../hooks/useMenus'
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
  const { menus, loading, create, update, remove, duplicate } = useMenus()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false)
  const [editing, setEditing] = useState<Menu | null>(null)
  const [form, setForm] = useState<MenuFormValues>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

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
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => setAiGeneratorOpen(true)}>
            {t('menus.aiGenerator.button')}
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openCreate}>
            {t('menus.newMenu')}
          </Button>
        </div>
      </header>

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
    </div>
  )
}
