import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { GlobalHeader } from './GlobalHeader'
import { SectionTabs } from './SectionTabs'
import { BottomNav } from './BottomNav'
import { InventoryProvider } from '../../contexts/InventoryContext'
import { RecipesProvider } from '../../contexts/RecipesContext'
import { PWAUpdateBanner } from '../ui/PWAUpdateBanner'
import { useAuth } from '../../contexts/AuthContext'
import { rememberKitchen } from '../auth/IntroSplash'

/**
 * Kitchen-floor screens run on the dark "night" theme: less glare under the
 * pass lights and the same look as the KDS. Everything else is the day theme.
 */
const NIGHT_ROUTES = ['/kds', '/prep', '/haccp', '/haccp-logbook', '/handover', '/waste']

export function isNightRoute(pathname: string) {
  return NIGHT_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

export function AppShell() {
  const { pathname } = useLocation()
  const night = isNightRoute(pathname)
  const { profile, myTeams } = useAuth()

  // The login intro greets the kitchen by name; remember which one this is.
  useEffect(() => {
    rememberKitchen(myTeams.find((t) => t.id === profile?.team_id)?.name)
  }, [myTeams, profile?.team_id])

  // The day theme applies to the signed-in app only; public pages and
  // fullscreen buffet screens keep the root tokens. It lives on <html> so
  // drawers and other portals pick it up as well.
  useEffect(() => {
    document.documentElement.classList.add('theme-c')
    return () => document.documentElement.classList.remove('theme-c')
  }, [])

  return (
    <InventoryProvider>
      <RecipesProvider>
        <PWAUpdateBanner />
        <div className={cn('min-h-screen flex flex-col bg-bg-surface text-white', night && 'theme-dark')}>
          <GlobalHeader />
          <SectionTabs />
          <main className="flex-1 p-4 sm:p-6 pb-28 md:pb-8">
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </RecipesProvider>
    </InventoryProvider>
  )
}
