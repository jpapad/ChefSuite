import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { usePermissions } from '../../hooks/usePermissions'
import { findSection, isItemActive } from './navigation'

/** Pill tabs for the sub-pages of the section the current route belongs to. */
export function SectionTabs() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { can } = usePermissions()
  const section = findSection(pathname)
  const items = section?.items.filter((i) => can(i.module)) ?? []
  if (!section || items.length < 2) return null

  return (
    <nav
      aria-label={t(section.titleKey)}
      className="flex items-center gap-2 overflow-x-auto scrollbar-none px-4 sm:px-6 pb-1"
    >
      <span className="hidden lg:block shrink-0 pr-2 text-[13px] font-medium text-white/50">
        {t(section.titleKey)}
      </span>
      {items.map((item) => {
        const Icon = item.icon
        const active = isItemActive(item, pathname)
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={cn(
              'flex shrink-0 items-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition-colors',
              active
                ? 'bg-brand-orange text-on-accent'
                : 'bg-bg-card text-white/70 shadow-card hover:text-white',
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            {t(item.labelKey)}
          </NavLink>
        )
      })}
    </nav>
  )
}
