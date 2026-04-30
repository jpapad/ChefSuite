import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag, Printer, Search, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import type { Recipe } from '../types/database.types'

type LabelLang = 'el' | 'en' | 'both'

const ALLERGEN_LABELS: Record<string, { el: string; en: string; emoji: string }> = {
  gluten:    { el: 'Γλουτένη',   en: 'Gluten',      emoji: '🌾' },
  dairy:     { el: 'Γαλακτ.',    en: 'Dairy',        emoji: '🥛' },
  eggs:      { el: 'Αυγά',       en: 'Eggs',         emoji: '🥚' },
  nuts:      { el: 'Ξηροί καρ.', en: 'Nuts',         emoji: '🥜' },
  shellfish: { el: 'Οστρακ.',    en: 'Shellfish',    emoji: '🦐' },
  fish:      { el: 'Ψάρι',       en: 'Fish',         emoji: '🐟' },
  soy:       { el: 'Σόγια',      en: 'Soy',          emoji: '🫘' },
  sesame:    { el: 'Σουσάμι',    en: 'Sesame',       emoji: '🌿' },
  celery:    { el: 'Σέλινο',     en: 'Celery',       emoji: '🌿' },
  mustard:   { el: 'Μουστάρδα',  en: 'Mustard',      emoji: '🌻' },
  lupin:     { el: 'Λούπινο',    en: 'Lupin',        emoji: '🌱' },
  sulphites: { el: 'Θειώδη',     en: 'Sulphites',    emoji: '🍷' },
  molluscs:  { el: 'Μαλάκια',    en: 'Molluscs',     emoji: '🦑' },
}

const PRESETS = [
  { key: 'small',  width: 50,  height: 35,  cols: 4 },
  { key: 'medium', width: 70,  height: 50,  cols: 3 },
  { key: 'large',  width: 100, height: 70,  cols: 2 },
  { key: 'a4',     width: 210, height: 297, cols: 1 },
]

