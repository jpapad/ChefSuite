import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { ArrowRight, Building2 } from 'lucide-react'
import { AuthShell, AuthField } from '../components/layout/AuthShell'

export default function Login() {
  const { t } = useTranslation()
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  if (!loading && session) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-7">
        <div>
          <h2 className="text-4xl font-medium tracking-[-0.03em]">{t('login.signIn')}</h2>
          <p className="mt-1.5 text-white/55">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <AuthField label={t('login.email')} type="email" placeholder="chef@kitchen.com" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <AuthField label={t('login.password')} type="password" placeholder="••••••••••" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />

          {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

          <button type="submit" disabled={submitting}
            className="mt-1 flex h-12 items-center justify-center gap-2 rounded-full bg-brand-orange text-[15px] font-medium text-on-accent transition hover:bg-brand-orange/85 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? t('login.signingIn') : t('login.signIn')}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/45">{t('login.newHere')}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <Link to="/signup" className="flex h-12 items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-ink transition hover:brightness-95">
          <Building2 className="h-4 w-4" />{t('login.createNewTeam')}
        </Link>
      </div>
    </AuthShell>
  )
}
