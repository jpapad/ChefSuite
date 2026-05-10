import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import { AlignCenter, AlignLeft, AlignRight, Loader2, Printer, QrCode, Save, Tag, Trash2 } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { ImageUpload } from '../ui/ImageUpload'
import { cn } from '../../lib/cn'
import { buildPreviewHtml, getDims, previewIframeHeight, printLabels } from '../../lib/printLabels'
import type { LabelSettings, LabelSize, LabelSizePreset } from '../../lib/printLabels'
import type { MenuWithSections, MenuItem, Recipe } from '../../types/database.types'

// ── Custom preset persistence ────────────────────────────────────────────────

interface CustomPreset { id: string; name: string; w: number; h: number }

const PRESETS_KEY = 'chefsuite_label_presets_v1'

function loadPresets(): CustomPreset[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') } catch { return [] }
}
function persistPresets(ps: CustomPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(ps))
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  menu: MenuWithSections
  recipes: Recipe[]
}

interface FlatItem { item: MenuItem; sectionName: string }

const DEFAULT_SETTINGS = (logoUrl: string | null): LabelSettings => ({
  size: 'medium',
  customW: 100,
  customH: 70,
  logoUrl,
  logoMaxW: 45,
  logoMaxH: 18,
  logoAlign: 'left',
  nameAlign: 'left',
  showDescription: true,
  showAllergens: true,
  showTags: true,
  showPrice: true,
  language: 'en',
  allergenLang: 'both',
  showAllergenLegend: false,
  showQr: false,
})

