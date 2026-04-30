import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList,
  Plus,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle,
  AlertTriangle,
  Minus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'

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

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/15">
            <ClipboardList className="h-5 w-5 text-brand-orange" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t('handover.title')}</h1>
            <p className="text-xs text-white/40 mt-0.5">{t('handover.subtitle')}</p>
          </div>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white animate-pulse">
              {t('handover.unread_other', { count: unreadCount })}
            </span>
          )}
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t('handover.newNote')}
        </Button>
      </div>

      {/* New Note form */}
      {formOpen && (
        <form onSubmit={submitNote} className="glass gradient-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold">{t('handover.newNote')}</span>
            <button type="button" onClick={() => setFormOpen(false)} className="text-white/40 hover:text-white/70 transition">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{t('handover.to')}</label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, toUserId: m.id }))}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-sm font-medium transition-all',
                    form.toUserId === m.id
                      ? 'bg-brand-orange text-white-fixed'
                      : 'glass text-white/70 hover:text-white',
                  )}
                >
                  {m.full_name ?? m.id.slice(0, 8)}
                </button>
              ))}
              {members.length === 0 && (
                <span className="text-xs text-white/30">{t('handover.selectRecipient')}</span>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{t('handover.priorityAll')}</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                const cfg = PRIORITY_CONFIG[p]
                const Icon = cfg.icon
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: p }))}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                      form.priority === p
                        ? p === 'high' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/50'
                          : p === 'medium' ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
                          : 'bg-green-500/20 text-green-300 ring-1 ring-green-500/50'
                        : 'glass text-white/50 hover:text-white/80',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t(cfg.label_key)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{t('handover.note')}</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={4}
              required
              placeholder={t('handover.notePlaceholder')}
              className="w-full rounded-xl bg-white-fixed/55 border border-white/70 text-white text-sm px-3 py-2.5 placeholder:text-white/30 outline-none focus:ring-1 focus:ring-brand-orange/40 resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('handover.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving || !form.toUserId || !form.content.trim()}>
              {saving ? t('handover.saving') : t('handover.save')}
            </Button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {(['all', 'received', 'sent'] as FilterMode[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-sm font-medium transition-all',
                filter === f ? 'bg-brand-orange text-white-fixed' : 'glass text-white/55 hover:text-white/80',
              )}
            >
              {t(`handover.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-white/10" />
        <div className="flex gap-1.5">
          {(['all', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(p)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                priorityFilter === p ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70',
              )}
            >
              {p === 'all' ? t('handover.priorityAll') : t(`handover.priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass gradient-border rounded-2xl p-12 text-center">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 text-white/20" />
          <p className="text-white/50 font-medium">{t('handover.empty')}</p>
          <p className="text-white/30 text-sm mt-1">{t('handover.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => {
            const isReceived = note.to_user_id === user?.id
            const cfg = PRIORITY_CONFIG[note.priority]
            const PriorityIcon = cfg.icon
            const unread = isReceived && !note.acknowledged

            return (
              <div
                key={note.id}
                className={cn(
                  'glass gradient-border rounded-2xl p-4 border-l-4 transition-all',
                  cfg.border,
                  unread && 'ring-1 ring-brand-orange/40',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {isReceived ? (
                        <ArrowDownCircle className="h-4 w-4 text-sky-400 shrink-0" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 text-purple-400 shrink-0" />
                      )}
                      <span className="text-sm font-semibold">
                        {isReceived
                          ? `${t('handover.from')}: ${note.from_name ?? '—'}`
                          : `${t('handover.to')}: ${note.to_name ?? '—'}`}
                      </span>
                      <span className={cn('flex items-center gap-1 text-xs font-medium', cfg.color)}>
                        <PriorityIcon className="h-3 w-3" />
                        {t(cfg.label_key)}
                      </span>
                      {unread && (
                        <span className="h-2 w-2 rounded-full bg-brand-orange animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-white/35 mb-2">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                  </div>

                  <div className="shrink-0">
                    {unread && (
                      <button
                        type="button"
                        onClick={() => void acknowledge(note.id)}
                        className="flex items-center gap-1.5 rounded-xl bg-green-500/20 border border-green-500/30 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/30 transition-all"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t('handover.acknowledge')}
                      </button>
                    )}
                    {note.acknowledged && isReceived && (
                      <span className="flex items-center gap-1 text-xs text-green-400/70">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t('handover.acknowledged')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
