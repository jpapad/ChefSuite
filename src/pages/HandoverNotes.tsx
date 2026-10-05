import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle,
  Minus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { Page, PageHeader, PillButton, Panel, Segmented, Chip, ChipRow, EmptyState } from '../components/ui/page'

type Priority = 'low' | 'medium' | 'high'
type FilterMode = 'all' | 'received' | 'sent'

interface HandoverNote {
  id: string
  team_id: string
  from_user_id: string
  to_user_id: string
  content: string
  priority: Priority
  acknowledged: boolean
  acknowledged_at: string | null
  created_at: string
  from_name?: string | null
  to_name?: string | null
}

interface TeamMember {
  id: string
  full_name: string | null
}

const PRIORITY_CONFIG: Record<Priority, { label_key: string; color: string; icon: typeof ArrowUp; border: string }> = {
  high:   { label_key: 'handover.priorityHigh',   color: 'text-red-400',   icon: ArrowUp,   border: 'border-l-red-500' },
  medium: { label_key: 'handover.priorityMedium', color: 'text-amber-400', icon: Minus,     border: 'border-l-amber-400' },
  low:    { label_key: 'handover.priorityLow',    color: 'text-green-400', icon: ArrowDown, border: 'border-l-green-400' },
}

export default function HandoverNotes() {
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const teamId = profile?.team_id

  const [notes, setNotes] = useState<HandoverNote[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const namesRef = useRef<Map<string, string | null>>(new Map())

  const [form, setForm] = useState({ toUserId: '', content: '', priority: 'medium' as Priority })

  // Load team members
  useEffect(() => {
    if (!teamId || !user) return
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('team_id', teamId)
      .neq('id', user.id)
      .then(({ data }) => setMembers((data ?? []) as TeamMember[]))
  }, [teamId, user])

  // Load notes
  const loadNotes = useCallback(async () => {
    if (!teamId || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('handover_notes')
      .select('*, from:from_user_id(full_name), to:to_user_id(full_name)')
      .eq('team_id', teamId)
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(100)

    const rows = (data ?? []) as Array<HandoverNote & {
      from: { full_name: string | null } | null
      to: { full_name: string | null } | null
    }>
    rows.forEach((r) => {
      namesRef.current.set(r.from_user_id, r.from?.full_name ?? null)
      namesRef.current.set(r.to_user_id, r.to?.full_name ?? null)
    })
    setNotes(rows.map((r) => ({ ...r, from_name: r.from?.full_name ?? null, to_name: r.to?.full_name ?? null })))
    setLoading(false)
  }, [teamId, user])

  useEffect(() => { void loadNotes() }, [loadNotes])

  // Realtime
  useEffect(() => {
    if (!teamId || !user) return
    const ch = supabase
      .channel(`handover:${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'handover_notes', filter: `team_id=eq.${teamId}` }, () => {
        void loadNotes()
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [teamId, user, loadNotes])

  const unreadCount = useMemo(
    () => notes.filter((n) => n.to_user_id === user?.id && !n.acknowledged).length,
    [notes, user],
  )

  const filtered = useMemo(() => {
    let list = notes
    if (filter === 'received') list = list.filter((n) => n.to_user_id === user?.id)
    if (filter === 'sent') list = list.filter((n) => n.from_user_id === user?.id)
    if (priorityFilter !== 'all') list = list.filter((n) => n.priority === priorityFilter)
    return list
  }, [notes, filter, priorityFilter, user])

  async function submitNote(e: React.FormEvent) {
    e.preventDefault()
    if (!teamId || !user || !form.toUserId || !form.content.trim()) return
    setSaving(true)
    try {
      await supabase.from('handover_notes').insert({
        team_id: teamId,
        from_user_id: user.id,
        to_user_id: form.toUserId,
        content: form.content.trim(),
        priority: form.priority,
      })
      setForm({ toUserId: '', content: '', priority: 'medium' })
      setFormOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function acknowledge(noteId: string) {
    await supabase
      .from('handover_notes')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', noteId)
  }

  const composer = (
    <form onSubmit={submitNote} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-white/60">{t('handover.to')}</span>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <Chip key={m.id} active={form.toUserId === m.id} onClick={() => setForm((f) => ({ ...f, toUserId: m.id }))}>
              {m.full_name ?? m.id.slice(0, 8)}
            </Chip>
          ))}
          {members.length === 0 && <span className="text-xs text-white/45">{t('handover.selectRecipient')}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-white/60">{t('handover.priorityAll')}</span>
        <div className="grid grid-cols-3 gap-2">
          {(['low', 'medium', 'high'] as Priority[]).map((p) => {
            const cfg = PRIORITY_CONFIG[p]
            const Icon = cfg.icon
            const on = form.priority === p
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => setForm((f) => ({ ...f, priority: p }))}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium transition',
                  on
                    ? p === 'high' ? 'bg-red-600 text-white-fixed' : p === 'medium' ? 'bg-amber-500 text-ink' : 'bg-emerald-600 text-white-fixed'
                    : 'bg-white/[0.05] text-white/60 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />{t(cfg.label_key)}
              </button>
            )
          })}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-white/60">{t('handover.note')}</span>
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={5}
          required
          placeholder={t('handover.notePlaceholder')}
          className="w-full resize-none rounded-2xl bg-white/[0.05] px-4 py-3 text-sm outline-none placeholder:text-white/40 focus:ring-2 focus:ring-brand-orange/40"
        />
      </label>

      <div className="flex justify-end gap-2">
        <PillButton onClick={() => setFormOpen(false)} disabled={saving} className="lg:hidden">{t('handover.cancel')}</PillButton>
        <PillButton type="submit" variant="primary" disabled={saving || !form.toUserId || !form.content.trim()}>
          {saving ? t('handover.saving') : t('handover.save')}
        </PillButton>
      </div>
    </form>
  )

  return (
    <Page>
      <PageHeader
        title={t('handover.title')}
        subtitle={t('handover.subtitle')}
        actions={
          <>
            {unreadCount > 0 && <span className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white-fixed">{t('handover.unread_other', { count: unreadCount })}</span>}
            <PillButton icon={Plus} variant="primary" onClick={() => setFormOpen(true)} className="lg:hidden">{t('handover.newNote')}</PillButton>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          {formOpen && <Panel title={t('handover.newNote')} className="lg:hidden">{composer}</Panel>}

          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={(['all', 'received', 'sent'] as FilterMode[]).map((f) => ({ value: f, label: t(`handover.filter${f.charAt(0).toUpperCase() + f.slice(1)}`) }))}
            />
            <ChipRow className="pb-0">
              {(['all', 'high', 'medium', 'low'] as const).map((p) => (
                <Chip key={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>
                  {p === 'all' ? t('handover.priorityAll') : t(`handover.priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}
                </Chip>
              ))}
            </ChipRow>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-3xl bg-white/[0.05] animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t('handover.empty')} body={t('handover.emptyHint')} />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((note) => {
                const isReceived = note.to_user_id === user?.id
                const cfg = PRIORITY_CONFIG[note.priority]
                const PriorityIcon = cfg.icon
                const unread = isReceived && !note.acknowledged
                return (
                  <article key={note.id} className={cn('flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card', unread && 'ring-2 ring-lime')}>
                    <div className="flex flex-wrap items-center gap-2">
                      {isReceived ? <ArrowDownCircle className="h-4 w-4 text-sky-500" /> : <ArrowUpCircle className="h-4 w-4 text-violet-500" />}
                      <span className="font-medium">
                        {isReceived ? `${t('handover.from')}: ${note.from_name ?? '—'}` : `${t('handover.to')}: ${note.to_name ?? '—'}`}
                      </span>
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        note.priority === 'high' ? 'bg-red-500/10 text-red-500' : note.priority === 'medium' ? 'bg-amber-500/12 text-amber-500' : 'bg-emerald-500/10 text-emerald-500')}>
                        <PriorityIcon className="h-3 w-3" />{t(cfg.label_key)}
                      </span>
                      <span className="ml-auto text-xs text-white/45 tabular-nums">{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    {unread && (
                      <button type="button" onClick={() => void acknowledge(note.id)}
                        className="inline-flex items-center gap-1.5 self-start rounded-full bg-lime px-4 py-2 text-sm font-medium text-ink">
                        <CheckCircle className="h-4 w-4" />{t('handover.acknowledge')}
                      </button>
                    )}
                    {note.acknowledged && isReceived && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-500"><CheckCircle className="h-3.5 w-3.5" />{t('handover.acknowledged')}</span>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Composer (always visible on desktop) ── */}
        <Panel title={t('handover.newNote')} className="hidden lg:flex lg:sticky lg:top-24">{composer}</Panel>
      </div>
    </Page>
  )
}
