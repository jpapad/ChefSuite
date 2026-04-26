import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ChefHat,
  Package,
  ClipboardList,
  MessageSquare,
} from 'lucide-react'
import { cn } from '../../lib/cn'

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/recipes', label: 'Recipes', icon: ChefHat },
  { to: '/inventory', label: 'Stock', icon: Package },
  { to: '/prep', label: 'Prep', icon: ClipboardList },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'md:hidden fixed bottom-0 inset-x-0 z-20',
        'glass-strong border-t border-glass-border',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="grid grid-cols-5">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1',
                  'min-h-touch-target py-2 text-xs font-medium transition',
                  isActive
                    ? 'text-brand-orange'
                    : 'text-white/50 hover:text-white',
                )
              }
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
