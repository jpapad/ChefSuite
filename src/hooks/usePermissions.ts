import { useAuth } from '../contexts/AuthContext'

export const ALL_MODULES = [
  'dashboard',
  'recipes',
  'inventory',
  'prep',
  'kds',
  'haccp',
  'suppliers',
  'orders',
  'waste',
  'price-tracking',
  'team',
  'shifts',
  'timeclock',
  'staff-performance',
  'menus',
  'menu-engineering',
  'reservations',
  'analytics',
  'pl',
  'chat',
  'walkie',
  'journal',
  'pulse',
  'copilot',
  'handover',
  'labels',
  'stocktake',
  'costing',
  'culinary-tools',
  'glossary',
  'techniques',
  'help',
  'ingredients',
  'pos-settings',
] as const

export type AppModule = (typeof ALL_MODULES)[number]

export const MODULE_GROUPS: { labelKey: string; modules: AppModule[] }[] = [
  {
    labelKey: 'nav.groups.kitchen',
    modules: ['dashboard', 'recipes', 'menus', 'prep', 'kds', 'haccp', 'labels'],
  },
  {
    labelKey: 'nav.groups.procurement',
    modules: ['inventory', 'suppliers', 'orders', 'waste', 'price-tracking', 'stocktake'],
  },
  {
    labelKey: 'nav.groups.team',
    modules: ['team', 'shifts', 'timeclock', 'staff-performance', 'handover'],
  },
  {
    labelKey: 'nav.groups.revenue',
    modules: ['menu-engineering', 'reservations', 'analytics', 'pl', 'pos-settings', 'costing'],
  },
  {
    labelKey: 'nav.groups.comms',
    modules: ['chat', 'walkie', 'journal', 'pulse', 'copilot'],
  },
  {
    labelKey: 'nav.groups.library',
    modules: ['culinary-tools', 'glossary', 'techniques', 'ingredients', 'help'],
  },
]

export const MODULE_LABEL_KEY: Record<AppModule, string> = {
  'dashboard': 'nav.dashboard',
  'recipes': 'nav.recipes',
  'inventory': 'nav.inventory',
  'prep': 'nav.prep',
  'kds': 'nav.kds',
  'haccp': 'nav.haccp',
  'suppliers': 'nav.suppliers',
  'orders': 'nav.purchaseOrders',
  'waste': 'nav.wasteLog',
  'price-tracking': 'nav.priceTracking',
  'team': 'nav.team',
  'shifts': 'nav.shifts',
  'timeclock': 'nav.timeclock',
  'staff-performance': 'nav.staffPerformance',
  'menus': 'nav.menus',
  'menu-engineering': 'nav.menuEngineering',
  'reservations': 'nav.reservations',
  'analytics': 'nav.analytics',
  'pl': 'nav.profitLoss',
  'chat': 'nav.chat',
  'walkie': 'nav.walkie',
  'journal': 'nav.journal',
  'pulse': 'nav.pulse',
  'copilot': 'nav.copilot',
  'culinary-tools': 'nav.culinaryTools',
  'glossary': 'nav.glossary',
  'techniques': 'nav.techniques',
  'ingredients': 'nav.ingredients',
  'pos-settings': 'nav.posSettings',
  'help': 'nav.help',
  'handover': 'nav.handover',
  'labels': 'nav.labels',
  'stocktake': 'nav.stocktake',
  'costing': 'nav.costing',
}

export function usePermissions() {
  const { profile, loading } = useAuth()

  const isOwner = profile?.role === 'owner'

  function can(module: AppModule): boolean {
    if (!profile) return false
    if (isOwner) return true
    if (profile.permissions === null) return true
    return profile.permissions.includes(module)
  }

  return { can, isOwner, loading }
}
