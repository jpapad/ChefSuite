import { useEffect, useState } from 'react'
import { Plus, BookOpen, Tag, X, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, PillButton, SearchField, Chip, ChipRow, Panel, EmptyState } from '../components/ui/page'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/cn'
import { ErrorState } from '../components/ui/ErrorState'

interface JournalEntry {
  id: string
  title: string
  content: string
  tags: string[]
  mood: number | null
  created_at: string
  updated_at: string
  author_name?: string
}

const MOOD_EMOJI = ['', '😞', '😐', '🙂', '😊', '🤩']

export default function ChefJournal() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<JournalEntry | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [mood, setMood] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing] = useState<JournalEntry | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    if (!profile?.team_id) return
    setLoadError(null)
    const { data, error: err } = await supabase
      .from('journal_entries')
      .select('*, profiles:author_id(full_name)')
      .eq('team_id', profile.team_id)
      .order('created_at', { ascending: false })
    if (err) { setLoadError(err.message); setLoading(false); return }
    const rows = (data ?? []) as Array<JournalEntry & { profiles: { full_name: string } | null }>
    setEntries(rows.map((r) => ({ ...r, author_name: r.profiles?.full_name ?? undefined })))
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile?.team_id])

  function openCreate() {
    setEditing(null); setTitle(''); setContent(''); setTags([]); setMood(null)
    setDrawerOpen(true)
  }

  function openEdit(e: JournalEntry) {
    setEditing(e); setTitle(e.title); setContent(e.content); setTags(e.tags); setMood(e.mood ?? null)
    setDrawerOpen(true)
  }

  function addTag() {
    const t2 = tagInput.trim().toLowerCase()
    if (t2 && !tags.includes(t2)) setTags((prev) => [...prev, t2])
    setTagInput('')
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!title.trim() || !profile?.team_id) return
    setSaving(true)
    try {
      const payload = { title: title.trim(), content, tags, mood, team_id: profile.team_id, author_id: profile.id, updated_at: new Date().toISOString() }
      if (editing) {
        await supabase.from('journal_entries').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('journal_entries').insert(payload)
      }
      setDrawerOpen(false)
      void load()
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('journal.deleteConfirm'))) return
    await supabase.from('journal_entries').delete().eq('id', id)
    setViewing(null)
    void load()
  }

  const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort()

  const filtered = entries.filter((e) => {
    const q = query.trim().toLowerCase()
    if (q && !e.title.toLowerCase().includes(q) && !e.content.toLowerCase().includes(q)) return false
    if (tagFilter && !e.tags.includes(tagFilter)) return false
    return true
  })

  return (
    <Page>
      <PageHeader
        title={t('journal.title')}
        subtitle={t('journal.subtitle')}
        actions={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('journal.newEntry')}</PillButton>}
      />

      <div className="flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder={t('journal.search')} className="max-w-md" />
        {allTags.length > 0 && (
          <ChipRow>
            <Chip active={!tagFilter} onClick={() => setTagFilter('')}>{t('common.all')}</Chip>
            {allTags.map((tag) => (
              <Chip key={tag} active={tagFilter === tag} onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}>#{tag}</Chip>
            ))}
          </ChipRow>
        )}
      </div>

      {loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t('journal.empty.title')}
          body={t('journal.empty.description')}
          action={<PillButton icon={Plus} variant="primary" onClick={openCreate}>{t('journal.newEntry')}</PillButton>}
        />
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4">
          {filtered.map((entry, i) => {
            const d = new Date(entry.created_at)
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setViewing(entry)}
                className={cn('flex w-full break-inside-avoid flex-col gap-3 rounded-3xl p-5 text-left shadow-card transition-transform hover:-translate-y-0.5', i === 0 ? 'bg-ink text-white-fixed' : 'bg-bg-card')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className={cn('text-3xl font-medium tabular-nums tracking-[-0.03em]', i === 0 && 'text-lime')}>{d.getDate()}</span>
                    <span className={cn('text-sm', i === 0 ? 'text-white-fixed/60' : 'text-white/50')}>{d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                  </div>
                  {entry.mood && <span className="text-xl" aria-hidden>{MOOD_EMOJI[entry.mood]}</span>}
                </div>
                <h3 className="text-lg font-medium leading-snug">{entry.title}</h3>
                {entry.content && <p className={cn('line-clamp-5 text-sm leading-relaxed', i === 0 ? 'text-white-fixed/70' : 'text-white/60')}>{entry.content}</p>}
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags.map((tag) => (
                      <span key={tag} className={cn('rounded-full px-2.5 py-0.5 text-xs', i === 0 ? 'bg-white-fixed/10' : 'bg-white/[0.06] text-white/60')}>#{tag}</span>
                    ))}
                  </div>
                )}
                {entry.author_name && <p className={cn('text-xs', i === 0 ? 'text-white-fixed/50' : 'text-white/45')}>{entry.author_name}</p>}
              </button>
            )
          })}
        </div>
      )}

      {/* View drawer */}
      <Drawer open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ''}>
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {viewing.mood && <span className="text-2xl">{MOOD_EMOJI[viewing.mood]}</span>}
              <p className="text-xs text-white/40">
                {new Date(viewing.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {viewing.author_name && ` · ${viewing.author_name}`}
              </p>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => { setViewing(null); openEdit(viewing) }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void onDelete(viewing.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {viewing.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewing.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-white/10 text-white/50 rounded-full px-2 py-0.5">#{tag}</span>
                ))}
              </div>
            )}
            {viewing.content ? (
              <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{viewing.content}</div>
            ) : (
              <p className="text-sm text-white/30 italic">{t('journal.noContent')}</p>
            )}
          </div>
        )}
      </Drawer>

      {/* Create / Edit drawer */}
      <Drawer open={drawerOpen} onClose={() => { if (!saving) setDrawerOpen(false) }}
        title={editing ? t('journal.editEntry') : t('journal.newEntry')}>
        <form onSubmit={onSubmit} className="space-y-5">
          <Input name="title" label={t('journal.entryTitle')} required value={title}
            onChange={(e) => setTitle(e.target.value)} />

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">{t('journal.content')}</label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('journal.contentPlaceholder')}
              className="w-full rounded-xl border border-glass-border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">{t('journal.mood')}</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map((v) => (
                <button key={v} type="button" onClick={() => setMood(mood === v ? null : v)}
                  className={cn('flex-1 rounded-xl py-2 text-xl border transition',
                    mood === v ? 'border-brand-orange bg-brand-orange/15' : 'border-glass-border hover:bg-white/5')}>
                  {MOOD_EMOJI[v]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">{t('journal.tags')}</label>
            <div className="flex gap-2">
              <Input name="tag_input" placeholder={t('journal.tagPlaceholder')} value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
              <Button type="button" variant="ghost" onClick={addTag} className="shrink-0">
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-white/10 text-white/70 rounded-full px-2.5 py-1">
                    #{tag}
                    <button type="button" onClick={() => setTags((p) => p.filter((t2) => t2 !== tag))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Drawer>
    </Page>
  )
}
