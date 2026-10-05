import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLightTheme } from '../lib/useLightTheme'

export default function NotFound() {
  const { t } = useTranslation()
  useLightTheme()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg-surface p-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-sm font-bold text-ink">CS</span>
      <p className="text-[9rem] font-medium leading-none tracking-[-0.06em] tabular-nums">404</p>
      <div>
        <h1 className="text-3xl font-medium tracking-[-0.02em]">{t('notFound.title')}</h1>
        <p className="mt-2 max-w-md text-white/55">{t('notFound.description')}</p>
      </div>
      <Link to="/" className="inline-flex h-12 items-center rounded-full bg-brand-orange px-6 font-medium text-on-accent hover:bg-brand-orange/85">
        {t('notFound.backToDashboard')}
      </Link>
    </div>
  )
}
