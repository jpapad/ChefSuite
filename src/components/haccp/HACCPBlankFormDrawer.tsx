import React, { useRef, useState } from 'react'
import { Printer, Plus, X, ImagePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { HACCPLocation } from '../../types/database.types'

interface BlankCols {
  temp: boolean
  sig: boolean
  actions: boolean
  check: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  locations: HACCPLocation[]
}

const MONTHS_EL = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_BG = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']

// A4 at CSS reference 96dpi = 1122px tall. Margins 10mm = 37.8px each.
// Available: 1122 - 76 = 1046px
// Fixed overhead: header ~54px, info bar ~28px, table-head ~40px, footer ~46px ≈ 168px
// Rows budget: 1046 - 168 = 878px
const ROW_BUDGET_PX = 878

const thS: React.CSSProperties = {
  border: '1px solid #000',
  padding: '2px 4px',
  textAlign: 'center',
  fontWeight: 700,
  background: '#e5e7eb',
  fontSize: 10,
}

export function HACCPBlankFormDrawer({ open, onClose, locations }: Props) {
  const { t, i18n } = useTranslation()
  const now = new Date()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle]         = useState('')
  const [month, setMonth]         = useState(now.getMonth())
  const [year, setYear]           = useState(now.getFullYear())
  const [targetTemp, setTargetTemp] = useState('0°C – 5°C')
  const [timeCols, setTimeCols]   = useState<string[]>(['08:00', '14:00', '20:00'])
  const [newTime, setNewTime]     = useState('')
  const [cols, setCols]           = useState<BlankCols>({ temp: true, sig: true, actions: true, check: true })
  const [logo, setLogo]           = useState<string | null>(null)

  const monthNames   = i18n.language.startsWith('el') ? MONTHS_EL : i18n.language.startsWith('bg') ? MONTHS_BG : MONTHS_EN
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const colSpanPerTime = Number(cols.temp) + Number(cols.sig)

  // Row height that fits all days on one A4 page
  const rowH = Math.max(20, Math.floor(ROW_BUDGET_PX / daysInMonth))

  const tdS: React.CSSProperties = {
    border: '1px solid #000',
    padding: 0,
    height: `${rowH}px`,
  }

  function selectLocation(loc: HACCPLocation) {
    setTitle(loc.name)
    setTargetTemp(`${loc.min_temp}°${loc.unit} – ${loc.max_temp}°${loc.unit}`)
  }

  function addTime() {
    const val = newTime.trim()
    if (!val || timeCols.includes(val)) return
    setTimeCols(prev => [...prev, val].sort())
    setNewTime('')
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogo(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function printBlankForm() {
    document.body.classList.add('print-haccp-blank')
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('print-haccp-blank')
    }, { once: true })
    window.print()
  }

  return (
    <>
      {/* ── Blank sheet (hidden on screen, printed via body.print-haccp-blank) ── */}
      <div
        className="haccp-blank-sheet"
        style={{ fontFamily: 'sans-serif', color: '#000', background: '#fff', padding: '0 10mm', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 2px' }}>
              {t('haccp.blankForm.sheetTitle')}
            </h1>
            <h2 style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>
              {title || '___________________________________'}
            </h2>
          </div>
          {logo && (
            <img
              src={logo}
              alt="logo"
              style={{ maxHeight: 44, maxWidth: 120, objectFit: 'contain', marginLeft: 12 }}
            />
          )}
        </div>

        {/* Month + target temp bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f3f4f6', border: '1px solid #bbb', padding: '3px 8px', marginBottom: 8, fontSize: 10, fontWeight: 600 }}>
          <span>{t('haccp.blankForm.month')}: {monthNames[month]} {year}</span>
          <span>{t('haccp.blankForm.targetTemp')}: {targetTemp}</span>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 34 }} />
            {timeCols.map((col) => (
              <React.Fragment key={col}>
                {cols.temp && <col style={{ width: 40 }} />}
                {cols.sig  && <col style={{ width: 40 }} />}
              </React.Fragment>
            ))}
            {cols.actions && <col style={{ width: '34%' }} />}
            {cols.check   && <col style={{ width: 54 }} />}
          </colgroup>
          <thead>
            {/* Row 1 */}
            <tr>
              <th rowSpan={colSpanPerTime > 0 ? 2 : 1} style={{ ...thS, fontSize: 9 }}>
                {t('haccp.blankForm.date')}
              </th>
              {colSpanPerTime > 0 && timeCols.map((col) => (
                <th key={col} colSpan={colSpanPerTime} style={thS}>{col}</th>
              ))}
              {cols.actions && (
                <th rowSpan={colSpanPerTime > 0 ? 2 : 1} style={{ ...thS, fontSize: 9 }}>
                  {t('haccp.blankForm.correctiveActions')}
                </th>
              )}
              {cols.check && (
                <th rowSpan={colSpanPerTime > 0 ? 2 : 1} style={{ ...thS, fontSize: 8 }}>
                  {t('haccp.blankForm.check')}
                </th>
              )}
            </tr>
            {/* Row 2: sub-headers */}
            {colSpanPerTime > 0 && (
              <tr>
                {timeCols.map((col) => (
                  <React.Fragment key={col}>
                    {cols.temp && <th style={{ ...thS, fontSize: 8 }}>{t('haccp.blankForm.temp')}</th>}
                    {cols.sig  && <th style={{ ...thS, fontSize: 8 }}>{t('haccp.blankForm.sig')}</th>}
                  </React.Fragment>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <tr key={day}>
                <td style={{ ...tdS, background: '#f9fafb', fontWeight: 600, fontSize: 9, textAlign: 'center', verticalAlign: 'middle' }}>
                  {day}/{month + 1}
                </td>
                {timeCols.map((col) => (
                  <React.Fragment key={col}>
                    {cols.temp && <td style={tdS} />}
                    {cols.sig  && <td style={tdS} />}
                  </React.Fragment>
                ))}
                {cols.actions && <td style={tdS} />}
                {cols.check   && <td style={tdS} />}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 7, color: '#555', lineHeight: 1.5, maxWidth: '74%' }}>
            <strong>{t('haccp.blankForm.instructions')}:</strong>{' '}
            {t('haccp.blankForm.instructionsText')}
          </p>
          <p style={{ margin: 0, fontSize: 7, color: '#bbb', textAlign: 'right', whiteSpace: 'nowrap' }}>
            ChefSuite &bull; {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* ── Config Drawer ── */}
      <Drawer open={open} onClose={onClose} title={t('haccp.blankForm.title')}>
        <div className="space-y-5">

          {/* Location preset chips */}
          {locations.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">{t('haccp.blankForm.locationPreset')}</label>
              <div className="flex flex-wrap gap-2">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => selectLocation(loc)}
                    className={
                      'rounded-lg border px-3 py-1.5 text-sm transition ' +
                      (title === loc.name
                        ? 'bg-brand-orange border-brand-orange text-white-fixed'
                        : 'border-glass-border text-white/60 hover:text-white hover:bg-white/5')
                    }
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <Input
            name="bf_title"
            label={t('haccp.blankForm.sheetTitleLabel')}
            placeholder={t('haccp.blankForm.sheetTitlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Month + Year */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-white/70 block mb-1.5">{t('haccp.blankForm.month')}</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              >
                {monthNames.map((m, i) => (
                  <option key={i} value={i} className="bg-stone-900">{m}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="text-sm font-medium text-white/70 block mb-1.5">{t('haccp.blankForm.year')}</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              >
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y} className="bg-stone-900">{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Target temperature */}
          <Input
            name="bf_targetTemp"
            label={t('haccp.blankForm.targetTemp')}
            placeholder="0°C – 5°C"
            value={targetTemp}
            onChange={(e) => setTargetTemp(e.target.value)}
          />

          {/* Logo upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">{t('haccp.blankForm.logo')}</label>
            {logo ? (
              <div className="flex items-center gap-3 rounded-xl border border-glass-border p-3">
                <img src={logo} alt="logo preview" className="h-10 max-w-[120px] object-contain rounded" />
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-glass-border py-3 text-sm text-white/50 hover:text-white hover:border-white/30 transition"
              >
                <ImagePlus className="h-4 w-4" />
                {t('haccp.blankForm.uploadLogo')}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />
          </div>

          {/* Time columns */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">{t('haccp.blankForm.timeColumns')}</label>
            <div className="flex flex-wrap gap-2 min-h-[34px]">
              {timeCols.map((col) => (
                <span key={col} className="flex items-center gap-1 rounded-lg border border-glass-border px-2.5 py-1 text-sm text-white/80">
                  {col}
                  <button
                    type="button"
                    onClick={() => setTimeCols(prev => prev.filter(c => c !== col))}
                    className="text-white/30 hover:text-red-400 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTime() } }}
                className="flex-1 rounded-xl border border-glass-border bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              />
              <Button type="button" variant="secondary" size="md" leftIcon={<Plus className="h-4 w-4" />} onClick={addTime}>
                {t('haccp.blankForm.addTime')}
              </Button>
            </div>
          </div>

          {/* Column toggles */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">{t('haccp.blankForm.columns')}</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['temp',    t('haccp.blankForm.temp')],
                ['sig',     t('haccp.blankForm.sig')],
                ['actions', t('haccp.blankForm.correctiveActions')],
                ['check',   t('haccp.blankForm.check')],
              ] as [keyof BlankCols, string][]).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 rounded-xl border border-glass-border px-3 py-2.5 cursor-pointer hover:bg-white/5 transition"
                >
                  <input
                    type="checkbox"
                    checked={cols[key]}
                    onChange={(e) => setCols(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="accent-brand-orange h-4 w-4"
                  />
                  <span className="text-sm text-white/80">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="button" leftIcon={<Printer className="h-4 w-4" />} onClick={printBlankForm}>
              {t('haccp.blankForm.print')}
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  )
}
