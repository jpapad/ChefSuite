import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import { AlignCenter, AlignLeft, AlignRight, Globe, Loader2, Printer, QrCode, Save, Tag, Trash2 } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { ImageUpload } from '../ui/ImageUpload'
import { cn } from '../../lib/cn'
import { buildPreviewHtml, getDims, LABEL_FONTS, previewIframeHeight, printLabels } from '../../lib/printLabels'
import type { LabelSettings, LabelSize, LabelSizePreset } from '../../lib/printLabels'
import type { MenuWithSections, MenuItem, Recipe } from '../../types/database.types'
import { supabase } from '../../lib/supabase'
import { translateMenuItemsExtra, type TranslatedItemExtra } from '../../lib/gemini'

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
  customUnit: 'mm',
  fontFamily: 'Georgia, serif',
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
  langBothLines: ['en', 'source'],
  allergenLang: 'both',
  allergenIconSet: 'default',
  allergenSize: 'medium',
  showAllergenLegend: false,
  showQr: false,
  qrSizeMm: 35,
  labelsPerRow: 3,
  descSizeScale: 1.0,
  langStyles: {
    source: { bold: true,  italic: false, sizeScale: 1.0 },
    en:     { bold: true,  italic: false, sizeScale: 1.0 },
    bg:     { bold: false, italic: true,  sizeScale: 0.8 },
  },
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
  // Extra-language translations (RO/SL/UK/TR/SR) — loaded from DB or freshly translated
  const [extraNames, setExtraNames] = useState<Map<string, TranslatedItemExtra>>(new Map())
  const [translatingExtra, setTranslatingExtra] = useState(false)
  const [extraTranslateDone, setExtraTranslateDone] = useState(false)
  const [extraTranslateError, setExtraTranslateError] = useState<string | null>(null)

  // Sync logo default when menu prop changes
  useEffect(() => {
    setSettings((s) => ({ ...s, logoUrl: menu.logo_url }))
  }, [menu.logo_url])

  // Re-select all items when menu changes
  useEffect(() => {
    setSelectedIds(new Set(allItems.map((fi) => fi.item.id)))
  }, [allItems])

  // Seed extraNames from DB values already on the items
  useEffect(() => {
    const map = new Map<string, TranslatedItemExtra>()
    for (const { item } of allItems) {
      if (item.name_bg || item.name_uk || item.name_ro || item.name_sr || item.name_sk || item.name_pl || item.name_cs) {
        const ed = (item.descriptions_extra ?? {}) as Record<string, string | null>
        map.set(item.id, {
          name_bg: item.name_bg ?? null,
          name_uk: item.name_uk ?? null,
          name_ro: item.name_ro ?? null,
          name_sr: item.name_sr ?? null,
          name_sk: item.name_sk ?? null,
          name_pl: item.name_pl ?? null,
          name_cs: item.name_cs ?? null,
          desc_bg: item.description_bg ?? null,
          desc_uk: ed.uk ?? null,
          desc_ro: ed.ro ?? null,
          desc_sr: ed.sr ?? null,
          desc_sk: ed.sk ?? null,
          desc_pl: ed.pl ?? null,
          desc_cs: ed.cs ?? null,
        })
      }
    }
    setExtraNames(map)
    if (map.size > 0) setExtraTranslateDone(true)
  }, [allItems])

  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])

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
        const extra = extraNames.get(item.id)
        const recipe = item.recipe_id ? recipeMap.get(item.recipe_id) : undefined
        // n = Greek name as fallback; worker language names below
        const payload: Record<string, string> = { n: item.name.slice(0, 60) }
        const nameBg = extra?.name_bg ?? item.name_bg ?? recipe?.name_bg
        const nuk = extra?.name_uk ?? item.name_uk
        const nro = extra?.name_ro ?? item.name_ro
        const nsr = extra?.name_sr ?? item.name_sr
        const nsk = extra?.name_sk ?? item.name_sk
        const npl = extra?.name_pl ?? item.name_pl
        const ncs = extra?.name_cs ?? item.name_cs
        if (nameBg) payload.nb  = nameBg.slice(0, 60)
        if (nuk)    payload.nuk = nuk.slice(0, 60)
        if (nro)    payload.nro = nro.slice(0, 60)
        if (nsr)    payload.nsr = nsr.slice(0, 60)
        if (nsk)    payload.nsk = nsk.slice(0, 60)
        if (npl)    payload.npl = npl.slice(0, 60)
        if (ncs)    payload.ncs = ncs.slice(0, 60)
        // English description as fallback; translated descriptions override per language
        const de = trunc(item.description_el ?? recipe?.description_el); if (de) payload.de = de
        const db = trunc(extra?.desc_bg ?? item.description_bg ?? recipe?.description_bg); if (db) payload.db = db
        const duk = extra?.desc_uk ? extra.desc_uk.slice(0, 100) : undefined; if (duk) payload.duk = duk
        const dro = extra?.desc_ro ? extra.desc_ro.slice(0, 100) : undefined; if (dro) payload.dro = dro
        const dsr = extra?.desc_sr ? extra.desc_sr.slice(0, 100) : undefined; if (dsr) payload.dsr = dsr
        const dsk = extra?.desc_sk ? extra.desc_sk.slice(0, 100) : undefined; if (dsk) payload.dsk = dsk
        const dpl = extra?.desc_pl ? extra.desc_pl.slice(0, 100) : undefined; if (dpl) payload.dpl = dpl
        const dcs = extra?.desc_cs ? extra.desc_cs.slice(0, 100) : undefined; if (dcs) payload.dcs = dcs
        const jsonBytes = new TextEncoder().encode(JSON.stringify(payload))
        let binary = ''
        jsonBytes.forEach((b) => { binary += String.fromCharCode(b) })
        const url = `${origin}/dish?d=${encodeURIComponent(btoa(binary))}`
        const dataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'L',
        })
        return [item.id, dataUrl] as const
      })
    ).then((pairs) => {
      setQrMap(new Map(pairs))
    }).catch((err) => {
      console.error('QR generation failed:', err)
    }).finally(() => {
      setGeneratingQr(false)
    })
  }, [settings.showQr, allItems, extraNames, recipeMap])

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── Extra-language translation ─────────────────────────────────────────────

  const handleTranslateExtra = useCallback(async () => {
    setTranslatingExtra(true)
    setExtraTranslateError(null)
    try {
      const results = await translateMenuItemsExtra(
        allItems.map(({ item }) => {
          const recipe = item.recipe_id ? recipeMap.get(item.recipe_id) : undefined
          return {
            name: item.name,
            name_el: item.name_el ?? recipe?.name_el ?? null,
            description: item.description_el ?? recipe?.description_el ?? item.description ?? null,
          }
        })
      )
      const newMap = new Map<string, TranslatedItemExtra>()
      for (let i = 0; i < allItems.length; i++) {
        newMap.set(allItems[i].item.id, results[i])
      }
      setExtraNames(newMap)
      setExtraTranslateDone(true)
      // Persist to DB (best-effort)
      await Promise.all(
        allItems.map(({ item }, i) =>
          supabase.from('menu_items').update({
            name_bg: results[i].name_bg,
            description_bg: results[i].desc_bg,
            name_uk: results[i].name_uk,
            name_ro: results[i].name_ro,
            name_sr: results[i].name_sr,
            name_sk: results[i].name_sk,
            name_pl: results[i].name_pl,
            name_cs: results[i].name_cs,
            descriptions_extra: {
              uk: results[i].desc_uk,
              ro: results[i].desc_ro,
              sr: results[i].desc_sr,
              sk: results[i].desc_sk,
              pl: results[i].desc_pl,
              cs: results[i].desc_cs,
            },
          }).eq('id', item.id)
        )
      )
    } catch (err) {
      setExtraTranslateError(err instanceof Error ? err.message : 'Translation failed')
    } finally {
      setTranslatingExtra(false)
    }
  }, [allItems, recipeMap])

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

            {/* ── Font family ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Γραμματοσειρά τίτλου</label>
              <select
                value={settings.fontFamily}
                onChange={(e) => set('fontFamily', e.target.value)}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50"
                style={{ fontFamily: settings.fontFamily }}
              >
                {LABEL_FONTS.map((f) => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
                ))}
              </select>
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
                  {/* Unit toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Μονάδα μέτρησης</span>
                    <div className="flex rounded-lg border border-glass-border overflow-hidden text-xs font-medium">
                      {(['mm', 'cm'] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => set('customUnit', u)}
                          className={cn(
                            'px-3 py-1 transition',
                            settings.customUnit === u
                              ? 'bg-brand-orange text-white'
                              : 'text-white/50 hover:text-white hover:bg-white/5',
                          )}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-white/60">{t('menus.labels.customWidth')}</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={1} value={settings.customW}
                          onChange={(e) => set('customW', Math.max(1, +e.target.value))}
                          className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-glass-border text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                        />
                        <span className="text-xs text-white/40 shrink-0">{settings.customUnit}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/60">{t('menus.labels.customHeight')}</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={1} value={settings.customH}
                          onChange={(e) => set('customH', Math.max(1, +e.target.value))}
                          className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-glass-border text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 [appearance:textfield]"
                        />
                        <span className="text-xs text-white/40 shrink-0">{settings.customUnit}</span>
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

            {/* ── Labels per row ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Ετικέτες ανά σειρά (εκτύπωση)</label>
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as const).map((n) => (
                  <button key={n} type="button" onClick={() => set('labelsPerRow', n)}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-xs font-medium transition text-center',
                      settings.labelsPerRow === n
                        ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                        : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                    )}
                  >
                    {n} {n === 1 ? 'στήλη' : 'στήλες'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Language ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">{t('menus.labels.language')}</label>
              <div className="grid grid-cols-2 gap-2">
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

            {/* ── Language order (both mode) ── */}
            {settings.language === 'both' && (() => {
              type LK = 'source' | 'en' | 'bg'
              const currentLines: LK[] = settings.langBothLines?.length ? settings.langBothLines : ['en', 'source']
              const allKeys: LK[] = ['source', 'en', 'bg']
              const inactive = allKeys.filter((k) => !currentLines.includes(k))
              const meta: Record<LK, { label: string; flag: string }> = {
                source: { label: 'Ελληνικά', flag: '🇬🇷' },
                en:     { label: 'Αγγλικά',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
                bg:     { label: 'Βουλγαρικά', flag: '🇧🇬' },
              }
              return (
                <>
                <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-1.5">
                  <p className="text-xs text-white/50 mb-2">Σειρά γλωσσών στην ετικέτα</p>
                  {currentLines.map((key, idx) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-4 shrink-0 text-center text-[10px] text-white/25">{idx + 1}</span>
                      <div className="flex-1 rounded-lg border border-brand-orange/40 bg-brand-orange/8 px-2.5 py-1.5 text-xs text-brand-orange">
                        {meta[key].flag} {meta[key].label}
                      </div>
                      <div className="flex flex-col">
                        <button type="button" disabled={idx === 0}
                          onClick={() => { const l: LK[] = [...currentLines]; [l[idx-1], l[idx]] = [l[idx], l[idx-1]]; set('langBothLines', l) }}
                          className="h-4 w-4 text-[10px] text-white/30 hover:text-white disabled:opacity-15 leading-none">▲</button>
                        <button type="button" disabled={idx === currentLines.length - 1}
                          onClick={() => { const l: LK[] = [...currentLines]; [l[idx], l[idx+1]] = [l[idx+1], l[idx]]; set('langBothLines', l) }}
                          className="h-4 w-4 text-[10px] text-white/30 hover:text-white disabled:opacity-15 leading-none">▼</button>
                      </div>
                      <button type="button" disabled={currentLines.length <= 1}
                        onClick={() => { const l: LK[] = currentLines.filter((k) => k !== key); set('langBothLines', l) }}
                        className="text-white/25 hover:text-red-400 text-xs transition disabled:opacity-15">✕</button>
                    </div>
                  ))}
                  {inactive.map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-4 shrink-0" />
                      <div className="flex-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/25">
                        {meta[key].flag} {meta[key].label}
                      </div>
                      <div className="w-4 shrink-0" />
                      <button type="button"
                        onClick={() => set('langBothLines', [...currentLines, key])}
                        className="text-white/30 hover:text-emerald-400 text-sm font-bold transition">+</button>
                    </div>
                  ))}
                </div>

                {/* Per-language font style */}
                <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2">
                  <p className="text-xs text-white/50">Στυλ γραμματοσειράς ανά γλώσσα</p>
                  {currentLines.map((key) => {
                    const st = settings.langStyles?.[key] ?? { bold: key !== 'bg', italic: key === 'bg', sizeScale: key === 'bg' ? 0.8 : 1.0 }
                    const updateStyle = (patch: Partial<typeof st>) =>
                      set('langStyles', { ...settings.langStyles, [key]: { ...st, ...patch } })
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] text-white/40">{meta[key].flag} {meta[key].label}</span>
                        {/* Bold */}
                        <button type="button" onClick={() => updateStyle({ bold: !st.bold })}
                          className={cn('h-6 w-7 rounded text-xs font-bold border transition',
                            st.bold ? 'border-brand-orange bg-brand-orange/15 text-brand-orange' : 'border-glass-border text-white/30 hover:text-white')}>
                          B
                        </button>
                        {/* Italic */}
                        <button type="button" onClick={() => updateStyle({ italic: !st.italic })}
                          className={cn('h-6 w-7 rounded text-xs border transition italic',
                            st.italic ? 'border-brand-orange bg-brand-orange/15 text-brand-orange' : 'border-glass-border text-white/30 hover:text-white')}>
                          I
                        </button>
                        {/* Size scale */}
                        <div className="flex items-center gap-1 ml-auto">
                          <button type="button" onClick={() => updateStyle({ sizeScale: Math.max(0.5, +(st.sizeScale - 0.1).toFixed(1)) })}
                            className="h-6 w-6 rounded border border-glass-border text-white/40 hover:text-white text-xs transition">−</button>
                          <span className="w-8 text-center text-[11px] text-white/60 font-mono">{Math.round(st.sizeScale * 100)}%</span>
                          <button type="button" onClick={() => updateStyle({ sizeScale: Math.min(1.5, +(st.sizeScale + 0.1).toFixed(1)) })}
                            className="h-6 w-6 rounded border border-glass-border text-white/40 hover:text-white text-xs transition">+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                </>
              )
            })()}

            {/* ── Allergen label language ── */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">{t('menus.labels.allergenLang')}</label>
              <p className="text-xs text-white/40">{t('menus.labels.allergenLangHint')}</p>
              <div className="grid grid-cols-2 gap-2">
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

            {/* ── Allergen icon set ── */}
            {settings.showAllergens && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Εικονίδια αλλεργιογόνων</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['default', 'custom'] as const).map((v) => (
                    <button key={v} type="button" onClick={() => set('allergenIconSet', v)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-xs font-medium transition text-center',
                        settings.allergenIconSet === v
                          ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                          : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                      )}>
                      {v === 'default' ? 'Προεπιλεγμένα (SVG)' : 'Προσαρμοσμένα'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Allergen size ── */}
            {settings.showAllergens && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Μέγεθος αλλεργιογόνων</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'small',  label: 'Μικρό' },
                    { v: 'medium', label: 'Μεσαίο' },
                    { v: 'large',  label: 'Μεγάλο' },
                  ] as const).map(({ v, label }) => (
                    <button key={v} type="button" onClick={() => set('allergenSize', v)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-xs font-medium transition text-center',
                        settings.allergenSize === v
                          ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                          : 'border-glass-border text-white/50 hover:text-white hover:bg-white/5',
                      )}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {/* ── Description size ── */}
            {settings.showDescription && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white/70">Μέγεθος περιγραφής</span>
                <div className="flex items-center gap-1">
                  <button type="button"
                    onClick={() => set('descSizeScale', Math.max(0.5, +((settings.descSizeScale ?? 1) - 0.1).toFixed(1)))}
                    className="h-6 w-6 rounded border border-glass-border text-white/40 hover:text-white text-xs transition">−</button>
                  <span className="w-10 text-center text-[11px] text-white/60 font-mono">{Math.round((settings.descSizeScale ?? 1) * 100)}%</span>
                  <button type="button"
                    onClick={() => set('descSizeScale', Math.min(2.0, +((settings.descSizeScale ?? 1) + 0.1).toFixed(1)))}
                    className="h-6 w-6 rounded border border-glass-border text-white/40 hover:text-white text-xs transition">+</button>
                </div>
              </div>
            )}

            {/* ── QR size ── */}
            {settings.showQr && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Μέγεθος QR</span>
                  <span className="font-mono text-white/80">{settings.qrSizeMm} mm</span>
                </div>
                <input
                  type="range" min={15} max={60} step={1} value={settings.qrSizeMm}
                  onChange={(e) => set('qrSizeMm', +e.target.value)}
                  className="w-full accent-brand-orange cursor-pointer"
                />
              </div>
            )}

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
                <span>
                  {qrMap.size} QR codes ready
                  {extraTranslateDone && ' 🇧🇬 🇺🇦 🇷🇴 🇷🇸 🇸🇰 🇵🇱 🇨🇿'}
                </span>
              </div>
            )}

            {/* ── Extra-language translate button (visible when QR is on) ── */}
            {settings.showQr && (
              <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2">
                <p className="text-xs text-white/50">
                  🌍 Μεταφράσεις QR σε επιπλέον γλώσσες
                </p>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  🇧🇬 Βουλγαρικά · 🇺🇦 Ουκρανικά · 🇷🇴 Ρουμανικά · 🇷🇸 Σερβικά · 🇸🇰 Σλοβακικά · 🇵🇱 Πολωνικά · 🇨🇿 Τσεχικά
                </p>
                {extraTranslateError && (
                  <p className="text-xs text-red-400">{extraTranslateError}</p>
                )}
                <button
                  type="button"
                  disabled={translatingExtra}
                  onClick={() => void handleTranslateExtra()}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium transition',
                    extraTranslateDone
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      : 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20',
                    translatingExtra && 'opacity-60 pointer-events-none',
                  )}
                >
                  {translatingExtra
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Μετάφραση…</>
                    : <><Globe className="h-3.5 w-3.5" /> {extraTranslateDone ? '✓ Μεταφρασμένα — Ξαναμετάφραση' : 'AI Μετάφραση σε 6 γλώσσες'}</>
                  }
                </button>
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
