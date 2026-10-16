import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { usePermissions } from '../../hooks/usePermissions'
import { findSection, isItemActive } from './navigation'

/** Underlined tabs for the sub-pages of the section the current route belongs to. */
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
      className="flex min-h-[60px] items-stretch gap-1 overflow-x-auto scrollbar-none border-b-2 border-inv-border px-4 sm:px-6"
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = isItemActive(item, pathname)
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-4 px-3.5 font-display text-[17px] font-bold uppercase tracking-[0.03em] transition-colors',
              active ? 'border-signal text-white' : 'border-transparent text-white/60 hover:text-white',
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.2} />
            {t(item.labelKey)}
          </NavLink>
        )
      })}
    </nav>
  )
}
