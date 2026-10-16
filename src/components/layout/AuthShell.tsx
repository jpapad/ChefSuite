import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLightTheme } from '../../lib/useLightTheme'
import { BrandMark } from './BrandMark'

/** Split layout for sign-in, sign-up and onboarding: black brand panel + form. */
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  useLightTheme()
  const { t } = useTranslation()
  const features = [
    { title: t('station.loginF1Title'), body: t('station.loginF1') },
    { title: t('station.loginF2Title'), body: t('station.loginF2') },
    { title: t('station.loginF3Title'), body: t('station.loginF3') },
  ]

  return (
    <div className="flex min-h-screen bg-bg-surface text-white">
      <aside className="relative hidden w-[46%] max-w-[680px] flex-col justify-between gap-10 overflow-hidden bg-ink p-12 text-white-fixed lg:flex">
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-8 font-display text-[520px] font-extrabold leading-none text-transparent [-webkit-text-stroke:2px_#1F1F1F]">
          C
        </span>
        <Link to="/" className="relative self-start"><BrandMark size="lg" /></Link>
        <h1 className="relative font-display text-[clamp(72px,7.5vw,112px)] font-extrabold uppercase leading-[0.85]">
          {t('station.loginHead1')}<br />
          <span className="text-signal">{t('station.loginHead2')}</span>
        </h1>
        <ul className="relative grid grid-cols-3 border-t-2 border-white-fixed">
          {features.map((f, i) => (
            <li key={f.title} className={i < 2 ? 'border-r-2 border-[#3A3A3A] pr-4 pt-4' : 'pt-4'} style={i > 0 ? { paddingLeft: 16 } : undefined}>
              <span className="font-mono text-[15px] font-bold text-signal">{String(i + 1).padStart(2, '0')}</span>
              <span className="block font-display text-[30px] font-extrabold uppercase leading-tight">{f.title}</span>
              <span className="text-[14px] text-[#D4D4D4]">{f.body}</span>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className={wide ? 'w-full max-w-2xl' : 'w-full max-w-[440px]'}>
          <Link to="/" className="mb-8 inline-flex rounded bg-ink p-2.5 lg:hidden"><BrandMark size="sm" /></Link>
          {children}
        </div>
      </main>
    </div>
  )
}

export const AuthField = forwardRef<HTMLInputElement, { label: string } & InputHTMLAttributes<HTMLInputElement>>(
  function AuthField({ label, ...rest }, ref) {
    return (
      <label className="flex flex-col gap-2">
        <span className="sb-label">{label}</span>
        <input
          ref={ref}
          {...rest}
          className="h-[60px] rounded border-2 border-inv-border bg-bg-input px-4 text-[18px] outline-none placeholder:text-white/50 focus:ring-4 focus:ring-signal/60"
        />
      </label>
    )
  },
)
