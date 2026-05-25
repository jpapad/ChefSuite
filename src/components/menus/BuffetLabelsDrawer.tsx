import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import { AlignCenter, AlignLeft, AlignRight, Check, Globe, Loader2, Printer, QrCode, Save, ShieldCheck, ShieldX, Tag, Trash2, Wrench } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { ImageUpload } from '../ui/ImageUpload'
import { cn } from '../../lib/cn'
import { ALLERGEN_EN, buildPreviewHtml, getDims, LABEL_FONTS, previewIframeHeight, printLabels } from '../../lib/printLabels'
import type { LabelSettings, LabelSize, LabelSizePreset } from '../../lib/printLabels'
import type { MenuWithSections, MenuItem, Recipe } from '../../types/database.types'
import { supabase } from '../../lib/supabase'
import { translateMenuItemsExtra, type TranslatedItemExtra } from '../../lib/gemini'

// ── QR Validation ────────────────────────────────────────────────────────────

type QrStatus = 'pending' | 'validating' | 'verified' | 'auto-fixed' | 'failed'

async function validateQrDataUrl(dataUrl: string): Promise<boolean> {
  const { default: jsQR } = await import('jsqr')
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(false); return }
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, img.width, img.height)
      resolve(!!jsQR(d.data, d.width, d.height))
    }
    img.onerror = () => resolve(false)
    img.src = dataUrl
  })
}

// ── Premium Label Card (drawer preview) ──────────────────────────────────────

// Card border per validation state
const QR_BORDER: Record<QrStatus, string> = {
  pending:      'border-gray-200',
  validating:   'border-gray-200',
  verified:     'border-emerald-300',
  'auto-fixed': 'border-amber-300',
  failed:       'border-red-400 animate-pulse',
}

// Bottom-left status badge per state (print:hidden in JSX)
const QR_BADGE: Partial<Record<QrStatus, { cls: string; label: string }>> = {
  verified:     { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: '✓ Ελέγχθηκε' },
  'auto-fixed': { cls: 'bg-amber-50  text-amber-700  border-amber-100',     label: '⚡ Διορθώθηκε' },
  failed:       { cls: 'bg-red-50    text-red-700    border-red-100',       label: '⚠ Αποτυχία' },
}

interface LabelCardProps {
  item: MenuItem
  recipe: Recipe | undefined
  menu: MenuWithSections
  settings: LabelSettings
  qrDataUrl: string | undefined
  shortCode: string | undefined
  status: QrStatus | undefined
  selected: boolean
  onToggle: () => void
}

