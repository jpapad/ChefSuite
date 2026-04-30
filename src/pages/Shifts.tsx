import { useMemo, useState } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2, CalendarDays, Clock, X, Check, Printer, FileDown,
} from 'lucide-react'
import { exportE4 } from '../lib/erganiExport'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
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
  'bg-brand-orange/20 border-brand-orange/50 text-brand-orange',
  'bg-blue-500/20 border-blue-500/50 text-blue-400',
  'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
  'bg-rose-500/20 border-rose-500/50 text-rose-400',
  'bg-amber-500/20 border-amber-500/50 text-amber-400',
  'bg-pink-500/20 border-pink-500/50 text-pink-400',
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

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">{t('shifts.title')}</h1>
          <p className="text-white/60 mt-1">{t('shifts.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            leftIcon={<FileDown className="h-4 w-4" />}
            onClick={() => exportE4(
              shifts.map((s) => ({
                memberName: membersById.get(s.member_id)?.full_name ?? '—',
                shiftDate: s.shift_date,
                startTime: s.start_time,
                endTime: s.end_time,
                role: s.role,
              })),
              weekLabel(weekStart),
            )}
          >
            {t('shifts.erganiExport')}
          </Button>
          <Button variant="secondary" leftIcon={<Printer className="h-4 w-4" />} onClick={() => setPrintOpen(true)}>
            {t('shifts.print.button')}
          </Button>
          <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => openCreate()}>
            {t('shifts.addShift')}
          </Button>
        </div>
      </header>

      {error && <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>}

      {/* Week navigator */}
      <GlassCard className="flex items-center justify-between gap-3">
        <button type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold">{weekLabel(weekStart)}</p>
          <button type="button"
            onClick={() => setWeekStart(getWeekStart())}
            className="text-xs text-white/40 hover:text-white/70 transition mt-0.5">
            {t('common.today')}
          </button>
        </div>
        <button type="button"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5">
          <ChevronRight className="h-5 w-5" />
        </button>
      </GlassCard>

      {/* Member legend */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium', memberColorMap.get(m.id))}>
              {m.full_name ?? t('common.unnamed')}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
      ) : (
        /* ── Weekly calendar grid ── */
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const { weekday, date, isToday } = dayLabel(day)
            const dayShifts = shifts.filter((sh) => sh.shift_date === day)
            return (
              <div key={day} className="flex flex-col gap-1.5 min-w-0">
                {/* Day header */}
                <div className={cn(
                  'rounded-xl px-2 py-2 text-center text-xs',
                  isToday ? 'bg-brand-orange text-white-fixed font-bold' : 'bg-white/5 text-white/60',
                )}>
                  <div className="font-semibold">{weekday}</div>
                  <div className="text-[10px] opacity-75">{date}</div>
                </div>

                {/* Shift cards */}
                {dayShifts.map((sh) => {
                  const member = membersById.get(sh.member_id)
                  const color = memberColorMap.get(sh.member_id) ?? MEMBER_COLORS[0]
                  return (
                    <div key={sh.id}
                      className={cn('group rounded-lg border px-2 py-1.5 text-xs space-y-0.5 cursor-pointer hover:brightness-110 transition', color)}>
                      <div className="font-semibold truncate leading-tight">
                        {member?.full_name ?? t('common.unnamed')}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-70">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        {sh.start_time.slice(0, 5)}–{sh.end_time.slice(0, 5)}
                      </div>
                      {sh.role && <div className="truncate opacity-60">{sh.role}</div>}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition pt-0.5">
                        <button type="button" onClick={() => openEdit(sh)}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-white/20">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => handleDelete(sh)}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-red-500/30 text-red-300">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Add button */}
                <button type="button" onClick={() => openCreate(day)}
                  className="flex items-center justify-center rounded-lg border border-dashed border-white/10 py-1.5 text-white/20 hover:text-white/50 hover:border-white/30 transition text-xs">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
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
                <option value="" className="bg-[#f5ede0]">{t('shifts.form.selectMember')}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#f5ede0]">
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
    </div>
  )
}
