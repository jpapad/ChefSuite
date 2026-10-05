import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  GraduationCap, Plus, ClipboardList, HelpCircle, CheckCircle2, XCircle, Circle, X, Sparkles,
  Pencil, Trash2, RotateCcw, ChefHat, Users, BookOpen,
} from 'lucide-react'
import {
  Page, PageHeader, PillButton, ActionMenu, StatRow, StatTile, Panel, Segmented, EmptyState, Notice,
} from '../components/ui/page'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../hooks/useTeam'
import { useTraining } from '../hooks/useTraining'
import { useRecipes } from '../hooks/useRecipes'
import { useRecipeIngredients } from '../hooks/useRecipeIngredients'
import { useInventory } from '../hooks/useInventory'
import { quizFromRecipe } from '../lib/quizFromRecipe'
import { cn } from '../lib/cn'
import type { TrainingModule, TrainingModuleDraft, TrainingQuestion } from '../types/database.types'

const MANAGER_ROLES = ['owner', 'executive_chef', 'head_chef']

// ── Player: read an SOP or take a quiz ───────────────────────────────────────
function Player({ module, onClose, onDone }: {
  module: TrainingModule
  onClose: () => void
  onDone: (r: { score: number | null; passed: boolean; answers: number[] | null }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const qs = module.questions
  const correct = answers.filter((a, i) => a === qs[i]?.answer).length
  const score = qs.length ? Math.round((correct / qs.length) * 100) : 0
  const passed = score >= module.pass_pct

  async function finishQuiz(all: number[]) {
    setFinished(true)
    setSaving(true)
    const c = all.filter((a, i) => a === qs[i]?.answer).length
    const sc = Math.round((c / qs.length) * 100)
    try { await onDone({ score: sc, passed: sc >= module.pass_pct, answers: all }) } finally { setSaving(false) }
  }

  function next() {
    if (picked == null) return
    const all = [...answers, picked]
    setAnswers(all)
    setPicked(null)
    if (idx + 1 >= qs.length) void finishQuiz(all)
    else setIdx(idx + 1)
  }

  function restart() { setIdx(0); setAnswers([]); setPicked(null); setFinished(false) }

  const steps = (module.body ?? '').split(/\n+/).map((s) => s.trim()).filter(Boolean)

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={module.title} className="fixed inset-0 z-50 overflow-y-auto bg-bg-surface">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 px-3 py-3 sm:px-6 sm:py-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink">{module.kind === 'quiz' ? 'Quiz' : 'SOP'}</span>
          {module.kind === 'quiz' && !finished && (
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-input">
              <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${(idx / qs.length) * 100}%` }} />
            </div>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-card shadow-card"><X className="h-5 w-5" /></button>
        </div>

        <h1 className="text-4xl font-medium tracking-[-0.03em]">{module.title}</h1>

        {module.kind === 'sop' ? (
          <>
            <ol className="flex flex-col gap-2">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-4 rounded-3xl bg-bg-card p-5 shadow-card">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-lime tabular-nums">{i + 1}</span>
                  <p className="pt-1.5 text-[15px] leading-relaxed sm:text-base">{s.replace(/^\d+[.)]\s*/, '')}</p>
                </li>
              ))}
            </ol>
            <button type="button" disabled={saving}
              onClick={async () => { setSaving(true); try { await onDone({ score: null, passed: true, answers: null }); onClose() } finally { setSaving(false) } }}
              className="mt-2 flex h-14 items-center justify-center gap-2 rounded-full bg-lime text-base font-medium text-ink hover:brightness-95 disabled:opacity-50">
              <CheckCircle2 className="h-5 w-5" />{t('training.ack')}
            </button>
          </>
        ) : finished ? (
          <div className={cn('flex flex-col items-center gap-4 rounded-[2rem] p-8 text-center', passed ? 'bg-ink text-white-fixed' : 'bg-bg-card shadow-card')}>
            <span className={cn('text-[6rem] font-medium leading-none tracking-[-0.05em] tabular-nums', passed ? 'text-lime' : 'text-red-500')}>{score}%</span>
            <p className="text-xl font-medium">{passed ? t('training.passed') : t('training.failed', { pct: module.pass_pct })}</p>
            <p className={cn('text-sm', passed ? 'text-white-fixed/60' : 'text-white/55')}>{t('training.correctOf', { correct, total: qs.length })}</p>
            <div className="flex gap-2">
              {!passed && <button type="button" onClick={restart} className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-orange px-5 font-medium text-on-accent"><RotateCcw className="h-4 w-4" />{t('training.retry')}</button>}
              <button type="button" onClick={onClose} className={cn('h-12 rounded-full px-5 font-medium', passed ? 'bg-lime text-ink' : 'bg-bg-input')}>{t('common.close')}</button>
            </div>
            {/* Review */}
            <ol className="mt-4 flex w-full flex-col gap-2 text-left">
              {qs.map((q, i) => {
                const ok = answers[i] === q.answer
                return (
                  <li key={i} className={cn('rounded-2xl px-4 py-3 text-sm', passed ? 'bg-white-fixed/[0.06]' : 'bg-bg-input')}>
                    <p className="flex items-start gap-2 font-medium">{ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}{q.q}</p>
                    {!ok && <p className="ml-6 mt-1 opacity-70">{t('training.rightAnswer')}: {q.options[q.answer]}</p>}
                  </li>
                )
              })}
            </ol>
          </div>
        ) : qs[idx] ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-white/55">{t('training.questionOf', { current: idx + 1, total: qs.length })}</p>
            <p className="text-2xl font-medium leading-snug sm:text-3xl">{qs[idx]!.q}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {qs[idx]!.options.map((o, i) => (
                <button key={i} type="button" onClick={() => setPicked(i)}
                  className={cn('flex min-h-16 items-center gap-3 rounded-3xl p-4 text-left text-lg font-medium transition',
                    picked === i ? 'bg-ink text-white-fixed' : 'bg-bg-card shadow-card hover:-translate-y-0.5')}>
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm', picked === i ? 'bg-lime text-ink' : 'bg-bg-input')}>{String.fromCharCode(65 + i)}</span>
                  {o}
                </button>
              ))}
            </div>
            <button type="button" onClick={next} disabled={picked == null}
              className="h-14 rounded-full bg-brand-orange text-base font-medium text-on-accent disabled:opacity-40">
              {idx + 1 >= qs.length ? t('training.finish') : t('common.next')}
            </button>
          </div>
        ) : <Notice>{t('training.noQuestions')}</Notice>}
      </div>
    </div>,
    document.body,
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Training() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { members } = useTeam()
  const { modules, loading, error, saveModule, removeModule, complete, bestOf } = useTraining()
  const { recipes } = useRecipes()
  const { getFor: getIngredients } = useRecipeIngredients()
  const { items: inventory } = useInventory()
  const isManager = MANAGER_ROLES.includes(profile?.role ?? '')
  const me = profile?.id ?? ''

  const [view, setView] = useState<'modules' | 'team'>('modules')
  const [playing, setPlaying] = useState<TrainingModule | null>(null)

  const required = modules.filter((m) => m.required)
  const myDone = required.filter((m) => bestOf(m.id, me)?.passed).length
  const staff = members
  const teamCells = staff.length * required.length
  const teamDone = staff.reduce((n, p) => n + required.filter((m) => bestOf(m.id, p.id)?.passed).length, 0)
  const behind = staff.filter((p) => required.some((m) => !bestOf(m.id, p.id)?.passed)).length

  // ── Editor ──
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingModule | null>(null)
  const [draft, setDraft] = useState<TrainingModuleDraft>({ kind: 'sop', title: '', body: '', recipe_id: null, questions: [], pass_pct: 80, required: true })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openEditor(kind: 'sop' | 'quiz', m?: TrainingModule) {
    setEditing(m ?? null)
    setDraft(m ? { kind: m.kind, title: m.title, body: m.body, recipe_id: m.recipe_id, questions: m.questions, pass_pct: m.pass_pct, required: m.required }
      : { kind, title: '', body: '', recipe_id: null, questions: [], pass_pct: 80, required: true })
    setFormError(null)
    setEditorOpen(true)
  }

  function generateFrom(recipeId: string) {
    const r = recipes.find((x) => x.id === recipeId)
    if (!r) { setDraft((d) => ({ ...d, recipe_id: null, questions: [] })); return }
    const qs = quizFromRecipe(r, getIngredients(r.id), inventory, t, i18n.language)
    setDraft((d) => ({ ...d, recipe_id: r.id, questions: qs, title: d.title || t('training.quizTitle', { recipe: r.title }) }))
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) { setFormError(t('training.titleRequired')); return }
    if (draft.kind === 'quiz' && draft.questions.length < 2) { setFormError(t('training.needQuestions')); return }
    if (draft.kind === 'sop' && !draft.body?.trim()) { setFormError(t('training.needBody')); return }
    setSaving(true)
    try { await saveModule({ ...draft, title: draft.title.trim() }, editing?.id); setEditorOpen(false) }
    catch (err) { setFormError(err instanceof Error ? err.message : t('common.saveFailed')) }
    finally { setSaving(false) }
  }

  function Status({ moduleId, uid }: { moduleId: string; uid: string }) {
    const b = bestOf(moduleId, uid)
    if (!b) return <span className="inline-flex items-center gap-1 text-xs text-white/40"><Circle className="h-3.5 w-3.5" />{t('training.pending')}</span>
    if (b.passed) return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" />{b.score != null ? `${b.score}%` : t('training.done')}</span>
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500"><XCircle className="h-3.5 w-3.5" />{b.score}%</span>
  }

  return (
    <Page>
      <PageHeader
        title={t('training.title')}
        subtitle={t('training.subtitle')}
        actions={isManager && (
          <ActionMenu label={t('training.new')} icon={Plus} variant="primary" actions={[
            { label: t('training.newSop'), hint: t('training.newSopHint'), icon: ClipboardList, onClick: () => openEditor('sop') },
            { label: t('training.newQuiz'), hint: t('training.newQuizHint'), icon: ChefHat, onClick: () => openEditor('quiz') },
          ]} />
        )}
      />
      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile label={t('training.stat.mine')} value={`${myDone}/${required.length}`} icon={GraduationCap} tone={required.length && myDone === required.length ? 'lime' : 'ink'} />
        <StatTile label={t('training.stat.modules')} value={modules.length} icon={BookOpen} hint={t('training.stat.modulesHint', { sop: modules.filter((m) => m.kind === 'sop').length, quiz: modules.filter((m) => m.kind === 'quiz').length })} />
        {isManager && <StatTile label={t('training.stat.team')} value={teamCells ? `${Math.round((teamDone / teamCells) * 100)}%` : '—'} icon={Users} onClick={() => setView('team')} />}
        {isManager && <StatTile label={t('training.stat.behind')} value={behind} icon={HelpCircle} tone={behind ? 'warn' : 'default'} hint={t('training.stat.behindHint')} onClick={() => setView('team')} />}
      </StatRow>

      {isManager && modules.length > 0 && (
        <Segmented value={view} onChange={setView} options={[
          { value: 'modules', label: t('training.view.modules'), icon: BookOpen },
          { value: 'team', label: t('training.view.team'), icon: Users },
        ]} />
      )}

      {loading ? null : modules.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t('training.empty')} body={isManager ? t('training.emptyHintManager') : t('training.emptyHint')}
          action={isManager && <PillButton variant="primary" icon={ChefHat} onClick={() => openEditor('quiz')}>{t('training.newQuiz')}</PillButton>} />
      ) : view === 'modules' ? (
        <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {modules.map((m) => {
            const b = bestOf(m.id, me)
            const recipe = m.recipe_id ? recipes.find((r) => r.id === m.recipe_id) : null
            return (
              <article key={m.id} className={cn('flex flex-col gap-4 rounded-3xl p-5 shadow-card', b?.passed ? 'bg-bg-card' : 'bg-bg-card ring-2 ring-lime/70')}>
                <div className="flex items-start justify-between gap-3">
                  <span className={cn('flex h-11 w-11 items-center justify-center rounded-full', m.kind === 'quiz' ? 'bg-ink text-lime' : 'bg-lime text-ink')}>
                    {m.kind === 'quiz' ? <HelpCircle className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                  </span>
                  {isManager && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => openEditor(m.kind, m)} aria-label={t('common.edit')} className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.05] hover:text-white"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => { if (window.confirm(t('training.deleteConfirm', { title: m.title }))) void removeModule(m.id) }} aria-label={t('common.delete')} className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 hover:bg-red-500/10 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-medium leading-tight">{m.title}</h2>
                  <p className="mt-1 text-sm text-white/55">
                    {m.kind === 'quiz' ? t('training.questionsN', { count: m.questions.length }) : t('training.stepsN', { count: (m.body ?? '').split(/\n+/).filter((s) => s.trim()).length })}
                    {recipe && ` · ${recipe.title}`}
                    {!m.required && ` · ${t('training.optional')}`}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Status moduleId={m.id} uid={me} />
                  <button type="button" onClick={() => setPlaying(m)}
                    className={cn('h-10 rounded-full px-4 text-sm font-medium', b?.passed ? 'bg-bg-input' : 'bg-brand-orange text-on-accent')}>
                    {b?.passed ? t('training.again') : m.kind === 'quiz' ? t('training.start') : t('training.read')}
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <Panel padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50">
                  <th className="px-5 py-4 font-medium">{t('training.person')}</th>
                  {modules.map((m) => <th key={m.id} className="max-w-[160px] truncate px-3 py-4 font-medium" title={m.title}>{m.title}</th>)}
                </tr>
              </thead>
              <tbody>
                {staff.map((p) => (
                  <tr key={p.id} className="border-t border-white/[0.06]">
                    <td className="px-5 py-3 font-medium">{p.full_name ?? t('common.unnamed')}</td>
                    {modules.map((m) => <td key={m.id} className="px-3 py-3"><Status moduleId={m.id} uid={p.id} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {playing && (
        <Player module={playing} onClose={() => setPlaying(null)} onDone={(r) => complete(playing.id, r)} />
      )}

      <Drawer open={editorOpen} onClose={() => !saving && setEditorOpen(false)}
        title={editing ? t('training.edit') : draft.kind === 'quiz' ? t('training.newQuiz') : t('training.newSop')}>
        <form onSubmit={(e) => void onSave(e)} className="flex flex-col gap-5">
          {draft.kind === 'quiz' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-white/80">{t('training.fromRecipe')}</span>
              <select value={draft.recipe_id ?? ''} onChange={(e) => generateFrom(e.target.value)}
                className="h-12 rounded-xl border border-inv-border bg-bg-input px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-orange/40">
                <option value="">{t('training.pickRecipe')}</option>
                {[...recipes].sort((a, b) => a.title.localeCompare(b.title)).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </label>
          )}
          <Input name="title" label={t('training.titleLabel')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />

          {draft.kind === 'sop' ? (
            <Textarea name="body" label={t('training.body')} rows={10} placeholder={t('training.bodyPlaceholder')} hint={t('training.bodyHint')}
              value={draft.body ?? ''} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">{t('training.questionsN', { count: draft.questions.length })}</span>
                {draft.recipe_id && (
                  <button type="button" onClick={() => generateFrom(draft.recipe_id!)} className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                    <Sparkles className="h-4 w-4" />{t('training.regenerate')}
                  </button>
                )}
              </div>
              {draft.questions.length === 0 && <p className="rounded-2xl bg-bg-input px-4 py-3 text-sm text-white/55">{t('training.pickRecipeHint')}</p>}
              {draft.questions.map((q: TrainingQuestion, i) => (
                <div key={i} className="flex gap-2 rounded-2xl bg-bg-input p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{i + 1}. {q.q}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {q.options.map((o, j) => (
                        <span key={j} className={cn('rounded-full px-2.5 py-0.5 text-xs', j === q.answer ? 'bg-ink text-lime' : 'bg-bg-card text-white/60')}>{o}</span>
                      ))}
                    </div>
                  </div>
                  <button type="button" aria-label={t('common.delete')} onClick={() => setDraft((d) => ({ ...d, questions: d.questions.filter((_, k) => k !== i) }))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/45 hover:bg-bg-card hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
              <Input type="number" min={1} max={100} name="pass_pct" label={t('training.passPct')} value={draft.pass_pct}
                onChange={(e) => setDraft((d) => ({ ...d, pass_pct: Math.min(100, Math.max(1, Number(e.target.value) || 80)) }))} />
            </div>
          )}

          <label className="flex items-center gap-3 rounded-2xl bg-bg-input px-4 py-3 text-sm">
            <input type="checkbox" checked={draft.required} onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))} className="h-4 w-4 accent-[#0F1210]" />
            {t('training.requiredLabel')}
          </label>

          {formError && <Notice>{formError}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
          </div>
        </form>
      </Drawer>
    </Page>
  )
}
