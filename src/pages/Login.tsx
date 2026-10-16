import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { ArrowRight } from 'lucide-react'
import { AuthShell, AuthField } from '../components/layout/AuthShell'
import { IntroSplash } from '../components/auth/IntroSplash'

export default function Login() {
  const { t } = useTranslation()
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [introRun, setIntroRun] = useState(0)

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
      <IntroSplash runKey={introRun} onDone={() => emailRef.current?.focus()} />
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-display text-6xl font-extrabold uppercase leading-[0.9]">{t('login.signIn')}</h2>
          <p className="mt-2 text-base text-white/60">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <AuthField ref={emailRef} label={t('login.email')} type="email" placeholder="chef@kitchen.com" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <AuthField label={t('login.password')} type="password" placeholder="••••••••••" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />

          {error && <div className="rounded border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[15px] font-medium text-red-500">{error}</div>}

          <button type="submit" disabled={submitting}
            className="mt-1 flex h-16 items-center justify-center gap-2.5 rounded bg-brand-orange font-display text-[22px] font-extrabold uppercase tracking-[0.05em] text-on-accent transition hover:text-signal disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? t('login.signingIn') : t('login.signIn')}
            {!submitting && <ArrowRight className="h-5 w-5" strokeWidth={2.4} />}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t-2 border-inv-border pt-5">
          <span className="text-base text-white/60">{t('login.newHere')}</span>
          <Link to="/signup" className="sb-label text-[17px] underline decoration-signal decoration-[3px] underline-offset-4">
            {t('login.createNewTeam')} →
          </Link>
          <span className="flex-1" />
          <button type="button" onClick={() => setIntroRun((n) => n + 1)} className="sb-label text-white/60 hover:text-white">
            {t('station.introReplay')}
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
