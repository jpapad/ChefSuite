import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Copy, Check, RefreshCw, Zap, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'

type Provider = 'viva' | 'square'

interface PosSettingsRow {
  team_id: string
  provider: Provider
  team_token: string
  webhook_secret: string | null
  active: boolean
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

function webhookUrl(token: string): string {
  return `${SUPABASE_URL}/functions/v1/pos-webhook?token=${token}`
}

export default function PosSettings() {
  const { t } = useTranslation()
  const { profile } = useAuth()

  const [settings, setSettings] = useState<PosSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [provider, setProvider] = useState<Provider>('viva')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!profile?.team_id) return
    supabase
      .from('pos_settings')
      .select('*')
      .eq('team_id', profile.team_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as PosSettingsRow
          setSettings(row)
          setProvider(row.provider)
          setWebhookSecret(row.webhook_secret ?? '')
          setActive(row.active)
        }
        setLoading(false)
      })
  }, [profile?.team_id])

  async function save() {
    if (!profile?.team_id) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const payload = {
        team_id: profile.team_id,
        provider,
        webhook_secret: webhookSecret.trim() || null,
        active,
      }
      const { data, error: err } = await supabase
        .from('pos_settings')
        .upsert(payload, { onConflict: 'team_id' })
        .select('*')
        .single()
      if (err) throw err
      setSettings(data as PosSettingsRow)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function copyUrl() {
    if (!settings) return
    await navigator.clipboard.writeText(webhookUrl(settings.team_token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateToken() {
    if (!profile?.team_id) return
    const ok = window.confirm(t('pos.regenerateConfirm'))
    if (!ok) return
    const newToken = crypto.randomUUID()
    const { data, error: err } = await supabase
      .from('pos_settings')
      .update({ team_token: newToken })
      .eq('team_id', profile.team_id)
      .select('*')
      .single()
    if (!err && data) setSettings(data as PosSettingsRow)
  }

  if (loading) return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-3xl font-semibold">{t('pos.title')}</h1>
      </header>
      <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-brand-orange" />
          {t('pos.title')}
        </h1>
        <p className="text-white/60 mt-1">{t('pos.subtitle')}</p>
      </header>

      {/* How it works */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">{t('pos.howItWorks')}</h2>
        <ol className="space-y-2 text-sm text-white/70">
          <li className="flex gap-2"><span className="text-brand-orange font-bold shrink-0">1.</span>{t('pos.step1')}</li>
          <li className="flex gap-2"><span className="text-brand-orange font-bold shrink-0">2.</span>{t('pos.step2')}</li>
          <li className="flex gap-2"><span className="text-brand-orange font-bold shrink-0">3.</span>{t('pos.step3')}</li>
        </ol>
      </GlassCard>

      {/* Provider selection */}
      <GlassCard>
        <h2 className="text-lg font-semibold mb-4">{t('pos.provider')}</h2>
        <div className="flex gap-3">
          {(['viva', 'square'] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 rounded-xl border p-4 transition',
                provider === p
                  ? 'border-brand-orange bg-brand-orange/10 text-brand-orange'
                  : 'border-white/10 text-white/50 hover:border-white/25 hover:bg-white/5',
              )}
            >
              <span className="text-2xl">{p === 'viva' ? '🇬🇷' : '🟦'}</span>
              <span className="text-sm font-semibold">
                {p === 'viva' ? 'Viva Wallet' : 'Square'}
              </span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Webhook URL card — shown once settings exist */}
      {settings && (
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t('pos.webhookUrl')}</h2>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              settings.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/40',
            )}>
              {settings.active ? t('pos.active') : t('pos.inactive')}
            </span>
          </div>
          <p className="text-xs text-white/40 mb-3">{t('pos.webhookHint')}</p>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <code className="flex-1 text-xs text-white/70 truncate font-mono">
              {webhookUrl(settings.team_token)}
            </code>
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="shrink-0 text-white/40 hover:text-white transition"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex justify-between items-center mt-3">
            <p className="text-xs text-white/30 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('pos.tokenHint')}
            </p>
            <button
              type="button"
              onClick={() => void regenerateToken()}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition"
            >
              <RefreshCw className="h-3 w-3" />
              {t('pos.regenerate')}
            </button>
          </div>
        </GlassCard>
      )}

      {/* Configuration */}
      <GlassCard>
        <h2 className="text-lg font-semibold mb-4">{t('pos.configuration')}</h2>
        <div className="space-y-4">

          {/* Webhook secret (Square requires it, Viva optional) */}
          <Input
            label={provider === 'square' ? t('pos.squareSecret') : t('pos.vivaSecret')}
            placeholder={provider === 'square' ? 'whsk_...' : t('pos.optional')}
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            hint={provider === 'square' ? t('pos.squareSecretHint') : t('pos.vivaSecretHint')}
          />

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 border-t border-white/8">
            <div>
              <p className="text-sm font-medium">{t('pos.enableIntegration')}</p>
              <p className="text-xs text-white/40 mt-0.5">{t('pos.enableHint')}</p>
            </div>
            <button
              type="button"
              onClick={() => setActive((v) => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                active ? 'bg-brand-orange' : 'bg-white/20',
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                active ? 'translate-x-6' : 'translate-x-1',
              )} />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {t('pos.saved')}
            </p>
          )}

          <Button
            leftIcon={<Zap className="h-4 w-4" />}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? t('common.saving') : settings ? t('pos.saveChanges') : t('pos.activate')}
          </Button>
        </div>
      </GlassCard>

      {/* Provider docs links */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">{t('pos.docs')}</h2>
        <div className="flex flex-col gap-2">
          <a
            href="https://developer.vivawallet.com/webhooks-for-payments/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white/90 transition"
          >
            <ExternalLink className="h-4 w-4 shrink-0 text-brand-orange" />
            Viva Wallet — Webhook setup guide
          </a>
          <a
            href="https://developer.squareup.com/docs/webhooks/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white/90 transition"
          >
            <ExternalLink className="h-4 w-4 shrink-0 text-brand-orange" />
            Square — Webhook setup guide
          </a>
        </div>
      </GlassCard>
    </div>
  )
}
