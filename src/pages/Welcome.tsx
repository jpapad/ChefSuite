import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Users, ChefHat, Compass, BookOpen, Package, MonitorPlay,
  CheckCircle2, ArrowRight, Copy, Check,
  Mail, UserPlus,
} from 'lucide-react'
import { AuthShell } from '../components/layout/AuthShell'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'

type UserRole = 'head_chef' | 'sous_chef' | 'cook' | 'staff'

type Step = 'invite' | 'recipe' | 'explore'

const STEPS: Step[] = ['invite', 'recipe', 'explore']

interface StepMeta {
  key: Step
  icon: typeof Users
}

const STEP_META: StepMeta[] = [
  { key: 'invite',  icon: Users },
  { key: 'recipe',  icon: ChefHat },
  { key: 'explore', icon: Compass },
]

export default function Welcome() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(0)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())

  // Invite step state
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('cook')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Recipe step state
  const [recipeTitle, setRecipeTitle] = useState('')
  const [recipeServings, setRecipeServings] = useState('4')
  const [recipeSaving, setRecipeSaving] = useState(false)
  const [recipeSaved, setRecipeSaved] = useState(false)
  const [recipeError, setRecipeError] = useState<string | null>(null)

  const teamId = profile?.team_id
  const teamName = (profile as unknown as Record<string, unknown> & { team?: { name?: string } })?.team?.name ?? 'your team'

  async function sendInvite() {
    if (!email.trim()) return
    setInviteSending(true)
    setInviteError(null)
    try {
      const { data, error } = await supabase.rpc('create_team_invite', {
        invite_email: email.trim(),
        invite_role: role,
      })
      if (error) throw error
      const token = (data as { token?: string })?.token ?? (data as { id?: string })?.id
      const link = `${window.location.origin}/onboarding?invite=${token}`
      setInviteLink(link)
      setEmail('')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteSending(false)
    }
  }

  function copyLink() {
    if (!inviteLink) return
    void navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveRecipe() {
    if (!recipeTitle.trim() || !teamId) return
    setRecipeSaving(true)
    setRecipeError(null)
    try {
      const { error } = await supabase.from('recipes').insert({
        team_id: teamId,
        title: recipeTitle.trim(),
        servings: parseInt(recipeServings) || 4,
        status: 'active',
      })
      if (error) throw error
      setRecipeSaved(true)
    } catch (err) {
      setRecipeError(err instanceof Error ? err.message : 'Failed to save recipe')
    } finally {
      setRecipeSaving(false)
    }
  }

  function next() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      navigate('/', { replace: true })
    }
  }

  function skip() {
    setSkipped((s) => new Set([...s, currentStep]))
    next()
  }

  const step = STEPS[currentStep]
  const meta = STEP_META[currentStep]

  return (
    <AuthShell>
      <div className="flex flex-col gap-4">
        {/* Greeting + progress */}
        <div className="rounded-3xl bg-ink p-6 text-white-fixed">
          <p className="text-sm text-white-fixed/55">{t('welcome.subtitle', { team: teamName })}</p>
          <h2 className="mt-1 text-3xl font-medium tracking-[-0.03em]">{t('welcome.title')}</h2>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => {
              const done = i < currentStep || (i === currentStep && (step === 'recipe' ? recipeSaved : step === 'invite' ? !!inviteLink : false))
              const active = i === currentStep
              return (
                <div key={s} className="flex flex-col gap-2">
                  <span className={cn('h-1.5 rounded-full', done || active ? 'bg-lime' : 'bg-white-fixed/15')} />
                  <span className={cn('flex items-center gap-1 text-xs', active ? 'text-white-fixed' : 'text-white-fixed/45')}>
                    {done && <CheckCircle2 className="h-3.5 w-3.5 text-lime" />}
                    {t(`welcome.steps.${s}`)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Step card */}
        <div className="flex flex-col gap-5 rounded-3xl bg-bg-card p-6 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-ink">
              <meta.icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-medium leading-tight">{t(`welcome.${step}.title`)}</h3>
              <p className="text-sm text-white/55">{t(`welcome.${step}.desc`)}</p>
            </div>
          </div>

          {/* --- INVITE STEP --- */}
          {step === 'invite' && (
            inviteLink ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-2xl bg-bg-input p-2 pl-4">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="flex-1 truncate text-sm text-white/70">{inviteLink}</span>
                  <button type="button" onClick={copyLink}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-card shadow-card">
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-white/60" />}
                  </button>
                </div>
                <button type="button" onClick={() => { setInviteLink(null) }}
                  className="flex items-center gap-1.5 self-start text-sm font-medium underline-offset-4 hover:underline">
                  <UserPlus className="h-4 w-4" />{t('welcome.invite.inviteAnother')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input type="email" placeholder={t('welcome.invite.emailPlaceholder')} value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void sendInvite()}
                    className="w-full h-12 rounded-2xl bg-bg-input px-4 text-[15px] outline-none placeholder:text-white/35 focus:ring-2 focus:ring-brand-orange/40 pl-10" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['head_chef', 'sous_chef', 'cook', 'staff'] as UserRole[]).map((r) => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className={cn('h-9 rounded-full px-4 text-sm font-medium transition',
                        role === r ? 'bg-ink text-white-fixed' : 'bg-bg-input text-white/65 hover:text-white')}>
                      {t(`team.roles.${r}`)}
                    </button>
                  ))}
                </div>
                {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
                <button type="button" onClick={() => void sendInvite()} disabled={!email.trim() || inviteSending}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-ink transition hover:brightness-95 disabled:opacity-40">
                  <UserPlus className="h-4 w-4" />
                  {inviteSending ? t('welcome.invite.sending') : t('welcome.invite.sendInvite')}
                </button>
              </div>
            )
          )}

          {/* --- RECIPE STEP --- */}
          {step === 'recipe' && (
            recipeSaved ? (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-sm">{t('welcome.recipe.saved', { title: recipeTitle })}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <input type="text" placeholder={t('welcome.recipe.titlePlaceholder')} value={recipeTitle}
                  onChange={(e) => setRecipeTitle(e.target.value)} className="w-full h-12 rounded-2xl bg-bg-input px-4 text-[15px] outline-none placeholder:text-white/35 focus:ring-2 focus:ring-brand-orange/40" />
                <label className="flex items-center gap-3">
                  <span className="text-sm text-white/55">{t('welcome.recipe.servings')}</span>
                  <input type="number" min="1" max="999" value={recipeServings}
                    onChange={(e) => setRecipeServings(e.target.value)}
                    className="h-11 w-24 rounded-2xl bg-bg-input px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand-orange/40" />
                </label>
                {recipeError && <p className="text-sm text-red-500">{recipeError}</p>}
                <button type="button" onClick={() => void saveRecipe()} disabled={!recipeTitle.trim() || recipeSaving}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-lime text-[15px] font-medium text-ink transition hover:brightness-95 disabled:opacity-40">
                  <ChefHat className="h-4 w-4" />
                  {recipeSaving ? t('welcome.recipe.saving') : t('welcome.recipe.save')}
                </button>
              </div>
            )
          )}

          {/* --- EXPLORE STEP --- */}
          {step === 'explore' && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/recipes',   label: t('nav.recipes'),   icon: BookOpen },
                { to: '/inventory', label: t('nav.inventory'), icon: Package },
                { to: '/team',      label: t('nav.team'),      icon: Users },
                { to: '/kds',       label: t('nav.kds'),       icon: MonitorPlay },
              ].map(({ to, label, icon: Icon }) => (
                <button key={to} type="button" onClick={() => navigate(to)}
                  className="flex flex-col items-start gap-6 rounded-2xl bg-bg-input p-4 text-left transition hover:bg-white/[0.08] active:scale-[0.98]">
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {currentStep < STEPS.length - 1 && !skipped.has(currentStep) ? (
            <button type="button" onClick={skip} className="px-2 text-sm text-white/50 hover:text-white">
              {t('welcome.skip')}
            </button>
          ) : <div />}
          <button type="button" onClick={next}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-orange px-6 text-[15px] font-medium text-on-accent hover:bg-brand-orange/85">
            {currentStep < STEPS.length - 1 ? t('welcome.next') : t('welcome.finish')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
