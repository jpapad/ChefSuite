import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Flame, Lock, Mail, User as UserIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
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
        navigate('/', { replace: true })
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
    <div className="min-h-screen flex items-center justify-center bg-chef-dark p-6">
      <GlassCard variant="strong" className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange">
            <Flame className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{t('signup.title')}</h1>
            <p className="text-white/60 text-sm">{t('signup.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            name="full_name"
            label={t('signup.fullName')}
            placeholder={t('signup.fullNamePlaceholder')}
            autoComplete="name"
            required
            leftIcon={<UserIcon className="h-5 w-5" />}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            type="email"
            name="email"
            label={t('signup.email')}
            placeholder={t('signup.emailPlaceholder')}
            autoComplete="email"
            required
            leftIcon={<Mail className="h-5 w-5" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            name="password"
            label={t('signup.password')}
            placeholder={t('signup.passwordHint')}
            autoComplete="new-password"
            minLength={6}
            required
            leftIcon={<Lock className="h-5 w-5" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">
              {error}
            </div>
          )}
          {info && (
            <div className="glass rounded-xl px-4 py-3 text-sm text-emerald-300 border border-emerald-500/40">
              {info}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? t('signup.creatingAccount') : t('signup.createAccount')}
          </Button>
        </form>

        <p className="text-center text-sm text-white/60 mt-6">
          {t('signup.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-brand-orange hover:underline">
            {t('signup.signIn')}
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
