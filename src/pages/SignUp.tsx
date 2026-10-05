import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthShell, AuthField } from '../components/layout/AuthShell'
import { useAuth } from '../contexts/AuthContext'

export default function SignUp() {
  const { t } = useTranslation()
  const { session, loading, signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const { hasSession } = await signUp(email, password, fullName)
      if (hasSession) {
        navigate('/onboarding', { replace: true })
      } else {
        setInfo(t('signup.accountCreated'))
        setTimeout(() => navigate('/login', { replace: true }), 1500)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed'
      setError(
        /already registered/i.test(message)
          ? t('signup.emailAlreadyRegistered')
          : message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-4xl font-medium tracking-[-0.03em]">{t('signup.ownerTitle')}</h2>
          <p className="mt-1.5 text-white/55">{t('signup.ownerSubtitle')}</p>
        </div>
        <p className="rounded-2xl bg-lime/30 px-4 py-3 text-sm text-ink">{t('signup.ownerNote')}</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <AuthField label={t('signup.fullName')} name="full_name" placeholder={t('signup.fullNamePlaceholder')} autoComplete="name" required
            value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <AuthField label={t('signup.email')} type="email" name="email" placeholder={t('signup.emailPlaceholder')} autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <AuthField label={t('signup.password')} type="password" name="password" placeholder={t('signup.passwordHint')} autoComplete="new-password" minLength={6} required
            value={password} onChange={(e) => setPassword(e.target.value)} />

          {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
          {info && <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">{info}</div>}

          <button type="submit" disabled={submitting}
            className="mt-1 h-12 rounded-full bg-brand-orange text-[15px] font-medium text-on-accent transition hover:bg-brand-orange/85 disabled:opacity-60">
            {submitting ? t('signup.creatingAccount') : t('signup.createAccount')}
          </button>
        </form>

        <p className="text-center text-sm text-white/55">
          {t('signup.alreadyHaveAccount')}{' '}
          <Link to="/login" className="font-medium text-white underline-offset-4 hover:underline">{t('signup.signIn')}</Link>
        </p>
      </div>
    </AuthShell>
  )
}
