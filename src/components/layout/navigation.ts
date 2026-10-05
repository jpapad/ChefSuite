import {
  Home, LayoutDashboard, HelpCircle, ChefHat, UtensilsCrossed, Star, Tag, MapPin,
  Building2, Package, ClipboardCheck, Truck, ShoppingCart, TrendingUp, Calculator,
  BarChart3, CreditCard, Flame, Monitor, ClipboardList, Thermometer, BookLock,
  Trash2, Heart, Activity, Map, Users, CalendarDays, TimerIcon, Award, CalendarCheck,
  MessageSquare, Radio, Bot, BookOpen, BookMarked, Scale, Layers, FlaskConical,
  CalendarRange, Sparkles, BadgeCheck, ScanLine, Wrench, MessageSquareHeart, GraduationCap, PartyPopper, type LucideIcon,
} from 'lucide-react'
import type { AppModule } from '../../hooks/usePermissions'

export interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  module: AppModule
  end?: boolean
}

export interface NavSection {
  id: string
  icon: LucideIcon
  /** Short label for the rail, long label for the section bar */
  shortKey: string
  titleKey: string
  items: NavItem[]
}

// Information architecture: nine sections, each with its own sub-pages shown as
// tabs above the page. Order inside a section is the order of the tabs.
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'home', icon: Home, shortKey: 'nav.sections.homeShort', titleKey: 'nav.sections.home',
    items: [
      { to: '/',          labelKey: 'nav.home',      icon: Home,            module: 'dashboard', end: true },
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, module: 'dashboard' },
      { to: '/help',      labelKey: 'nav.help',      icon: HelpCircle,      module: 'help' },
    ],
  },
  {
    id: 'recipes', icon: ChefHat, shortKey: 'nav.sections.recipesShort', titleKey: 'nav.sections.recipes',
    items: [
      { to: '/recipes',          labelKey: 'nav.recipes',         icon: ChefHat,         module: 'recipes' },
      { to: '/menus',            labelKey: 'nav.menus',           icon: UtensilsCrossed, module: 'menus' },
      { to: '/menu-engineering', labelKey: 'nav.menuEngineering', icon: Star,            module: 'menu-engineering' },
      { to: '/labels',           labelKey: 'nav.labels',          icon: Tag,             module: 'labels' },
      { to: '/regional-recipes', labelKey: 'nav.regionalRecipes', icon: MapPin,          module: 'regional-recipes' },
      { to: '/feedback', labelKey: 'nav.feedback', icon: MessageSquareHeart, module: 'feedback' },
    ],
  },
  {
    id: 'stock', icon: Package, shortKey: 'nav.sections.stockShort', titleKey: 'nav.sections.stock',
    items: [
      { to: '/warehouse',      labelKey: 'nav.warehouse',      icon: Building2,      module: 'warehouse' },
      { to: '/inventory',      labelKey: 'nav.inventory',      icon: Package,        module: 'inventory' },
      { to: '/stocktake',      labelKey: 'nav.stocktake',      icon: ClipboardCheck, module: 'stocktake' },
      { to: '/suppliers',      labelKey: 'nav.suppliers',      icon: Truck,          module: 'suppliers' },
      { to: '/orders',         labelKey: 'nav.purchaseOrders', icon: ShoppingCart,   module: 'orders' },
      { to: '/price-tracking', labelKey: 'nav.priceTracking',  icon: TrendingUp,     module: 'price-tracking' },
      { to: '/traceability', labelKey: 'nav.traceability', icon: ScanLine, module: 'traceability' },
    ],
  },
  {
    id: 'finance', icon: BarChart3, shortKey: 'nav.sections.financeShort', titleKey: 'nav.sections.finance',
    items: [
      { to: '/costing',      labelKey: 'nav.costing',     icon: Calculator, module: 'costing' },
      { to: '/pl',           labelKey: 'nav.profitLoss',  icon: BarChart3,  module: 'pl' },
      { to: '/analytics',    labelKey: 'nav.analytics',   icon: TrendingUp, module: 'analytics' },
      { to: '/pos-settings', labelKey: 'nav.posSettings', icon: CreditCard, module: 'pos-settings' },
      { to: '/catering', labelKey: 'nav.catering', icon: PartyPopper, module: 'catering' },
    ],
  },
  {
    id: 'kitchen', icon: Flame, shortKey: 'nav.sections.kitchenShort', titleKey: 'nav.sections.kitchen',
    items: [
      { to: '/kds',           labelKey: 'nav.kds',          icon: Monitor,        module: 'kds' },
      { to: '/prep',          labelKey: 'nav.prep',         icon: ClipboardList,  module: 'prep' },
      { to: '/haccp',         labelKey: 'nav.haccp',        icon: Thermometer,    module: 'haccp' },
      { to: '/haccp-logbook', labelKey: 'nav.haccpLogbook', icon: BookLock,       module: 'haccp-logbook' },
      { to: '/waste',         labelKey: 'nav.wasteLog',     icon: Trash2,         module: 'waste' },
      { to: '/handover',      labelKey: 'nav.handover',     icon: ClipboardCheck, module: 'handover' },
      { to: '/pulse',         labelKey: 'nav.pulse',        icon: Heart,          module: 'pulse' },
      { to: '/equipment', labelKey: 'nav.equipment', icon: Wrench, module: 'equipment' },
    ],
  },
  {
    id: 'buffet', icon: Activity, shortKey: 'nav.sections.buffetShort', titleKey: 'nav.sections.buffet',
    items: [
      { to: '/buffet-pulse', labelKey: 'nav.buffetPulse', icon: Activity, module: 'buffet-pulse' },
      { to: '/buffet-map',   labelKey: 'nav.buffetMap',   icon: Map,      module: 'buffet-pulse' },
    ],
  },
  {
    id: 'team', icon: Users, shortKey: 'nav.sections.teamShort', titleKey: 'nav.sections.team',
    items: [
      { to: '/team',              labelKey: 'nav.team',             icon: Users,         module: 'team' },
      { to: '/shifts',            labelKey: 'nav.shifts',           icon: CalendarDays,  module: 'shifts' },
      { to: '/timeclock',         labelKey: 'nav.timeclock',        icon: TimerIcon,     module: 'timeclock' },
      { to: '/staff-performance', labelKey: 'nav.staffPerformance', icon: Award,         module: 'staff-performance' },
      { to: '/reservations',      labelKey: 'nav.reservations',     icon: CalendarCheck, module: 'reservations' },
      { to: '/certificates', labelKey: 'nav.certificates', icon: BadgeCheck, module: 'certificates' },
      { to: '/training', labelKey: 'nav.training', icon: GraduationCap, module: 'training' },
    ],
  },
  {
    id: 'comms', icon: MessageSquare, shortKey: 'nav.sections.commsShort', titleKey: 'nav.sections.comms',
    items: [
      { to: '/chat',    labelKey: 'nav.chat',    icon: MessageSquare, module: 'chat' },
      { to: '/walkie',  labelKey: 'nav.walkie',  icon: Radio,         module: 'walkie' },
      { to: '/copilot', labelKey: 'nav.copilot', icon: Bot,           module: 'copilot' },
      { to: '/journal', labelKey: 'nav.journal', icon: BookOpen,      module: 'journal' },
    ],
  },
  {
    id: 'library', icon: BookMarked, shortKey: 'nav.sections.libraryShort', titleKey: 'nav.sections.library',
    items: [
      { to: '/culinary-tools',    labelKey: 'nav.culinaryTools',    icon: Scale,         module: 'culinary-tools' },
      { to: '/techniques',        labelKey: 'nav.techniques',       icon: Layers,        module: 'techniques' },
      { to: '/ingredients',       labelKey: 'nav.ingredients',      icon: FlaskConical,  module: 'ingredients' },
      { to: '/glossary',          labelKey: 'nav.glossary',         icon: BookMarked,    module: 'glossary' },
      { to: '/spice-guide',       labelKey: 'nav.spiceGuide',       icon: Sparkles,      module: 'spice-guide' },
      { to: '/seasonal-calendar', labelKey: 'nav.seasonalCalendar', icon: CalendarRange, module: 'seasonal-calendar' },
    ],
  },
]

function matches(item: NavItem, pathname: string) {
  if (item.end || item.to === '/') return pathname === item.to
  return pathname === item.to || pathname.startsWith(item.to + '/')
}

/** The section that owns the current route, if any (e.g. /menus/123 → recipes). */
export function findSection(pathname: string): NavSection | undefined {
  return NAV_SECTIONS.find((s) => s.items.some((i) => matches(i, pathname)))
}

export function isItemActive(item: NavItem, pathname: string) {
  return matches(item, pathname)
}
