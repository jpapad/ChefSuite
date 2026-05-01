import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, MessageSquare, Thermometer,
  MoreHorizontal, X, ChefHat, Package, ClipboardList,
  Users, CalendarDays, TrendingUp, Radio, BookOpen,
  Flame, ClipboardCheck, TimerIcon, Heart, Bot, Scale,
  BookMarked, Layers, FlaskConical, HelpCircle, UtensilsCrossed,
  Truck, Trash2, LineChart, BarChart3, Award, Star,
  CalendarCheck, CreditCard, Tag, Calculator, Building2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { usePermissions } from '../../hooks/usePermissions'

const PRIMARY_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/kds',   labelKey: 'nav.kds',    icon: Monitor },
  { to: '/chat',  labelKey: 'nav.chat',   icon: MessageSquare },
  { to: '/haccp', labelKey: 'nav.haccp',  icon: Thermometer },
]

const MORE_GROUPS = [
  {
    labelKey: 'nav.groups.kitchen',
    items: [
      { to: '/recipes',   labelKey: 'nav.recipes',   icon: ChefHat,        module: 'recipes'   },
      { to: '/menus',     labelKey: 'nav.menus',     icon: UtensilsCrossed, module: 'menus'    },
      { to: '/prep',      labelKey: 'nav.prep',      icon: ClipboardList,   module: 'prep'     },
      { to: '/labels',    labelKey: 'nav.labels',    icon: Tag,             module: 'labels'   },
    ],
  },
  {
    labelKey: 'nav.groups.procurement',
    items: [
      { to: '/inventory',     labelKey: 'nav.inventory',      icon: Package,       module: 'inventory'     },
      { to: '/stocktake',     labelKey: 'nav.stocktake',      icon: ClipboardCheck, module: 'stocktake'   },
      { to: '/suppliers',     labelKey: 'nav.suppliers',      icon: Truck,         module: 'suppliers'     },
      { to: '/orders',        labelKey: 'nav.purchaseOrders', icon: ClipboardCheck, module: 'orders'       },
      { to: '/waste',         labelKey: 'nav.wasteLog',       icon: Trash2,        module: 'waste'         },
      { to: '/price-tracking', labelKey: 'nav.priceTracking', icon: LineChart,     module: 'price-tracking'},
    ],
  },
  {
    labelKey: 'nav.groups.team',
    items: [
      { to: '/team',             labelKey: 'nav.team',             icon: Users,      module: 'team'             },
      { to: '/shifts',           labelKey: 'nav.shifts',           icon: CalendarDays, module: 'shifts'         },
      { to: '/timeclock',        labelKey: 'nav.timeclock',        icon: TimerIcon,  module: 'timeclock'        },
      { to: '/staff-performance', labelKey: 'nav.staffPerformance', icon: Award,    module: 'staff-performance' },
      { to: '/handover',         labelKey: 'nav.handover',         icon: ClipboardList, module: 'handover'     },
    ],
  },
  {
    labelKey: 'nav.groups.revenue',
    items: [
      { to: '/menu-engineering', labelKey: 'nav.menuEngineering', icon: Star,        module: 'menu-engineering' },
      { to: '/costing',          labelKey: 'nav.costing',         icon: Calculator,  module: 'costing'          },
      { to: '/reservations',     labelKey: 'nav.reservations',    icon: CalendarCheck, module: 'reservations'  },
      { to: '/analytics',        labelKey: 'nav.analytics',       icon: TrendingUp,  module: 'analytics'        },
      { to: '/pl',               labelKey: 'nav.profitLoss',      icon: BarChart3,   module: 'pl'               },
      { to: '/pos-settings',     labelKey: 'nav.posSettings',     icon: CreditCard,  module: 'pos-settings'     },
    ],
  },
  {
    labelKey: 'nav.groups.comms',
    items: [
      { to: '/walkie',  labelKey: 'nav.walkie',   icon: Radio,    module: 'walkie'  },
      { to: '/journal', labelKey: 'nav.journal',  icon: BookOpen, module: 'journal' },
      { to: '/pulse',   labelKey: 'nav.pulse',    icon: Heart,    module: 'pulse'   },
      { to: '/copilot', labelKey: 'nav.copilot',  icon: Bot,      module: 'copilot' },
    ],
  },
  {
    labelKey: 'nav.groups.library',
    items: [
      { to: '/culinary-tools', labelKey: 'nav.culinaryTools', icon: Scale,       module: 'culinary-tools' },
      { to: '/glossary',       labelKey: 'nav.glossary',      icon: BookMarked,  module: 'glossary'       },
      { to: '/techniques',     labelKey: 'nav.techniques',    icon: Layers,      module: 'techniques'     },
      { to: '/ingredients',    labelKey: 'nav.ingredients',   icon: FlaskConical, module: 'ingredients'   },
      { to: '/help',           labelKey: 'nav.help',          icon: HelpCircle,  module: 'help'           },
    ],
  },
]

export function BottomNav() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function handleNavClick(to: string) {
    setOpen(false)
    navigate(to)
  }

  return (
    <>
      {/* Bottom bar */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-white/8 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {PRIMARY_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[10px] font-medium transition-colors w-full',
                    isActive ? 'text-brand-orange' : 'text-white/50 hover:text-white',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{t(labelKey)}</span>
              </NavLink>
            </li>
          ))}

          {/* More button */}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[10px] font-medium text-white/50 hover:text-white transition-colors w-full"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>{t('nav.more', 'More')}</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* More drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Sheet */}
          <div className="relative glass-strong border-t border-white/10 rounded-t-3xl max-h-[80vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {/* Handle */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange">
                  <Flame className="h-4 w-4 text-white-fixed" />
                </div>
                <span className="font-semibold">Chefsuite</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/8 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Groups */}
            <div className="px-4 pb-6 space-y-4">
              {MORE_GROUPS.map((group) => {
                const visible = group.items.filter((item) => can(item.module as Parameters<typeof can>[0]))
                if (visible.length === 0) return null
                return (
                  <div key={group.labelKey}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1.5">
                      {t(group.labelKey)}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {visible.map(({ to, labelKey, icon: Icon }) => (
                        <button
                          key={to}
                          type="button"
                          onClick={() => handleNavClick(to)}
                          className="flex flex-col items-center gap-1.5 rounded-2xl glass py-3 px-2 text-white/70 hover:text-white hover:bg-white/8 transition-all active:scale-95"
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[10px] font-medium text-center leading-tight">{t(labelKey)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Profile */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1.5">Account</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleNavClick('/profile')}
                    className="flex flex-col items-center gap-1.5 rounded-2xl glass py-3 px-2 text-white/70 hover:text-white hover:bg-white/8 transition-all active:scale-95"
                  >
                    <Building2 className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{t('nav.profile', 'Profile')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
