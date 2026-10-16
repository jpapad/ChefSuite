import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, Languages, LogOut, Search, UserRound } from 'lucide-react'
import i18n from '../i18n'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { NAV_SECTIONS } from '../components/layout/navigation'
import { Page } from '../components/ui/page'

const LANGS = ['en', 'el', 'bg'] as const
const LANG_NAMES: Record<string, string> = { en: 'English', el: 'Ελληνικά', bg: 'Български' }

const row =
  'flex min-h-[52px] w-full items-center gap-3 border-t border-glass-border px-4 text-left font-display text-[20px] font-bold leading-tight first:border-t-0 hover:bg-signal hover:text-ink'

/** Every section of the app on one page: replaces the old icon rail. */
export default function AllSections() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const { user, myTeams, signOut } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const sections = useMemo(() => NAV_SECTIONS
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => can(i.module) && (!q || t(i.labelKey).toLowerCase().includes(q))),
    }))
    .filter((s) => s.items.length > 0), [can, q, t])

  const total = NAV_SECTIONS.reduce((n, s) => n + s.items.filter((i) => can(i.module)).length, 0)

  function cycleLang() {
    const next = LANGS[(LANGS.indexOf(i18n.language as typeof LANGS[number]) + 1) % LANGS.length]
    void i18n.changeLanguage(next)
    localStorage.setItem('chefsuite_lang', next)
    if (user) void supabase.from('profiles').update({ preferred_lang: next }).eq('id', user.id)
  }

  return (
    <Page>
      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <p className="flex items-baseline gap-3">
            <span className="font-mono text-[15px] font-bold text-signal">00</span>
            <span className="sb-label text-white/60">{t('station.sectionsCount', { n: total, g: NAV_SECTIONS.length })}</span>
          </p>
          <h1 className="mt-1.5 font-display text-5xl sm:text-6xl font-extrabold uppercase leading-[0.9]">{t('station.allSections')}</h1>
        </div>
        <div className="flex-1" />
        <label className="flex h-14 w-full max-w-md items-center gap-3 rounded px-4 shadow-card focus-within:ring-4 focus-within:ring-signal/60">
          <Search className="h-5 w-5 shrink-0" strokeWidth={2.2} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search', 'Search')}
            aria-label={t('common.search', 'Search')}
            className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-white/50"
          />
        </label>
      </header>

      <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((section, idx) => (
          <section key={section.id} className="overflow-hidden rounded shadow-card">
            <h2 className="flex items-center gap-3 bg-ink px-4 py-3 font-display text-[22px] font-extrabold uppercase leading-none tracking-[0.03em] text-white-fixed">
              <span className="font-mono text-[15px] font-bold text-signal">{String(idx + 1).padStart(2, '0')}</span>
              {t(section.titleKey)}
              <span className="ml-auto font-mono text-[14px] font-medium text-[#A3A3A3]">{section.items.length}</span>
            </h2>
            <div className="flex flex-col">
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.to} to={item.to} className={row}>
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={2.2} />
                    {t(item.labelKey)}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}

        <section className="overflow-hidden rounded shadow-card">
          <h2 className="flex items-center gap-3 bg-ink px-4 py-3 font-display text-[22px] font-extrabold uppercase leading-none tracking-[0.03em] text-white-fixed">
            <span className="font-mono text-[15px] font-bold text-signal">{String(sections.length + 1).padStart(2, '0')}</span>
            {t('station.account')}
          </h2>
          <div className="flex flex-col">
            <Link to="/profile" className={row}><UserRound className="h-5 w-5 shrink-0" strokeWidth={2.2} />{t('station.profile')}</Link>
            {myTeams.length > 1 && (
              <button type="button" onClick={() => navigate('/pick-team')} className={row}>
                <ArrowLeftRight className="h-5 w-5 shrink-0" strokeWidth={2.2} />{t('nav.switchTeam')}
              </button>
            )}
            <button type="button" onClick={cycleLang} className={row}>
              <Languages className="h-5 w-5 shrink-0" strokeWidth={2.2} />{t('station.language')}
              <span className="ml-auto font-mono text-[14px] font-medium opacity-70">{LANG_NAMES[i18n.language] ?? i18n.language}</span>
            </button>
            <button type="button" onClick={() => void signOut()} className={row}>
              <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.2} />{t('station.signOut')}
            </button>
          </div>
        </section>
      </div>
    </Page>
  )
}
