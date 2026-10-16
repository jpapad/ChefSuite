import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { useClock } from '../../lib/useClock'
import { usePermissions } from '../../hooks/usePermissions'
import { NAV_SECTIONS, findSection } from './navigation'
import { BrandMark } from './BrandMark'
import { GlobalSearch } from './GlobalSearch'
import { NotificationsBell } from './NotificationsBell'

/** Sections that get a top-level tab; the rest live behind the ≡ button. */
const PRIMARY = ['home', 'kitchen', 'recipes', 'stock', 'team', 'finance']

const iconBase = 'flex h-12 w-12 shrink-0 items-center justify-center rounded border-2'
const iconBtn = `${iconBase} border-[#3A3A3A] text-white-fixed hover:border-white-fixed`
const iconBtnOn = `${iconBase} border-white-fixed bg-white-fixed text-ink`

/**
 * The black "Station Board" bar: brand, section tabs, search, alerts, a live
 * clock and the button to every section. Always dark, whatever the page theme.
 */
export function GlobalHeader() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { can } = usePermissions()
  const clock = useClock()
  const [searchOpen, setSearchOpen] = useState(false)
  const active = findSection(pathname)
  const onSections = pathname === '/sections'

  const tabs = NAV_SECTIONS
    .filter((s) => PRIMARY.includes(s.id))
    .map((s) => ({ section: s, first: s.items.find((i) => can(i.module)) }))
    .filter((x) => x.first)

  return (
    <header className="theme-dark sticky top-0 z-30 border-b border-[#222] bg-black">
      {searchOpen ? (
        <div className="flex items-center gap-3 px-4 py-3 sm:hidden">
          <GlobalSearch onClose={() => setSearchOpen(false)} />
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link to="/" aria-label="ChefSuite" className="mr-2 shrink-0">
            <BrandMark />
          </Link>

          <nav aria-label={t('nav.primary', 'Primary')} className="hidden min-w-0 items-center gap-0.5 xl:flex">
            {tabs.map(({ section, first }) => (
              <NavLink
                key={section.id}
                to={first!.to}
                end={first!.end}
                className={cn(
                  'flex h-11 shrink-0 items-center rounded px-3.5 font-display text-[17px] font-bold uppercase tracking-[0.04em] transition-colors',
                  active?.id === section.id ? 'bg-white-fixed text-ink' : 'text-[#D4D4D4] hover:text-white-fixed',
                )}
              >
                {t(section.shortKey)}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="hidden w-full max-w-sm sm:block">
            <GlobalSearch />
          </div>
          <button type="button" aria-label={t('common.search', 'Search')} onClick={() => setSearchOpen(true)} className={cn(iconBtn, 'sm:hidden')}>
            <Search className="h-5 w-5" strokeWidth={2.2} />
          </button>

          <NotificationsBell />

          <span className="hidden font-mono text-[30px] font-bold tabular-nums tracking-[-0.03em] text-white-fixed md:block" aria-label={clock}>
            {clock}
          </span>

          <Link
            to={onSections ? '/' : '/sections'}
            aria-label={onSections ? t('station.close', 'Close') : t('station.allSections', 'All sections')}
            className={onSections ? iconBtnOn : iconBtn}
          >
            {onSections ? <X className="h-5 w-5" strokeWidth={2.4} /> : <Menu className="h-5 w-5" strokeWidth={2.4} />}
          </Link>
        </div>
      )}
    </header>
  )
}
