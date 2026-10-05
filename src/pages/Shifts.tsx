import { useMemo, useState } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Clock, X, Printer, FileDown,
} from 'lucide-react'
import { exportE4 } from '../lib/erganiExport'
import { useTranslation } from 'react-i18next'
import { Page, PageHeader, PillButton, ActionMenu, StatRow, StatTile, Panel, Notice } from '../components/ui/page'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { useShifts, getWeekStart, addDays } from '../hooks/useShifts'
import { useTeam } from '../hooks/useTeam'
import { cn } from '../lib/cn'
import type { Shift } from '../types/database.types'

// ── Colour palette per member index ───────────────────────────────────────────
const MEMBER_COLORS = [
  'bg-white/[0.06] border-white/15 text-white',
  'bg-sky-500/10 border-sky-500/30 text-sky-500',
  'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
  'bg-rose-500/10 border-rose-500/30 text-rose-500',
  'bg-amber-500/12 border-amber-500/30 text-amber-500',
  'bg-violet-500/10 border-violet-500/30 text-violet-500',
]

const PRINT_COLORS = ['#ea580c', '#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#ec4899']

function shiftMins(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function fmtHours(mins: number): string {
  if (mins <= 0) return '0h'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

interface ShiftFormValues {
  member_id: string
  shift_date: string
  start_time: string
  end_time: string
  role: string
  notes: string
}

function blankForm(defaultDate: string, sh?: Shift): ShiftFormValues {
  return {
    member_id: sh?.member_id ?? '',
    shift_date: sh?.shift_date ?? defaultDate,
    start_time: sh?.start_time ?? '08:00',
    end_time: sh?.end_time ?? '16:00',
    role: sh?.role ?? '',
    notes: sh?.notes ?? '',
  }
}

export default function Shifts() {
  const { t } = useTranslation()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const { shifts, loading, error, create, update, remove } = useShifts(weekStart)
  const { members } = useTeam()

  const [printOpen, setPrintOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState<ShiftFormValues>(() => blankForm(weekStart))

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const memberColorMap = useMemo(() => {
    const map = new Map<string, string>()
    members.forEach((m, i) => map.set(m.id, MEMBER_COLORS[i % MEMBER_COLORS.length]))
    return map
  }, [members])

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  function weekLabel(ws: string): string {
    const end = addDays(ws, 6)
    const s = new Date(ws + 'T00:00:00')
    const e = new Date(end + 'T00:00:00')
    return `${s.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

  function dayLabel(iso: string): { weekday: string; date: string; isToday: boolean } {
    const d = new Date(iso + 'T00:00:00')
    const today = new Date()
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    return {
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      isToday,
    }
  }

  function openCreate(date?: string) {
    setEditing(null)
    setValues(blankForm(date ?? weekStart))
    setFormError(null)
    setDrawerOpen(true)
  }

  function openEdit(sh: Shift) {
    setEditing(sh)
    setValues(blankForm(sh.shift_date, sh))
    setFormError(null)
    setDrawerOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!values.member_id) { setFormError(t('shifts.form.memberRequired')); return }
    if (!values.start_time || !values.end_time) { setFormError(t('shifts.form.timeRequired')); return }
    if (values.start_time >= values.end_time) { setFormError(t('shifts.form.timeOrder')); return }
    setSaving(true)
    try {
      const payload = {
        member_id: values.member_id,
        shift_date: values.shift_date,
        start_time: values.start_time,
        end_time: values.end_time,
        role: values.role.trim() || null,
        notes: values.notes.trim() || null,
      }
      if (editing) await update(editing.id, payload)
      else await create(payload)
      setDrawerOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sh: Shift) {
    const member = membersById.get(sh.member_id)
    const ok = window.confirm(t('shifts.deleteConfirm', { name: member?.full_name ?? '?' }))
    if (!ok) return
    await remove(sh.id)
  }

  const hoursOf = (sh: Shift) => {
    const [sh1, sm1] = sh.start_time.split(':').map(Number)
    const [eh, em] = sh.end_time.split(':').map(Number)
    let mins = eh * 60 + em - (sh1 * 60 + sm1)
    if (mins < 0) mins += 24 * 60
    return mins / 60
  }
  const totalHours = shifts.reduce((sum, sh) => sum + hoursOf(sh), 0)
  const scheduledIds = new Set(shifts.map((sh) => sh.member_id))
  const rows = members.filter((m) => scheduledIds.has(m.id)).concat(members.filter((m) => !scheduledIds.has(m.id)))
  const todayShifts = shifts.filter((sh) => dayLabel(sh.shift_date).isToday).length

  return (
    <Page>
      <PageHeader
        title={t('shifts.title')}
        subtitle={t('shifts.subtitle')}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-full bg-bg-card p-1 shadow-card">
              <button type="button" aria-label="−7" onClick={() => setWeekStart((w) => addDays(w, -7))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => setWeekStart(getWeekStart())} className="min-w-[150px] px-2 text-sm font-medium" title={t('common.today')}>
                {weekLabel(weekStart)}
              </button>
              <button type="button" aria-label="+7" onClick={() => setWeekStart((w) => addDays(w, 7))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <ActionMenu
              label={t('shifts.v2.export')}
              icon={FileDown}
              actions={[
                {
                  label: t('shifts.erganiExport'), icon: FileDown,
                  onClick: () => exportE4(
                    shifts.map((sh) => ({
                      memberName: membersById.get(sh.member_id)?.full_name ?? '—',
                      shiftDate: sh.shift_date, startTime: sh.start_time, endTime: sh.end_time, role: sh.role,
                    })),
                    weekLabel(weekStart),
                  ),
                },
                { label: t('shifts.print.button'), icon: Printer, onClick: () => setPrintOpen(true) },
              ]}
            />
            <PillButton icon={Plus} variant="primary" onClick={() => openCreate()}>{t('shifts.addShift')}</PillButton>
          </>
        }
      />

      {error && <Notice>{error}</Notice>}

      <StatRow>
        <StatTile tone="ink" label={t('shifts.v2.hours')} value={totalHours.toFixed(0)} hint={weekLabel(weekStart)} />
        <StatTile label={t('shifts.v2.shifts')} value={shifts.length} />
        <StatTile label={t('shifts.v2.people')} value={`${scheduledIds.size}/${members.length}`} hint={t('shifts.v2.peopleHint')} />
        <StatTile tone="lime" label={t('shifts.v2.today')} value={todayShifts} hint={t('shifts.v2.todayHint')} />
      </StatRow>

      {loading ? (
        <Panel><p className="text-white/55">{t('common.loading')}</p></Panel>
      ) : (
        /* ── Roster: people × days ── */
        <Panel padded={false}>
          <div className="overflow-x-auto p-3">
            <div className="grid min-w-[900px] gap-2" style={{ gridTemplateColumns: '200px repeat(7, minmax(0, 1fr)) 64px' }}>
              <span />
              {weekDays.map((day) => {
                const { weekday, date, isToday } = dayLabel(day)
                return (
                  <div key={day} className={cn('rounded-2xl px-2 py-2 text-center text-xs', isToday ? 'bg-ink text-white-fixed' : 'text-white/55')}>
                    <div className={cn('font-medium', isToday && 'text-lime')}>{weekday}</div>
                    <div className="opacity-75">{date}</div>
                  </div>
                )
              })}
              <span className="self-end pb-2 text-center text-xs text-white/45">{t('shifts.v2.hoursShort')}</span>

              {rows.map((m) => {
                const mine = shifts.filter((sh) => sh.member_id === m.id)
                const hrs = mine.reduce((sum, sh) => sum + hoursOf(sh), 0)
                return (
                  <div key={m.id} className="contents">
                    <div className="flex items-center gap-2 border-t border-white/[0.06] py-2 pr-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold">
                        {(m.full_name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      <span className="truncate text-sm font-medium">{m.full_name ?? t('common.unnamed')}</span>
                    </div>
                    {weekDays.map((day) => {
                      const cell = mine.filter((sh) => sh.shift_date === day)
                      return (
                        <div key={day} className="flex flex-col gap-1 border-t border-white/[0.06] py-2">
                          {cell.map((sh) => (
                            <div key={sh.id} className={cn('group relative rounded-xl border px-2 py-1.5 text-xs', memberColorMap.get(sh.member_id) ?? MEMBER_COLORS[0])}>
                              <div className="flex items-center gap-1 font-medium tabular-nums">
                                <Clock className="h-3 w-3 shrink-0 opacity-70" />{sh.start_time.slice(0, 5)}–{sh.end_time.slice(0, 5)}
                              </div>
                              {sh.role && <div className="truncate opacity-70">{sh.role}</div>}
                              <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                                <button type="button" onClick={() => openEdit(sh)} aria-label={t('common.edit')} className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-card text-white shadow-card"><Pencil className="h-3 w-3" /></button>
                                <button type="button" onClick={() => handleDelete(sh)} aria-label={t('common.delete')} className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-card text-red-500 shadow-card"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            </div>
                          ))}
                          {cell.length === 0 && (
                            <button type="button" onClick={() => openCreate(day)} aria-label={`${t('shifts.addShift')} ${day}`}
                              className="flex h-full min-h-[40px] items-center justify-center rounded-xl text-white/20 transition hover:bg-white/[0.04] hover:text-white/60">
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-center border-t border-white/[0.06] py-2 text-sm font-medium tabular-nums">
                      {hrs ? hrs.toFixed(0) : <span className="text-white/30">—</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Panel>
      )}

      {/* ── Print overlay ── */}
      {printOpen && (() => {
        const S = {
          root:      { background: 'rgb(26,18,8)' } as React.CSSProperties,
          topBar:    { background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
          titleText: { color: '#ffffff' } as React.CSSProperties,
          mutedText: { color: 'rgba(255,255,255,0.5)' } as React.CSSProperties,
          separator: { borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' } as React.CSSProperties,
          tableWrap: { border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' } as React.CSSProperties,
          thBase:    { padding: '12px 8px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: '90px' },
          thName:    { padding: '12px 16px', textAlign: 'left' as const, fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: '120px' },
          thToday:   { padding: '12px 8px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 600, color: '#ffffff', background: '#ea580c', borderBottom: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: '90px' },
          thTotal:   { padding: '12px 8px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.1)', minWidth: '70px' },
          tdName:    { padding: '12px 16px', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' as const, borderRight: '1px solid rgba(255,255,255,0.08)' },
          tdCell:    { padding: '8px', textAlign: 'center' as const, verticalAlign: 'top' as const, fontSize: '11px', borderRight: '1px solid rgba(255,255,255,0.08)' },
          tdCellToday: { padding: '8px', textAlign: 'center' as const, verticalAlign: 'top' as const, fontSize: '11px', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgba(234,88,12,0.1)' },
          tdTotal:   { padding: '8px', textAlign: 'center' as const, fontWeight: 700, fontSize: '13px' },
          trBorder:  { borderBottom: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties,
          trFoot:    { background: 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.15)' } as React.CSSProperties,
          tdFootName:{ padding: '12px 16px', fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.6)', borderRight: '1px solid rgba(255,255,255,0.08)' },
          tdFootCell:{ padding: '8px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', borderRight: '1px solid rgba(255,255,255,0.08)' },
          tdFootCellToday: { padding: '8px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgba(234,88,12,0.1)' },
          timeText:  { fontWeight: 700, color: 'rgba(255,255,255,0.88)' } as React.CSSProperties,
          roleText:  { color: 'rgba(255,255,255,0.45)', marginTop: '2px' } as React.CSSProperties,
          notesText: { color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '2px' } as React.CSSProperties,
          dash:      { color: 'rgba(255,255,255,0.12)' } as React.CSSProperties,
          footer:    { textAlign: 'center' as const, fontSize: '11px', color: 'rgba(255,255,255,0.2)' } as React.CSSProperties,
        }
        const totalAllMins = shifts.reduce((s, sh) => s + shiftMins(sh.start_time, sh.end_time), 0)
        return (
          <div className="fixed inset-0 z-50 overflow-auto" style={S.root}>

            {/* Top bar */}
            <div className="print:hidden sticky top-0 z-10 px-6 py-3 flex items-center justify-between gap-4" style={S.topBar}>
              <div>
                <p className="font-semibold" style={S.titleText}>{t('shifts.print.title')}</p>
                <p className="text-sm" style={S.mutedText}>{weekLabel(weekStart)}</p>
              </div>
              <div className="flex gap-2">
                <Button leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                  {t('shifts.print.print')}
                </Button>
                <Button variant="secondary" leftIcon={<X className="h-4 w-4" />} onClick={() => setPrintOpen(false)}>
                  {t('shifts.print.close')}
                </Button>
              </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">

              <div style={S.separator}>
                <h1 className="text-2xl font-bold" style={S.titleText}>{t('shifts.print.title')}</h1>
                <p className="mt-1" style={S.mutedText}>{weekLabel(weekStart)}</p>
              </div>

              <div style={S.tableWrap}>
                <div className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                    <thead>
                      <tr>
                        <th style={S.thName}>{t('shifts.form.member')}</th>
                        {weekDays.map((day) => {
                          const { weekday, date, isToday } = dayLabel(day)
                          return (
                            <th key={day} style={isToday ? S.thToday : S.thBase}>
                              <div>{weekday}</div>
                              <div style={{ fontWeight: 400, fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>{date}</div>
                            </th>
                          )
                        })}
                        <th style={S.thTotal}>{t('shifts.print.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member, idx) => {
                        const color = PRINT_COLORS[idx % PRINT_COLORS.length]
                        const memberShifts = shifts.filter((sh) => sh.member_id === member.id)
                        const totalMins = memberShifts.reduce((s, sh) => s + shiftMins(sh.start_time, sh.end_time), 0)
                        return (
                          <tr key={member.id} style={S.trBorder}>
                            <td style={{ ...S.tdName, color }}>{member.full_name ?? t('common.unnamed')}</td>
                            {weekDays.map((day) => {
                              const { isToday } = dayLabel(day)
                              const dayShifts = shifts.filter((sh) => sh.shift_date === day && sh.member_id === member.id)
                              return (
                                <td key={day} style={isToday ? S.tdCellToday : S.tdCell}>
                                  {dayShifts.length === 0
                                    ? <span style={S.dash}>—</span>
                                    : dayShifts.map((sh) => (
                                      <div key={sh.id} style={{ marginBottom: '4px' }}>
                                        <div style={S.timeText}>{sh.start_time.slice(0, 5)}–{sh.end_time.slice(0, 5)}</div>
                                        {sh.role && <div style={S.roleText}>{sh.role}</div>}
                                        {sh.notes && <div style={S.notesText}>{sh.notes}</div>}
                                      </div>
                                    ))
                                  }
                                </td>
                              )
                            })}
                            <td style={{ ...S.tdTotal, color }}>{fmtHours(totalMins)}</td>
                          </tr>
                        )
                      })}

                      {members.length > 0 && (
                        <tr style={S.trFoot}>
                          <td style={S.tdFootName}>{t('shifts.print.totalRow')}</td>
                          {weekDays.map((day) => {
                            const { isToday } = dayLabel(day)
                            const dayMins = shifts.filter((sh) => sh.shift_date === day).reduce((s, sh) => s + shiftMins(sh.start_time, sh.end_time), 0)
                            return (
                              <td key={day} style={isToday ? S.tdFootCellToday : S.tdFootCell}>
                                {dayMins > 0 ? fmtHours(dayMins) : <span style={S.dash}>—</span>}
                              </td>
                            )
                          })}
                          <td style={{ ...S.tdTotal, color: '#ea580c', fontSize: '15px' }}>{fmtHours(totalAllMins)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p style={S.footer}>{new Date().toLocaleDateString()} · Chefsuite</p>
            </div>

            <style>{`
              @media print {
                @page { size: A4 landscape; margin: 12mm; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              }
            `}</style>
          </div>
        )
      })()}

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { if (!saving) setDrawerOpen(false) }}
        title={editing ? t('shifts.editShift') : t('shifts.newShift')}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Member */}
          <div>
            <span className="mb-2 block text-sm font-medium text-white/80">{t('shifts.form.member')}</span>
            <div className="glass flex items-center rounded-xl px-4 min-h-touch-target focus-within:ring-2 focus-within:ring-brand-orange">
              <select
                value={values.member_id}
                onChange={(e) => setValues((v) => ({ ...v, member_id: e.target.value }))}
                className="flex-1 bg-transparent outline-none text-base text-white"
              >
                <option value="" className="bg-bg-card">{t('shifts.form.selectMember')}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id} className="bg-bg-card">
                    {m.full_name ?? t('common.unnamed')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            type="date"
            name="shift_date"
            label={t('shifts.form.date')}
            value={values.shift_date}
            onChange={(e) => setValues((v) => ({ ...v, shift_date: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="time"
              name="start_time"
              label={t('shifts.form.startTime')}
              value={values.start_time}
              onChange={(e) => setValues((v) => ({ ...v, start_time: e.target.value }))}
            />
            <Input
              type="time"
              name="end_time"
              label={t('shifts.form.endTime')}
              value={values.end_time}
              onChange={(e) => setValues((v) => ({ ...v, end_time: e.target.value }))}
            />
          </div>

          <Input
            name="role"
            label={t('shifts.form.role')}
            placeholder={t('shifts.form.rolePlaceholder')}
            value={values.role}
            onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}
          />

          <Textarea
            name="notes"
            label={t('shifts.form.notes')}
            placeholder={t('shifts.form.notesPlaceholder')}
            rows={2}
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />

          {formError && (
            <div className="glass rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/40">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('common.saving') : editing ? t('common.save') : t('shifts.form.create')}
            </Button>
          </div>
        </form>
      </Drawer>
    </Page>
  )
}
