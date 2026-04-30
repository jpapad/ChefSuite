import { type FormEvent, useState } from 'react'
import { UserCircle2, Mail, Shield, KeyRound, Save, Bell, BellOff, BellRing, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { UserRole } from '../types/database.types'
import { useNotifications } from '../hooks/useNotifications'
import { usePushSubscription } from '../hooks/usePushSubscription'
import i18n from '../i18n'
import { cn } from '../lib/cn'

function roleLabel(role: UserRole): string {
  return role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export default function Profile() {
  const { t } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()
  const { supported: notifSupported, permission: notifPermission, request: requestNotif } = useNotifications()
  const { status: pushStatus, busy: pushBusy, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [savingLang, setSavingLang] = useState(false)

  async function onSelectLang(lang: string) {
    setSavingLang(true)
    void i18n.changeLanguage(lang)
    localStorage.setItem('chefsuite_lang', lang)
    await supabase.from('profiles').update({ preferred_lang: lang }).eq('id', user!.id)
    await refreshProfile()
    setSavingLang(false)
  }

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)

  async function onSaveName(e: FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    if (!name) return
    setSavingName(true)
    setNameError(null)
    setNameSuccess(false)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name })
        .eq('id', user!.id)
      if (error) throw error
      await refreshProfile()
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 2500)
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not save name')
    } finally {
      setSavingName(false)
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwdError(t('profile.passwordsNoMatch'))
      return
    }
    if (newPassword.length < 8) {
      setPwdError(t('profile.passwordTooShort'))
      return
    }
    setSavingPwd(true)
    setPwdError(null)
    setPwdSuccess(false)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      })
      if (signInErr) throw new Error(t('profile.passwordIncorrect'))

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwdSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwdSuccess(false), 2500)
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <header>
        <h1 className="text-3xl font-semibold">{t('profile.title')}</h1>
        <p className="text-white/60 mt-1">{t('profile.subtitle')}</p>
      </header>

      <GlassCard className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-orange/20 text-brand-orange text-2xl font-semibold shrink-0">
          {(profile?.full_name ?? user?.email ?? '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-lg truncate">
            {profile?.full_name ?? '—'}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-white/60">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-4 w-4" />
              {user?.email}
            </span>
            {profile?.role && (
              <span className="inline-flex items-center gap-1">
                <Shield className="h-4 w-4" />
                {roleLabel(profile.role)}
              </span>
            )}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold mb-4">{t('profile.displayName')}</h2>
        <form onSubmit={onSaveName} className="space-y-4">
          <Input
            name="full_name"
            label={t('profile.fullName')}
            placeholder={t('profile.namePlaceholder')}
            leftIcon={<UserCircle2 className="h-5 w-5" />}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
          />
          {nameError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {nameError}
            </p>
          )}
          {nameSuccess && (
            <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {t('profile.nameUpdated')}
            </p>
          )}
          <Button
            type="submit"
            leftIcon={<Save className="h-4 w-4" />}
            disabled={savingName || fullName.trim() === (profile?.full_name ?? '')}
          >
            {savingName ? t('profile.savingName') : t('profile.saveName')}
          </Button>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className="text-lg font-semibold mb-4">{t('profile.changePassword')}</h2>
        <form onSubmit={onChangePassword} className="space-y-4">
          <Input
            name="current_password"
            label={t('profile.currentPassword')}
            type="password"
            placeholder="••••••••"
            leftIcon={<KeyRound className="h-5 w-5" />}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            name="new_password"
            label={t('profile.newPassword')}
            type="password"
            placeholder="••••••••"
            leftIcon={<KeyRound className="h-5 w-5" />}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            hint={t('profile.minPasswordHint')}
          />
          <Input
            name="confirm_password"
            label={t('profile.confirmPassword')}
            type="password"
            placeholder="••••••••"
            leftIcon={<KeyRound className="h-5 w-5" />}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {pwdError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {pwdError}
            </p>
          )}
          {pwdSuccess && (
            <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {t('profile.passwordChanged')}
            </p>
          )}
          <Button
            type="submit"
            leftIcon={<KeyRound className="h-4 w-4" />}
            disabled={savingPwd}
          >
            {savingPwd ? t('profile.updatingPassword') : t('profile.updatePassword')}
          </Button>
        </form>
      </GlassCard>

      {/* ── Language ── */}
      <GlassCard>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Languages className="h-5 w-5 text-brand-orange" />
          {t('profile.language')}
        </h2>
        <p className="text-xs text-white/45 mb-4">{t('profile.languageHint')}</p>
        <div className="flex gap-2 flex-wrap">
          {(['en', 'el', 'bg'] as const).map((lang) => {
            const labels: Record<string, string> = { en: 'English', el: 'Ελληνικά', bg: 'Български' }
            const active = i18n.language === lang
            return (
              <button
                key={lang}
                type="button"
                disabled={savingLang}
                onClick={() => void onSelectLang(lang)}
                className={cn(
                  'px-4 py-2 rounded-xl border text-sm font-medium transition',
                  active
                    ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                    : 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/90 hover:bg-white/5',
                )}
              >
                {labels[lang]}
              </button>
            )
          })}
        </div>
      </GlassCard>

      {/* ── Notifications ── */}
      <GlassCard>
        <h2 className="text-lg font-semibold mb-4">{t('profile.notifications.title')}</h2>
        {!notifSupported ? (
          <p className="text-sm text-white/50">{t('profile.notifications.unsupported')}</p>
        ) : notifPermission === 'denied' ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <BellOff className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-300">{t('profile.notifications.denied')}</p>
              <p className="text-xs text-white/50 mt-0.5">{t('profile.notifications.deniedHint')}</p>
            </div>
          </div>
        ) : notifPermission !== 'granted' ? (
          <div className="space-y-3">
            <p className="text-sm text-white/60">{t('profile.notifications.description')}</p>
            <Button
              leftIcon={<Bell className="h-4 w-4" />}
              onClick={() => void requestNotif()}
            >
              {t('profile.notifications.enable')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Browser in-app notifications — granted */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-300">{t('profile.notifications.enabled')}</p>
                <p className="text-xs text-white/50 mt-0.5">{t('profile.notifications.enabledHint')}</p>
              </div>
            </div>

            {/* Push notifications toggle */}
            <div className="border-t border-white/8 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition',
                    pushStatus === 'subscribed'
                      ? 'bg-brand-orange/15 text-brand-orange'
                      : 'bg-white/8 text-white/40',
                  )}>
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/90">{t('profile.notifications.pushTitle')}</p>
                    <p className="text-xs text-white/45 mt-0.5">
                      {pushStatus === 'subscribed'
                        ? t('profile.notifications.pushActiveHint')
                        : pushStatus === 'unsupported'
                        ? t('profile.notifications.pushUnsupported')
                        : t('profile.notifications.pushDescription')}
                    </p>
                  </div>
                </div>

                {pushStatus !== 'unsupported' && pushStatus !== 'loading' && (
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={() => void (pushStatus === 'subscribed' ? pushUnsubscribe() : pushSubscribe())}
                    className={cn(
                      'shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none',
                      pushBusy && 'opacity-50 cursor-not-allowed',
                      pushStatus === 'subscribed' ? 'bg-brand-orange' : 'bg-white/15',
                    )}
                    role="switch"
                    aria-checked={pushStatus === 'subscribed'}
                  >
                    <span className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                      pushStatus === 'subscribed' ? 'translate-x-6' : 'translate-x-1',
                    )} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
