import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Ticket, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AuthShell, AuthField } from '../components/layout/AuthShell'
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
      navigate('/welcome', { replace: true })
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

  const errorBox = error && (
    <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
  )

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-4xl font-medium tracking-[-0.03em]">{t('onboarding.title')}</h2>
          <p className="mt-1.5 text-white/55">{t('onboarding.subtitle')}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {([
            { key: 'create' as Mode, icon: Building2, label: t('onboarding.createTeam') },
            { key: 'join' as Mode, icon: Ticket, label: t('onboarding.joinTeam') },
          ]).map(({ key, icon: Icon, label }) => (
            <button key={key} type="button" onClick={() => setMode(key)}
              className={`flex flex-col items-start gap-6 rounded-3xl p-4 text-left transition ${mode === key ? 'bg-ink text-white-fixed' : 'bg-bg-card shadow-card hover:-translate-y-0.5'}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${mode === key ? 'bg-lime text-ink' : 'bg-white/[0.06]'}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[15px] font-medium leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {mode === 'create' ? (
          <form onSubmit={onCreate} className="flex flex-col gap-4">
            <AuthField label={t('onboarding.teamName')} name="team_name" placeholder={t('onboarding.teamNamePlaceholder')}
              required minLength={2} value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            {errorBox}
            <button type="submit" disabled={submitting}
              className="h-12 rounded-full bg-brand-orange text-[15px] font-medium text-on-accent hover:bg-brand-orange/85 disabled:opacity-60">
              {submitting ? t('onboarding.creatingTeam') : t('onboarding.createTeam')}
            </button>
          </form>
        ) : (
          <form onSubmit={onJoin} className="flex flex-col gap-4">
            <AuthField label={t('onboarding.inviteToken')} name="invite_token" placeholder={t('onboarding.inviteTokenPlaceholder')}
              required value={token} onChange={(e) => setToken(e.target.value)} />
            <p className="-mt-2 text-xs text-white/50">{t('onboarding.inviteTokenHint')}</p>
            {errorBox}
            <button type="submit" disabled={submitting}
              className="h-12 rounded-full bg-brand-orange text-[15px] font-medium text-on-accent hover:bg-brand-orange/85 disabled:opacity-60">
              {submitting ? t('onboarding.joining') : t('onboarding.joinTeam')}
            </button>
          </form>
        )}

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg-card px-4 py-3 text-sm shadow-card">
          <span className="truncate text-white/60">{t('onboarding.signedInAs', { email: user?.email })}</span>
          <button type="button" onClick={() => signOut()} className="inline-flex shrink-0 items-center gap-1.5 font-medium hover:underline">
            <LogOut className="h-4 w-4" />{t('onboarding.signOut')}
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
