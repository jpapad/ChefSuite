import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Flame, Users, ChefHat, Compass,
  CheckCircle2, ArrowRight, Copy, Check,
  Mail, UserPlus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'

type UserRole = 'head_chef' | 'sous_chef' | 'cook' | 'staff'

type Step = 'invite' | 'recipe' | 'explore'

const STEPS: Step[] = ['invite', 'recipe', 'explore']

interface StepMeta {
  key: Step
  icon: typeof Users
  color: string
  bg: string
}

const STEP_META: StepMeta[] = [
  { key: 'invite',  icon: Users,     color: 'text-sky-400',          bg: 'bg-sky-400/15'         },
  { key: 'recipe',  icon: ChefHat,   color: 'text-brand-orange',     bg: 'bg-brand-orange/15'    },
  { key: 'explore', icon: Compass,   color: 'text-emerald-400',      bg: 'bg-emerald-400/15'     },
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
    <div className="min-h-screen flex items-center justify-center bg-chef-dark p-4">
      <div className="w-full max-w-lg">

        {/* Logo + greeting */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange shrink-0">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t('welcome.title')}</h1>
            <p className="text-sm text-white/45 mt-0.5">{t('welcome.subtitle', { team: teamName })}</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => {
            const done = i < currentStep || (i === currentStep && (step === 'recipe' ? recipeSaved : step === 'invite' ? !!inviteLink : false))
            const active = i === currentStep
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0 transition-all',
                  done ? 'bg-green-500 text-white' : active ? 'bg-brand-orange text-white' : 'bg-white/10 text-white/30',
                )}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn('text-xs font-medium truncate', active ? 'text-white' : 'text-white/30')}>
                  {t(`welcome.steps.${s}`)}
                </span>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-white/10" />}
              </div>
            )
          })}
        </div>

        {/* Step card */}
        <div className="glass gradient-border rounded-3xl p-6 space-y-5">

          {/* Step header */}
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', meta.bg)}>
              <meta.icon className={cn('h-5 w-5', meta.color)} />
            </div>
            <div>
              <h2 className="font-semibold leading-none">{t(`welcome.${step}.title`)}</h2>
              <p className="text-xs text-white/45 mt-0.5">{t(`welcome.${step}.desc`)}</p>
            </div>
          </div>

          {/* --- INVITE STEP --- */}
          {step === 'invite' && (
            <div className="space-y-4">
              {inviteLink ? (
                <div className="space-y-3">
                  <div className="glass rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    <span className="text-sm text-white/70 flex-1 truncate">{inviteLink}</span>
                    <button
                      type="button"
                      onClick={copyLink}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/8 hover:bg-white/15 transition shrink-0"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white/60" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setInviteLink(null) }}
                    className="text-xs text-brand-orange hover:text-brand-orange/80 transition flex items-center gap-1"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t('welcome.invite.inviteAnother')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input
                      type="email"
                      placeholder={t('welcome.invite.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void sendInvite()}
                      className="w-full rounded-xl bg-white-fixed/55 border border-white/50 text-white text-sm pl-10 pr-3 py-2.5 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/40"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['head_chef', 'sous_chef', 'cook', 'staff'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={cn(
                          'rounded-xl px-2 py-2 text-[11px] font-medium transition-all',
                          role === r ? 'bg-brand-orange text-white-fixed' : 'glass text-white/55 hover:text-white/80',
                        )}
                      >
                        {t(`team.roles.${r}`)}
                      </button>
                    ))}
                  </div>
                  {inviteError && (
                    <p className="text-xs text-red-400">{inviteError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void sendInvite()}
                    disabled={!email.trim() || inviteSending}
                    className="w-full rounded-xl bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 disabled:opacity-40 transition py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    {inviteSending ? t('welcome.invite.sending') : t('welcome.invite.sendInvite')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* --- RECIPE STEP --- */}
          {step === 'recipe' && (
            <div className="space-y-3">
              {recipeSaved ? (
                <div className="glass rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <span className="text-sm text-white/70">{t('welcome.recipe.saved', { title: recipeTitle })}</span>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder={t('welcome.recipe.titlePlaceholder')}
                    value={recipeTitle}
                    onChange={(e) => setRecipeTitle(e.target.value)}
                    className="w-full rounded-xl bg-white-fixed/55 border border-white/50 text-white text-sm px-3 py-2.5 placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/40"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/45 shrink-0">{t('welcome.recipe.servings')}</label>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={recipeServings}
                      onChange={(e) => setRecipeServings(e.target.value)}
                      className="w-20 rounded-xl bg-white-fixed/55 border border-white/50 text-white text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-brand-orange/40"
                    />
                  </div>
                  {recipeError && <p className="text-xs text-red-400">{recipeError}</p>}
                  <button
                    type="button"
                    onClick={() => void saveRecipe()}
                    disabled={!recipeTitle.trim() || recipeSaving}
                    className="w-full rounded-xl bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 disabled:opacity-40 transition py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <ChefHat className="h-4 w-4" />
                    {recipeSaving ? t('welcome.recipe.saving') : t('welcome.recipe.save')}
                  </button>
                </>
              )}
            </div>
          )}

          {/* --- EXPLORE STEP --- */}
          {step === 'explore' && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/recipes',   label: t('nav.recipes'),   emoji: '🍳' },
                { to: '/inventory', label: t('nav.inventory'), emoji: '📦' },
                { to: '/team',      label: t('nav.team'),      emoji: '👥' },
                { to: '/kds',       label: t('nav.kds'),       emoji: '🖥️' },
              ].map(({ to, label, emoji }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => navigate(to)}
                  className="glass rounded-2xl p-3 text-left hover:bg-white/8 transition-all active:scale-95 flex items-center gap-2.5"
                >
                  <span className="text-xl">{emoji}</span>
                  <span className="text-sm font-medium text-white/80">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          {currentStep < STEPS.length - 1 && !skipped.has(currentStep) ? (
            <button
              type="button"
              onClick={skip}
              className="text-sm text-white/35 hover:text-white/60 transition"
            >
              {t('welcome.skip')}
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-orange text-white-fixed px-5 py-2.5 text-sm font-medium hover:bg-brand-orange/90 transition-all"
          >
            {currentStep < STEPS.length - 1 ? t('welcome.next') : t('welcome.finish')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
