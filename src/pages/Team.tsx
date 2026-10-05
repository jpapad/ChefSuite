import { type FormEvent, useEffect, useState } from 'react'
import { UserPlus, Copy, Check, Trash2, Shield, Pencil, Save, Lock, Languages, Clock, AlertTriangle, Percent } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PillButton, StatRow, StatTile, Panel, Notice } from '../components/ui/page'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Drawer } from '../components/ui/Drawer'
import { InviteForm } from '../components/team/InviteForm'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { useTeamSettings } from '../hooks/useTeamSettings'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/cn'
import { ALL_MODULES, MODULE_GROUPS, MODULE_LABEL_KEY, type AppModule } from '../hooks/usePermissions'
import type { UserRole, Profile } from '../types/database.types'

function roleLabel(role: UserRole): string {
  return role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function expiryInfo(expiresAt: string | null): { label: string; urgent: boolean; expired: boolean } | null {
  if (!expiresAt) return null
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: 'Έληξε', urgent: true, expired: true }
  if (diff === 0) return { label: 'Λήγει σήμερα', urgent: true, expired: false }
  if (diff <= 7) return { label: `Λήγει σε ${diff} μ.`, urgent: true, expired: false }
  return { label: `Λήγει ${new Date(expiresAt).toLocaleDateString('el-GR')}`, urgent: false, expired: false }
}

