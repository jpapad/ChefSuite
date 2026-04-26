import { useState } from 'react'
import { LogOut, Flame, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { NotificationsBell } from './NotificationsBell'
import { GlobalSearch } from './GlobalSearch'

function initialsFor(name: string | null | undefined, email: string | undefined) {
  const src = (name ?? email ?? '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export function TopBar() {
  const { user, profile, signOut } = useAuth()
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  return (
    <header className="glass border-b border-glass-border px-4 sm:px-6 py-3 sticky top-0 z-10">
      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="sm:hidden flex items-center gap-2 w-full">
          <GlobalSearch onClose={() => setMobileSearchOpen(false)} />
        </div>
      )}

      {/* Normal bar */}
      {!mobileSearchOpen && (
        <div className="flex items-center gap-3">
          <div className="md:hidden flex items-center gap-2 shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange">
              <Flame className="h-5 w-5 text-white-fixed" />
            </div>
            <span className="text-lg font-semibold">Chefsuite</span>
          </div>

          <div className="hidden sm:flex flex-1">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Mobile search button */}
            <button
              type="button"
              aria-label="Search"
              onClick={() => setMobileSearchOpen(true)}
              className="sm:hidden flex h-12 w-12 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition"
            >
              <Search className="h-6 w-6" />
            </button>

            <NotificationsBell />

            <Link
              to="/profile"
              className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-brand-orange/20 text-brand-orange font-semibold hover:ring-2 hover:ring-brand-orange transition text-sm sm:text-base"
              title={profile?.full_name ?? user?.email ?? ''}
            >
              {initialsFor(profile?.full_name, user?.email)}
            </Link>

            <button
              type="button"
              aria-label="Sign out"
              onClick={() => signOut()}
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition"
            >
              <LogOut className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
