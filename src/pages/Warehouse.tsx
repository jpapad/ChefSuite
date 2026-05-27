import { useState } from 'react'
import {
  Package, Building2, FolderOpen, MapPin, ShoppingCart,
  ClipboardList, CalendarDays, FileSpreadsheet, ArrowLeft,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { WareProducts }          from '../components/warehouse/WareProducts'
import { WareSuppliers }         from '../components/warehouse/WareSuppliers'
import { WareCategories }        from '../components/warehouse/WareCategories'
import { WareStorageLocations }  from '../components/warehouse/WareStorageLocations'
import { WareOrders }            from '../components/warehouse/WareOrders'
import { WareInventory }         from '../components/warehouse/WareInventory'
import { WareSchedule }          from '../components/warehouse/WareSchedule'
import { WareImportExcel }       from '../components/warehouse/WareImportExcel'
import type { WarehousePage }    from '../types/warehouse.types'

interface NavItem {
  id: WarehousePage
  label: string
  sublabel: string
  icon: React.ElementType
  color: string
}

const NAV: NavItem[] = [
  { id: 'products',         label: 'Προϊόντα',        sublabel: 'Κατάλογος αποθήκης',      icon: Package,         color: 'text-brand-orange bg-brand-orange/10' },
  { id: 'orders',           label: 'Παραγγελίες',     sublabel: 'Αποστολή & παραλαβή',     icon: ShoppingCart,    color: 'text-sky-400 bg-sky-500/10' },
  { id: 'inventory',        label: 'Απογραφές',       sublabel: 'Μηνιαία καταμέτρηση',     icon: ClipboardList,   color: 'text-emerald-400 bg-emerald-500/10' },
  { id: 'suppliers',        label: 'Προμηθευτές',     sublabel: 'Στοιχεία & ημέρες',       icon: Building2,       color: 'text-violet-400 bg-violet-500/10' },
  { id: 'categories',       label: 'Κατηγορίες',      sublabel: 'Οργάνωση προϊόντων',      icon: FolderOpen,      color: 'text-amber-400 bg-amber-500/10' },
  { id: 'storage',          label: 'Θέσεις',          sublabel: 'Ψυγεία & αποθήκες',       icon: MapPin,          color: 'text-rose-400 bg-rose-500/10' },
  { id: 'schedule',         label: 'Πρόγραμμα',       sublabel: 'Ημερολόγιο παραδόσεων',   icon: CalendarDays,    color: 'text-teal-400 bg-teal-500/10' },
  { id: 'import',           label: 'Εισαγωγή Excel',  sublabel: 'Μαζική εισαγωγή',         icon: FileSpreadsheet, color: 'text-lime-400 bg-lime-500/10' },
]

export default function Warehouse() {
  const [page, setPage] = useState<WarehousePage | null>(null)
  const [productFilter, setProductFilter] = useState<Record<string, string>>({})

  function navigateTo(_target: 'products', filter: Record<string, string>) {
    setProductFilter(filter)
    setPage('products')
  }

  const activePage = NAV.find((n) => n.id === page)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {page && (
          <button
            onClick={() => setPage(null)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-glass-border text-white/40 hover:text-white hover:bg-white/5 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-white">
            {activePage ? activePage.label : 'Αποθήκη'}
          </h1>
          {!page && <p className="text-xs text-white/40">Διαχείριση αποθέματος & παραγγελιών</p>}
        </div>
      </div>

      {/* Sub-page content */}
      {page === 'products'  && <WareProducts initialFilter={productFilter} />}
      {page === 'orders'    && <WareOrders />}
      {page === 'inventory' && <WareInventory />}
      {page === 'suppliers' && <WareSuppliers onNavigate={navigateTo} />}
      {page === 'categories'&& <WareCategories onNavigate={navigateTo} />}
      {page === 'storage'   && <WareStorageLocations onNavigate={navigateTo} />}
      {page === 'schedule'  && <WareSchedule />}
      {page === 'import'    && <WareImportExcel />}

      {/* Home grid */}
      {!page && (
        <div className="grid grid-cols-2 gap-3">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => { setProductFilter({}); setPage(item.id) }}
              className="flex items-start gap-3 rounded-2xl border border-glass-border bg-white/3 p-4 text-left hover:bg-white/6 transition-all duration-150 active:scale-[0.98]"
            >
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.color.split(' ')[1])}>
                <item.icon className={cn('h-5 w-5', item.color.split(' ')[0])} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-[11px] text-white/40 mt-0.5 leading-tight">{item.sublabel}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