function initialsFor(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function Team() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const {
    team,
    members,
    memberExpiries,
    invites,
    loading,
    error,
    createInvite,
    revokeInvite,
    updateMemberExpiry,
  } = useTeam()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [renamingTeam, setRenamingTeam] = useState(false)
  const [teamName, setTeamName] = useState(team?.name ?? '')
  const [savingTeam, setSavingTeam] = useState(false)
  const [teamNameError, setTeamNameError] = useState<string | null>(null)

  // Food cost target
  const { targetFoodCostPct, loading: loadingTarget, save: saveTarget } = useTeamSettings()
  const [targetInput, setTargetInput] = useState(String(targetFoodCostPct))
  const [savingTarget, setSavingTarget] = useState(false)
  const [targetSaved, setTargetSaved] = useState(false)
  useEffect(() => { setTargetInput(String(targetFoodCostPct)) }, [targetFoodCostPct])

  async function onSaveTarget(e: FormEvent) {
    e.preventDefault()
    const pct = parseFloat(targetInput)
    if (Number.isNaN(pct) || pct <= 0) return
    setSavingTarget(true)
    try {
      await saveTarget(pct)
      setTargetSaved(true)
      setTimeout(() => setTargetSaved(false), 2000)
    } finally {
      setSavingTarget(false)
    }
  }

  // Create member drawer state
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'staff' as UserRole, expiresAt: '' })
  const [createPerms, setCreatePerms] = useState<Set<AppModule>>(new Set(ALL_MODULES))
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)

  async function onCreateMember(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateSuccess(false)
    try {
      const allPerms = createPerms.size === ALL_MODULES.length
      const { data, error } = await supabase.functions.invoke('create-team-member', {
        body: {
          email: createForm.email,
          password: createForm.password,
          full_name: createForm.name,
          role: createForm.role,
          permissions: allPerms ? null : [...createPerms],
          expires_at: createForm.expiresAt ? new Date(createForm.expiresAt).toISOString() : null,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setCreateSuccess(true)
      setTimeout(() => {
        setCreateOpen(false)
        setCreateForm({ name: '', email: '', password: '', role: 'staff', expiresAt: '' })
        setCreatePerms(new Set(ALL_MODULES))
        setCreateSuccess(false)
      }, 1000)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('team.createError'))
    } finally {
      setCreating(false)
    }
  }

  // Permissions drawer state
  const [permMember, setPermMember] = useState<Profile | null>(null)
  const [permChecked, setPermChecked] = useState<Set<AppModule>>(new Set())
  const [permLang, setPermLang] = useState<string>('en')
  const [permExpiry, setPermExpiry] = useState<string>('')
  const [savingPerms, setSavingPerms] = useState(false)
  const [permSaved, setPermSaved] = useState(false)

  const isOwner = profile?.role === 'owner'
  const canManageSettings = profile?.role === 'owner' || profile?.role === 'executive_chef'
  const canInvite = profile?.role === 'owner' || profile?.role === 'head_chef'

  function openPermissions(member: Profile) {
    const initial: Set<AppModule> = member.permissions === null
      ? new Set(ALL_MODULES)
      : new Set(member.permissions as AppModule[])
    setPermChecked(initial)
    setPermLang(member.preferred_lang ?? 'en')
    const expiry = memberExpiries.find((e) => e.userId === member.id)
    const expiryVal = expiry?.expiresAt
      ? new Date(expiry.expiresAt).toISOString().slice(0, 10)
      : ''
    setPermExpiry(expiryVal)
    setPermMember(member)
    setPermSaved(false)
  }

  function toggleModule(mod: AppModule) {
    setPermChecked((prev) => {
      const next = new Set(prev)
      next.has(mod) ? next.delete(mod) : next.add(mod)
      return next
    })
  }

  function selectAll() { setPermChecked(new Set(ALL_MODULES)) }
  function deselectAll() { setPermChecked(new Set()) }

  async function savePermissions() {
    if (!permMember) return
    setSavingPerms(true)
    try {
      const allChecked = permChecked.size === ALL_MODULES.length
      const newPerms: string[] | null = allChecked ? null : [...permChecked]
      const expiryMembership = memberExpiries.find((e) => e.userId === permMember.id)
      const newExpiry = permExpiry ? new Date(permExpiry).toISOString() : null
      await Promise.all([
        supabase.rpc('update_member_permissions', {
          member_id: permMember.id,
          new_permissions: newPerms,
        }),
        supabase.from('profiles').update({ preferred_lang: permLang }).eq('id', permMember.id),
        expiryMembership
          ? updateMemberExpiry(expiryMembership.membershipId, newExpiry)
          : Promise.resolve(),
      ])
      setPermSaved(true)
      setTimeout(() => setPermMember(null), 800)
    } finally {
      setSavingPerms(false)
    }
  }

  async function onRenameTeam(e: FormEvent) {
    e.preventDefault()
    const name = teamName.trim()
    if (!name || !team) return
    setSavingTeam(true)
    setTeamNameError(null)
    try {
      const { error } = await supabase.from('teams').update({ name }).eq('id', team.id)
      if (error) throw error
      setRenamingTeam(false)
    } catch (err) {
      setTeamNameError(err instanceof Error ? err.message : 'Could not rename team')
    } finally {
      setSavingTeam(false)
    }
  }

  async function onSubmit(email: string, role: UserRole) {
    setSubmitting(true)
    try {
      await createInvite(email, role)
      setDrawerOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function onCopy(token: string, id: string) {
    const link = `${window.location.origin}/onboarding?invite=${token}`
    await navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1500)
  }

  async function onRevoke(id: string) {
    const ok = window.confirm(t('team.revokeConfirm'))
    if (!ok) return
    await revokeInvite(id)
  }

  const expiring = memberExpiries.filter((e) => { const x = expiryInfo(e.expiresAt); return x?.urgent }).length

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <p className="text-sm text-white/55">{t('team.subtitle')}</p>
          {renamingTeam && isOwner ? (
            <form onSubmit={onRenameTeam} className="mt-1 flex flex-wrap items-center gap-2">
              <input
                name="team_name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                minLength={2}
                autoFocus
                aria-label={t('team.renameTeam')}
                className="h-12 rounded-full bg-bg-card px-5 text-2xl font-medium shadow-card outline-none focus:ring-2 focus:ring-brand-orange/40"
              />
              <PillButton type="submit" variant="primary" icon={Save} disabled={savingTeam}>{savingTeam ? t('team.savingTeam') : t('common.save')}</PillButton>
              <PillButton onClick={() => { setRenamingTeam(false); setTeamName(team?.name ?? '') }}>{t('common.cancel')}</PillButton>
            </form>
          ) : (
            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em]">{team?.name ?? t('team.title')}</h1>
              {isOwner && (
                <button type="button" onClick={() => { setTeamName(team?.name ?? ''); setRenamingTeam(true) }} aria-label={t('team.renameTeam')}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          {teamNameError && <p className="mt-1 text-sm text-red-500">{teamNameError}</p>}
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <PillButton icon={UserPlus} onClick={() => setDrawerOpen(true)}>{t('team.invite')}</PillButton>
            <PillButton icon={UserPlus} variant="primary" onClick={() => setCreateOpen(true)}>{t('team.createMember')}</PillButton>
          </div>
        )}
      </header>

      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile tone="ink" label={t('team.members')} value={members.length} />
        <StatTile label={t('team.pendingInvites')} value={invites.length} tone={invites.length ? 'warn' : 'default'} />
        <StatTile label={t('team.v2.expiring')} value={expiring} tone={expiring ? 'warn' : 'default'} icon={Clock} hint={t('team.v2.expiringHint')} />
        <StatTile tone="lime" label={t('team.v2.target')} value={`${targetFoodCostPct}%`} icon={Percent} hint="food cost" to="/costing" />
      </StatRow>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Members ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium">{t('team.members')}</h2>
          {loading ? (
            <Panel><p className="text-white/55">{t('team.loadingTeam')}</p></Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {members.map((m) => {
                const exp = memberExpiries.find((e) => e.userId === m.id)
                const expInfo = expiryInfo(exp?.expiresAt ?? null)
                const isMe = m.id === profile?.id
                return (
                  <article key={m.id} className={cn('flex flex-col gap-4 rounded-3xl p-5 shadow-card', isMe ? 'bg-ink text-white-fixed' : 'bg-bg-card')}>
                    <div className="flex items-start gap-3">
                      <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold',
                        expInfo?.expired ? 'bg-red-500/15 text-red-500' : isMe ? 'bg-lime text-ink' : 'bg-white/[0.06]')}>
                        {initialsFor(m.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-medium">{m.full_name ?? '—'}</p>
                        {isMe && <p className="text-xs text-lime">{t('team.you')}</p>}
                      </div>
                      {isOwner && !isMe && m.role !== 'owner' && (
                        <button type="button" onClick={() => openPermissions(m)} title={t('team.editPermissions')} aria-label={t('team.editPermissions')}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/60 hover:text-white">
                          <Lock className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium', isMe ? 'bg-white-fixed/10' : 'bg-white/[0.06]')}>
                        <Shield className="h-3.5 w-3.5" />{roleLabel(m.role)}
                      </span>
                      {m.permissions !== null && <span className={cn('rounded-full px-2.5 py-1 font-medium', isMe ? 'bg-white-fixed/10' : 'bg-white/[0.06]')}>{t('team.v2.custom')}</span>}
                      {expInfo && (
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium',
                          expInfo.expired ? 'bg-red-500/10 text-red-500' : expInfo.urgent ? 'bg-amber-500/12 text-amber-500' : 'bg-white/[0.06] text-white/60')}>
                          {expInfo.expired ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{expInfo.label}
                        </span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {canManageSettings && (
            <Panel title={<span className="flex items-center gap-2"><Percent className="h-4 w-4" />{t('team.v2.targetTitle')}</span>}>
              <p className="-mt-2 text-sm text-white/55">{t('team.v2.targetHint')}</p>
              <form onSubmit={onSaveTarget} className="flex items-center gap-2">
                <label className="relative">
                  <input type="number" step="0.5" min="1" max="90" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} disabled={loadingTarget}
                    aria-label={t('team.v2.targetTitle')}
                    className="h-11 w-28 rounded-full bg-white/[0.06] px-4 pr-8 text-sm tabular-nums outline-none focus:ring-2 focus:ring-brand-orange/40" />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/45">%</span>
                </label>
                <PillButton type="submit" variant="primary" icon={Save} disabled={savingTarget || loadingTarget}>{savingTarget ? t('team.savingTeam') : t('common.save')}</PillButton>
                {targetSaved && <Check className="h-5 w-5 text-emerald-500" />}
              </form>
            </Panel>
          )}

          {canInvite && (
            <Panel title={t('team.pendingInvites')}>
              {invites.length === 0 ? (
                <p className="text-sm text-white/55">{t('team.noPendingInvites')}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-white/[0.06]">
                  {invites.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{inv.email}</p>
                        <p className="text-xs text-white/50">
                          {roleLabel(inv.role)}{inv.expires_at && ` · ${t('team.expires', { date: new Date(inv.expires_at).toLocaleDateString() })}`}
                        </p>
                      </div>
                      <button type="button" onClick={() => onCopy(inv.token, inv.id)} aria-label={t('team.copyLink')} title={t('team.copyLink')}
                        className={cn('flex h-10 w-10 items-center justify-center rounded-full', copiedId === inv.id ? 'bg-lime text-ink' : 'bg-white/[0.06] text-white/60 hover:text-white')}>
                        {copiedId === inv.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button type="button" onClick={() => onRevoke(inv.id)} aria-label={t('team.revokeLabel')}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 hover:bg-red-500/10 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => { if (!submitting) setDrawerOpen(false) }}
        title={t('team.inviteTeammate')}
      >
        <InviteForm
          submitting={submitting}
          onSubmit={onSubmit}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>

      {/* Create member drawer */}
      <Drawer
        open={createOpen}
        onClose={() => { if (!creating) { setCreateOpen(false); setCreateError(null) } }}
        title={t('team.createMemberTitle')}
      >
        <form onSubmit={onCreateMember} className="flex flex-col gap-5">
          <p className="text-xs text-white/45">{t('team.createMemberHint')}</p>

          {/* Basic info */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">{t('team.memberFullName')}</label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('team.memberFullNamePlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">{t('team.memberEmail')}</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t('team.memberEmailPlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">{t('team.memberPassword')}</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <p className="text-[11px] text-white/30 mt-1">{t('team.memberPasswordHint')}</p>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-2">{t('team.memberRole')}</label>
              <div className="grid grid-cols-2 gap-2">
                {(['head_chef', 'sous_chef', 'cook', 'staff'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, role: r }))}
                    className={cn(
                      'rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-all',
                      createForm.role === r
                        ? 'bg-brand-orange text-on-accent shadow-[0_0_12px_rgba(196,149,106,0.4)]'
                        : 'glass text-white/70 hover:text-white hover:bg-white/8',
                    )}
                  >
                    {t(`team.roles.${r}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">
                <Clock className="inline h-3 w-3 mr-1" />
                {t('team.memberExpiry')}
              </label>
              <input
                type="date"
                value={createForm.expiresAt}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCreateForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white/80 bg-white/5 border border-white/12 focus:outline-none focus:border-brand-orange/50"
              />
              <p className="text-[11px] text-white/30 mt-1">{t('team.memberExpiryHint')}</p>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">{t('team.memberPermissionsTitle')}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCreatePerms(new Set(ALL_MODULES))} className="text-xs text-brand-orange hover:underline">{t('team.selectAll')}</button>
                <span className="text-white/20">·</span>
                <button type="button" onClick={() => setCreatePerms(new Set())} className="text-xs text-white/50 hover:text-white/80 hover:underline">{t('team.deselectAll')}</button>
              </div>
            </div>
            {MODULE_GROUPS.map((group) => (
              <div key={group.labelKey} className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">{t(group.labelKey)}</p>
                <div className="grid grid-cols-2 gap-0.5">
                  {group.modules.map((mod) => (
                    <label key={mod} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={createPerms.has(mod)}
                        onChange={() => {
                          setCreatePerms((prev) => {
                            const next = new Set(prev)
                            next.has(mod) ? next.delete(mod) : next.add(mod)
                            return next
                          })
                        }}
                        className="h-3.5 w-3.5 accent-[#C4956A] rounded"
                      />
                      <span className="text-xs text-white/70">{t(MODULE_LABEL_KEY[mod])}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {createError && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{createError}</p>
          )}

          <div className="flex gap-3 pt-2 border-t border-white/8">
            <Button type="submit" disabled={creating || createSuccess} className="flex-1">
              {createSuccess ? t('team.created') : creating ? t('team.creating') : t('team.createMember')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Permissions drawer */}
      <Drawer
        open={!!permMember}
        onClose={() => { if (!savingPerms) setPermMember(null) }}
        title={t('team.permissionsDrawerTitle')}
      >
        {permMember && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-semibold text-white/90">{t('team.permissionsFor', { name: permMember.full_name ?? '—' })}</p>
              <p className="text-xs text-white/45 mt-1">{t('team.permissionsHint')}</p>
            </div>

            {/* Language preference */}
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" /> {t('team.memberLanguage')}
              </p>
              <div className="flex gap-2">
                {(['en', 'el', 'bg'] as const).map((lang) => {
                  const labels: Record<string, string> = { en: 'English', el: 'Ελληνικά', bg: 'Български' }
                  return (
                    <button key={lang} type="button" onClick={() => setPermLang(lang)}
                      className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition',
                        permLang === lang
                          ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                          : 'border-white/15 text-white/50 hover:text-white/80 hover:bg-white/5')}
                    >
                      {labels[lang]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Expiry date */}
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {t('team.memberExpiry')}
              </p>
              <input
                type="date"
                value={permExpiry}
                onChange={(e) => setPermExpiry(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white/80 bg-white/5 border border-white/12 focus:outline-none focus:border-brand-orange/50"
              />
              {permExpiry && (
                <button
                  type="button"
                  onClick={() => setPermExpiry('')}
                  className="mt-1 text-xs text-white/40 hover:text-white/70"
                >
                  {t('team.removeExpiry')}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="text-xs text-brand-orange hover:underline">{t('team.selectAll')}</button>
              <span className="text-white/20">·</span>
              <button type="button" onClick={deselectAll} className="text-xs text-white/50 hover:text-white/80 hover:underline">{t('team.deselectAll')}</button>
            </div>

            <div className="flex flex-col gap-4">
              {MODULE_GROUPS.map((group) => (
                <div key={group.labelKey}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                    {t(group.labelKey)}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.modules.map((mod) => (
                      <label key={mod} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={permChecked.has(mod)}
                          onChange={() => toggleModule(mod)}
                          className="h-4 w-4 accent-[#C4956A] rounded"
                        />
                        <span className="text-sm text-white/80">{t(MODULE_LABEL_KEY[mod])}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2 border-t border-white/8">
              <Button
                onClick={savePermissions}
                disabled={savingPerms || permSaved}
                className="flex-1"
              >
                {permSaved ? t('team.permissionsSaved') : savingPerms ? t('team.savingPermissions') : t('team.savePermissions')}
              </Button>
              <Button variant="secondary" onClick={() => setPermMember(null)} disabled={savingPerms}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </Page>
  )
}
