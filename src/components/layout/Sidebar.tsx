import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ChefHat,
  Package,
  Users,
  Flame,
  ClipboardList,
  TrendingUp,
  Thermometer,
  MessageSquare,
  Monitor,
  Radio,
  Languages,
  UtensilsCrossed,
  Truck,
  Trash2,
  CalendarDays,
  ClipboardCheck,
  TimerIcon,
  CalendarCheck,
  Star,
  LineChart,
  BarChart3,
  Award,
  BookOpen,
  Heart,
  Bot,
  ChevronDown,
  Search,
  X,
  Scale,
  BookMarked,
  Layers,
  HelpCircle,
  FlaskConical,
  CreditCard,
  Building2,
  Tag,
  Calculator,
  type LucideIcon,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions, type AppModule } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import i18n from '../../i18n'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  module: AppModule
}

interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

const STORAGE_KEY = 'chefsuite_sidebar_collapsed'

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveCollapsed(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function getFirstName(name: string | null | undefined): string {
  if (!name) return 'Chef'
  return name.split(' ')[0] ?? 'Chef'
}

export function Sidebar() {
  const { profile, user, myTeams, switchTeam } = useAuth()
  const { t } = useTranslation()
  const { can } = usePermissions()
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const [search, setSearch] = useState('')
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const teamSwitcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => { saveCollapsed(collapsed) }, [collapsed])

  useEffect(() => {
    if (!teamDropdownOpen) return
    function onClickOutside(e: MouseEvent) {
      if (teamSwitcherRef.current && !teamSwitcherRef.current.contains(e.target as Node)) {
        setTeamDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [teamDropdownOpen])

  // ⌘K / Ctrl+K focuses the search bar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const groups: NavGroup[] = [
    {
      id: 'kitchen',
      label: t('nav.groups.kitchen'),
      items: [
        { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true, module: 'dashboard' as AppModule },
        { to: '/recipes', label: t('nav.recipes'), icon: ChefHat, module: 'recipes' as AppModule },
        { to: '/menus', label: t('nav.menus'), icon: UtensilsCrossed, module: 'menus' as AppModule },
        { to: '/prep', label: t('nav.prep'), icon: ClipboardList, module: 'prep' as AppModule },
        { to: '/kds', label: t('nav.kds'), icon: Monitor, module: 'kds' as AppModule },
        { to: '/haccp', label: t('nav.haccp'), icon: Thermometer, module: 'haccp' as AppModule },
        { to: '/labels', label: t('nav.labels'), icon: Tag, module: 'labels' as AppModule },
      ],
    },
    {
      id: 'procurement',
      label: t('nav.groups.procurement'),
      items: [
        { to: '/inventory', label: t('nav.inventory'), icon: Package, module: 'inventory' as AppModule },
        { to: '/stocktake', label: t('nav.stocktake'), icon: ClipboardList, module: 'stocktake' as AppModule },
        { to: '/suppliers', label: t('nav.suppliers'), icon: Truck, module: 'suppliers' as AppModule },
        { to: '/orders', label: t('nav.purchaseOrders'), icon: ClipboardCheck, module: 'orders' as AppModule },
        { to: '/waste', label: t('nav.wasteLog'), icon: Trash2, module: 'waste' as AppModule },
        { to: '/price-tracking', label: t('nav.priceTracking'), icon: LineChart, module: 'price-tracking' as AppModule },
      ],
    },
    {
      id: 'team',
      label: t('nav.groups.team'),
      items: [
        { to: '/team', label: t('nav.team'), icon: Users, module: 'team' as AppModule },
        { to: '/shifts', label: t('nav.shifts'), icon: CalendarDays, module: 'shifts' as AppModule },
        { to: '/timeclock', label: t('nav.timeclock'), icon: TimerIcon, module: 'timeclock' as AppModule },
        { to: '/staff-performance', label: t('nav.staffPerformance'), icon: Award, module: 'staff-performance' as AppModule },
        { to: '/handover', label: t('nav.handover'), icon: ClipboardCheck, module: 'handover' as AppModule },
      ],
    },
    {
      id: 'revenue',
      label: t('nav.groups.revenue'),
      items: [
        { to: '/menu-engineering', label: t('nav.menuEngineering'), icon: Star,        module: 'menu-engineering' as AppModule },
        { to: '/costing',         label: t('nav.costing'),          icon: Calculator,    module: 'costing'         as AppModule },
        { to: '/reservations',    label: t('nav.reservations'),    icon: CalendarCheck, module: 'reservations'    as AppModule },
        { to: '/analytics',       label: t('nav.analytics'),       icon: TrendingUp,    module: 'analytics'       as AppModule },
        { to: '/pl',              label: t('nav.profitLoss'),       icon: BarChart3,     module: 'pl'              as AppModule },
        { to: '/pos-settings',    label: t('nav.posSettings'),      icon: CreditCard,    module: 'pos-settings'    as AppModule },
      ],
    },
    {
      id: 'comms',
      label: t('nav.groups.comms'),
      items: [
        { to: '/chat', label: t('nav.chat'), icon: MessageSquare, module: 'chat' as AppModule },
        { to: '/walkie', label: t('nav.walkie'), icon: Radio, module: 'walkie' as AppModule },
        { to: '/journal', label: t('nav.journal'), icon: BookOpen, module: 'journal' as AppModule },
        { to: '/pulse', label: t('nav.pulse'), icon: Heart, module: 'pulse' as AppModule },
        { to: '/copilot', label: t('nav.copilot'), icon: Bot, module: 'copilot' as AppModule },
      ],
    },
    {
      id: 'library',
      label: t('nav.groups.library'),
      items: [
        { to: '/culinary-tools', label: t('nav.culinaryTools'), icon: Scale,          module: 'culinary-tools' as AppModule },
        { to: '/glossary',       label: t('nav.glossary'),      icon: BookMarked,     module: 'glossary'       as AppModule },
        { to: '/techniques',     label: t('nav.techniques'),    icon: Layers,         module: 'techniques'     as AppModule },
        { to: '/ingredients',    label: t('nav.ingredients'),   icon: FlaskConical,   module: 'ingredients'    as AppModule },
        { to: '/help',           label: t('nav.help'),          icon: HelpCircle,     module: 'help'           as AppModule },
      ],
    },
  ]

  const allItems = groups.flatMap((g) => g.items).filter((item) => can(item.module))
  const query = search.trim().toLowerCase()
  const filteredItems = query
    ? allItems.filter((item) => item.label.toLowerCase().includes(query))
    : null

  function toggleLang() {
    const cycle = ['en', 'el', 'bg']
    const next = cycle[(cycle.indexOf(i18n.language) + 1) % cycle.length]
    void i18n.changeLanguage(next)
    localStorage.setItem('chefsuite_lang', next)
    if (user) {
      void supabase.from('profiles').update({ preferred_lang: next }).eq('id', user.id)
    }
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
      isActive
        ? 'bg-gradient-to-r from-brand-orange/20 to-brand-orange/5 text-white shadow-[inset_2px_0_0_#C4956A]'
        : 'text-white/50 hover:bg-white/5 hover:text-white/90',
    )

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col glass-strong border-r border-white/8 py-4 px-3 gap-1 overflow-y-auto">

      {/* Logo */}
      <div className="flex items-center gap-3 px-2 pt-1 pb-3 border-b border-white/6 mb-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange shadow-[0_0_16px_rgba(196,149,106,0.6)]">
          <Flame className="h-5 w-5 text-white-fixed" />
        </div>
        <div>
          <div className="text-base font-semibold leading-none tracking-tight">Chefsuite</div>
          <div className="text-[11px] text-white/35 mt-0.5">Culinary Ops</div>
        </div>
      </div>

      {/* Team switcher — only visible when user belongs to 2+ teams */}
      {myTeams.length > 1 && (
        <div className="relative mb-1" ref={teamSwitcherRef}>
          <button
            type="button"
            onClick={() => setTeamDropdownOpen((prev) => !prev)}
            className="flex w-full items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 transition-all"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-orange/15">
              <Building2 className="h-3.5 w-3.5 text-brand-orange" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[10px] text-white/35 leading-none uppercase tracking-wider">Restaurant</div>
              <div className="text-xs font-semibold text-white/80 truncate leading-none mt-0.5">
                {myTeams.find((t) => t.id === profile?.team_id)?.name ?? '—'}
              </div>
            </div>
            <ChevronDown
              className={cn('h-3 w-3 text-white/30 shrink-0 transition-transform duration-200', teamDropdownOpen && 'rotate-180')}
            />
          </button>

          {teamDropdownOpen && (
            <div className="absolute left-0 right-0 mt-1 z-50 glass-strong gradient-border rounded-xl py-1 shadow-xl">
              {myTeams.map((t) => {
                const isActive = t.id === profile?.team_id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      void switchTeam(t.id)
                      setTeamDropdownOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors rounded-lg',
                      isActive
                        ? 'text-brand-orange'
                        : 'text-white/55 hover:text-white hover:bg-white/5',
                    )}
                  >
                    <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', isActive ? 'bg-brand-orange' : 'bg-white/20')} />
                    <span className="truncate">{t.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Profile section */}
      <NavLink
        to="/profile"
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all group mb-1',
            isActive ? 'bg-white/8' : 'hover:bg-white/5',
          )
        }
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-orange to-[#8B5E3C] text-white-fixed text-xs font-bold shadow-[0_0_12px_rgba(196,149,106,0.45)] select-none">
          {getInitials(profile?.full_name)}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-white/35 leading-none mb-0.5 uppercase tracking-wider">Hello,</div>
          <div className="text-sm font-semibold truncate leading-none text-white/80 group-hover:text-white transition-colors">
            {getFirstName(profile?.full_name)}
          </div>
        </div>
      </NavLink>

      {/* Search bar */}
      <div className="relative mb-3">
        <div
          className={cn(
            'glass gradient-border flex items-center gap-2 rounded-xl px-3 h-9 transition-all',
            'focus-within:ring-1 focus-within:ring-brand-orange/40 focus-within:bg-white/6',
          )}
        >
          <Search className="h-3.5 w-3.5 text-white/30 shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
            placeholder={t('nav.search')}
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/25 min-w-0"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-white/30 hover:text-white/70 transition shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="text-white/20 text-[10px] font-mono bg-white/5 rounded px-1.5 py-0.5 shrink-0 leading-none">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Nav — search results or grouped */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {filteredItems ? (
          filteredItems.length > 0 ? (
            filteredItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}
                onClick={() => setSearch('')}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            ))
          ) : (
            <p className="text-center text-xs text-white/25 py-4">{t('nav.noResults')}</p>
          )
        ) : (
          groups.map((group) => {
            const visibleItems = group.items.filter((item) => can(item.module))
            if (visibleItems.length === 0) return null
            const isOpen = !collapsed.has(group.id)
            return (
              <div key={group.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest text-white/25 hover:text-white/45 transition select-none"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn('h-3 w-3 transition-transform duration-200', !isOpen && '-rotate-90')}
                  />
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {visibleItems.map(({ to, label, icon: Icon, end }) => (
                      <NavLink key={to} to={to} end={end} className={navLinkClass}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </nav>

      {/* Language toggle */}
      <div className="pt-2 border-t border-white/6">
        <button
          type="button"
          onClick={toggleLang}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition text-white/35 hover:bg-white/5 hover:text-white/70"
        >
          <Languages className="h-4 w-4 shrink-0" />
          <span>{ i18n.language === 'en' ? 'Ελληνικά' : i18n.language === 'el' ? 'Български' : 'English' }</span>
        </button>
      </div>
    </aside>
  )
}
