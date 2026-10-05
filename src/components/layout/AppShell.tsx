import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { SectionTabs } from './SectionTabs'
import { BottomNav } from './BottomNav'
import { InventoryProvider } from '../../contexts/InventoryContext'
import { RecipesProvider } from '../../contexts/RecipesContext'
import { PWAUpdateBanner } from '../ui/PWAUpdateBanner'

export function AppShell() {
  // The light "Bento & Lime" theme applies to the signed-in app only; public
  // pages and fullscreen buffet screens keep the root (dark) tokens. It lives on
  // <html> so drawers and other portals pick it up as well.
  useEffect(() => {
    document.documentElement.classList.add('theme-c')
    return () => document.documentElement.classList.remove('theme-c')
  }, [])

  return (
    <InventoryProvider>
      <RecipesProvider>
        <PWAUpdateBanner />
        <div className="min-h-screen flex items-start bg-bg-surface md:p-4 md:gap-2">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 min-h-[calc(100vh-2rem)]">
            <TopBar />
            <SectionTabs />
            <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6">
              <Outlet />
            </main>
          </div>
          <BottomNav />
        </div>
      </RecipesProvider>
    </InventoryProvider>
  )
}
