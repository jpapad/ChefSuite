import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck, Plus, AlertTriangle, CalendarClock, ShieldCheck, Users, FileText, Upload,
  Trash2, LayoutGrid, List, Loader2,
} from 'lucide-react'
import {
  Page, PageHeader, PillButton, StatRow, StatTile, Panel, Segmented, EmptyState, Notice,
} from '../components/ui/page'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { certStatus, daysLeft, useStaffCertificates, type CertStatus } from '../hooks/useStaffCertificates'
import { cn } from '../lib/cn'
import type { CertificateKind, StaffCertificate, StaffCertificateDraft } from '../types/database.types'

const KINDS: CertificateKind[] = ['health_card', 'haccp', 'food_safety', 'first_aid', 'fire_safety', 'other']
const MANAGER_ROLES = ['owner', 'executive_chef', 'head_chef']

const STATUS_PILL: Record<CertStatus, string> = {
  valid: 'bg-emerald-500/10 text-emerald-500',
  expiring: 'bg-amber-500/15 text-amber-500',
  expired: 'bg-red-500/10 text-red-500',
  no_expiry: 'bg-white/[0.06] text-white/60',
}

function fmtDate(d: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

const EMPTY: StaffCertificateDraft = { user_id: '', kind: 'health_card', title: null, issued_on: null, expires_on: null, doc_path: null, notes: null }

export default function Certificates() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { members } = useTeam()
  const { certs, loading, error, save, remove, uploadDoc, openDoc } = useStaffCertificates()
  const isManager = MANAGER_ROLES.includes(profile?.role ?? '')

  const [view, setView] = useState<'people' | 'timeline'>('people')
  const [editing, setEditing] = useState<StaffCertificate | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draft, setDraft] = useState<StaffCertificateDraft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const nameOf = (id: string) => members.find((m) => m.id === id)?.full_name ?? t('common.unnamed')
  const kindLabel = (c: Pick<StaffCertificate, 'kind' | 'title'>) =>
    c.kind === 'other' && c.title ? c.title : t(`certs.kinds.${c.kind}`)

  // Latest certificate per person & kind (the one that expires last)
  const latest = useMemo(() => {
    const map = new Map<string, StaffCertificate>()
    for (const c of certs) {
      const key = `${c.user_id}:${c.kind}`
      const prev = map.get(key)
      if (!prev || (c.expires_on ?? '9999') > (prev.expires_on ?? '9999')) map.set(key, c)
    }
    return map
  }, [certs])
  const current = [...latest.values()]

  const counts = {
    expired: current.filter((c) => certStatus(c) === 'expired').length,
    expiring: current.filter((c) => certStatus(c) === 'expiring').length,
    valid: current.filter((c) => ['valid', 'no_expiry'].includes(certStatus(c))).length,
  }
  const visibleMembers = isManager ? members : members.filter((m) => m.id === profile?.id)
  const missingHealth = visibleMembers.filter((m) => !latest.has(`${m.id}:health_card`)).length
  const timeline = [...current].sort((a, b) => (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999'))

  function openNew(userId?: string, kind?: CertificateKind) {
    setEditing(null)
    setDraft({ ...EMPTY, user_id: userId ?? '', kind: kind ?? 'health_card' })
    setFormError(null)
    setDrawerOpen(true)
  }
  function openEdit(c: StaffCertificate) {
    setEditing(c)
    setDraft({ user_id: c.user_id, kind: c.kind, title: c.title, issued_on: c.issued_on, expires_on: c.expires_on, doc_path: c.doc_path, notes: c.notes })
    setFormError(null)
    setDrawerOpen(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.user_id) { setFormError(t('certs.pickPerson')); return }
    setSaving(true); setFormError(null)
    try {
      await save({ ...draft, title: draft.title?.trim() || null, notes: draft.notes?.trim() || null }, editing?.id)
      setDrawerOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.saveFailed'))
    } finally { setSaving(false) }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setUploading(true); setFormError(null)
    try { setDraft((d) => ({ ...d, doc_path: null })); const path = await uploadDoc(file); setDraft((d) => ({ ...d, doc_path: path })) }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  function StatusPill({ c }: { c: StaffCertificate }) {
    const st = certStatus(c)
    const d = daysLeft(c.expires_on)
    const label = st === 'expired' ? t('certs.expiredAgo', { count: -(d ?? 0) })
      : st === 'expiring' ? t('certs.inDays', { count: d ?? 0 })
      : st === 'no_expiry' ? t('certs.noExpiry') : fmtDate(c.expires_on)
    return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tabular-nums', STATUS_PILL[st])}>{label}</span>
  }

  return (
    <Page>
      <PageHeader
        title={t('certs.title')}
        subtitle={t('certs.subtitle')}
        actions={isManager && <PillButton variant="primary" icon={Plus} onClick={() => openNew()}>{t('certs.add')}</PillButton>}
      />

      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile label={t('certs.stat.expired')} value={counts.expired} icon={AlertTriangle} tone={counts.expired ? 'bad' : 'default'} />
        <StatTile label={t('certs.stat.expiring')} value={counts.expiring} icon={CalendarClock} tone={counts.expiring ? 'warn' : 'default'} hint={t('certs.stat.within30')} />
        <StatTile label={t('certs.stat.valid')} value={counts.valid} icon={ShieldCheck} tone="ink" />
        <StatTile label={t('certs.stat.noHealth')} value={missingHealth} icon={Users} tone={missingHealth ? 'lime' : 'default'} hint={t('certs.stat.noHealthHint')} />
      </StatRow>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={view} onChange={setView} options={[
          { value: 'people', label: t('certs.view.people'), icon: LayoutGrid },
          { value: 'timeline', label: t('certs.view.timeline'), icon: List },
        ]} />
        {!isManager && <p className="text-sm text-white/55">{t('certs.ownOnly')}</p>}
      </div>

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : view === 'people' ? (
        <Panel padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50">
                  <th className="px-5 py-4 font-medium">{t('certs.person')}</th>
                  {KINDS.map((k) => <th key={k} className="px-3 py-4 font-medium">{t(`certs.kinds.${k}`)}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((m) => (
                  <tr key={m.id} className="border-t border-white/[0.06]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-lime">
                          {(m.full_name ?? '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{m.full_name ?? t('common.unnamed')}</span>
                          <span className="block text-xs text-white/45">{m.role}</span>
                        </span>
                      </div>
                    </td>
                    {KINDS.map((k) => {
                      const c = latest.get(`${m.id}:${k}`)
                      return (
                        <td key={k} className="px-3 py-3">
                          {c ? (
                            <button type="button" onClick={() => isManager ? openEdit(c) : c.doc_path && void openDoc(c.doc_path)}
                              className="flex flex-col items-start gap-1 rounded-xl text-left">
                              <StatusPill c={c} />
                              {c.doc_path && <span className="flex items-center gap-1 text-[11px] text-white/45"><FileText className="h-3 w-3" />{t('certs.scan')}</span>}
                            </button>
                          ) : isManager ? (
                            <button type="button" onClick={() => openNew(m.id, k)}
                              className={cn('inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs',
                                k === 'health_card' ? 'bg-lime/40 font-medium text-ink' : 'text-white/35 hover:bg-white/[0.05] hover:text-white/70')}>
                              <Plus className="h-3 w-3" />{k === 'health_card' ? t('certs.missing') : ''}
                            </button>
                          ) : <span className="text-white/25">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : timeline.length === 0 ? (
        <EmptyState icon={BadgeCheck} title={t('certs.empty')} body={t('certs.emptyHint')}
          action={isManager && <PillButton variant="primary" icon={Plus} onClick={() => openNew()}>{t('certs.add')}</PillButton>} />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-white/[0.06]">
            {timeline.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => isManager && openEdit(c)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.03]">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    certStatus(c) === 'expired' ? 'bg-red-500/10 text-red-500' : certStatus(c) === 'expiring' ? 'bg-amber-500/15 text-amber-500' : 'bg-ink text-lime')}>
                    <BadgeCheck className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{nameOf(c.user_id)}</span>
                    <span className="block truncate text-sm text-white/55">{kindLabel(c)}{c.issued_on ? ` · ${t('certs.issued')} ${fmtDate(c.issued_on)}` : ''}</span>
                  </span>
                  <StatusPill c={c} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Drawer open={drawerOpen} onClose={() => !saving && setDrawerOpen(false)} title={editing ? t('certs.edit') : t('certs.add')}>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-white/80">{t('certs.person')}</span>
            <select value={draft.user_id} onChange={(e) => setDraft((d) => ({ ...d, user_id: e.target.value }))}
              className="h-12 rounded-xl border border-inv-border bg-bg-input px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-orange/40">
              <option value="">{t('certs.pickPerson')}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name ?? t('common.unnamed')}</option>)}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white/80">{t('certs.kind')}</span>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setDraft((d) => ({ ...d, kind: k }))}
                  className={cn('h-9 rounded-full px-3.5 text-sm font-medium transition',
                    draft.kind === k ? 'bg-ink text-white-fixed' : 'bg-bg-input text-white/65 hover:text-white')}>
                  {t(`certs.kinds.${k}`)}
                </button>
              ))}
            </div>
          </div>

          {draft.kind === 'other' && (
            <Input name="title" label={t('certs.titleLabel')} value={draft.title ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input type="date" name="issued_on" label={t('certs.issued')} value={draft.issued_on ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, issued_on: e.target.value || null }))} />
            <Input type="date" name="expires_on" label={t('certs.expires')} value={draft.expires_on ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, expires_on: e.target.value || null }))} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white/80">{t('certs.scan')}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-bg-input px-4 text-sm font-medium hover:bg-white/[0.08]">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {draft.doc_path ? t('certs.replaceScan') : t('certs.uploadScan')}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
              {draft.doc_path && (
                <button type="button" onClick={() => void openDoc(draft.doc_path!)} className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                  <FileText className="h-4 w-4" />{t('certs.viewScan')}
                </button>
              )}
            </div>
            <p className="text-xs text-white/45">{t('certs.privateHint')}</p>
          </div>

          <Textarea name="notes" label={t('certs.notes')} rows={2} value={draft.notes ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />

          {formError && <Notice>{formError}</Notice>}

          <div className="flex items-center justify-between gap-3 pt-1">
            {editing ? (
              <button type="button" onClick={() => { if (window.confirm(t('certs.deleteConfirm'))) { void remove(editing); setDrawerOpen(false) } }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:underline">
                <Trash2 className="h-4 w-4" />{t('common.delete')}
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saving || uploading}>{saving ? t('common.saving') : t('common.save')}</Button>
            </div>
          </div>
        </form>
      </Drawer>
    </Page>
  )
}
