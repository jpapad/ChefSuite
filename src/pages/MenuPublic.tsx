import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Flame, Printer, X, LayoutTemplate, ShoppingCart, Plus, Minus, CalendarCheck } from 'lucide-react'
import { fetchPublicMenu } from '../hooks/useMenus'
import { recordScan } from '../hooks/useMenuScans'
import { placeOrder } from '../hooks/useOnlineOrders'
import type { MenuWithSections, MenuItemTag, PrintTemplate, MenuItem } from '../types/database.types'

// ── Tag styles ───────────────────────────────────────────────────────────────
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

// ── Language helpers ─────────────────────────────────────────────────────────
function useBrowserLang() { return navigator.language.startsWith('el') }
function localName(item: { name: string; name_el?: string | null }, isEl: boolean) {
  return (isEl && item.name_el) ? item.name_el : item.name
}
function localDesc(item: { description?: string | null; description_el?: string | null }, isEl: boolean) {
  return (isEl && item.description_el) ? item.description_el : (item.description ?? null)
}

// ── Cart types ───────────────────────────────────────────────────────────────
interface CartItem { item: MenuItem; qty: number }

// ── Template: Classic ────────────────────────────────────────────────────────
function ClassicTemplate({ menu, filterTag }: { menu: MenuWithSections; filterTag: MenuItemTag | null }) {
  const isEl = useBrowserLang()
  return (
    <div className="font-serif max-w-2xl mx-auto px-6 py-10 print:px-0 print:py-0 space-y-10 text-gray-900">
      <div className="text-center space-y-2 border-b-2 border-gray-900 pb-6">
        {menu.logo_url && <img src={menu.logo_url} alt="logo" className="h-16 mx-auto mb-2 object-contain" />}
        <h1 className="text-4xl font-bold tracking-wide">{menu.name}</h1>
        <p className="text-gray-500 italic text-lg">{menu.description}</p>
        {menu.price_per_person != null && <p className="text-gray-700 font-semibold">€{menu.price_per_person.toFixed(2)} p.p.</p>}
      </div>
      {menu.sections.map((section) => {
        const items = filterTag ? section.items.filter((i) => (i.tags ?? []).includes(filterTag)) : section.items
        if (filterTag && items.length === 0) return null
        return (
          <div key={section.id} className="space-y-4">
            <h2 className="text-center text-sm font-bold uppercase tracking-[0.3em] text-gray-600">── {section.name} ──</h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {items.map((item) => {
                const desc = localDesc(item, isEl)
                return (
                  <div key={item.id} className="flex items-baseline justify-between gap-2 border-b border-gray-200 pb-2">
                    <div className="min-w-0">
                      <span className="font-semibold">{localName(item, isEl)}</span>
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

// ── Template: Modern ─────────────────────────────────────────────────────────
function ModernTemplate({ menu, filterTag }: { menu: MenuWithSections; filterTag: MenuItemTag | null }) {
  const isEl = useBrowserLang()
  return (
    <div className="font-sans max-w-2xl mx-auto px-6 py-10 print:px-0 print:py-0 space-y-8 text-white bg-neutral-950 print:text-gray-900 print:bg-white">
      <div className="space-y-1">
        {menu.logo_url && <img src={menu.logo_url} alt="logo" className="h-12 mb-3 object-contain" />}
        <h1 className="text-5xl font-black tracking-tight text-white print:text-gray-900">{menu.name}</h1>
        {menu.description && <p className="text-white/60 print:text-gray-500">{menu.description}</p>}
        {menu.price_per_person != null && <p className="text-brand-orange font-bold print:text-orange-600">€{menu.price_per_person.toFixed(2)} p.p.</p>}
      </div>
      {menu.sections.map((section) => {
        const items = filterTag ? section.items.filter((i) => (i.tags ?? []).includes(filterTag)) : section.items
        if (filterTag && items.length === 0) return null
        return (
          <div key={section.id} className="space-y-3">
            <div className="bg-white/10 print:bg-gray-900 px-4 py-2 rounded-xl print:rounded-none">
              <h2 className="text-xs font-black uppercase tracking-[0.25em] text-white/70 print:text-white">{section.name}</h2>
            </div>
            <div className="space-y-2 px-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 flex items-baseline gap-2">
                    <span className="font-semibold">{localName(item, isEl)}</span>
                    {(item.tags ?? []).map((tag) => <span key={tag} className="text-xs">{TAG_EMOJI[tag]}</span>)}
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0 min-w-[4rem]">
                    <span className="flex-1 border-b border-dotted border-white/20 print:border-gray-400 h-px self-center mx-1" />
                    {menu.show_prices && item.price != null && (
                      <span className="font-black text-brand-orange print:text-orange-600 tabular-nums">€{item.price.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {menu.custom_footer && <p className="text-xs text-white/30 print:text-gray-400 pt-2 border-t border-white/10 print:border-gray-200">{menu.custom_footer}</p>}
    </div>
  )
}

// ── Template: Elegant ────────────────────────────────────────────────────────
function ElegantTemplate({ menu, filterTag }: { menu: MenuWithSections; filterTag: MenuItemTag | null }) {
  const isEl = useBrowserLang()
  return (
    <div className="font-serif max-w-xl mx-auto px-8 py-10 print:px-8 print:py-10 text-center"
      style={{ background: '#faf7f2', color: '#3d2b1f', minHeight: '100vh' }}>
      <div className="border-4 border-double p-8 space-y-8" style={{ borderColor: '#8b6f47' }}>
        <div className="space-y-3">
          {menu.logo_url && <img src={menu.logo_url} alt="logo" className="h-16 mx-auto object-contain" />}
          <div style={{ color: '#8b6f47', fontSize: '0.7rem', letterSpacing: '0.4em' }}>{'✦ ✦ ✦'}</div>
          <h1 className="text-3xl font-bold" style={{ color: '#3d2b1f', letterSpacing: '0.05em' }}>{menu.name}</h1>
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
              <h2 className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: '#8b6f47' }}>{section.name}</h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const desc = localDesc(item, isEl)
                  return (
                    <div key={item.id} className="space-y-0.5">
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="font-semibold">{localName(item, isEl)}</span>
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

// ── Cart Drawer ───────────────────────────────────────────────────────────────
function CartDrawer({
  menu, cart, open, onClose, onQtyChange, onClear,
}: {
  menu: MenuWithSections
  cart: CartItem[]
  open: boolean
  onClose: () => void
  onQtyChange: (itemId: string, delta: number) => void
  onClear: () => void
}) {
  const isEl = useBrowserLang()
  const [tableRef, setTableRef] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const total = cart.reduce((s, c) => s + (c.item.price ?? 0) * c.qty, 0)

  async function handleOrder() {
    if (cart.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await placeOrder({
        team_id: menu.team_id,
        menu_id: menu.id,
        table_ref: tableRef.trim() || null,
        customer_name: customerName.trim() || null,
        customer_notes: customerNotes.trim() || null,
        items: cart.map((c) => ({
          menu_item_id: c.item.id,
          name: localName(c.item, isEl),
          price: c.item.price,
          quantity: c.qty,
          notes: null,
        })),
      })
      setDone(true)
      onClear()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="print:hidden fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-neutral-900 border-l border-white/10 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold text-white text-lg">Your Order</h2>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold text-white">Order placed!</h3>
            <p className="text-white/60 text-sm">Your order has been sent to the kitchen.</p>
            <button type="button" onClick={() => { setDone(false); onClose() }}
              className="mt-2 rounded-xl bg-brand-orange text-white-fixed px-6 py-2.5 font-semibold hover:bg-brand-orange/90 transition">
              Close
            </button>
          </div>
        ) : (
          <>
            {/* All menu items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {menu.sections.flatMap((s) => s.items.filter((i) => i.available)).map((item) => {
                const cartItem = cart.find((c) => c.item.id === item.id)
                const qty = cartItem?.qty ?? 0
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{localName(item, isEl)}</p>
                      {item.price != null && <p className="text-xs text-white/50">€{item.price.toFixed(2)}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {qty > 0 && (
                        <button type="button" onClick={() => onQtyChange(item.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {qty > 0 && <span className="text-white font-semibold w-5 text-center text-sm">{qty}</span>}
                      <button type="button" onClick={() => onQtyChange(item.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/80 text-white hover:bg-brand-orange transition">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">{cart.reduce((s, c) => s + c.qty, 0)} items</span>
                  {total > 0 && <span className="font-bold text-white">€{total.toFixed(2)}</span>}
                </div>

                <input
                  type="text"
                  placeholder="Table number (optional)"
                  value={tableRef}
                  onChange={(e) => setTableRef(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                />
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                />
                <textarea
                  rows={2}
                  placeholder="Special requests…"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                />

                {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

                <button type="button" onClick={() => void handleOrder()} disabled={submitting}
                  className="w-full rounded-xl bg-brand-orange text-white-fixed font-semibold py-3 hover:bg-brand-orange/90 transition disabled:opacity-60">
                  {submitting ? 'Placing order…' : 'Place Order'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MenuPublic() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [menu, setMenu] = useState<MenuWithSections | null | undefined>(undefined)
  const [activeFilterTag, setActiveFilterTag] = useState<MenuItemTag | null>(null)
  const [template, setTemplate] = useState<PrintTemplate>('classic')
  const [showTemplateBar, setShowTemplateBar] = useState(false)

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

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

  function onQtyChange(itemId: string, delta: number) {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === itemId)
      if (!existing) {
        const item = menu?.sections.flatMap((s) => s.items).find((i) => i.id === itemId)
        if (!item) return prev
        return [...prev, { item, qty: 1 }]
      }
      const newQty = existing.qty + delta
      if (newQty <= 0) return prev.filter((c) => c.item.id !== itemId)
      return prev.map((c) => c.item.id === itemId ? { ...c, qty: newQty } : c)
    })
  }

  if (menu === undefined) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-white/50">{t('common.loading')}</p>
      </div>
    )
  }

  if (!menu) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
          <Flame className="h-7 w-7 text-brand-orange" />
        </div>
        <h1 className="text-2xl font-semibold text-white">{t('menus.public.notFound')}</h1>
        <p className="text-white/50 max-w-xs">{t('menus.public.notFoundHint')}</p>
      </div>
    )
  }

  const templateBg = template === 'elegant' ? '#faf7f2' : template === 'modern' ? '#0a0a0a' : '#ffffff'

  return (
    <div className="min-h-screen" style={{ background: templateBg }}>
      {/* Top toolbar */}
      <div className="print:hidden sticky top-0 z-20 bg-neutral-900/90 backdrop-blur-md border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange">
            <Flame className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm truncate max-w-[120px]">{menu.name}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasTags && (['vegan', 'vegetarian', 'gluten_free'] as MenuItemTag[]).map((tag) => {
            const hasItems = menu.sections.some((s) => s.items.some((i) => (i.tags ?? []).includes(tag)))
            if (!hasItems) return null
            const active = activeFilterTag === tag
            return (
              <button key={tag} type="button"
                onClick={() => setActiveFilterTag(active ? null : tag)}
                className={`hidden sm:flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${
                  active ? 'border-brand-orange bg-brand-orange/20 text-brand-orange' : 'border-white/20 text-white/60 hover:text-white'
                }`}>
                {TAG_EMOJI[tag]}{active && <X className="h-3 w-3 ml-0.5" />}
              </button>
            )
          })}

          <button type="button" onClick={() => setShowTemplateBar((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-white/20 text-white/60 hover:text-white px-2.5 py-1.5 text-xs font-medium transition">
            <LayoutTemplate className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('menus.public.switchTemplate')}</span>
          </button>

          <button type="button" onClick={() => window.print()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-white/60 hover:text-white transition">
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showTemplateBar && (
        <div className="print:hidden bg-neutral-900 border-b border-white/10 px-4 py-3 flex items-center gap-2 flex-wrap">
          {(['classic', 'modern', 'elegant'] as PrintTemplate[]).map((tmpl) => (
            <button key={tmpl} type="button" onClick={() => { setTemplate(tmpl); setShowTemplateBar(false) }}
              className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition ${
                template === tmpl ? 'bg-brand-orange border-brand-orange text-white-fixed' : 'border-white/20 text-white/60 hover:text-white hover:bg-white/5'
              }`}>
              {t(`menus.print.${tmpl}`)}
            </button>
          ))}
        </div>
      )}

      <div className="pb-28">
        {template === 'classic' && <ClassicTemplate menu={menu} filterTag={activeFilterTag} />}
        {template === 'modern' && <ModernTemplate menu={menu} filterTag={activeFilterTag} />}
        {template === 'elegant' && <ElegantTemplate menu={menu} filterTag={activeFilterTag} />}
      </div>

      {/* Bottom action bar */}
      <div className="print:hidden fixed bottom-0 inset-x-0 z-30 bg-neutral-900/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <Link to={`/reserve/${id}`}
          className="flex items-center gap-2 rounded-xl border border-white/20 text-white/70 hover:text-white px-4 py-2.5 text-sm font-medium transition hover:bg-white/5">
          <CalendarCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Book a Table</span>
        </Link>

        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="relative flex items-center gap-2 rounded-xl bg-brand-orange text-white-fixed px-5 py-2.5 text-sm font-semibold hover:bg-brand-orange/90 transition ml-auto"
        >
          <ShoppingCart className="h-4 w-4" />
          Order Now
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-orange text-xs font-black">
              {cartCount}
            </span>
          )}
        </button>

        <p className="text-xs text-white/20 ml-3 hidden sm:block">{t('menus.public.poweredBy')}</p>
      </div>

      {/* Cart drawer */}
      <CartDrawer
        menu={menu}
        cart={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onQtyChange={onQtyChange}
        onClear={() => setCart([])}
      />

      <style>{`
        @media print {
          @page { margin: 15mm; }
          nav, header, footer { display: none !important; }
        }
      `}</style>
    </div>
  )
}
