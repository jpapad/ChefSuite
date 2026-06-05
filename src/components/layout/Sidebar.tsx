import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Home, ChefHat, Users, ClipboardList,
  TrendingUp, MessageSquare, Monitor, Radio, Languages,
  UtensilsCrossed, Trash2, CalendarDays, ClipboardCheck,
  TimerIcon, CalendarCheck, Star, BarChart3, Award,
  BookOpen, Heart, Bot, Search, X, Scale, BookMarked,
  Layers, HelpCircle, FlaskConical, CreditCard, Building2,
  Tag, Calculator, MapPin, Activity, BookLock, Thermometer, Map,
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

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
}

const PRIMARY_NAV: { to: string; icon: LucideIcon; end?: boolean; labelKey: string; module: AppModule }[] = [
  { to: '/',          icon: Home,            end: true,  labelKey: 'nav.home',      module: 'dashboard' },
  { to: '/dashboard', icon: LayoutDashboard, end: false, labelKey: 'nav.dashboard', module: 'dashboard' },
  { to: '/kds',       icon: Monitor,         end: false, labelKey: 'nav.kds',       module: 'kds'       },
  { to: '/chat',      icon: MessageSquare,   end: false, labelKey: 'nav.chat',      module: 'chat'      },
]

const GROUP_META: Record<string, { icon: LucideIcon; color: string }> = {
  kitchen:     { icon: ChefHat,       color: 'text-amber-400'  },
  procurement: { icon: Building2,     color: 'text-blue-400'   },
  team:        { icon: Users,         color: 'text-green-400'  },
  revenue:     { icon: TrendingUp,    color: 'text-purple-400' },
  comms:       { icon: MessageSquare, color: 'text-pink-400'   },
  library:     { icon: BookMarked,    color: 'text-cyan-400'   },
}

