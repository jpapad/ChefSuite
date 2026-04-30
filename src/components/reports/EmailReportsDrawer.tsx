import { useEffect, useState, type FormEvent } from 'react'
import { Mail, Plus, X, Send, Loader2, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Settings {
  recipients: string[]
  last_sent_at: string | null
}

interface Props {
  open: boolean
  onClose: () => void
}

export function EmailReportsDrawer({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { profile } = useAuth()

  const [settings, setSettings] = useState<Settings>({ recipients: [], last_sent_at: null })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!open || !profile?.team_id) return
    setLoading(true)
    supabase
      .from('email_report_settings')
      .select('recipients, last_sent_at')
      .eq('team_id', profile.team_id)
      .single()
      .then(({ data }) => {
        if (data) setSettings(data as Settings)
        setLoading(false)
      })
  }, [open, profile?.team_id])

  async function saveRecipients(next: string[]) {
    if (!profile?.team_id) return
    setSaving(true)
    await supabase
      .from('email_report_settings')
      .upsert({ team_id: profile.team_id, recipients: next, updated_at: new Date().toISOString() }, { onConflict: 'team_id' })
    setSaving(false)
  }

  function addEmail(e: FormEvent) {
    e.preventDefault()
    const email = draft.trim().toLowerCase()
    if (!email.includes('@') || settings.recipients.includes(email)) return
    const next = [...settings.recipients, email]
    setSettings((s) => ({ ...s, recipients: next }))
    void saveRecipients(next)
    setDraft('')
  }

  function removeEmail(email: string) {
    const next = settings.recipients.filter((r) => r !== email)
    setSettings((s) => ({ ...s, recipients: next }))
    void saveRecipients(next)
  }

  async function sendNow() {
    if (settings.recipients.length === 0) { setError(t('reports.noRecipients')); return }
    setSending(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error: fnErr } = await supabase.functions.invoke('weekly-report', {
        body: { to: settings.recipients },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error)
      const now = new Date().toISOString()
      setSettings((s) => ({ ...s, last_sent_at: now }))
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={t('reports.title')}>
      <div className="space-y-6">

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange">
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{t('reports.description')}</p>
        </div>

        {/* Recipients */}
        <div>
          <p className="mb-2 text-sm font-medium text-white/80">{t('reports.recipients')}</p>

          {loading ? (
            <div className="flex justify-center py-6 text-white/30"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              {settings.recipients.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {settings.recipients.map((email) => (
                    <li key={email} className="flex items-center gap-3 glass rounded-xl px-4 py-2.5">
                      <Mail className="h-4 w-4 text-white/30 shrink-0" />
                      <span className="flex-1 text-sm text-white/80 truncate">{email}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="rounded-lg p-1 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={addEmail} className="flex gap-2">
                <Input
                  type="email"
                  name="email"
                  placeholder="email@example.com"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} disabled={saving}>
                  {t('common.add')}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* What's included */}
        <div className="glass rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">{t('reports.includes')}</p>
          {[
            t('reports.includesItems.foodCost'),
            t('reports.includesItems.wasteCost'),
            t('reports.includesItems.prepRate'),
            t('reports.includesItems.lowStock'),
            t('reports.includesItems.haccp'),
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-white/70">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>

        {/* Last sent */}
        {settings.last_sent_at && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Clock className="h-3.5 w-3.5" />
            {t('reports.lastSent')}: {new Date(settings.last_sent_at).toLocaleString()}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Send button */}
        <Button
          type="button"
          onClick={() => void sendNow()}
          disabled={sending || settings.recipients.length === 0}
          leftIcon={
            sent
              ? <CheckCircle2 className="h-4 w-4" />
              : sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
          }
          className="w-full"
        >
          {sent
            ? t('reports.sent')
            : sending
              ? t('reports.sending')
              : t('reports.sendNow')}
        </Button>

        {/* Schedule hint */}
        <p className="text-xs text-white/30 text-center leading-relaxed">
          {t('reports.scheduleHint')}
        </p>
      </div>
    </Drawer>
  )
}
