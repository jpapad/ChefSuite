import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, ChevronUp, ChevronDown,
  Pencil, Trash2, ToggleLeft, ToggleRight, GripVertical,
  Printer, ClipboardList, QrCode, X, TrendingUp, ShoppingCart, Tag, FileText, Radio,
} from 'lucide-react'
import QRCodeLib from 'qrcode'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { MenuCostAnalysis } from '../components/menus/MenuCostAnalysis'
import { ShoppingListDrawer } from '../components/menus/ShoppingListDrawer'
import { BuffetLabelsDrawer } from '../components/menus/BuffetLabelsDrawer'
import { ProductionSheetDrawer } from '../components/menus/ProductionSheetDrawer'
import { ServiceBoardOverlay } from '../components/menus/ServiceBoardOverlay'
import { PrepFromMenuDrawer, type GeneratedPrepItem } from '../components/prep/PrepFromMenuDrawer'
import { useMenuDetail } from '../hooks/useMenus'
import { useMenuScans } from '../hooks/useMenuScans'
import { useRecipes } from '../hooks/useRecipes'
import { useWorkstations } from '../hooks/useWorkstations'
import { useTeam } from '../hooks/useTeam'
import { useAuth } from '../contexts/AuthContext'
import { useInventory } from '../contexts/InventoryContext'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import type { MenuSectionWithItems, MenuItem, MenuItemTag } from '../types/database.types'

// ── Tag config ──────────────────────────────────────────────────────────────
const ALL_TAGS: MenuItemTag[] = ['vegan', 'vegetarian', 'gluten_free', 'spicy', 'chefs_pick']

const TAG_COLORS: Record<MenuItemTag, string> = {
  vegan:       'bg-green-500/15 text-green-400',
  vegetarian:  'bg-lime-500/15 text-lime-400',
  gluten_free: 'bg-amber-400/15 text-amber-400',
  spicy:       'bg-red-500/15 text-red-400',
  chefs_pick:  'bg-brand-orange/15 text-brand-orange',
}

const TAG_EMOJI: Record<MenuItemTag, string> = {
  vegan: '🌱', vegetarian: '🥦', gluten_free: '🌾', spicy: '🌶️', chefs_pick: '⭐',
}

// ── Form interfaces ──────────────────────────────────────────────────────────
interface ItemFormValues {
  name: string
  description: string
  name_el: string
  description_el: string
  price: string
  available: boolean
  recipe_id: string
  tags: MenuItemTag[]
}

const EMPTY_ITEM: ItemFormValues = {
  name: '', description: '', name_el: '', description_el: '',
  price: '', available: true, recipe_id: '', tags: [],
}

