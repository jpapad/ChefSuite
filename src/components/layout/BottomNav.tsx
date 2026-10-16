import { NavLink } from 'react-router-dom'
import { Home, Menu, Monitor, ClipboardList, Package, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { usePermissions, type AppModule } from '../../hooks/usePermissions'

const ITEMS: { to: string; labelKey: string; fallback: string; icon: LucideIcon; end?: boolean; module?: AppModule }[] = [
  { to: '/',          labelKey: 'nav.home',             fallback: 'Home',     icon: Home, end: true },
  { to: '/kds',       labelKey: 'nav.sections.kitchenShort', fallback: 'Kitchen', icon: Monitor, module: 'kds' },
  { to: '/prep',      labelKey: 'nav.prep',             fallback: 'Prep',     icon: ClipboardList, module: 'prep' },
  { to: '/inventory', labelKey: 'nav.inventory',        fallback: 'Stock',    icon: Package, module: 'inventory' },
  { to: '/sections',  labelKey: 'station.menu',         fallback: 'Menu',     icon: Menu },
]

/** Black bottom bar on phones; everything not listed here is under "Menu". */
export function BottomNav() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const items = ITEMS.filter((i) => !i.module || can(i.module))

  return (
    <nav
      aria-label={t('nav.primary', 'Primary')}
      className="theme-dark md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#222] bg-black px-1.5 pt-1.5 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <ul className="flex">
        {items.map(({ to, labelKey, fallback, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded font-display text-[13px] font-bold uppercase tracking-[0.04em] transition-colors',
                  isActive ? 'bg-white-fixed text-ink' : 'text-[#A3A3A3] hover:text-white-fixed',
                )
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2.2} />
              <span className="max-w-full truncate px-1">{t(labelKey, fallback)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
