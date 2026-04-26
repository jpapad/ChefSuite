import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { InventoryProvider } from '../../contexts/InventoryContext'
import { RecipesProvider } from '../../contexts/RecipesContext'

export function AppShell() {
  return (
    <InventoryProvider>
      <RecipesProvider>
        <div className="min-h-screen flex bg-transparent">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
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
