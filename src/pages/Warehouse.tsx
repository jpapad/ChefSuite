import { useState } from 'react'
import {
  Package, Building2, FolderOpen, MapPin, ShoppingCart,
  ClipboardList, CalendarDays, FileSpreadsheet, ArrowLeft, BookOpen, ArrowLeftRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/cn'
import { Page, PageHeader, PillButton } from '../components/ui/page'
import { WareProducts }          from '../components/warehouse/WareProducts'
import { WareSuppliers }         from '../components/warehouse/WareSuppliers'
import { WareCategories }        from '../components/warehouse/WareCategories'
import { WareStorageLocations }  from '../components/warehouse/WareStorageLocations'
import { WareOrders }            from '../components/warehouse/WareOrders'
import { WareInventory }         from '../components/warehouse/WareInventory'
import { WareSchedule }          from '../components/warehouse/WareSchedule'
import { WareImportExcel }       from '../components/warehouse/WareImportExcel'
import { WareCatalogs }          from '../components/warehouse/WareCatalogs'
import { WareTransfers }         from '../components/warehouse/WareTransfers'
import type { WarehousePage }    from '../types/warehouse.types'

interface NavItem {
  id: WarehousePage
  label: string
  sublabel: string
  icon: React.ElementType
  color: string
}

export default function Warehouse() {
  const { t } = useTranslation()
  const [page, setPage] = useState<WarehousePage | null>(null)
  const [productFilter, setProductFilter] = useState<Record<string, string>>({})

  const NAV: NavItem[] = [
    { id: 'products',   label: t('warehousePage.nav.products'),   sublabel: t('warehousePage.nav.productsSub'),   icon: Package,         color: 'text-brand-orange bg-brand-orange/10' },
    { id: 'orders',     label: t('warehousePage.nav.orders'),     sublabel: t('warehousePage.nav.ordersSub'),     icon: ShoppingCart,    color: 'text-sky-400 bg-sky-500/10' },
    { id: 'inventory',  label: t('warehousePage.nav.stocktaking'),sublabel: t('warehousePage.nav.stocktakingSub'),icon: ClipboardList,   color: 'text-emerald-400 bg-emerald-500/10' },
    { id: 'suppliers',  label: t('warehousePage.nav.suppliers'),  sublabel: t('warehousePage.nav.suppliersSub'),  icon: Building2,       color: 'text-violet-400 bg-violet-500/10' },
    { id: 'categories', label: t('warehousePage.nav.categories'), sublabel: t('warehousePage.nav.categoriesSub'),icon: FolderOpen,      color: 'text-amber-400 bg-amber-500/10' },
    { id: 'storage',    label: t('warehousePage.nav.locations'),  sublabel: t('warehousePage.nav.locationsSub'),  icon: MapPin,          color: 'text-rose-400 bg-rose-500/10' },
    { id: 'catalogs',   label: t('warehousePage.nav.pricelists'), sublabel: t('warehousePage.nav.pricelistsSub'), icon: BookOpen,        color: 'text-indigo-400 bg-indigo-500/10' },
    { id: 'transfers',  label: t('warehousePage.v2.transfers'),  sublabel: t('warehousePage.v2.transfersSub'),   icon: ArrowLeftRight,  color: 'text-cyan-400 bg-cyan-500/10' },
    { id: 'schedule',   label: t('warehousePage.nav.schedule'),   sublabel: t('warehousePage.nav.scheduleSub'),   icon: CalendarDays,    color: 'text-teal-400 bg-teal-500/10' },
    { id: 'import',     label: t('warehousePage.nav.importExcel'),sublabel: t('warehousePage.nav.importExcelSub'),icon: FileSpreadsheet, color: 'text-lime-400 bg-lime-500/10' },
  ]

  function navigateTo(_target: 'products', filter: Record<string, string>) {
    setProductFilter(filter)
    setPage('products')
  }

  const activePage = NAV.find((n) => n.id === page)

  return (
    <Page>
      <PageHeader
        eyebrow={activePage ? t('warehousePage.title') : undefined}
        title={activePage ? activePage.label : t('warehousePage.title')}
        subtitle={activePage ? activePage.sublabel : t('warehousePage.subtitle')}
        actions={page ? <PillButton icon={ArrowLeft} onClick={() => setPage(null)}>{t('warehousePage.v2.overview')}</PillButton> : undefined}
      />

      {!page ? (
        /* ── Hub: every warehouse tool as a large tile ── */
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {NAV.map((item, i) => (
            <button
              key={item.id}
              onClick={() => { setProductFilter({}); setPage(item.id) }}
              className={cn(
                'group flex min-h-[150px] flex-col justify-between gap-4 rounded-3xl p-5 text-left transition-transform hover:-translate-y-0.5',
                i === 0 ? 'bg-ink text-white-fixed sm:col-span-2 xl:col-span-1 xl:row-span-2' : 'bg-bg-card shadow-card',
              )}
            >
              <span className={cn('flex h-12 w-12 items-center justify-center rounded-full', i === 0 ? 'bg-lime text-ink' : 'bg-white/[0.06]')}>
                <item.icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span>
                <span className={cn('block font-medium', i === 0 ? 'text-2xl tracking-[-0.02em]' : 'text-lg')}>{item.label}</span>
                <span className={cn('mt-1 block text-sm', i === 0 ? 'text-[#C9CEC8]' : 'text-white/55')}>{item.sublabel}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* ── Module nav ── */}
          <nav aria-label={t('warehousePage.title')} className="flex gap-1 overflow-x-auto scrollbar-none rounded-3xl bg-bg-card p-2 shadow-card lg:sticky lg:top-24 lg:flex-col">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => { setProductFilter({}); setPage(item.id) }}
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition',
                  page === item.id ? 'bg-brand-orange text-on-accent' : 'text-white/70 hover:bg-white/[0.05] hover:text-white',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* ── Module content ── */}
          <div className="min-w-0 rounded-3xl bg-bg-card p-4 sm:p-6 shadow-card">
            {page === 'products'  && <WareProducts initialFilter={productFilter} />}
            {page === 'orders'    && <WareOrders />}
            {page === 'inventory' && <WareInventory />}
            {page === 'suppliers' && <WareSuppliers onNavigate={navigateTo} />}
            {page === 'categories'&& <WareCategories onNavigate={navigateTo} />}
            {page === 'storage'   && <WareStorageLocations onNavigate={navigateTo} />}
            {page === 'catalogs'  && <WareCatalogs />}
            {page === 'transfers' && <WareTransfers />}
            {page === 'schedule'  && <WareSchedule />}
            {page === 'import'    && <WareImportExcel />}
          </div>
        </div>
      )}
    </Page>
  )
}
