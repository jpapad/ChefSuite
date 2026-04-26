import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-chef-dark gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
        <Flame className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-6xl font-bold text-brand-orange">404</h1>
        <p className="text-xl font-semibold mt-2">{t('notFound.title')}</p>
        <p className="text-white/60 mt-1">{t('notFound.description')}</p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-xl bg-brand-orange px-6 py-3 font-semibold text-white hover:bg-brand-orange/90 transition"
      >
        {t('notFound.backToDashboard')}
      </Link>
    </div>
  )
}
