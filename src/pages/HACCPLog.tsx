import { useMemo, useState } from 'react'
import { Plus, Thermometer, CheckCircle2, XCircle, Trash2, Settings2, FileDown, ClipboardList, Bell, BellRing } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { HACCPCheckForm, type HACCPCheckFormValues } from '../components/haccp/HACCPCheckForm'
import { HACCPBlankFormDrawer } from '../components/haccp/HACCPBlankFormDrawer'
import { HACCPRemindersDrawer } from '../components/haccp/HACCPRemindersDrawer'
import { useHACCP, isPass } from '../hooks/useHACCP'
import { useHACCPReminders } from '../hooks/useHACCPReminders'
import type { TempUnit } from '../types/database.types'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function HACCPLog() {
  const { t } = useTranslation()
  const [date, setDate] = useState(todayIso())
  const { checks, locations, loading, error, logCheck, deleteCheck, saveLocation, deleteLocation } = useHACCP(date)

  const { reminders } = useHACCPReminders()
  const overdueCount = useMemo(
    () => reminders.filter((r) => r.active && new Date(r.next_due) < new Date()).length,
    [reminders],
  )

  const [logDrawerOpen, setLogDrawerOpen] = useState(false)
  const [locDrawerOpen, setLocDrawerOpen] = useState(false)
  const [blankFormOpen, setBlankFormOpen] = useState(false)
  const [remindersOpen, setRemindersOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [locName, setLocName] = useState('')
  const [locMin, setLocMin] = useState<number>(0)
  const [locMax, setLocMax] = useState<number>(5)
  const [locUnit, setLocUnit] = useState<TempUnit>('C')
  const [locSaving, setLocSaving] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const passCount = useMemo(() => checks.filter(isPass).length, [checks])
  const failCount = checks.length - passCount
  const passRate = checks.length > 0 ? Math.round((passCount / checks.length) * 100) : null

  async function onLogCheck(values: HACCPCheckFormValues) {
    setSubmitting(true)
    try {
      await logCheck(values)
      setLogDrawerOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('haccp.deleteConfirm'))) return
    await deleteCheck(id)
  }

  async function onSaveLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!locName.trim()) return
    setLocSaving(true)
    setLocError(null)
    try {
      await saveLocation(locName.trim(), locMin, locMax, locUnit)
      setLocName('')
      setLocMin(0)
      setLocMax(5)
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLocSaving(false)
    }
  }

  function exportPdf() {
    window.print()
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          * { visibility: hidden; }
          /* Log print (default) */
          .haccp-print-area {
            visibility: visible;
            display: block !important;
            position: absolute;
            top: 0; left: 0; width: 100%;
          }
          .haccp-print-area * { visibility: visible; }
          /* Blank form print — hide log, show blank sheet */
          body.print-haccp-blank .haccp-print-area,
          body.print-haccp-blank .haccp-print-area * { visibility: hidden !important; }
          body.print-haccp-blank .haccp-blank-sheet {
            visibility: visible !important;
            display: block !important;
            position: absolute;
            top: 0; left: 0; width: 100%;
          }
          body.print-haccp-blank .haccp-blank-sheet * { visibility: visible !important; }
        }
        .haccp-print-area { display: none; }
        .haccp-blank-sheet { display: none; }
      `}</style>

      {/* Print-only area */}
      <div className="haccp-print-area" aria-hidden="true">
        {/* Header */}
        <div style={{ border: '2px solid #333', borderRadius: 4, padding: '14px 16px', marginBottom: 16, fontFamily: 'sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 3px' }}>HACCP Temperature Log</h1>
            <p style={{ fontSize: 12, color: '#555', margin: 0 }}>{t('haccp.tableHeaders.time')}: {date}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ border: '1px solid #16a34a', borderRadius: 6, padding: '6px 12px', textAlign: 'center', background: '#f0fdf4' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', lineHeight: 1 }}>{passCount}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>PASS</div>
            </div>
            <div style={{ border: '1px solid #dc2626', borderRadius: 6, padding: '6px 12px', textAlign: 'center', background: '#fff5f5' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', lineHeight: 1 }}>{failCount}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>FAIL</div>
            </div>
            {passRate !== null && (
              <div style={{ border: '1px solid #aaa', borderRadius: 6, padding: '6px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: passRate === 100 ? '#16a34a' : passRate >= 80 ? '#d97706' : '#dc2626', lineHeight: 1 }}>{passRate}%</div>
                <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>COMPLIANCE</div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'sans-serif', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={thStyle}>{t('haccp.tableHeaders.location')}</th>
              <th style={thStyle}>{t('haccp.tableHeaders.temperature')}</th>
              <th style={thStyle}>{t('haccp.tableHeaders.range')}</th>
              <th style={thStyle}>{t('haccp.tableHeaders.time')}</th>
              <th style={thStyle}>{t('haccp.tableHeaders.checkedBy')}</th>
              <th style={thStyle}>{t('haccp.form.status')}</th>
              <th style={thStyle}>{t('haccp.correctiveAction')}</th>
              <th style={thStyle}>{t('haccp.form.notesLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => {
              const pass = isPass(c)
              return (
                <tr key={c.id} style={{ background: pass ? '#f0fdf4' : '#fff5f5' }}>
                  <td style={tdStyle}>{c.location}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{c.temperature}°{c.unit}</td>
                  <td style={tdStyle}>{c.min_temp}–{c.max_temp}°{c.unit}</td>
                  <td style={tdStyle}>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={tdStyle}>{c.checked_by_name ?? '—'}</td>
                  <td style={{ ...tdStyle, color: pass ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                    {pass ? '✓ PASS' : '✗ FAIL'}
                  </td>
                  <td style={tdStyle}>{c.corrective_action ?? '—'}</td>
                  <td style={tdStyle}>{c.notes ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Signature section */}
        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, fontFamily: 'sans-serif' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 600, margin: '0 0 8px' }}>{t('haccp.print.kitchenManagerSignOff')}</p>
            <p style={{ fontSize: 10, color: '#777', margin: 0 }}>{t('haccp.print.signatureLine')}</p>
          </div>
          <div style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 600, margin: '0 0 8px' }}>{t('haccp.print.headChefReview')}</p>
            <p style={{ fontSize: 10, color: '#777', margin: 0 }}>{t('haccp.print.signatureLine')}</p>
          </div>
        </div>

        <p style={{ fontFamily: 'sans-serif', fontSize: 9, color: '#aaa', textAlign: 'center', marginTop: 20 }}>
          {t('haccp.title')} — {t('haccp.subtitle')} — {new Date().toLocaleString()}
        </p>
      </div>

      <div className="space-y-6 no-print">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">{t('haccp.title')}</h1>
            <p className="text-white/60 mt-1">{t('haccp.subtitle')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {checks.length > 0 && (
              <Button
                variant="secondary"
                leftIcon={<FileDown className="h-5 w-5" />}
                onClick={exportPdf}
              >
                {t('haccp.exportPdf')}
              </Button>
            )}
            <button
              type="button"
              onClick={() => setRemindersOpen(true)}
              className="relative flex items-center gap-2 rounded-xl border border-glass-border px-3 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition"
            >
              {overdueCount > 0 ? <BellRing className="h-4 w-4 text-red-400 animate-pulse" /> : <Bell className="h-4 w-4" />}
              {t('haccp.reminders.title')}
              {overdueCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center">{overdueCount}</span>
              )}
            </button>
            <Button
              variant="secondary"
              leftIcon={<ClipboardList className="h-5 w-5" />}
              onClick={() => setBlankFormOpen(true)}
            >
              {t('haccp.blankForm.button')}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Settings2 className="h-5 w-5" />}
              onClick={() => setLocDrawerOpen(true)}
            >
              {t('haccp.locations')}
            </Button>
            <Button
              leftIcon={<Plus className="h-5 w-5" />}
              onClick={() => setLogDrawerOpen(true)}
            >
              {t('haccp.logCheck')}
            </Button>
          </div>
        </header>

        {error && (
          <GlassCard className="border border-red-500/40 text-red-300">{error}</GlassCard>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Input
            type="date"
            name="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
          {checks.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {t('haccp.pass_other', { count: passCount })}
              </span>
              <span className="flex items-center gap-1.5 text-red-300">
                <XCircle className="h-4 w-4" />
                {t('haccp.fail_other', { count: failCount })}
              </span>
              {passRate !== null && (
                <span className={`font-semibold ${passRate === 100 ? 'text-emerald-300' : passRate >= 80 ? 'text-amber-300' : 'text-red-300'}`}>
                  {t('haccp.compliance', { pct: passRate })}
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <GlassCard><p className="text-white/60">{t('common.loading')}</p></GlassCard>
        ) : checks.length === 0 ? (
          <GlassCard className="flex flex-col items-center text-center gap-3 py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
              <Thermometer className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">{t('haccp.empty.title')}</h2>
            <p className="text-white/60 max-w-sm">
              {date === todayIso()
                ? t('haccp.empty.descriptionToday')
                : t('haccp.empty.descriptionDate', { date })}
            </p>
            <Button leftIcon={<Plus className="h-5 w-5" />} onClick={() => setLogDrawerOpen(true)} className="mt-2">
              {t('haccp.logCheck')}
            </Button>
          </GlassCard>
        ) : (
          <GlassCard className="p-0 overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 text-xs uppercase tracking-wide text-white/50 border-b border-glass-border">
              <span>{t('haccp.tableHeaders.location')}</span>
              <span>{t('haccp.tableHeaders.temperature')}</span>
              <span>{t('haccp.tableHeaders.range')}</span>
              <span>{t('haccp.tableHeaders.time')}</span>
              <span>{t('haccp.tableHeaders.checkedBy')}</span>
              <span />
            </div>
            <ul className="divide-y divide-glass-border">
              {checks.map((c) => {
                const pass = isPass(c)
                return (
                  <li key={c.id} className="grid gap-2 md:gap-4 px-5 py-4 items-start md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {pass
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                        {c.location}
                      </div>
                      {!pass && c.corrective_action && (
                        <p className="mt-1 ml-6 text-xs text-amber-300 leading-snug">
                          ↳ {c.corrective_action}
                        </p>
                      )}
                    </div>
                    <span className={`text-lg font-semibold ${pass ? 'text-emerald-300' : 'text-red-300'}`}>
                      {c.temperature}°{c.unit}
                    </span>
                    <span className="text-white/60 text-sm">
                      {c.min_temp}–{c.max_temp}°{c.unit}
                    </span>
                    <span className="text-white/50 text-sm">
                      {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {c.notes && <span className="block text-xs truncate max-w-[140px]">{c.notes}</span>}
                    </span>
                    <span className="text-white/60 text-sm truncate">
                      {c.checked_by_name ?? <span className="text-white/30">—</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      aria-label={t('haccp.deleteCheckLabel')}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </GlassCard>
        )}

        <Drawer open={logDrawerOpen} onClose={() => { if (!submitting) setLogDrawerOpen(false) }} title={t('haccp.logTemperatureCheck')}>
          <HACCPCheckForm
            locations={locations}
            submitting={submitting}
            onSubmit={onLogCheck}
            onCancel={() => setLogDrawerOpen(false)}
          />
        </Drawer>

        <Drawer open={locDrawerOpen} onClose={() => setLocDrawerOpen(false)} title={t('haccp.manageLocations')}>
          <div className="space-y-6">
            <form onSubmit={onSaveLocation} className="space-y-4">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">{t('haccp.addLocation')}</h3>
              <Input
                name="loc_name"
                label={t('haccp.locationName')}
                placeholder={t('haccp.locationPlaceholder')}
                required
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
              />
              <div className="flex gap-3 items-end">
                <Input
                  type="number"
                  name="loc_min"
                  label={t('haccp.minTemp', { unit: locUnit })}
                  step="0.1"
                  required
                  value={locMin}
                  onChange={(e) => setLocMin(Number(e.target.value))}
                />
                <Input
                  type="number"
                  name="loc_max"
                  label={t('haccp.maxTemp', { unit: locUnit })}
                  step="0.1"
                  required
                  value={locMax}
                  onChange={(e) => setLocMax(Number(e.target.value))}
                />
                <div className="flex gap-1 mb-0.5">
                  {(['C', 'F'] as TempUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setLocUnit(u)}
                      className={
                        'h-11 w-11 rounded-xl border text-sm font-semibold transition ' +
                        (locUnit === u
                          ? 'bg-brand-orange border-brand-orange text-white-fixed'
                          : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5')
                      }
                    >
                      °{u}
                    </button>
                  ))}
                </div>
              </div>
              {locError && <p className="text-sm text-red-400">{locError}</p>}
              <Button type="submit" disabled={locSaving} leftIcon={<Plus className="h-4 w-4" />}>
                {locSaving ? t('haccp.savingLocation') : t('haccp.addLocation')}
              </Button>
            </form>

            {locations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">{t('haccp.savedLocations')}</h3>
                <ul className="space-y-2">
                  {locations.map((loc) => (
                    <li key={loc.id} className="flex items-center justify-between gap-3 py-2 border-b border-glass-border last:border-0">
                      <div>
                        <div className="font-medium">{loc.name}</div>
                        <div className="text-xs text-white/50">{loc.min_temp}–{loc.max_temp}°{loc.unit}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteLocation(loc.id)}
                        aria-label={t('haccp.deleteLocationLabel')}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Drawer>
      </div>

      <HACCPBlankFormDrawer
        open={blankFormOpen}
        onClose={() => setBlankFormOpen(false)}
        locations={locations}
      />

      <HACCPRemindersDrawer
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
      />
    </>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '6px 8px',
  textAlign: 'left',
  fontWeight: 600,
}

const tdStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '6px 8px',
  verticalAlign: 'top',
}
