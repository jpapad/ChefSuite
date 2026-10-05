import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, X, LayoutTemplate, UtensilsCrossed } from 'lucide-react'
import { fetchPublicMenu } from '../hooks/useMenus'
import { recordScan } from '../hooks/useMenuScans'
import type { MenuWithSections, MenuItemTag, PrintTemplate } from '../types/database.types'


const TAG_EMOJI: Record<MenuItemTag, string> = {
  vegan: '🌱', vegetarian: '🥦', gluten_free: '🌾', spicy: '🌶️', chefs_pick: '⭐',
}

// ── Language helpers ─────────────────────────────────────────────────────────
type Lang = 'en' | 'el' | 'bg'

function detectBrowserLang(): Lang {
  const l = navigator.language.toLowerCase()
  if (l.startsWith('el')) return 'el'
  if (l.startsWith('bg')) return 'bg'
  return 'en'
}

function localName(item: { name: string; name_el?: string | null; name_bg?: string | null }, lang: Lang) {
  if (lang === 'en' && item.name_el) return item.name_el  // name_el stores English translation
  if (lang === 'bg' && item.name_bg) return item.name_bg
  return item.name  // 'el' falls through to Greek original
}

function localDesc(item: { description?: string | null; description_el?: string | null; description_bg?: string | null }, lang: Lang) {
  if (lang === 'en' && item.description_el) return item.description_el
  if (lang === 'bg' && item.description_bg) return item.description_bg
  return item.description ?? null
}



