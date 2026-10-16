import { useEffect, useRef, useState } from 'react'
import { Search, ChefHat, Package, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRecipes } from '../../hooks/useRecipes'
import { useInventory } from '../../hooks/useInventory'

interface Result {
  id: string
  label: string
  sub: string
  icon: 'recipe' | 'inventory'
  to: string
  param: string
}

interface GlobalSearchProps {
  onClose?: () => void
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const { recipes } = useRecipes()
  const { items } = useInventory()

  const q = query.trim().toLowerCase()
  const results: Result[] = q
    ? [
        ...recipes
          .filter((r) => r.title.toLowerCase().includes(q))
          .slice(0, 4)
          .map((r) => ({
            id: `r-${r.id}`,
            label: r.title,
            sub: r.description ?? '',
            icon: 'recipe' as const,
            to: '/recipes',
            param: r.title,
          })),
        ...items
          .filter((i) => i.name.toLowerCase().includes(q))
          .slice(0, 4)
          .map((i) => ({
            id: `i-${i.id}`,
            label: i.name,
            sub: `${i.quantity} ${i.unit}`,
            icon: 'inventory' as const,
            to: '/inventory',
            param: i.name,
          })),
      ]
    : []

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Only the mobile overlay (which has a close button) grabs focus; the
  // always-visible desktop field must not steal it on every page load.
  useEffect(() => {
    if (onClose) inputRef.current?.focus()
  }, [onClose])

  function onSelect(result: Result) {
    navigate(`${result.to}?q=${encodeURIComponent(result.param)}`)
    setQuery('')
    setOpen(false)
    onClose?.()
  }

  function clear() {
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl">
      <div className="flex items-center gap-3 rounded border-2 border-[#3A3A3A] bg-bg-card px-4 min-h-[48px] focus-within:border-signal">
        <Search className="h-5 w-5 text-white/70 shrink-0" strokeWidth={2.2} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query && setOpen(true)}
          placeholder={t('station.searchPlaceholder', 'Find a recipe or ingredient')}
          aria-label={t('common.search', 'Search')}
          className="flex-1 min-w-0 bg-transparent outline-none text-base text-white placeholder:text-white/50"
        />
        {query ? (
          <button type="button" onClick={clear} className="text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        ) : onClose ? (
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 top-full mt-2 w-full glass-strong border border-glass-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <ul className="divide-y divide-glass-border">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
                    {r.icon === 'recipe' ? <ChefHat className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.label}</div>
                    <div className="text-xs text-white/50 truncate">{r.sub}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && q && results.length === 0 && (
        <div className="absolute left-0 top-full mt-2 w-full glass-strong border border-glass-border rounded-2xl shadow-xl z-50 px-4 py-6 text-center">
          <p className="text-sm text-white/60">{t('station.noResults', { q: query, defaultValue: 'No results for "{{q}}"' })}</p>
        </div>
      )}
    </div>
  )
}
