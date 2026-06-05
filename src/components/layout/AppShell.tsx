import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { InventoryProvider } from '../../contexts/InventoryContext'
import { RecipesProvider } from '../../contexts/RecipesContext'
import { PWAUpdateBanner } from '../ui/PWAUpdateBanner'

export function AppShell() {
  return (
    <InventoryProvider>
      <RecipesProvider>
        <PWAUpdateBanner />
        <div className="min-h-screen flex bg-transparent md:p-4 md:gap-4">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <TopBar />
            <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 overflow-auto">
              <Outlet />
            </main>
          </div>
          <BottomNav />
        </div>
      </RecipesProvider>
    </InventoryProvider>
  )
}