// ── Template: Classic ────────────────────────────────────────────────────────
function ClassicTemplate({ menu, filterTag, lang }: { menu: MenuWithSections; filterTag: MenuItemTag | null; lang: Lang }) {
  return (
    <div className="font-serif max-w-2xl mx-auto px-6 py-10 print:px-0 print:py-0 space-y-10 text-gray-900">
      <div className="text-center space-y-2 border-b-2 border-gray-900 pb-6">
        {menu.logo_url && <img src={menu.logo_url} alt="logo" className="h-16 mx-auto mb-2 object-contain" />}
        <h1 className="text-4xl font-bold tracking-wide">{localName(menu, lang)}</h1>
        <p className="text-gray-500 italic text-lg">{menu.description}</p>
        {menu.price_per_person != null && <p className="text-gray-700 font-semibold">€{menu.price_per_person.toFixed(2)} p.p.</p>}
      </div>
      {menu.sections.map((section) => {
        const items = filterTag ? section.items.filter((i) => (i.tags ?? []).includes(filterTag)) : section.items
        if (filterTag && items.length === 0) return null
        return (
          <div key={section.id} className="space-y-4">
            <h2 className="text-center text-sm font-bold uppercase tracking-[0.3em] text-gray-600">── {localName(section, lang)} ──</h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {items.map((item) => {
                const desc = localDesc(item, lang)
                return (
                  <div key={item.id} className="flex items-baseline justify-between gap-2 border-b border-gray-200 pb-2">
                    <div className="min-w-0">
                      <span className="font-semibold">{localName(item, lang)}</span>
                      {(item.tags ?? []).map((tag) => <span key={tag} className="ml-1 text-xs">{TAG_EMOJI[tag]}</span>)}
                      {desc && <p className="text-xs text-gray-500 mt-0.5 italic">{desc}</p>}
                    </div>
                    {menu.show_prices && item.price != null && (
                      <span className="shrink-0 font-bold tabular-nums ml-2">€{item.price.toFixed(2)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {menu.custom_footer && <p className="text-center text-xs text-gray-400 border-t border-gray-200 pt-4">{menu.custom_footer}</p>}
    </div>
  )
}

// ── Template: Modern (bento) ─────────────────────────────────────────────────
function ModernTemplate({ menu, filterTag, lang }: { menu: MenuWithSections; filterTag: MenuItemTag | null; lang: Lang }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-3 py-3 font-sans text-ink sm:py-6 print:max-w-none print:px-0 print:py-0">
      <header className="rounded-[2rem] bg-ink px-6 pb-8 pt-6 text-white-fixed print:rounded-none">
        {menu.logo_url && <img src={menu.logo_url} alt="logo" className="mb-6 h-12 object-contain" />}
        <h1 className="text-5xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-6xl">{localName(menu, lang)}</h1>
        {menu.description && <p className="mt-3 max-w-lg text-white-fixed/60">{menu.description}</p>}
        {menu.price_per_person != null && (
          <span className="mt-6 inline-flex items-baseline gap-1.5 rounded-full bg-lime px-4 py-1.5 text-ink">
            <span className="text-lg font-semibold tabular-nums">€{menu.price_per_person.toFixed(2)}</span>
            <span className="text-xs">p.p.</span>
          </span>
        )}
      </header>

      {menu.sections.map((section) => {
        const items = filterTag ? section.items.filter((i) => (i.tags ?? []).includes(filterTag)) : section.items
        if (filterTag && items.length === 0) return null
        return (
          <section key={section.id} className="break-inside-avoid rounded-3xl bg-white-fixed p-5 shadow-[0_1px_2px_rgba(15,18,16,0.05),0_10px_30px_-18px_rgba(15,18,16,0.25)] sm:p-6">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-2xl font-medium tracking-[-0.02em]">{localName(section, lang)}</h2>
              <span className="text-xs tabular-nums text-ink/40">{items.length}</span>
            </div>
            <ul className="divide-y divide-ink/[0.07]">
              {items.map((item) => {
                const desc = localDesc(item, lang)
                const tags = item.tags ?? []
                return (
                  <li key={item.id} className="flex items-start gap-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-medium leading-snug">{localName(item, lang)}</p>
                      {desc && <p className="mt-0.5 text-sm leading-snug text-ink/55">{desc}</p>}
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span key={tag} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tag === 'chefs_pick' ? 'bg-ink text-lime' : 'bg-[#EAEBE6] text-ink/70'}`}>
                              {t(`menus.tags.${tag}`, { lng: lang })}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {menu.show_prices && item.price != null && (
                      <span className="shrink-0 rounded-full bg-[#F1F2EE] px-3 py-1 text-[15px] font-semibold tabular-nums">€{item.price.toFixed(2)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {menu.custom_footer && <p className="px-4 py-2 text-center text-sm text-ink/45">{menu.custom_footer}</p>}
    </div>
  )
}

// ── Template: Elegant ────────────────────────────────────────────────────────
function ElegantTemplate({ menu, filterTag, lang }: { menu: MenuWithSections; filterTag: MenuItemTag | null; lang: Lang }) {
  return (
    <div className="font-serif max-w-xl mx-auto px-8 py-10 print:px-8 print:py-10 text-center"
      style={{ background: '#faf7f2', color: '#3d2b1f', minHeight: '100vh' }}>
      <div className="border-4 border-double p-8 space-y-8" style={{ borderColor: '#8b6f47' }}>
        <div className="space-y-3">
          {menu.logo_url && <img src={menu.logo_url} alt="logo" className="h-16 mx-auto object-contain" />}
          <div style={{ color: '#8b6f47', fontSize: '0.7rem', letterSpacing: '0.4em' }}>{'✦ ✦ ✦'}</div>
          <h1 className="text-3xl font-bold" style={{ color: '#3d2b1f', letterSpacing: '0.05em' }}>{localName(menu, lang)}</h1>
          {menu.description && <p className="italic text-sm" style={{ color: '#8b6f47' }}>{menu.description}</p>}
          {menu.price_per_person != null && <p className="font-semibold text-sm" style={{ color: '#3d2b1f' }}>€{menu.price_per_person.toFixed(2)} per person</p>}
          <div style={{ color: '#8b6f47', fontSize: '0.7rem', letterSpacing: '0.4em' }}>{'✦ ✦ ✦'}</div>
        </div>
        {menu.sections.map((section, sIdx) => {
          const items = filterTag ? section.items.filter((i) => (i.tags ?? []).includes(filterTag)) : section.items
          if (filterTag && items.length === 0) return null
          return (
            <div key={section.id} className="space-y-4">
              {sIdx > 0 && <div style={{ borderTop: '1px solid #c9a96e', margin: '0 2rem' }} />}
              <h2 className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: '#8b6f47' }}>{localName(section, lang)}</h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const desc = localDesc(item, lang)
                  return (
                    <div key={item.id} className="space-y-0.5">
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="font-semibold">{localName(item, lang)}</span>
                        {(item.tags ?? []).map((tag) => <span key={tag} className="text-xs">{TAG_EMOJI[tag]}</span>)}
                        {menu.show_prices && item.price != null && (
                          <span className="font-semibold tabular-nums" style={{ color: '#8b6f47' }}>— €{item.price.toFixed(2)}</span>
                        )}
                      </div>
                      {desc && <p className="text-xs italic" style={{ color: '#8b6f47' }}>{desc}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {menu.custom_footer && <p className="text-xs italic" style={{ color: '#8b6f47', borderTop: '1px solid #c9a96e', paddingTop: '1rem' }}>{menu.custom_footer}</p>}
        <div style={{ color: '#8b6f47', fontSize: '0.7rem', letterSpacing: '0.4em' }}>{'✦ ✦ ✦'}</div>
      </div>
    </div>
  )
}

// ── Main page (exported for reuse in MenuToday) ──────────────────────────────
export function MenuPublicContent({ menuId }: { menuId: string | undefined }) {
  const id = menuId
  const { t } = useTranslation()
  const [menu, setMenu] = useState<MenuWithSections | null | undefined>(undefined)
  const [activeFilterTag, setActiveFilterTag] = useState<MenuItemTag | null>(null)
  const [template, setTemplate] = useState<PrintTemplate>('classic')
  const [showTemplateBar, setShowTemplateBar] = useState(false)
  const [lang, setLang] = useState<Lang>(detectBrowserLang)

  useEffect(() => {
    if (!id) { setMenu(null); return }
    fetchPublicMenu(id).then((m) => {
      setMenu(m)
      if (m?.print_template) setTemplate(m.print_template)
    })
    recordScan(id)
  }, [id])

  const hasTags = useMemo(() => {
    if (!menu) return false
    return menu.sections.some((s) => s.items.some((i) => (i.tags ?? []).length > 0))
  }, [menu])


  if (menu === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F1F2EE]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60" />
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F1F2EE] p-4 text-ink">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-[2rem] bg-white-fixed p-8 text-center shadow-[0_10px_30px_-18px_rgba(15,18,16,0.25)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime">
            <UtensilsCrossed className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">{t('menus.public.notFound')}</h1>
          <p className="text-sm text-ink/55">{t('menus.public.notFoundHint')}</p>
        </div>
      </div>
    )
  }

  const templateBg = template === 'elegant' ? '#faf7f2' : template === 'modern' ? '#F1F2EE' : '#ffffff'
  const filterTags = hasTags
    ? (['vegan', 'vegetarian', 'gluten_free', 'spicy'] as MenuItemTag[]).filter((tag) =>
        menu.sections.some((s) => s.items.some((i) => (i.tags ?? []).includes(tag))))
    : []
  const pill = (on: boolean) => `h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition ${on ? 'bg-ink text-white-fixed' : 'text-ink/60 hover:text-ink'}`

  return (
    <div className="min-h-screen text-ink" style={{ background: templateBg }}>
      {/* Floating toolbar */}
      <div className="sticky top-0 z-20 px-3 pt-3 print:hidden">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-[1.75rem] bg-white-fixed/90 p-1.5 shadow-[0_1px_2px_rgba(15,18,16,0.06),0_12px_32px_-16px_rgba(15,18,16,0.3)] backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime text-[11px] font-bold">CS</span>
            <span className="min-w-0 flex-1 truncate px-1 text-sm font-medium">{localName(menu, lang)}</span>

            <div className="flex rounded-full bg-[#EAEBE6] p-0.5">
              {(['el', 'en', 'bg'] as Lang[]).map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)}
                  title={l === 'el' ? 'Ελληνικά' : l === 'en' ? 'English' : 'Български'}
                  className={`h-8 rounded-full px-2.5 text-xs font-semibold uppercase transition ${lang === l ? 'bg-white-fixed text-ink shadow-sm' : 'text-ink/50 hover:text-ink'}`}>
                  {l}
                </button>
              ))}
            </div>

            <button type="button" onClick={() => setShowTemplateBar((v) => !v)} title={t('menus.public.switchTemplate')}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${showTemplateBar ? 'bg-ink text-white-fixed' : 'hover:bg-[#EAEBE6]'}`}>
              <LayoutTemplate className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => window.print()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[#EAEBE6]">
              <Printer className="h-4 w-4" />
            </button>
          </div>

          {(filterTags.length > 0 || showTemplateBar) && (
            <div className="flex items-center gap-1 overflow-x-auto">
              {showTemplateBar
                ? (['classic', 'modern', 'elegant'] as PrintTemplate[]).map((tmpl) => (
                    <button key={tmpl} type="button" onClick={() => { setTemplate(tmpl); setShowTemplateBar(false) }} className={pill(template === tmpl)}>
                      {t(`menus.print.${tmpl}`)}
                    </button>
                  ))
                : filterTags.map((tag) => {
                    const active = activeFilterTag === tag
                    return (
                      <button key={tag} type="button" onClick={() => setActiveFilterTag(active ? null : tag)}
                        className={`${pill(active)} inline-flex items-center gap-1`}>
                        {t(`menus.tags.${tag}`, { lng: lang })}{active && <X className="h-3.5 w-3.5" />}
                      </button>
                    )
                  })}
            </div>
          )}
        </div>
      </div>

      <div className="pb-6">
        {template === 'classic' && <ClassicTemplate menu={menu} filterTag={activeFilterTag} lang={lang} />}
        {template === 'modern' && <ModernTemplate menu={menu} filterTag={activeFilterTag} lang={lang} />}
        {template === 'elegant' && <ElegantTemplate menu={menu} filterTag={activeFilterTag} lang={lang} />}
      </div>

      <style>{`
        @media print {
          @page { margin: 15mm; }
          nav, header, footer { display: none !important; }
        }
      `}</style>
    </div>
  )
}

export default function MenuPublic() {
  const { id } = useParams<{ id: string }>()
  return <MenuPublicContent menuId={id} />
}