export default function MenuDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { menu, loading,
    addSection, updateSection, removeSection, moveSectionUp, moveSectionDown,
    addItem, updateItem, removeItem, moveItemUp, moveItemDown,
  } = useMenuDetail(id ?? null)
  const { recipes } = useRecipes()
  const { inventory } = useInventory()
  const { workstations } = useWorkstations()
  const { members } = useTeam()

  // ── Section drawer ─────────────────────────────────────────────────────────
  const [sectionDrawerOpen, setSectionDrawerOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<MenuSectionWithItems | null>(null)
  const [sectionName, setSectionName] = useState('')
  const [savingSection, setSavingSection] = useState(false)

  // ── Item drawer ────────────────────────────────────────────────────────────
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [itemSectionId, setItemSectionId] = useState<string>('')
  const [itemForm, setItemForm] = useState<ItemFormValues>(EMPTY_ITEM)
  const [savingItem, setSavingItem] = useState(false)

  // ── Staff print overlay ────────────────────────────────────────────────────
  const [printOverlayOpen, setPrintOverlayOpen] = useState(false)

  // ── Cost analysis ──────────────────────────────────────────────────────────
  const [costDrawerOpen, setCostDrawerOpen] = useState(false)

  // ── Shopping list ──────────────────────────────────────────────────────────
  const [shoppingDrawerOpen, setShoppingDrawerOpen] = useState(false)

  // ── Buffet labels ──────────────────────────────────────────────────────────
  const [labelsDrawerOpen, setLabelsDrawerOpen] = useState(false)

  // ── Prep from menu drawer ──────────────────────────────────────────────────
  const [prepDrawerOpen, setPrepDrawerOpen] = useState(false)

  // ── Production sheet drawer ────────────────────────────────────────────────
  const [productionSheetOpen, setProductionSheetOpen] = useState(false)

  // ── Service board (86) ─────────────────────────────────────────────────────
  const [serviceBoardOpen, setServiceBoardOpen] = useState(false)

  // ── QR drawer ─────────────────────────────────────────────────────────────
  const [qrDrawerOpen, setQrDrawerOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const qrLinkRef = useRef<HTMLAnchorElement>(null)
  const { stats: scanStats } = useMenuScans(id ?? null)

  // ── Helpers ────────────────────────────────────────────────────────────────
  function linkedRecipe(recipeId: string | null) {
    if (!recipeId) return null
    return recipes.find((r) => r.id === recipeId) ?? null
  }

  // ── Section handlers ───────────────────────────────────────────────────────
  function openAddSection() {
    setEditingSection(null); setSectionName(''); setSectionDrawerOpen(true)
  }
  function openEditSection(section: MenuSectionWithItems) {
    setEditingSection(section); setSectionName(section.name); setSectionDrawerOpen(true)
  }
  async function onSubmitSection(e: React.FormEvent) {
    e.preventDefault()
    if (!sectionName.trim()) return
    setSavingSection(true)
    try {
      if (editingSection) await updateSection(editingSection.id, { name: sectionName.trim() })
      else await addSection(sectionName.trim())
      setSectionDrawerOpen(false)
    } finally { setSavingSection(false) }
  }
  async function onDeleteSection(section: MenuSectionWithItems) {
    if (!window.confirm(t('menus.detail.deleteSectionConfirm', { name: section.name }))) return
    await removeSection(section.id)
  }

  // ── Item handlers ──────────────────────────────────────────────────────────
  function openAddItem(sectionId: string) {
    setEditingItem(null); setItemSectionId(sectionId); setItemForm(EMPTY_ITEM); setItemDrawerOpen(true)
  }
  function openEditItem(item: MenuItem, sectionId: string) {
    setEditingItem(item); setItemSectionId(sectionId)
    setItemForm({
      name: item.name,
      description: item.description ?? '',
      name_el: item.name_el ?? '',
      description_el: item.description_el ?? '',
      price: item.price != null ? String(item.price) : '',
      available: item.available,
      recipe_id: item.recipe_id ?? '',
      tags: item.tags ?? [],
    })
    setItemDrawerOpen(true)
  }
  function onRecipeSelect(recipeId: string) {
    if (!recipeId) { setItemForm((f) => ({ ...f, recipe_id: '' })); return }
    const recipe = recipes.find((r) => r.id === recipeId)
    if (!recipe) return
    setItemForm((f) => ({
      ...f,
      recipe_id: recipeId,
      name: f.name || recipe.title,
      description: f.description || (recipe.description ?? ''),
      price: f.price || (recipe.selling_price != null ? String(recipe.selling_price) : ''),
    }))
  }
  async function onSubmitItem(e: React.FormEvent) {
    e.preventDefault()
    if (!itemForm.name.trim()) return
    setSavingItem(true)
    try {
      const payload = {
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        name_el: itemForm.name_el.trim() || null,
        description_el: itemForm.description_el.trim() || null,
        price: itemForm.price ? parseFloat(itemForm.price) : null,
        available: itemForm.available,
        recipe_id: itemForm.recipe_id || null,
        tags: itemForm.tags,
      }
      if (editingItem) await updateItem(editingItem.id, itemSectionId, payload)
      else await addItem(itemSectionId, payload)
      setItemDrawerOpen(false)
    } finally { setSavingItem(false) }
  }
  async function onDeleteItem(item: MenuItem, sectionId: string) {
    if (!window.confirm(t('menus.detail.deleteItemConfirm', { name: item.name }))) return
    await removeItem(item.id, sectionId)
  }
  function toggleTag(tag: MenuItemTag) {
    setItemForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))
  }

  // ── Prep generation ────────────────────────────────────────────────────────
  async function handleGeneratePrep(items: GeneratedPrepItem[]) {
    if (!profile?.team_id || !profile?.id) return
    for (const item of items) {
      await supabase.from('prep_tasks').insert({
        team_id: profile.team_id,
        created_by: profile.id,
        title: item.title,
        description: item.description ?? null,
        recipe_id: item.recipe_id,
        menu_id: item.menu_id ?? id ?? null,
        quantity: item.quantity,
        workstation_id: item.workstation_id,
        assignee_id: item.assignee_id,
        status: 'pending' as const,
        prep_for: item.prep_for,
      })
    }
  }

  // ── QR code ────────────────────────────────────────────────────────────────
  async function openQrDrawer() {
    setQrDrawerOpen(true)
    const url = `${window.location.origin}/menu/${id}`
    const dataUrl = await QRCodeLib.toDataURL(url, { width: 512, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    setQrDataUrl(dataUrl)
  }
  function downloadQR() {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `menu-qr-${id}.png`
    a.click()
  }

  // ── Loading / not found ────────────────────────────────────────────────────
  if (loading) {
    return <div className="space-y-6"><GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard></div>
  }
  if (!menu) {
    return (
      <div className="space-y-6">
        <Link to="/menus" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm">
          <ArrowLeft className="h-4 w-4" />{t('menus.detail.backToMenus')}
        </Link>
        <GlassCard><p className="text-white/60">{t('menus.public.notFound')}</p></GlassCard>
      </div>
    )
  }

  const allPrepItems = menu.sections.flatMap((s) => s.items.filter((i) => !!i.recipe_id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-3">
        <Link to="/menus" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm transition">
          <ArrowLeft className="h-4 w-4" />{t('menus.detail.backToMenus')}
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">{menu.name}</h1>
            <p className="text-white/60 mt-1">{t(`menus.types.${menu.type}`)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" leftIcon={<TrendingUp className="h-4 w-4" />} onClick={() => setCostDrawerOpen(true)}>
              {t('menus.detail.costAnalysis')}
            </Button>
            <Button variant="secondary" leftIcon={<ShoppingCart className="h-4 w-4" />} onClick={() => setShoppingDrawerOpen(true)}>
              {t('menus.detail.shoppingList')}
            </Button>
            <Button variant="secondary" leftIcon={<Tag className="h-4 w-4" />} onClick={() => setLabelsDrawerOpen(true)}>
              {t('menus.labels.button')}
            </Button>
            <Button variant="secondary" leftIcon={<Radio className="h-4 w-4" />} onClick={() => setServiceBoardOpen(true)}>
              {t('menus.serviceBoard.button')}
            </Button>
            <Button variant="secondary" leftIcon={<Printer className="h-4 w-4" />} onClick={() => setPrintOverlayOpen(true)}>
              {t('menus.detail.printStaff')}
            </Button>
            {allPrepItems.length > 0 && (
              <>
                <Button variant="secondary" leftIcon={<ClipboardList className="h-4 w-4" />} onClick={() => setPrepDrawerOpen(true)}>
                  {t('menus.detail.generatePrep')}
                </Button>
                <Button variant="secondary" leftIcon={<FileText className="h-4 w-4" />} onClick={() => setProductionSheetOpen(true)}>
                  {t('menus.productionSheet.button')}
                </Button>
              </>
            )}
            <Button variant="secondary" leftIcon={<QrCode className="h-4 w-4" />} onClick={openQrDrawer}>
              {t('menus.detail.qrCode')}{scanStats.total > 0 && ` · ${scanStats.total}`}
            </Button>
            <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openAddSection}>
              {t('menus.detail.addSection')}
            </Button>
          </div>
        </div>
      </header>

      {/* Empty state */}
      {menu.sections.length === 0 && (
        <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <GripVertical className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">{t('menus.detail.noSections')}</h2>
          <p className="text-white/60 max-w-sm">{t('menus.detail.noSectionsHint')}</p>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={openAddSection} className="mt-2">
            {t('menus.detail.addSection')}
          </Button>
        </GlassCard>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {menu.sections.map((section, sIdx) => (
          <GlassCard key={section.id} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-lg">{section.name}</h2>
              <div className="flex items-center gap-1 shrink-0">
                {[
                  { fn: () => moveSectionUp(section.id), icon: <ChevronUp className="h-4 w-4" />, disabled: sIdx === 0, label: t('menus.detail.moveUp') },
                  { fn: () => moveSectionDown(section.id), icon: <ChevronDown className="h-4 w-4" />, disabled: sIdx === menu.sections.length - 1, label: t('menus.detail.moveDown') },
                ].map(({ fn, icon, disabled, label }) => (
                  <button key={label} type="button" onClick={fn} disabled={disabled} aria-label={label}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition disabled:opacity-20 disabled:pointer-events-none">
                    {icon}
                  </button>
                ))}
                <button type="button" onClick={() => openEditSection(section)} aria-label={t('common.edit')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onDeleteSection(section)} aria-label={t('menus.detail.deleteSection')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {section.items.length === 0 && (
                <p className="text-sm text-white/40 italic px-1">{t('menus.detail.emptySection')}</p>
              )}
              {section.items.map((item, iIdx) => {
                const recipe = linkedRecipe(item.recipe_id)
                return (
                  <div key={item.id} className={cn(
                    'flex items-start gap-3 rounded-xl border border-glass-border px-3 py-2.5',
                    !item.available && 'opacity-50',
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('font-medium text-sm', !item.available && 'line-through text-white/40')}>
                          {item.name}
                        </span>
                        {!item.available && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
                            {t('menus.detail.unavailable')}
                          </span>
                        )}
                        {(item.tags ?? []).map((tag) => (
                          <span key={tag} className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', TAG_COLORS[tag])}>
                            {TAG_EMOJI[tag]} {t(`menus.tags.${tag}`)}
                          </span>
                        ))}
                        {recipe && recipe.allergens.length > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400/80 border border-amber-400/20">
                            {recipe.allergens.slice(0, 3).join(', ')}{recipe.allergens.length > 3 ? '…' : ''}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {item.price != null && (
                          <span className="text-sm font-semibold text-brand-orange">€{item.price.toFixed(2)}</span>
                        )}
                        {recipe?.cost_per_portion != null && (
                          <span className="text-xs text-white/40">
                            {t('menus.detail.costPerPortion')}: €{recipe.cost_per_portion.toFixed(2)}
                            {item.price != null && item.price > 0 && (
                              <span className="ml-1 text-white/30">
                                ({Math.round((recipe.cost_per_portion / item.price) * 100)}% {t('menus.detail.foodCost')})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {[
                        { fn: () => moveItemUp(item.id, section.id), icon: <ChevronUp className="h-3.5 w-3.5" />, disabled: iIdx === 0, label: t('menus.detail.moveUp') },
                        { fn: () => moveItemDown(item.id, section.id), icon: <ChevronDown className="h-3.5 w-3.5" />, disabled: iIdx === section.items.length - 1, label: t('menus.detail.moveDown') },
                      ].map(({ fn, icon, disabled, label }) => (
                        <button key={label} type="button" onClick={fn} disabled={disabled} aria-label={label}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition disabled:opacity-20 disabled:pointer-events-none">
                          {icon}
                        </button>
                      ))}
                      <button type="button" onClick={() => updateItem(item.id, section.id, { available: !item.available })}
                        aria-label={item.available ? t('menus.detail.unavailable') : t('menus.detail.available')}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition">
                        {item.available ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                      <button type="button" onClick={() => openEditItem(item, section.id)} aria-label={t('menus.detail.editItem')}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => onDeleteItem(item, section.id)} aria-label={t('menus.detail.deleteItem')}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button type="button" onClick={() => openAddItem(section.id)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-glass-border px-3 py-2 text-sm text-white/40 hover:text-white hover:border-white/30 hover:bg-white/5 transition">
              <Plus className="h-4 w-4" />{t('menus.detail.addItem')}
            </button>
          </GlassCard>
        ))}
      </div>

      {/* ── Section drawer ── */}
      <Drawer
        open={sectionDrawerOpen}
        onClose={() => { if (!savingSection) setSectionDrawerOpen(false) }}
        title={editingSection ? t('menus.detail.editSectionDrawer') : t('menus.detail.addSectionDrawer')}
      >
        <form onSubmit={onSubmitSection} className="space-y-4">
          <Input name="section_name" label={t('menus.detail.sectionName')}
            placeholder={t('menus.detail.sectionNamePlaceholder')} required
            value={sectionName} onChange={(e) => setSectionName(e.target.value)} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={savingSection} className="flex-1">
              {savingSection ? t('common.saving') : t('common.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSectionDrawerOpen(false)} disabled={savingSection}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* ── Item drawer ── */}
      <Drawer
        open={itemDrawerOpen}
        onClose={() => { if (!savingItem) setItemDrawerOpen(false) }}
        title={editingItem ? t('menus.detail.editItemDrawer') : t('menus.detail.addItemDrawer')}
      >
        <form onSubmit={onSubmitItem} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">{t('menus.detail.linkRecipe')}</label>
            <select value={itemForm.recipe_id} onChange={(e) => onRecipeSelect(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/5 border border-glass-border text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50">
              <option value="">{t('menus.detail.noRecipe')}</option>
              {recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>

          <Input name="item_name" label={t('menus.detail.itemName')}
            placeholder={t('menus.detail.itemNamePlaceholder')} required
            value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">{t('menus.detail.itemDescription')}</label>
            <textarea value={itemForm.description}
              onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('menus.detail.itemDescriptionPlaceholder')} rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/5 border border-glass-border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none" />
          </div>

          {/* Greek translation (optional) */}
          <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 space-y-3">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              {t('menus.detail.greekTranslation')}
            </p>
            <Input name="item_name_el" label={t('menus.detail.itemNameEl')}
              placeholder={t('menus.detail.itemNameElPlaceholder')}
              value={itemForm.name_el} onChange={(e) => setItemForm((f) => ({ ...f, name_el: e.target.value }))} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">{t('menus.detail.itemDescriptionEl')}</label>
              <textarea value={itemForm.description_el}
                onChange={(e) => setItemForm((f) => ({ ...f, description_el: e.target.value }))}
                placeholder={t('menus.detail.itemDescriptionElPlaceholder')} rows={2}
                className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/5 border border-glass-border text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none" />
            </div>
          </div>

          {menu.show_prices && (
            <Input name="price" type="number" step="0.01" min="0"
              label={t('menus.detail.itemPrice')} placeholder="e.g. 18.50"
              value={itemForm.price} onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))} />
          )}

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">{t('menus.detail.tags')}</label>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                    itemForm.tags.includes(tag)
                      ? cn('border-transparent', TAG_COLORS[tag])
                      : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                  )}>
                  {TAG_EMOJI[tag]} {t(`menus.tags.${tag}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Allergens from linked recipe */}
          {itemForm.recipe_id && (() => {
            const r = recipes.find((x) => x.id === itemForm.recipe_id)
            return r && r.allergens.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white/70">{t('menus.detail.allergens')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {r.allergens.map((a) => (
                    <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400/15 text-amber-400">{a}</span>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {/* Available toggle */}
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-white/70">{t('menus.detail.available')}</span>
            <button type="button" onClick={() => setItemForm((f) => ({ ...f, available: !f.available }))}
              className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', itemForm.available ? 'bg-brand-orange' : 'bg-white/20')}>
              <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white-fixed transition-transform', itemForm.available ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={savingItem} className="flex-1">
              {savingItem ? t('common.saving') : t('common.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setItemDrawerOpen(false)} disabled={savingItem}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* ── Prep from menu drawer ── */}
      <PrepFromMenuDrawer
        open={prepDrawerOpen}
        onClose={() => setPrepDrawerOpen(false)}
        defaultDate={new Date().toISOString().slice(0, 10)}
        defaultWorkstationId={workstations[0]?.id ?? null}
        recipes={recipes}
        inventory={inventory}
        workstations={workstations}
        members={members}
        lockedMenuId={id}
        onGenerate={handleGeneratePrep}
      />

      {/* ── Production sheet drawer ── */}
      {menu && (
        <ProductionSheetDrawer
          open={productionSheetOpen}
          onClose={() => setProductionSheetOpen(false)}
          menu={menu}
          members={members}
          recipes={recipes}
        />
      )}

      {/* ── QR drawer ── */}
      <Drawer
        open={qrDrawerOpen}
        onClose={() => setQrDrawerOpen(false)}
        title={t('menus.detail.qrDrawerTitle')}
      >
        <div className="space-y-5">
          {qrDataUrl ? (
            <div className="flex justify-center">
              <img src={qrDataUrl} alt="QR code" className="w-56 h-56 rounded-2xl bg-white-fixed p-3" />
            </div>
          ) : (
            <div className="flex justify-center items-center h-56">
              <p className="text-white/50 text-sm">{t('common.loading')}</p>
            </div>
          )}
          <p className="text-sm text-white/50 text-center">{t('menus.detail.qrHint')}</p>

          {/* Scan stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: t('menus.detail.scans.total'), value: scanStats.total },
              { label: t('menus.detail.scans.today'), value: scanStats.today },
              { label: t('menus.detail.scans.last7days'), value: scanStats.last7days },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-glass-border bg-white/3 py-3">
                <div className="text-2xl font-bold text-brand-orange">{value}</div>
                <div className="text-xs text-white/50 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={downloadQR} disabled={!qrDataUrl} className="flex-1">
              {t('menus.detail.qrDownload')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setQrDrawerOpen(false)}>
              {t('common.close')}
            </Button>
          </div>
          <a ref={qrLinkRef} className="hidden" />
        </div>
      </Drawer>

      {/* ── Cost analysis drawer ── */}
      {menu && (
        <MenuCostAnalysis
          open={costDrawerOpen}
          onClose={() => setCostDrawerOpen(false)}
          menu={menu}
          recipes={recipes}
        />
      )}

      {/* ── Shopping list drawer ── */}
      {menu && (
        <ShoppingListDrawer
          open={shoppingDrawerOpen}
          onClose={() => setShoppingDrawerOpen(false)}
          menu={menu}
          recipes={recipes}
        />
      )}

      {/* ── Buffet labels drawer ── */}
      {menu && (
        <BuffetLabelsDrawer
          open={labelsDrawerOpen}
          onClose={() => setLabelsDrawerOpen(false)}
          menu={menu}
          recipes={recipes}
        />
      )}

      {/* ── Service board (86) ── */}
      {serviceBoardOpen && menu && (
        <ServiceBoardOverlay
          sections={menu.sections}
          onClose={() => setServiceBoardOpen(false)}
          onItemToggled={(itemId, available) => {
            void updateItem(itemId,
              menu.sections.find((s) => s.items.some((i) => i.id === itemId))?.id ?? '',
              { available }
            )
          }}
        />
      )}

      {/* ── Staff print overlay ── */}
      {printOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-white-fixed text-gray-900 overflow-auto">
          {/* Screen controls (hidden when printing) */}
          <div className="print:hidden sticky top-0 z-10 bg-white-fixed border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-700">{t('menus.detail.staffSheetTitle')}: {menu.name}</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
                <Printer className="h-4 w-4" />{t('menus.detail.staffSheetPrint')}
              </button>
              <button type="button" onClick={() => setPrintOverlayOpen(false)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50">
                <X className="h-4 w-4" />{t('menus.detail.staffSheetClose')}
              </button>
            </div>
          </div>

          {/* Print content */}
          <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
            {/* Title */}
            <div className="border-b-2 border-gray-900 pb-4">
              <h1 className="text-3xl font-bold">{menu.name}</h1>
              <p className="text-gray-500 mt-1">
                {t(`menus.types.${menu.type}`)}
                {menu.valid_from && menu.valid_to && ` · ${menu.valid_from} – ${menu.valid_to}`}
              </p>
              {menu.description && <p className="text-gray-600 mt-2">{menu.description}</p>}
            </div>

            {/* Sections */}
            {menu.sections.map((section) => (
              <div key={section.id} className="space-y-3">
                <h2 className="text-xl font-bold uppercase tracking-widest border-b border-gray-300 pb-1">
                  {section.name}
                </h2>
                {section.items.length === 0 && (
                  <p className="text-sm text-gray-400 italic">{t('menus.detail.emptySection')}</p>
                )}
                {section.items.map((item) => {
                  const recipe = linkedRecipe(item.recipe_id)
                  return (
                    <div key={item.id} className={cn('flex items-start gap-4 py-2 border-b border-gray-100', !item.available && 'opacity-40')}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('font-semibold', !item.available && 'line-through text-gray-400')}>
                            {item.name}
                          </span>
                          {!item.available && (
                            <span className="text-xs border border-gray-300 text-gray-400 px-1.5 py-0.5 rounded">
                              {t('menus.detail.unavailable')}
                            </span>
                          )}
                          {(item.tags ?? []).map((tag) => (
                            <span key={tag} className="text-xs border border-gray-300 text-gray-600 px-1.5 py-0.5 rounded">
                              {TAG_EMOJI[tag]} {t(`menus.tags.${tag}`)}
                            </span>
                          ))}
                        </div>
                        {item.description && <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>}
                        <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
                          {recipe && (
                            <span>{t('menus.detail.recipe')}: <strong className="text-gray-700">{recipe.title}</strong></span>
                          )}
                          {recipe && recipe.allergens.length > 0 && (
                            <span>{t('menus.detail.allergens')}: <strong className="text-gray-700">{recipe.allergens.join(', ')}</strong></span>
                          )}
                          {recipe?.cost_per_portion != null && (
                            <span>{t('menus.detail.costPerPortion')}: <strong className="text-gray-700">€{recipe.cost_per_portion.toFixed(2)}</strong></span>
                          )}
                        </div>
                      </div>
                      {menu.show_prices && item.price != null && (
                        <span className="font-bold text-gray-900 shrink-0">€{item.price.toFixed(2)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            <p className="text-xs text-gray-400 text-center pt-4">
              {new Date().toLocaleDateString()} · Chefsuite
            </p>
          </div>

          <style>{`
            @media print {
              @page { margin: 20mm; }
              body { font-family: serif; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
