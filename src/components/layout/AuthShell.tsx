import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChefHat, Package, Flame, Users } from 'lucide-react'
import { useLightTheme } from '../../lib/useLightTheme'

/** Split layout for sign-in, sign-up and onboarding: brand panel + form. */
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  useLightTheme()
  const { t } = useTranslation()
  const features = [
    { icon: ChefHat, label: t('auth.v2.f1') },
    { icon: Package, label: t('auth.v2.f2') },
    { icon: Flame, label: t('auth.v2.f3') },
    { icon: Users, label: t('auth.v2.f4') },
  ]

  return (
    <div className="flex min-h-screen bg-bg-surface p-3 sm:p-4">
      <aside className="hidden w-[44%] max-w-[620px] flex-col justify-between rounded-[2rem] bg-ink p-10 text-white-fixed lg:flex">
        <Link to="/" className="flex items-center gap-3 self-start">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-sm font-bold text-ink">CS</span>
          <span className="text-lg font-medium">ChefSuite</span>
        </Link>
        <div className="flex flex-col gap-8">
          <h1 className="text-5xl font-medium leading-[1.05] tracking-[-0.03em]">{t('auth.v2.headline')}</h1>
          <ul className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col gap-3 rounded-3xl bg-white-fixed/[0.06] p-4">
                <Icon className="h-5 w-5 text-lime" />
                <span className="text-sm leading-snug text-white-fixed/80">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white-fixed/45">{t('auth.v2.footer')}</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className={wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
          <Link to="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-sm font-bold text-ink">CS</span>
            <span className="text-lg font-medium">ChefSuite</span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

export function AuthField({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-white/65">{label}</span>
      <input
        {...rest}
        className="h-12 rounded-2xl bg-bg-card px-4 text-[15px] shadow-card outline-none placeholder:text-white/35 focus:ring-2 focus:ring-brand-orange/40"
      />
    </label>
  )
}
