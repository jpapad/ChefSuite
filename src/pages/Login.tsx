import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Flame, Lock, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { t } = useTranslation()
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
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
    <div className="min-h-screen flex items-center justify-center bg-chef-dark p-6">
      <GlassCard variant="strong" className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange">
            <Flame className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Chefsuite</h1>
            <p className="text-white/60 text-sm">{t('login.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="email"
            name="email"
            label={t('login.email')}
            placeholder={t('login.emailPlaceholder')}
            autoComplete="email"
            required
            leftIcon={<Mail className="h-5 w-5" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            name="password"
            label={t('login.password')}
            placeholder="••••••••"
            autoComplete="current-password"
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

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? t('login.signingIn') : t('login.signIn')}
          </Button>
        </form>

        <p className="text-center text-sm text-white/60 mt-6">
          {t('login.noAccount')}{' '}
          <Link to="/signup" className="text-brand-orange hover:underline">
            {t('login.createOne')}
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
