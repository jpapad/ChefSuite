import { type FormEvent, useState } from 'react'
import { UserPlus, Copy, Check, Trash2, Shield, Pencil, Save, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Drawer } from '../components/ui/Drawer'
import { InviteForm } from '../components/team/InviteForm'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { supabase } from '../lib/supabase'
import { ALL_MODULES, MODULE_GROUPS, MODULE_LABEL_KEY, type AppModule } from '../hooks/usePermissions'
import type { UserRole, Profile } from '../types/database.types'

function roleLabel(role: UserRole): string {
  return role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
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
    invites,
    loading,
    error,
    createInvite,
    revokeInvite,
  } = useTeam()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [renamingTeam, setRenamingTeam] = useState(false)
  const [teamName, setTeamName] = useState(team?.name ?? '')
  const [savingTeam, setSavingTeam] = useState(false)
  const [teamNameError, setTeamNameError] = useState<string | null>(null)

  // Create member drawer state
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'staff' as UserRole })
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
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setCreateSuccess(true)
      setTimeout(() => {
        setCreateOpen(false)
        setCreateForm({ name: '', email: '', password: '', role: 'staff' })
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
  const [savingPerms, setSavingPerms] = useState(false)
  const [permSaved, setPermSaved] = useState(false)

  const isOwner = profile?.role === 'owner'
  const canInvite = profile?.role === 'owner' || profile?.role === 'head_chef'

  function openPermissions(member: Profile) {
    const initial: Set<AppModule> = member.permissions === null
      ? new Set(ALL_MODULES)
      : new Set(member.permissions as AppModule[])
    setPermChecked(initial)
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
      await supabase.rpc('update_member_permissions', {
        member_id: permMember.id,
        new_permissions: newPerms,
      })
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

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          {renamingTeam && isOwner ? (
            <form onSubmit={onRenameTeam} className="flex items-center gap-2">
              <Input
                name="team_name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                minLength={2}
                autoFocus
              />
              <Button type="submit" size="md" leftIcon={<Save className="h-4 w-4" />} disabled={savingTeam}>
                {savingTeam ? t('team.savingTeam') : t('common.save')}
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={() => { setRenamingTeam(false); setTeamName(team?.name ?? '') }}>
                {t('common.cancel')}
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold">{team?.name ?? t('team.title')}</h1>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => { setTeamName(team?.name ?? ''); setRenamingTeam(true) }}
                  aria-label={t('team.renameTeam')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          {teamNameError && <p className="text-sm text-red-400 mt-1">{teamNameError}</p>}
          <p className="text-white/60 mt-1">{t('team.subtitle')}</p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              leftIcon={<UserPlus className="h-5 w-5" />}
              onClick={() => setDrawerOpen(true)}
            >
              {t('team.invite')}
            </Button>
            <Button
              leftIcon={<UserPlus className="h-5 w-5" />}
              onClick={() => setCreateOpen(true)}
            >
              {t('team.createMember')}
            </Button>
          </div>
        )}
      </header>

      {error && (
        <GlassCard className="border border-red-500/40 text-red-300">
          {error}
        </GlassCard>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t('team.members')}</h2>
        {loading ? (
          <GlassCard>
            <p className="text-white/60">{t('team.loadingTeam')}</p>
          </GlassCard>
        ) : (
          <GlassCard className="p-0 overflow-hidden">
            <ul className="divide-y divide-glass-border">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange/20 text-brand-orange font-semibold">
                    {initialsFor(m.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {m.full_name ?? '—'}
                      {m.id === profile?.id && (
                        <span className="ml-2 text-xs text-white/50">
                          {t('team.you')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-glass-border px-2.5 py-1 text-sm text-white/80">
                    <Shield className="h-3.5 w-3.5" />
                    {roleLabel(m.role)}
                  </span>
                  {isOwner && m.id !== profile?.id && m.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => openPermissions(m)}
                      title={t('team.editPermissions')}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 hover:text-brand-orange hover:bg-brand-orange/10 transition"
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}
      </section>

      {canInvite && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('team.pendingInvites')}</h2>
          {invites.length === 0 ? (
            <GlassCard>
              <p className="text-white/60">{t('team.noPendingInvites')}</p>
            </GlassCard>
          ) : (
            <GlassCard className="p-0 overflow-hidden">
              <ul className="divide-y divide-glass-border">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 px-5 py-4 flex-wrap"
                  >
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-medium">{inv.email}</div>
                      <div className="text-xs text-white/50 mt-0.5">
                        {roleLabel(inv.role)}
                        {inv.expires_at &&
                          ` · ${t('team.expires', { date: new Date(inv.expires_at).toLocaleDateString() })}`}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="md"
                      leftIcon={
                        copiedId === inv.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )
                      }
                      onClick={() => onCopy(inv.token, inv.id)}
                    >
                      {copiedId === inv.id ? t('team.copied') : t('team.copyLink')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => onRevoke(inv.id)}
                      aria-label={t('team.revokeLabel')}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-white/70 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </section>
      )}

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
              <label className="block text-xs text-white/50 mb-1">{t('team.memberRole')}</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full h-10 rounded-xl bg-white-fixed/55 border border-white/70 text-white text-sm px-3 outline-none focus:ring-1 focus:ring-brand-orange/40"
              >
                {(['head_chef', 'sous_chef', 'cook', 'staff'] as UserRole[]).map((r) => (
                  <option key={r} value={r} className="bg-[#0e0905]">
                    {t(`team.roles.${r}`)}
                  </option>
                ))}
              </select>
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
    </div>
  )
}