function LabelCardPreview({ item, recipe, menu, settings, qrDataUrl, shortCode, status, selected, onToggle }: LabelCardProps) {
  const allergens = recipe?.allergens ?? []
  const border    = status ? QR_BORDER[status] : 'border-gray-200'
  const badge     = status ? QR_BADGE[status] : undefined
  const showQr    = settings.showQr && !!qrDataUrl

  return (
    <div
      onClick={onToggle}
      className={cn(
        'relative w-full h-[190px] bg-white rounded-xl border-2 cursor-pointer transition-all shrink-0 overflow-hidden select-none',
        border,
        selected
          ? 'ring-2 ring-brand-orange ring-offset-2 ring-offset-[#0d0d0d]'
          : 'hover:border-gray-300 opacity-50',
      )}
    >
      {/* ── Selection dot ── */}
      <div className={cn(
        'absolute top-2.5 left-2.5 z-10 h-4 w-4 rounded-full border-2 flex items-center justify-center transition shrink-0',
        selected ? 'bg-brand-orange border-brand-orange' : 'border-gray-300 bg-white',
      )}>
        {selected && <Check className="h-2.5 w-2.5 text-white" />}
      </div>

      {/* ── Validation badge — bottom-left, never printed ── */}
      {badge && (
        <div className={cn(
          'absolute bottom-2 left-2.5 z-10 flex items-center gap-0.5 rounded-md border px-1.5 py-[3px] text-[8px] font-semibold print:hidden',
          badge.cls,
        )}>
          {badge.label}
        </div>
      )}

      {/* ── Card body ── */}
      <div className="flex flex-col h-full px-3 pt-2.5 pb-2.5">

        {/* Brand header — full width, separated by hairline */}
        <div className="pl-5 border-b border-gray-50 pb-1.5 mb-2 shrink-0">
          <p className="text-[9px] font-black tracking-[0.2em] text-gray-400 uppercase truncate">
            {menu.name}
          </p>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left column: title hierarchy + allergens ── */}
          <div className="flex flex-col min-w-0 flex-1 pr-2">

            {/* Greek / source title */}
            <p className="text-base font-black tracking-tight text-gray-900 uppercase leading-tight truncate">
              {item.name}
            </p>

            {/* English subtitle */}
            {item.name_el && (
              <p className="text-xs font-semibold text-gray-400 italic mt-0.5 tracking-wide truncate">
                {item.name_el}
              </p>
            )}

            {/* Description */}
            {settings.showDescription && (item.description_el ?? item.description) && (
              <p className="text-[10px] text-gray-400 leading-relaxed mt-2 line-clamp-2 font-medium print:text-gray-600">
                {item.description_el ?? item.description}
              </p>
            )}

            {/* Allergen badges — pushed to bottom; extra padding when status badge occupies corner */}
            {settings.showAllergens && allergens.length > 0 && (
              <div className={cn('flex flex-wrap gap-1 mt-auto', badge ? 'pb-5' : 'pb-0')}>
                {allergens.slice(0, 5).map((a) => (
                  <span
                    key={a}
                    className={cn(
                      'text-[7px] font-semibold px-1.5 py-0.5 rounded-md border leading-none',
                      a === 'vegan' || a === 'vegetarian'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 print:bg-white print:border-black print:text-black'
                        : 'bg-gray-50 text-gray-600 border-gray-100 print:bg-white print:border-black print:text-black',
                    )}
                  >
                    {ALLERGEN_EN[a] ?? a}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Right column: QR + Manual Code ── */}
          {showQr && (
            <div className="flex flex-col items-center justify-center shrink-0 border-l border-gray-50 pl-3 print:border-l-gray-200">
              {/* QR image — white padded block for camera clearance */}
              <div className="bg-white border border-gray-100 rounded-sm p-1">
                <img
                  src={qrDataUrl}
                  alt="QR"
                  style={{ width: 68, height: 68, imageRendering: 'pixelated', display: 'block' }}
                />
              </div>

              {/* Short code block */}
              {shortCode && (
                <div className="flex flex-col items-center mt-1.5">
                  <span className="text-[7px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-0.5">
                    MANUAL CODE
                  </span>
                  <span className="font-mono text-[11px] font-black text-gray-700 bg-gray-100 border border-gray-200/50 px-2 py-0.5 rounded-md tracking-wider print:bg-white print:border-black">
                    #{shortCode}
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Custom preset persistence ────────────────────────────────────────────────

interface CustomPreset { id: string; name: string; w: number; h: number }

const PRESETS_KEY = 'chefsuite_label_presets_v1'

function loadPresets(): CustomPreset[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') } catch { return [] }
}
function persistPresets(ps: CustomPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(ps))
}

// ── Label Settings Profiles ──────────────────────────────────────────────────

interface LabelProfile { id: string; name: string; settings: LabelSettings }

const PROFILES_KEY = 'chefsuite_label_profiles_v1'

function loadProfiles(): LabelProfile[] {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '[]') } catch { return [] }
}
function persistProfiles(ps: LabelProfile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(ps))
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
  qrBorder: false,
  qrBorderColor: '#333333',
  qrBorderWidth: 1,
  qrBorderRadius: 2,
  qrBorderPadding: 2,
  qrLabel: '',
  qrLabelPos: 'below' as const,
  qrLabelSize: 7,
  qrLabelColor: '#555555',
  qrLabelAlign: 'center' as const,
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
  const [qrValidation, setQrValidation] = useState<Map<string, QrStatus>>(new Map())
  const [fixedQrMap, setFixedQrMap] = useState<Map<string, string>>(new Map())
  // Extra-language translations (RO/SL/UK/TR/SR) — loaded from DB or freshly translated
  const [extraNames, setExtraNames] = useState<Map<string, TranslatedItemExtra>>(new Map())
  const [translatingExtra, setTranslatingExtra] = useState(false)
  const [extraTranslateDone, setExtraTranslateDone] = useState(false)
  const [extraTranslateError, setExtraTranslateError] = useState<string | null>(null)
  const [removingBg, setRemovingBg] = useState(false)
  const [bgRemoveError, setBgRemoveError] = useState<string | null>(null)
  const [labelProfiles, setLabelProfiles] = useState<LabelProfile[]>(() => loadProfiles())
  const [profileName, setProfileName] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')

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

  // Short code map: item.id → zero-padded 3-digit position (e.g. "001")
  const shortCodeMap = useMemo<Map<string, string>>(
    () => new Map(allItems.map(({ item }, i) => [item.id, String(i + 1).padStart(3, '0')])),
    [allItems],
  )

  // Effective QR map: override originals with auto-fixed variants where applicable
  const effectiveQrMap = useMemo(() => {
    if (!settings.showQr) return new Map<string, string>()
    const merged = new Map(qrMap)
    fixedQrMap.forEach((v, k) => merged.set(k, v))
    return merged
  }, [settings.showQr, qrMap, fixedQrMap])

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
          width: 600,
          margin: 4,
          errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#ffffff' },
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

  // Validate every generated QR; auto-fix failures with a shorter URL + larger render
  useEffect(() => {
    if (!settings.showQr || qrMap.size === 0) {
      setQrValidation(new Map())
      setFixedQrMap(new Map())
      return
    }
    const origin = window.location.origin
    let cancelled = false

    void (async () => {
      setQrValidation(new Map(allItems.map(({ item }) => [item.id, 'pending' as QrStatus])))
      setFixedQrMap(new Map())
      const newFixed = new Map<string, string>()

      for (const { item } of allItems) {
        if (cancelled) break
        const dataUrl = qrMap.get(item.id)
        if (!dataUrl) continue

        setQrValidation((prev) => new Map(prev).set(item.id, 'validating'))
        const ok = await validateQrDataUrl(dataUrl)
        if (cancelled) break

        if (ok) {
          setQrValidation((prev) => new Map(prev).set(item.id, 'verified'))
        } else {
          // Auto-fix: minimal URL (no JSON payload) + higher resolution + tighter margin
          try {
            const fixedDataUrl = await QRCode.toDataURL(`${origin}/b/${item.id}`, {
              width: 900,
              margin: 2,
              errorCorrectionLevel: 'H',
              color: { dark: '#000000', light: '#ffffff' },
            })
            const fixedOk = await validateQrDataUrl(fixedDataUrl)
            if (cancelled) break
            if (fixedOk) {
              newFixed.set(item.id, fixedDataUrl)
              setQrValidation((prev) => new Map(prev).set(item.id, 'auto-fixed'))
            } else {
              setQrValidation((prev) => new Map(prev).set(item.id, 'failed'))
            }
          } catch {
            setQrValidation((prev) => new Map(prev).set(item.id, 'failed'))
          }
        }
      }

      if (!cancelled) setFixedQrMap(newFixed)
    })()

    return () => { cancelled = true }
  }, [qrMap, settings.showQr, allItems])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const selectedItems = useMemo(
    () => allItems.filter((fi) => selectedIds.has(fi.item.id)).map((fi) => fi.item),
    [allItems, selectedIds],
  )

  function set<K extends keyof LabelSettings>(key: K, value: LabelSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  async function handleRemoveBg() {
    if (!settings.logoUrl) return
    setRemovingBg(true)
    setBgRemoveError(null)
    try {
      const { removeBackground } = await import('@imgly/background-removal')
      let source: Blob | string = settings.logoUrl
      if (settings.logoUrl.startsWith('http') || settings.logoUrl.startsWith('//')) {
        const resp = await fetch(settings.logoUrl)
        source = await resp.blob()
      }
      const result = await removeBackground(source, { model: 'isnet' })
      set('logoUrl', URL.createObjectURL(result))
    } catch (err) {
      setBgRemoveError(err instanceof Error ? err.message : 'Αποτυχία αφαίρεσης φόντου')
    } finally {
      setRemovingBg(false)
    }
  }

  function saveProfile() {
    const name = profileName.trim()
    if (!name) return
    const profile: LabelProfile = { id: crypto.randomUUID(), name, settings: { ...settings } }
    const updated = [...labelProfiles, profile]
    setLabelProfiles(updated)
    persistProfiles(updated)
    setProfileName('')
  }

  function loadProfile(id: string) {
    const profile = labelProfiles.find((p) => p.id === id)
    if (!profile) return
    setSettings(profile.settings)
  }

  function deleteProfile(id: string) {
    const updated = labelProfiles.filter((p) => p.id !== id)
    setLabelProfiles(updated)
    persistProfiles(updated)
    if (selectedProfileId === id) setSelectedProfileId('')
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
  const logoWMax = Math.max(20, Math.min(160, dims.w - 5))
  const logoHMax = Math.max(10, Math.min(80, dims.h - 10))

  // ── Preview iframe ─────────────────────────────────────────────────────────

  const previewItem   = selectedItems[0] ?? null
  const previewRecipe = previewItem?.recipe_id ? recipeMap.get(previewItem.recipe_id) : undefined
  const iframeRef     = useRef<HTMLIFrameElement>(null)
  const iframeH       = useMemo(() => previewIframeHeight(settings), [settings])

  useEffect(() => {
    if (!previewItem) return
    const qrDataUrl  = settings.showQr ? effectiveQrMap.get(previewItem.id) : undefined
    const shortCode  = settings.showQr ? shortCodeMap.get(previewItem.id) : undefined
    const html = buildPreviewHtml(previewItem, previewRecipe, settings, qrDataUrl, shortCode)
    const iframe = iframeRef.current
    if (iframe) iframe.srcdoc = html
  }, [previewItem, previewRecipe, settings, effectiveQrMap, shortCodeMap])

  const handlePrint = useCallback(() => {
    if (selectedItems.length === 0) return
    printLabels(selectedItems, menu, recipes, settings, settings.showQr ? effectiveQrMap : undefined, settings.showQr ? shortCodeMap : undefined)
  }, [selectedItems, menu, recipes, settings, effectiveQrMap, shortCodeMap])

  // ── QR Validation stats ───────────────────────────────────────────────────

  const validationStats = useMemo(() => {
    if (!settings.showQr || qrValidation.size === 0) return null
    const vals = [...qrValidation.values()]
    return {
      verified:  vals.filter((s) => s === 'verified').length,
      autoFixed: vals.filter((s) => s === 'auto-fixed').length,
      failed:    vals.filter((s) => s === 'failed').length,
      pending:   vals.filter((s) => s === 'pending' || s === 'validating').length,
    }
  }, [settings.showQr, qrValidation])

  const hasFailedQr = settings.showQr &&
    selectedItems.some((item) => qrValidation.get(item.id) === 'failed')

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
            {/* ── Profiles ── */}
            <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 space-y-3">
              <p className="text-xs font-semibold text-brand-orange/70 uppercase tracking-wider">🎨 Στυλ / Profiles</p>

              {/* Load existing profile */}
              {labelProfiles.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none"
                  >
                    <option value="">— Επιλογή profile —</option>
                    {labelProfiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedProfileId}
                    onClick={() => loadProfile(selectedProfileId)}
                    className="rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-3 py-1.5 text-xs font-medium text-brand-orange hover:bg-brand-orange/20 transition disabled:opacity-40"
                  >
                    Φόρτωση
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProfileId}
                    onClick={() => deleteProfile(selectedProfileId)}
                    className="rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Save current as new profile */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
                  placeholder="Όνομα νέου profile…"
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-brand-orange/50"
                />
                <button
                  type="button"
                  disabled={!profileName.trim()}
                  onClick={saveProfile}
                  className="rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-3 py-1.5 text-xs font-medium text-brand-orange hover:bg-brand-orange/20 transition disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

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

                  {/* Background removal */}
                  <div className="pt-1 border-t border-white/10 space-y-1.5">
                    <button
                      type="button"
                      onClick={handleRemoveBg}
                      disabled={removingBg}
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition',
                        removingBg
                          ? 'border-glass-border text-white/30 cursor-not-allowed'
                          : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10',
                      )}
                    >
                      {removingBg
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Επεξεργασία…</>
                        : '✨ Αφαίρεση φόντου'
                      }
                    </button>
                    {bgRemoveError && (
                      <p className="text-xs text-red-400">{bgRemoveError}</p>
                    )}
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

            {/* ── QR border ── */}
            {settings.showQr && (
              <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-white/60">Πλαίσιο γύρω από QR</span>
                  <button type="button"
                    onClick={() => set('qrBorder', !settings.qrBorder)}
                    className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
                      settings.qrBorder ? 'bg-brand-orange' : 'bg-white/20')}>
                    <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white-fixed transition-transform',
                      settings.qrBorder ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
                  </button>
                </label>
                {settings.qrBorder && (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-white/50">Χρώμα</span>
                      <input type="color" value={settings.qrBorderColor}
                        onChange={(e) => set('qrBorderColor', e.target.value)}
                        className="h-7 w-12 cursor-pointer rounded border border-glass-border bg-transparent" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-white/50">
                        <span>Πάχος</span><span className="font-mono">{settings.qrBorderWidth}px</span>
                      </div>
                      <input type="range" min={1} max={6} step={1} value={settings.qrBorderWidth}
                        onChange={(e) => set('qrBorderWidth', +e.target.value)}
                        className="w-full accent-brand-orange cursor-pointer" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-white/50">
                        <span>Γωνίες</span><span className="font-mono">{settings.qrBorderRadius}mm</span>
                      </div>
                      <input type="range" min={0} max={6} step={1} value={settings.qrBorderRadius}
                        onChange={(e) => set('qrBorderRadius', +e.target.value)}
                        className="w-full accent-brand-orange cursor-pointer" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-white/50">
                        <span>Εσωτερικό padding</span><span className="font-mono">{settings.qrBorderPadding}mm</span>
                      </div>
                      <input type="range" min={1} max={6} step={1} value={settings.qrBorderPadding}
                        onChange={(e) => set('qrBorderPadding', +e.target.value)}
                        className="w-full accent-brand-orange cursor-pointer" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── QR scan label ── */}
            {settings.showQr && (
              <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-3">
                <p className="text-xs text-white/60">Μήνυμα δίπλα στο QR</p>
                <input type="text" placeholder='π.χ. "Scan me" ή "📷 Σκανάρετε"'
                  value={settings.qrLabel}
                  onChange={(e) => set('qrLabel', e.target.value)}
                  className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-brand-orange/50" />
                {settings.qrLabel && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      {(['above', 'below'] as const).map((pos) => (
                        <button key={pos} type="button" onClick={() => set('qrLabelPos', pos)}
                          className={cn('rounded-lg border py-1.5 text-[11px] font-medium transition',
                            settings.qrLabelPos === pos
                              ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                              : 'border-glass-border text-white/40 hover:text-white')}>
                          {pos === 'above' ? '↑ Πάνω' : '↓ Κάτω'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-white/50">Χρώμα</span>
                      <input type="color" value={settings.qrLabelColor}
                        onChange={(e) => set('qrLabelColor', e.target.value)}
                        className="h-7 w-12 cursor-pointer rounded border border-glass-border bg-transparent" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-white/50">
                        <span>Μέγεθος</span><span className="font-mono">{settings.qrLabelSize}pt</span>
                      </div>
                      <input type="range" min={5} max={14} step={1} value={settings.qrLabelSize}
                        onChange={(e) => set('qrLabelSize', +e.target.value)}
                        className="w-full accent-brand-orange cursor-pointer" />
                    </div>
                    <div className="flex gap-2">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button key={align} type="button" onClick={() => set('qrLabelAlign', align)}
                          className={cn('flex-1 rounded-lg border py-1.5 text-[11px] transition',
                            settings.qrLabelAlign === align
                              ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                              : 'border-glass-border text-white/40 hover:text-white')}>
                          {align === 'left' ? '⬤ ←' : align === 'center' ? '→⬤←' : '→ ⬤'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── QR generating indicator ── */}
            {settings.showQr && generatingQr && (
              <div className="flex items-center gap-2 text-xs text-white/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Generating QR codes…</span>
              </div>
            )}

            {/* ── QR Validation & Auto-Fix panel ── */}
            {settings.showQr && !generatingQr && validationStats && (
              <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2.5">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <QrCode className="h-3.5 w-3.5 text-white/40 shrink-0" />
                  <p className="text-xs font-semibold text-white/60 uppercase tracking-wider flex-1">
                    Ψηφιακός Έλεγχος QR
                  </p>
                  {validationStats.pending > 0 && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30 shrink-0" />
                  )}
                  {validationStats.pending === 0 && validationStats.failed === 0 && (
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  )}
                  {validationStats.pending === 0 && validationStats.failed > 0 && (
                    <ShieldX className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  )}
                </div>

                {/* Status chips */}
                <div className="flex gap-1.5 flex-wrap">
                  {validationStats.verified > 0 && (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      <ShieldCheck className="h-3 w-3" />
                      {validationStats.verified} Ελέγχθηκε
                    </span>
                  )}
                  {validationStats.autoFixed > 0 && (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                      <Wrench className="h-3 w-3" />
                      {validationStats.autoFixed} Διορθώθηκε αυτόματα
                    </span>
                  )}
                  {validationStats.failed > 0 && (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                      <ShieldX className="h-3 w-3" />
                      {validationStats.failed} Αποτυχία
                    </span>
                  )}
                  {validationStats.pending > 0 && (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/5 text-white/40 border border-white/10">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {validationStats.pending} Σε εξέλιξη…
                    </span>
                  )}
                  {extraTranslateDone && validationStats.pending === 0 && (
                    <span className="text-[11px] px-2 py-1 rounded-lg bg-white/5 text-white/40 border border-white/10">
                      🇧🇬 🇺🇦 🇷🇴 🇷🇸 🇸🇰 🇵🇱 🇨🇿
                    </span>
                  )}
                </div>

                {/* Failure message */}
                {validationStats.failed > 0 && validationStats.pending === 0 && (
                  <p className="text-[11px] text-red-400 leading-relaxed border-t border-red-500/15 pt-2">
                    ⚠️ Μερικά QR δεν είναι αναγνώσιμα ακόμα και μετά την αυτόματη διόρθωση. Η εκτύπωση είναι κλειδωμένη μέχρι να επιλυθούν.
                  </p>
                )}

                {/* All-clear message */}
                {validationStats.failed === 0 && validationStats.pending === 0 && (
                  <p className="text-[11px] text-emerald-400/80 leading-relaxed border-t border-emerald-500/15 pt-2">
                    ✓ Όλα τα QR είναι εγγυημένα αναγνώσιμα — ασφαλής εκτύπωση!
                  </p>
                )}
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

            {/* ── Label cards (selection + preview combined) ── */}
            <div className="space-y-3">
              {/* Section header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/70">{t('menus.labels.selectItems')}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/50">
                    {selectedItems.length}/{allItems.length}
                  </span>
                </div>
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

              {/* Premium label card grid */}
              <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-0.5 rounded-xl">
                {allItems.map(({ item }) => (
                  <LabelCardPreview
                    key={item.id}
                    item={item}
                    recipe={item.recipe_id ? recipeMap.get(item.recipe_id) : undefined}
                    menu={menu}
                    settings={settings}
                    qrDataUrl={effectiveQrMap.get(item.id)}
                    shortCode={shortCodeMap.get(item.id)}
                    status={qrValidation.get(item.id)}
                    selected={selectedIds.has(item.id)}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}
              </div>
            </div>

            {/* Hidden iframe keeps the preview effect alive (srcdoc written but not displayed) */}
            <iframe ref={iframeRef} title="label-preview" className="sr-only" style={{ height: iframeH }} />

            {/* ── Print ── */}
            <div className="flex gap-2 pt-2">
              <Button type="button" leftIcon={<Printer className="h-4 w-4" />}
                onClick={handlePrint}
                disabled={selectedItems.length === 0 || hasFailedQr || (validationStats?.pending ?? 0) > 0}
                className="flex-1">
                {selectedItems.length === 0
                  ? t('menus.labels.noItems')
                  : hasFailedQr
                    ? '🔒 QR αποτυχία — κλειδωμένο'
                    : (validationStats?.pending ?? 0) > 0
                      ? 'Έλεγχος QR…'
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
