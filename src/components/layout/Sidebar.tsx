import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import i18n from '../../i18n'
import { NAV_SECTIONS, findSection } from './navigation'

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
}

// The rail is always ink-black, so it uses fixed colours rather than theme tokens.
const railBtn =
  'flex flex-col items-center justify-center gap-1 w-[76px] min-h-[60px] shrink-0 rounded-[22px] ' +
  'text-[11px] font-medium leading-none transition-colors'

const railIconBtn =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#C3C8C2] hover:bg-[#262B27] hover:text-white-fixed'

export function Sidebar() {
  const { profile, user, myTeams } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { can } = usePermissions()
  const active = findSection(pathname)

  function toggleLang() {
    const cycle = ['en', 'el', 'bg']
    const next = cycle[(cycle.indexOf(i18n.language) + 1) % cycle.length]
    void i18n.changeLanguage(next)
    localStorage.setItem('chefsuite_lang', next)
    if (user) void supabase.from('profiles').update({ preferred_lang: next }).eq('id', user.id)
  }

  return (
    <aside
      aria-label={t('nav.primary', 'Primary')}
      className="hidden md:flex flex-col items-center w-[92px] shrink-0 sticky top-4 h-[calc(100vh-2rem)] rounded-[2rem] bg-ink py-3.5 gap-1 overflow-y-auto scrollbar-none shadow-[0_8px_24px_rgba(15,18,16,0.18)]"
    >
      <Link
        to="/"
        aria-label="ChefSuite"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-ink text-sm font-bold mb-2"
      >
        CS
      </Link>

      {/* One button per section; it opens the first sub-page the user may see */}
      {NAV_SECTIONS.map((section) => {
        const first = section.items.find((i) => can(i.module))
        if (!first) return null
        const Icon = section.icon
        return (
          <NavLink
            key={section.id}
            to={first.to}
            end={first.end}
            title={t(section.titleKey)}
            className={cn(
              railBtn,
              active?.id === section.id
                ? 'bg-lime text-ink'
                : 'text-[#C3C8C2] hover:bg-[#262B27] hover:text-white-fixed',
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.8} />
            <span className="max-w-full truncate px-1">{t(section.shortKey)}</span>
          </NavLink>
        )
      })}

      <div className="flex-1 min-h-3" />

      {myTeams.length > 1 && (
        <button
          type="button"
          title={t('nav.switchTeam')}
          aria-label={t('nav.switchTeam')}
          onClick={() => navigate('/pick-team')}
          className={railIconBtn}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
      )}
      <button type="button" onClick={toggleLang} title="Language" aria-label="Language" className={railIconBtn}>
        <Languages className="h-4 w-4" />
      </button>
      <NavLink
        to="/profile"
        title={profile?.full_name ?? 'Profile'}
        className={({ isActive }) => cn(
          'mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white-fixed text-ink text-[11px] font-bold',
          isActive && 'ring-2 ring-lime ring-offset-2 ring-offset-ink',
        )}
      >
        {getInitials(profile?.full_name)}
      </NavLink>
    </aside>
  )
}