export default function Labels() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const teamId = profile?.team_id

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [width, setWidth] = useState(70)
  const [height, setHeight] = useState(50)
  const [cols, setCols] = useState(3)
  const [showAllergens, setShowAllergens] = useState(true)
  const [showDesc, setShowDesc] = useState(false)
  const [lang, setLang] = useState<LabelLang>('el')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!teamId) return
    supabase
      .from('recipes')
      .select('id, title, description, allergens, category')
      .eq('team_id', teamId)
      .order('title')
      .then(({ data }) => {
        setRecipes((data ?? []) as Recipe[])
        setLoading(false)
      })
  }, [teamId])

  function toggleRecipe(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function applyPreset(p: typeof PRESETS[number]) {
    setWidth(p.width)
    setHeight(p.height)
    setCols(p.cols)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setLogoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handlePrint() {
    const printContent = printRef.current?.innerHTML
    if (!printContent) return

    const win = window.open('', '_blank')
    if (!win) return

    win.document.write(`<!DOCTYPE html><html><head><title>Kitchen Labels</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; color: #000; }
  .label-grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 4mm; padding: 8mm; }
  .label {
    width: ${width}mm; height: ${height}mm;
    border: 1px solid #ccc; border-radius: 3mm; padding: 3mm;
    display: flex; flex-direction: column; justify-content: space-between;
    overflow: hidden; page-break-inside: avoid;
  }
  .label-title { font-size: ${Math.max(8, Math.min(14, height * 0.22))}pt; font-weight: bold; line-height: 1.2; }
  .label-desc { font-size: ${Math.max(6, Math.min(9, height * 0.14))}pt; color: #555; margin-top: 1mm; line-height: 1.3; overflow: hidden; }
  .label-allergens { display: flex; flex-wrap: wrap; gap: 1mm; margin-top: auto; padding-top: 2mm; }
  .allergen { font-size: 7pt; background: #fee2e2; color: #991b1b; border-radius: 1mm; padding: 0.5mm 1.5mm; }
  .label-logo { max-height: ${Math.round(height * 0.25)}mm; max-width: 100%; object-fit: contain; margin-bottom: 1mm; }
  @media print { @page { margin: 5mm; } }
</style></head><body>
<div class="label-grid">${printContent}</div>
</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  const selectedRecipes = recipes.filter((r) => selected.has(r.id))
  const filteredRecipes = search
    ? recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : recipes

  function renderLabel(recipe: Recipe) {
    const name = lang === 'el' ? recipe.title : lang === 'en' ? (recipe.title) : recipe.title
    const allergens = (recipe.allergens ?? []).filter((a) => a in ALLERGEN_LABELS)

    return (
      <div
        key={recipe.id}
        style={{ width: `${Math.min(width * 3.78, 280)}px`, height: `${Math.min(height * 3.78, 200)}px` }}
        className="border border-white/20 rounded-xl p-3 flex flex-col justify-between glass"
      >
        {logoUrl && <img src={logoUrl} alt="logo" className="h-5 object-contain self-start mb-1" />}
        <div>
          <p className="font-bold text-sm leading-tight text-white line-clamp-2">{name}</p>
          {showDesc && recipe.description && (
            <p className="text-[10px] text-white/50 mt-0.5 line-clamp-2">{recipe.description}</p>
          )}
        </div>
        {showAllergens && allergens.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {allergens.slice(0, 6).map((a) => {
              const al = ALLERGEN_LABELS[a]
              return (
                <span key={a} className="text-[9px] bg-red-500/20 text-red-300 rounded px-1 py-0.5">
                  {al?.emoji} {lang === 'el' ? al?.el : lang === 'en' ? al?.en : `${al?.el}/${al?.en}`}
                </span>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Print-ready HTML labels
  function renderPrintLabel(recipe: Recipe): string {
    const allergens = (recipe.allergens ?? []).filter((a) => a in ALLERGEN_LABELS)
    const logoHtml = logoUrl ? `<img src="${logoUrl}" class="label-logo" />` : ''
    const descHtml = showDesc && recipe.description
      ? `<div class="label-desc">${recipe.description}</div>`
      : ''
    const allergensHtml = showAllergens && allergens.length > 0
      ? `<div class="label-allergens">${allergens.map((a) => {
          const al = ALLERGEN_LABELS[a]
          const label = lang === 'el' ? al?.el : lang === 'en' ? al?.en : `${al?.el}/${al?.en}`
          return `<span class="allergen">${al?.emoji ?? ''} ${label ?? a}</span>`
        }).join('')}</div>`
      : ''
    return `<div class="label">${logoHtml}<div class="label-title">${recipe.title}</div>${descHtml}${allergensHtml}</div>`
  }

  return (
    <div className="p-6 h-full flex gap-5">
      {/* Settings panel */}
      <div className="w-60 shrink-0 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange/15">
            <Tag className="h-4.5 w-4.5 text-brand-orange" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none">{t('kitchenLabels.title')}</h1>
            <p className="text-[11px] text-white/40 mt-0.5">{t('kitchenLabels.subtitle')}</p>
          </div>
        </div>

        <div className="glass gradient-border rounded-2xl p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Presets */}
          <div>
            <label className="block text-xs text-white/50 mb-2">{t('kitchenLabels.presets')}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                    width === p.width && height === p.height && cols === p.cols
                      ? 'bg-brand-orange/20 text-brand-orange'
                      : 'glass text-white/60 hover:text-white',
                  )}
                >
                  {t(`kitchenLabels.size${p.key.charAt(0).toUpperCase() + p.key.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-white/40 mb-1">{t('kitchenLabels.width')}</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full rounded-lg bg-white-fixed/55 border border-white/40 text-white text-xs px-2 py-1.5 outline-none focus:ring-1 focus:ring-brand-orange/40"
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/40 mb-1">{t('kitchenLabels.height')}</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full rounded-lg bg-white-fixed/55 border border-white/40 text-white text-xs px-2 py-1.5 outline-none focus:ring-1 focus:ring-brand-orange/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-white/40 mb-1">{t('kitchenLabels.columns')}</label>
            <input
              type="number"
              min={1} max={6}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
              className="w-full rounded-lg bg-white-fixed/55 border border-white/40 text-white text-xs px-2 py-1.5 outline-none focus:ring-1 focus:ring-brand-orange/40"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="block text-xs text-white/50">{t('kitchenLabels.content')}</label>
            {[
              { key: 'showAllergens', val: showAllergens, set: setShowAllergens },
              { key: 'showDescription', val: showDesc, set: setShowDesc },
            ].map(({ key, val, set }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => set(!val)}
                  className={cn(
                    'h-4 w-4 rounded flex items-center justify-center border transition-all cursor-pointer',
                    val ? 'bg-brand-orange border-brand-orange' : 'border-white/30',
                  )}
                >
                  {val && <Check className="h-2.5 w-2.5 text-white-fixed" />}
                </div>
                <span className="text-xs text-white/70">{t(`kitchenLabels.${key}`)}</span>
              </label>
            ))}
          </div>

          {/* Language */}
          <div>
            <label className="block text-[11px] text-white/40 mb-1.5">{t('kitchenLabels.language')}</label>
            <div className="flex gap-1.5">
              {(['el', 'en', 'both'] as LabelLang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                    lang === l ? 'bg-brand-orange text-white-fixed' : 'glass text-white/55 hover:text-white',
                  )}
                >
                  {t(`kitchenLabels.lang${l.charAt(0).toUpperCase() + l.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{t('kitchenLabels.logo')}</label>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            {logoUrl ? (
              <div className="flex items-center gap-2">
                <img src={logoUrl} alt="logo" className="h-8 object-contain rounded" />
                <button type="button" onClick={() => setLogoUrl(null)} className="text-xs text-white/40 hover:text-white/70">
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full glass rounded-lg px-3 py-2 text-xs text-white/50 hover:text-white/80 transition border border-dashed border-white/20 hover:border-white/40"
              >
                {t('kitchenLabels.logoHint')}
              </button>
            )}
          </div>
        </div>

        {/* Print button */}
        <Button
          onClick={handlePrint}
          disabled={selected.size === 0}
          className="w-full gap-2"
        >
          <Printer className="h-4 w-4" />
          {selected.size > 0
            ? t('kitchenLabels.print', { count: selected.size })
            : t('kitchenLabels.print', { count: 0 })}
        </Button>
      </div>

      {/* Recipe selection + preview */}
      <div className="flex-1 flex gap-4 min-w-0">
        {/* Recipe list */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">
              {t('kitchenLabels.selectRecipes')}
              {selected.size > 0 && (
                <span className="ml-2 text-xs text-brand-orange">
                  {t('kitchenLabels.selected_other', { count: selected.size })}
                </span>
              )}
            </span>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-white/40 hover:text-white/70">
                ✕ Clear
              </button>
            )}
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t('nav.search')}`}
              className="w-full rounded-xl bg-white-fixed/55 border border-white/50 text-white text-sm pl-9 pr-3 py-2 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/40"
            />
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="glass rounded-xl h-12 animate-pulse" />)}
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-white/40 text-sm">{t('kitchenLabels.noRecipes')}</div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {filteredRecipes.map((r) => {
                const isSelected = selected.has(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRecipe(r.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                      isSelected
                        ? 'bg-brand-orange/15 border border-brand-orange/40 text-white'
                        : 'glass text-white/70 hover:text-white',
                    )}
                  >
                    <div className={cn(
                      'h-4 w-4 rounded flex items-center justify-center border shrink-0 transition-all',
                      isSelected ? 'bg-brand-orange border-brand-orange' : 'border-white/30',
                    )}>
                      {isSelected && <Check className="h-2.5 w-2.5 text-white-fixed" />}
                    </div>
                    <span className="text-sm font-medium truncate">{r.title}</span>
                    {(r.allergens ?? []).length > 0 && (
                      <span className="ml-auto text-[10px] text-white/30 shrink-0">
                        {(r.allergens ?? []).length} allergens
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="w-64 shrink-0 flex flex-col">
          <div className="text-sm font-semibold mb-3">
            {t('kitchenLabels.preview')}
            {selectedRecipes.length > 3 && (
              <span className="ml-2 text-xs text-white/40">{t('kitchenLabels.previewHint')}</span>
            )}
          </div>
          <div className="glass gradient-border rounded-2xl p-4 flex-1 flex flex-col gap-3 overflow-y-auto">
            {selectedRecipes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                <Tag className="h-10 w-10 text-white/15" />
                <p className="text-xs text-white/30">{t('kitchenLabels.previewEmpty')}</p>
              </div>
            ) : (
              selectedRecipes.slice(0, 3).map((r) => renderLabel(r))
            )}
          </div>
        </div>
      </div>

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          {selectedRecipes.map((r) => (
            <span key={r.id} dangerouslySetInnerHTML={{ __html: renderPrintLabel(r) }} />
          ))}
        </div>
      </div>
    </div>
  )
}
