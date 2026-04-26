import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Flame, Building2, Ticket, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type Mode = 'create' | 'join'

export default function Onboarding() {
  const { t } = useTranslation()
  const { user, profile, loading, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillToken = searchParams.get('invite') ?? ''

  const [mode, setMode] = useState<Mode>(prefillToken ? 'join' : 'create')
  const [teamName, setTeamName] = useState('')
  const [token, setToken] = useState(prefillToken)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (prefillToken) {
      setMode('join')
      setToken(prefillToken)
    }
  }, [prefillToken])

  if (!loading && profile?.team_id) return <Navigate to="/" replace />

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc(
        'create_team_for_current_user',
        { team_name: teamName.trim() },
      )
      if (rpcErr) throw rpcErr
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create team')
    } finally {
      setSubmitting(false)
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('accept_team_invite', {
        invite_token: token.trim(),
      })
      if (rpcErr) throw rpcErr
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join team')
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
            <h1 className="text-2xl font-semibold">{t('onboarding.title')}</h1>
            <p className="text-white/60 text-sm">{t('onboarding.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={
              'min-h-touch-target rounded-xl px-4 font-medium transition inline-flex items-center justify-center gap-2 ' +
              (mode === 'create'
                ? 'bg-brand-orange text-white-fixed'
                : 'glass text-white/80 hover:bg-white/5')
            }
          >
            <Building2 className="h-5 w-5" />
            {t('onboarding.createTeam')}
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={
              'min-h-touch-target rounded-xl px-4 font-medium transition inline-flex items-center justify-center gap-2 ' +
              (mode === 'join'
                ? 'bg-brand-orange text-white-fixed'
                : 'glass text-white/80 hover:bg-white/5')
            }
          >
            <Ticket className="h-5 w-5" />
            {t('onboarding.joinTeam')}
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={onCreate} className="space-y-4">
            <Input
              name="team_name"
              label={t('onboarding.teamName')}
              placeholder={t('onboarding.teamNamePlaceholder')}
              required
              minLength={2}
              leftIcon={<Building2 className="h-5 w-5" />}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
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
              {submitting ? t('onboarding.creatingTeam') : t('onboarding.createTeam')}
            </Button>
          </form>
        ) : (
          <form onSubmit={onJoin} className="space-y-4">
            <Input
              name="invite_token"
              label={t('onboarding.inviteToken')}
              placeholder={t('onboarding.inviteTokenPlaceholder')}
              required
              leftIcon={<Ticket className="h-5 w-5" />}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              hint={t('onboarding.inviteTokenHint')}
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
              {submitting ? t('onboarding.joining') : t('onboarding.joinTeam')}
            </Button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-white/60">
          <span>{t('onboarding.signedInAs', { email: user?.email })}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-1 text-white/70 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> {t('onboarding.signOut')}
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