export function BuffetLabelsDrawer({ open, onClose, menu, recipes }: Props) {
  const { t } = useTranslation()

  const allItems = useMemo<FlatItem[]>(() => {
    const result: FlatItem[] = []
    for (const section of menu.sections)
      for (const item of section.items)
        result.push({ item, sectionName: section.name })
    return result
  }, [menu])

  const [settings, setSettings] = useState<LabelSettings>(() => DEFAULT_SETTINGS(menu.logo_url))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(allItems.map((fi) => fi.item.id)))
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => loadPresets())
  const [presetName, setPresetName] = useState('')
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map())
  const [generatingQr, setGeneratingQr] = useState(false)

  // Sync logo default when menu prop changes
  useEffect(() => {
    setSettings((s) => ({ ...s, logoUrl: menu.logo_url }))
  }, [menu.logo_url])

  // Re-select all items when menu changes
  useEffect(() => {
    setSelectedIds(new Set(allItems.map((fi) => fi.item.id)))
  }, [allItems])

  // Generate QR data URLs for each item
  useEffect(() => {
    if (!settings.showQr) {
      setQrMap(new Map())
      return
    }
    setGeneratingQr(true)
    const origin = window.location.origin
    Promise.all(
      allItems.map(async ({ item }) => {
        // Keep payload short: truncate descriptions to reduce QR density
        const trunc = (s: string | null | undefined, max = 100) =>
          s ? s.slice(0, max) : undefined
        const payload: Record<string, string> = { n: item.name.slice(0, 60) }
        if (item.name_el)        payload.ne = item.name_el.slice(0, 60)
        if (item.name_bg)        payload.nb = item.name_bg.slice(0, 60)
        const d = trunc(item.description); if (d) payload.d = d
        const de = trunc(item.description_el); if (de) payload.de = de
        const db = trunc(item.description_bg); if (db) payload.db = db
        const url = `${origin}/dish?d=${btoa(encodeURIComponent(JSON.stringify(payload)))}`
        const dataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'L',
        })
        return [item.id, dataUrl] as const
      })
    ).then((pairs) => {
      setQrMap(new Map(pairs))
    }).finally(() => {
      setGeneratingQr(false)
    })
  }, [settings.showQr, allItems])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])

  const selectedItems = useMemo(
    () => allItems.filter((fi) => selectedIds.has(fi.item.id)).map((fi) => fi.item),
    [allItems, selectedIds],
  )

  function set<K extends keyof LabelSettings>(key: K, value: LabelSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Custom preset helpers ──────────────────────────────────────────────────

  function savePreset() {
    const name = presetName.trim()
    if (!name) return
    const preset: CustomPreset = {
      id: crypto.randomUUID(),
      name,
      w: settings.customW,
      h: settings.customH,
    }
    const updated = [...customPresets, preset]
    setCustomPresets(updated)
    persistPresets(updated)
    setPresetName('')
  }

  function deletePreset(id: string) {
    const updated = customPresets.filter((p) => p.id !== id)
    setCustomPresets(updated)
    persistPresets(updated)
  }

  function applyPreset(p: CustomPreset) {
    setSettings((s) => ({ ...s, size: 'custom', customW: p.w, customH: p.h }))
  }

  // ── Logo constraints based on current dims ─────────────────────────────────

  const dims = useMemo(() => getDims(settings), [settings])
  const logoWMax = Math.max(20, Math.min(80, dims.w - 10))
  const logoHMax = Math.max(10, Math.min(40, dims.h - 15))

  // ── Preview iframe ─────────────────────────────────────────────────────────

  const previewItem   = selectedItems[0] ?? null
  const previewRecipe = previewItem?.recipe_id ? recipeMap.get(previewItem.recipe_id) : undefined
  const iframeRef     = useRef<HTMLIFrameElement>(null)
  const iframeH       = useMemo(() => previewIframeHeight(settings), [settings])

  useEffect(() => {
    if (!previewItem) return
    const qrDataUrl = settings.showQr ? qrMap.get(previewItem.id) : undefined
    const html = buildPreviewHtml(previewItem, previewRecipe, settings, qrDataUrl)
    const iframe = iframeRef.current
    if (iframe) iframe.srcdoc = html
  }, [previewItem, previewRecipe, settings, qrMap])

  const handlePrint = useCallback(() => {
    if (selectedItems.length === 0) return
    printLabels(selectedItems, menu, recipes, settings, settings.showQr ? qrMap : undefined)
  }, [selectedItems, menu, recipes, settings, qrMap])

  // ── Static option lists ────────────────────────────────────────────────────

  const sizePresets: { value: LabelSizePreset; label: string }[] = [
    { value: 'small',  label: t('menus.labels.sizeSmall') },
    { value: 'medium', label: t('menus.labels.sizeMedium') },
    { value: 'large',  label: t('menus.labels.sizeLarge') },
  ]

  const languages: { value: LabelSettings['language']; label: string }[] = [
    { value: 'en',   label: t('menus.labels.langEn') },
    { value: 'el',   label: t('menus.labels.langEl') },
    { value: 'bg',   label: t('menus.labels.langBg') },
    { value: 'both', label: t('menus.labels.langBoth') },
  ]

  const allergenLangs: { value: LabelSettings['allergenLang']; label: string }[] = [
    { value: 'en',   label: t('menus.labels.langEn') },
    { value: 'el',   label: t('menus.labels.langEl') },
    { value: 'bg',   label: t('menus.labels.langBg') },
    { value: 'both', label: t('menus.labels.langBoth') },
  ]

  const toggles: { key: keyof LabelSettings; label: string }[] = [
    { key: 'showDescription',   label: t('menus.labels.showDescription') },
    { key: 'showAllergens',     label: t('menus.labels.showAllergens') },
    { key: 'showTags',          label: t('menus.labels.showTags') },
    { key: 'showPrice',         label: t('menus.labels.showPrice') },
    { key: 'showAllergenLegend', label: t('menus.labels.showAllergenLegend') },
    { key: 'showQr',            label: 'QR Code (scan for description)' },
  ]

  const alignOptions: { value: LabelSettings['logoAlign']; Icon: typeof AlignLeft }[] = [
    { value: 'left',   Icon: AlignLeft },
    { value: 'center', Icon: AlignCenter },
    { value: 'right',  Icon: AlignRight },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Drawer open={open} onClose={onClose} title={t('menus.labels.drawerTitle')}>
      <div className="space-y-6">

        {allItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Tag className="h-10 w-10 text-white/20" />
            <p className="text-white/50 text-sm">{t('menus.labels.noItemsInMenu')}</p>
          </div>
        ) : (
          <>
            {/* ── Logo ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">{t('menus.labels.logoLabel')}</label>
              <p className="text-xs text-white/40">{t('menus.labels.logoHint')}</p>
              <ImageUpload
                value={settings.logoUrl}
                onChange={(url) => set('logoUrl', url)}
                bucket="supplier-logos"
                aspectClass="h-24"
              />

              {/* Logo controls – only when a logo is set */}
              {settings.logoUrl && (
                <div className="rounded-xl border border-glass-border bg-white/3 px-4 py-3 space-y-3 mt-2">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    {t('menus.labels.logoControls')}
                  </p>

                  {/* Width slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{t('menus.labels.logoMaxWidth')}</span>
                      <span className="font-mono text-white/80">{settings.logoMaxW} mm</span>
                    </div>
                    <input
                      type="range" min={5} max={logoWMax} value={settings.logoMaxW}
                      onChange={(e) => set('logoMaxW', +e.target.value)}
                      className="w-full accent-brand-orange cursor-pointer"
                    />
                  </div>

                  {/* Height slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{t('menus.labels.logoMaxHeight')}</span>
                      <span className="font-mono text-white/80">{settings.logoMaxH} mm</span>
                    </div>
                    <input
                      type="range" min={3} max={logoHMax} value={settings.logoMaxH}
                      onChange={(e) => set('logoMaxH', +e.target.value)}
                      className="w-full accent-brand-orange cursor-pointer"
                    />
                  </div>

                  {/* Position */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60 flex-1">{t('menus.labels.logoPosition')}</span>
                    <div className="flex gap-1">
                      {alignOptions.map(({ value, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => set('logoAlign', value)}
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg border transition',
                            settings.logoAlign === value
                              ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                              : 'border-glass-border text-white/40 hover:text-white hover:bg-white/5',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Title alignment ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Title alignment</label>
              <div className="flex gap-1">
                {alignOptions.map(({ value, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('nameAlign', value)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition',
                      settings.nameAlign === value
                        ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                        : 'border-glass-border text-white/40 hover:text-white hover:bg-white/5',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {value === 'left' ? 'Left' : value === 'center' ? 'Center' : 'Right'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Label size ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">{t('menus.labels.labelSize')}</label>

              {/* Preset + Custom buttons */}
              <div className="grid grid-cols-4 gap-2">
                {sizePresets.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => set('size', value as LabelSize)}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-xs font-medium transition text-center',
                      settings.size === value
                        ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                        : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                    )}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" onClick={() => set('size', 'custom')}
                  className={cn(
                    'rounded-xl border px-2 py-2 text-xs font-medium transition text-center',
                    settings.size === 'custom'
                      ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                      : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                  )}
                >
                  {t('menus.labels.sizeCustom')}
                </button>
              </div>

              {/* Custom W/H inputs */}
              {settings.size === 'custom' && (
                <div className="rounded-xl border border-glass-border bg-white/3 px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-white/60">{t('menus.labels.customWidth')}</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={40} max={350} value={settings.customW}
                          onChange={(e) => set('customW', Math.max(40, +e.target.value))}
                          className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-glass-border text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                        />
                        <span className="text-xs text-white/40 shrink-0">mm</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/60">{t('menus.labels.customHeight')}</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={30} max={250} value={settings.customH}
                          onChange={(e) => set('customH', Math.max(30, +e.target.value))}
                          className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-glass-border text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                        />
                        <span className="text-xs text-white/40 shrink-0">mm</span>
                      </div>
                    </div>
                  </div>

                  {/* Save as preset */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder={t('menus.labels.presetNamePlaceholder')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); savePreset() } }}
                      className="flex-1 rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-glass-border text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
                    />
                    <button
                      type="button"
                      onClick={savePreset}
                      disabled={!presetName.trim()}
                      className="flex items-center gap-1.5 rounded-lg border border-glass-border px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {t('menus.labels.savePreset')}
                    </button>
                  </div>
                </div>
              )}

              {/* Saved custom presets */}
              {customPresets.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-white/40">{t('menus.labels.savedPresets')}</p>
                  <div className="flex flex-wrap gap-2">
                    {customPresets.map((p) => (
                      <div key={p.id}
                        className="flex items-center gap-1 rounded-lg border border-glass-border bg-white/3 pl-2.5 pr-1 py-1">
                        <button type="button" onClick={() => applyPreset(p)}
                          className="text-xs text-white/70 hover:text-white transition">
                          {p.name} <span className="text-white/30">({p.w}×{p.h})</span>
                        </button>
                        <button type="button" onClick={() => deletePreset(p.id)}
                          aria-label={t('menus.labels.deletePreset')}
                          className="flex h-5 w-5 items-center justify-center rounded text-white/30 hover:text-red-400 transition">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Language ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">{t('menus.labels.language')}</label>
              <div className="grid grid-cols-3 gap-2">
                {languages.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => set('language', value)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-medium transition text-center',
                      settings.language === value
                        ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                        : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Allergen label language ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">{t('menus.labels.allergenLang')}</label>
              <p className="text-xs text-white/40">{t('menus.labels.allergenLangHint')}</p>
              <div className="grid grid-cols-3 gap-2">
                {allergenLangs.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => set('allergenLang', value)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-medium transition text-center',
                      settings.allergenLang === value
                        ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                        : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Toggles ── */}
            <div className="rounded-xl border border-glass-border divide-y divide-glass-border overflow-hidden">
              {toggles.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer">
                  <span className="text-sm text-white/70">{label}</span>
                  <button type="button"
                    onClick={() => set(key, !settings[key] as LabelSettings[typeof key])}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
                      settings[key] ? 'bg-brand-orange' : 'bg-white/20',
                    )}
                  >
                    <span className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white-fixed transition-transform',
                      settings[key] ? 'translate-x-[18px]' : 'translate-x-[3px]',
                    )} />
                  </button>
                </label>
              ))}
            </div>

            {/* ── QR generating indicator ── */}
            {settings.showQr && generatingQr && (
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Generating QR codes…</span>
              </div>
            )}
            {settings.showQr && !generatingQr && qrMap.size > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-400/70">
                <QrCode className="h-3.5 w-3.5" />
                <span>{qrMap.size} QR codes ready — scan to get description in 🇬🇷 🏴󠁧󠁢󠁥󠁮󠁧󠁿 🇧🇬</span>
              </div>
            )}

            {/* ── Item selection ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-white/70">{t('menus.labels.selectItems')}</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setSelectedIds(new Set(allItems.map((fi) => fi.item.id)))}
                    className="text-xs text-brand-orange hover:underline">
                    {t('menus.labels.selectAll')}
                  </button>
                  <span className="text-white/20">·</span>
                  <button type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-white/40 hover:text-white">
                    {t('menus.labels.selectNone')}
                  </button>
                </div>
              </div>
              <div className="space-y-px max-h-52 overflow-y-auto rounded-xl border border-glass-border">
                {allItems.map(({ item, sectionName }) => (
                  <label key={item.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer transition hover:bg-white/5 first:rounded-t-xl last:rounded-b-xl',
                      !selectedIds.has(item.id) && 'opacity-40',
                    )}
                  >
                    <input type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="h-4 w-4 rounded accent-brand-orange shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-white/40 truncate">{sectionName}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Preview ── */}
            {previewItem && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white/70">{t('menus.labels.previewTitle')}</span>
                  <span className="text-xs text-white/30">{t('menus.labels.previewHint')}</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-glass-border bg-[#f0f0f0]">
                  <iframe
                    ref={iframeRef}
                    title="label-preview"
                    className="w-full border-0 block"
                    style={{ height: iframeH }}
                  />
                </div>
              </div>
            )}

            {/* ── Print ── */}
            <div className="flex gap-2 pt-2">
              <Button type="button" leftIcon={<Printer className="h-4 w-4" />}
                onClick={handlePrint} disabled={selectedItems.length === 0} className="flex-1">
                {selectedItems.length === 0
                  ? t('menus.labels.noItems')
                  : t('menus.labels.printButton', { count: selectedItems.length })}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t('common.cancel')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