export function Sidebar() {
  const { profile, user } = useAuth()
  const { t } = useTranslation()
  const { can } = usePermissions()
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [flyoutTop, setFlyoutTop]         = useState(16)
  const [search, setSearch]               = useState('')
  const sidebarRef = useRef<HTMLElement>(null)
  const flyoutRef  = useRef<HTMLDivElement>(null)
  const searchRef  = useRef<HTMLInputElement>(null)

  // Close flyout on outside click
  useEffect(() => {
    if (!activeGroupId) return
    function handle(e: MouseEvent) {
      if (
        flyoutRef.current?.contains(e.target as Node) ||
        sidebarRef.current?.contains(e.target as Node)
      ) return
      setActiveGroupId(null)
      setSearch('')
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [activeGroupId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setActiveGroupId(null); setSearch('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const groups: NavGroup[] = [
    {
      id: 'kitchen', label: t('nav.groups.kitchen'),
      items: [
        { to: '/',                 label: t('nav.home'),        icon: Home,            end: true,  module: 'dashboard'    },
        { to: '/dashboard',        label: t('nav.dashboard'),   icon: LayoutDashboard,             module: 'dashboard'    },
        { to: '/recipes',          label: t('nav.recipes'),     icon: ChefHat,                     module: 'recipes'      },
        { to: '/regional-recipes', label: 'Τοπικές Συνταγές',   icon: MapPin,                      module: 'regional-recipes' },
        { to: '/menus',            label: t('nav.menus'),       icon: UtensilsCrossed,             module: 'menus'        },
        { to: '/prep',             label: t('nav.prep'),        icon: ClipboardList,               module: 'prep'         },
        { to: '/kds',              label: t('nav.kds'),         icon: Monitor,                     module: 'kds'          },
        { to: '/buffet-pulse',     label: t('nav.buffetPulse'), icon: Activity,                    module: 'buffet-pulse' },
        { to: '/buffet-map',       label: 'Χάρτης Μπουφέ',     icon: Map,                          module: 'buffet-pulse' },
        { to: '/haccp',            label: t('nav.haccp'),       icon: Thermometer,                 module: 'haccp'        },
        { to: '/haccp-logbook',    label: t('nav.haccpLogbook'),icon: BookLock,                    module: 'haccp-logbook'},
        { to: '/labels',           label: t('nav.labels'),      icon: Tag,                         module: 'labels'       },
        { to: '/waste',            label: t('nav.wasteLog'),    icon: Trash2,                      module: 'waste'        },
      ],
    },
    {
      id: 'procurement', label: t('nav.groups.procurement'),
      items: [
        { to: '/warehouse', label: t('nav.warehouse'), icon: Building2, module: 'warehouse' },
      ],
    },
    {
      id: 'team', label: t('nav.groups.team'),
      items: [
        { to: '/team',             label: t('nav.team'),             icon: Users,         module: 'team'             },
        { to: '/shifts',           label: t('nav.shifts'),           icon: CalendarDays,  module: 'shifts'           },
        { to: '/timeclock',        label: t('nav.timeclock'),        icon: TimerIcon,     module: 'timeclock'        },
        { to: '/staff-performance',label: t('nav.staffPerformance'), icon: Award,         module: 'staff-performance'},
        { to: '/handover',         label: t('nav.handover'),         icon: ClipboardCheck,module: 'handover'         },
      ],
    },
    {
      id: 'revenue', label: t('nav.groups.revenue'),
      items: [
        { to: '/menu-engineering', label: t('nav.menuEngineering'), icon: Star,         module: 'menu-engineering' },
        { to: '/costing',          label: t('nav.costing'),         icon: Calculator,   module: 'costing'          },
        { to: '/reservations',     label: t('nav.reservations'),    icon: CalendarCheck,module: 'reservations'     },
        { to: '/analytics',        label: t('nav.analytics'),       icon: TrendingUp,   module: 'analytics'        },
        { to: '/pl',               label: t('nav.profitLoss'),      icon: BarChart3,    module: 'pl'               },
        { to: '/pos-settings',     label: t('nav.posSettings'),     icon: CreditCard,   module: 'pos-settings'     },
      ],
    },
    {
      id: 'comms', label: t('nav.groups.comms'),
      items: [
        { to: '/chat',    label: t('nav.chat'),    icon: MessageSquare, module: 'chat'    },
        { to: '/walkie',  label: t('nav.walkie'),  icon: Radio,         module: 'walkie'  },
        { to: '/journal', label: t('nav.journal'), icon: BookOpen,      module: 'journal' },
        { to: '/pulse',   label: t('nav.pulse'),   icon: Heart,         module: 'pulse'   },
        { to: '/copilot', label: t('nav.copilot'), icon: Bot,           module: 'copilot' },
      ],
    },
    {
      id: 'library', label: t('nav.groups.library'),
      items: [
        { to: '/culinary-tools', label: t('nav.culinaryTools'), icon: Scale,       module: 'culinary-tools' },
        { to: '/glossary',       label: t('nav.glossary'),      icon: BookMarked,  module: 'glossary'       },
        { to: '/techniques',     label: t('nav.techniques'),    icon: Layers,      module: 'techniques'     },
        { to: '/ingredients',    label: t('nav.ingredients'),   icon: FlaskConical,module: 'ingredients'    },
        { to: '/help',           label: t('nav.help'),          icon: HelpCircle,  module: 'help'           },
      ],
    },
  ]

  function openGroup(groupId: string, btn: HTMLButtonElement) {
    if (activeGroupId === groupId) { setActiveGroupId(null); setSearch(''); return }
    const rect = btn.getBoundingClientRect()
    setFlyoutTop(Math.max(16, rect.top))
    setActiveGroupId(groupId)
    setSearch('')
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function toggleLang() {
    const cycle = ['en', 'el', 'bg']
    const next = cycle[(cycle.indexOf(i18n.language) + 1) % cycle.length]
    void i18n.changeLanguage(next)
    localStorage.setItem('chefsuite_lang', next)
    if (user) void supabase.from('profiles').update({ preferred_lang: next }).eq('id', user.id)
  }

  const iconBtnCls = 'flex items-center justify-center h-10 w-10 rounded-2xl transition-all duration-200 text-white/35 hover:bg-white/8 hover:text-white/80'

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
      isActive
        ? 'bg-[rgba(197,160,89,0.15)] text-[#C5A059] shadow-[inset_2px_0_0_#C5A059]'
        : 'text-white/50 hover:bg-white/5 hover:text-white/90',
    )

  const activeGroup     = activeGroupId ? groups.find((g) => g.id === activeGroupId) : null
  const activeGroupMeta = activeGroupId ? GROUP_META[activeGroupId] : null
  const ActiveGroupIcon = activeGroupMeta?.icon ?? LayoutDashboard
  const activeItems     = activeGroup ? activeGroup.items.filter((i) => can(i.module)) : []
  const query           = search.trim().toLowerCase()
  const filteredItems   = query ? activeItems.filter((i) => i.label.toLowerCase().includes(query)) : activeItems

  return (
    <>
      {/* ── Icon strip ── */}
      <aside
        ref={sidebarRef}
        className="hidden md:flex flex-col items-center w-16 shrink-0 rounded-[2.5rem] py-5 gap-1"
        style={{
          background: 'rgba(10, 18, 28, 0.75)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
        }}
      >
        {/* Logo */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[14px] font-black text-sm text-white-fixed mb-2 shrink-0"
          style={{ background: 'linear-gradient(135deg, #d8b08c 0%, #C5A059 100%)', boxShadow: '0 0 20px rgba(197,160,89,0.35)' }}
        >
          CS
        </div>

        <div className="h-px w-8 bg-white/8 shrink-0" />

        {/* Primary nav */}
        <div className="flex flex-col items-center gap-0.5 w-full px-2">
          {PRIMARY_NAV.filter((item) => can(item.module)).map(({ to, icon: Icon, end, labelKey }) => (
            <NavLink
              key={to} to={to} end={end} title={t(labelKey)}
              onClick={() => setActiveGroupId(null)}
              className={({ isActive }) => cn(
                'flex items-center justify-center h-10 w-10 rounded-2xl transition-all duration-200',
                isActive ? 'text-white-fixed shadow-[0_0_20px_rgba(197,160,89,0.3)]' : 'text-white/40 hover:bg-white/8 hover:text-white',
              )}
              style={({ isActive }) => isActive ? { background: '#C5A059' } : {}}
            >
              <Icon className="h-5 w-5" />
            </NavLink>
          ))}
        </div>

        <div className="h-px w-8 bg-white/8 shrink-0" />

        {/* Group icons */}
        <div className="flex flex-col items-center gap-0.5 w-full px-2 flex-1">
          {groups.map((group) => {
            if (group.items.filter((i) => can(i.module)).length === 0) return null
            const meta = GROUP_META[group.id]
            const GroupIcon = meta?.icon ?? LayoutDashboard
            return (
              <button
                key={group.id} type="button" title={group.label}
                onClick={(e) => openGroup(group.id, e.currentTarget)}
                className={cn(iconBtnCls, activeGroupId === group.id && 'bg-white/10 text-white ring-1 ring-white/15')}
              >
                <GroupIcon className={cn('h-4 w-4', meta?.color)} />
              </button>
            )
          })}
        </div>

        <div className="h-px w-8 bg-white/8 shrink-0" />

        {/* Profile + Lang */}
        <NavLink to="/profile" title={profile?.full_name ?? 'Profile'}
          onClick={() => setActiveGroupId(null)}
          className={({ isActive }) => cn('flex items-center justify-center h-10 w-10 rounded-2xl transition-all', isActive ? 'bg-white/10' : 'hover:bg-white/8')}
        >
          <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white-fixed text-[10px] font-bold select-none"
            style={{ background: 'linear-gradient(135deg, #d8b08c, #C5A059)' }}>
            {getInitials(profile?.full_name)}
          </div>
        </NavLink>
        <button type="button" onClick={toggleLang} title="Language" className={iconBtnCls}>
          <Languages className="h-4 w-4" />
        </button>
      </aside>

      {/* ── Flyout panel (fixed, beside the sidebar, above other content) ── */}
      {activeGroup && (
        <div
          ref={flyoutRef}
          className="fixed w-52 rounded-3xl overflow-y-auto scrollbar-none"
          style={{
            left: '84px',
            top: `${flyoutTop}px`,
            maxHeight: `calc(100vh - ${flyoutTop}px - 16px)`,
            background: 'rgba(8, 16, 26, 0.97)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(28px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.70)',
            zIndex: 9999,
          }}
        >
          <div className="p-3 flex flex-col gap-0.5">
            {/* Header */}
            <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-white/8">
              <div className="flex items-center gap-2">
                <ActiveGroupIcon className={cn('h-4 w-4 shrink-0', activeGroupMeta?.color)} />
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                  {activeGroup.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setActiveGroupId(null); setSearch('') }}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/8 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setActiveGroupId(null) } }}
                placeholder={t('nav.search')}
                className="w-full rounded-xl pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-white/25 bg-white/5 border border-white/8 outline-none focus:border-[rgba(197,160,89,0.4)] transition"
              />
            </div>

            {/* Items */}
            {filteredItems.length > 0 ? (
              filteredItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to} to={to} end={end}
                  onClick={() => { setActiveGroupId(null); setSearch('') }}
                  className={navLinkCls}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))
            ) : (
              <p className="text-center text-xs text-white/25 py-3">{t('nav.noResults')}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
