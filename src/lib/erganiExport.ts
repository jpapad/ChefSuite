/**
 * Ergani (ΕΡΓΑΝΗ) export helpers.
 *
 * Generates two exports:
 *  - E4 (Πίνακας Προσωπικού / Weekly work schedule)
 *  - E8 (Overtime / Υπερωρίες) — from timeclock data
 *
 * Output is an Excel-compatible XML (SpreadsheetML) that opens directly
 * in Excel and LibreOffice without any npm dependency.
 *
 * NOTE: ΑΜΚΑ / ΑΦΜ fields are left blank — the employer fills them in
 * before submission via the ΕΡΓΑΝΗ II portal.
 */

interface ShiftRow {
  memberName: string
  shiftDate: string   // ISO date YYYY-MM-DD
  startTime: string  // HH:MM
  endTime: string    // HH:MM
  role?: string | null
}

interface TimeclockRow {
  memberName: string
  clockIn: string  // ISO datetime
  clockOut: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY (Greek format)
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtTime(hhmm: string): string {
  return hhmm.slice(0, 5) // ensure HH:MM
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function minsToHHMM(mins: number): string {
  if (mins <= 0) return '0:00'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function xlCell(value: string | number, bold = false, bg?: string): string {
  const styleId = bold ? (bg ? '3' : '2') : bg ? '4' : '1'
  return `<Cell ss:StyleID="s${styleId}"><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`
}

function xlRow(...cells: string[]): string {
  return `<Row>${cells.join('')}</Row>`
}

function xlWorkbook(sheets: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
 <Styles>
  <Style ss:ID="s1">
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="s2">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#1a1a2e" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
  </Style>
  <Style ss:ID="s3">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#C4956A" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
  </Style>
  <Style ss:ID="s4">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Interior ss:Color="#F5F0EA" ss:Pattern="Solid"/>
  </Style>
 </Styles>
${sheets.join('\n')}
</Workbook>`
}

function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── E4 Export (Πίνακας Προσωπικού) ──────────────────────────────────────────

export function exportE4(shifts: ShiftRow[], weekLabel: string, employerName = '') {
  const infoRows = [
    xlRow(
      xlCell('ΕΝΤΥΠΟ Ε4 — ΠΙΝΑΚΑΣ ΠΡΟΣΩΠΙΚΟΥ', true),
      xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''),
    ),
    xlRow(
      xlCell(`Εργοδότης: ${employerName || '___________________'}`, false),
      xlCell(''), xlCell(''), xlCell(''),
      xlCell(`Εβδομάδα: ${weekLabel}`, false),
      xlCell(''), xlCell(''),
    ),
    xlRow(
      xlCell('* Συμπληρώστε ΑΜΚΑ και ΑΦΜ εργαζομένων πριν την υποβολή στο ΕΡΓΑΝΗ II', false),
      xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''),
    ),
    xlRow(xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell('')),
  ]

  const header = xlRow(
    xlCell('ΕΠΩΝΥΜΟ & ΟΝΟΜΑ', true),
    xlCell('ΑΜΚΑ', true),
    xlCell('ΑΦΜ', true),
    xlCell('ΗΜΕΡΟΜΗΝΙΑ', true),
    xlCell('ΩΡΑ ΕΝΑΡΞΗΣ', true),
    xlCell('ΩΡΑ ΛΗΞΗΣ', true),
    xlCell('ΘΕΣΗ / ΡΟΛΟΣ', true),
  )

  const dataRows = shifts.map((s, i) =>
    xlRow(
      xlCell(s.memberName, false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell('', false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell('', false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell(fmtDate(s.shiftDate), false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell(fmtTime(s.startTime), false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell(fmtTime(s.endTime), false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell(s.role ?? '', false, i % 2 === 1 ? '#F5F0EA' : undefined),
    ),
  )

  const sheet = `<Worksheet ss:Name="Ε4 Πίνακας Προσωπικού">
 <Table ss:DefaultColumnWidth="120">
  <Column ss:Width="180"/>
  <Column ss:Width="100"/>
  <Column ss:Width="100"/>
  <Column ss:Width="100"/>
  <Column ss:Width="100"/>
  <Column ss:Width="100"/>
  <Column ss:Width="140"/>
  ${[...infoRows, header, ...dataRows].join('\n  ')}
 </Table>
</Worksheet>`

  const filename = `E4_${weekLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xls`
  downloadXml(xlWorkbook([sheet]), filename)
}

// ── E8 Export (Υπερωρίες / Attendance from Timeclock) ────────────────────────

export function exportTimeclockE8(entries: TimeclockRow[], dateLabel: string, employerName = '') {
  const infoRows = [
    xlRow(
      xlCell('ΕΝΤΥΠΟ Ε8 — ΠΑΡΟΥΣΙΟΛΟΓΙΟ / ΥΠΕΡΩΡΙΕΣ', true),
      xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''),
    ),
    xlRow(
      xlCell(`Εργοδότης: ${employerName || '___________________'}`, false),
      xlCell(''), xlCell(''),
      xlCell(`Περίοδος: ${dateLabel}`, false),
      xlCell(''), xlCell(''),
    ),
    xlRow(
      xlCell('* Συμπληρώστε ΑΜΚΑ και ΑΦΜ εργαζομένων πριν την υποβολή στο ΕΡΓΑΝΗ II', false),
      xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''),
    ),
    xlRow(xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell(''), xlCell('')),
  ]

  const header = xlRow(
    xlCell('ΕΠΩΝΥΜΟ & ΟΝΟΜΑ', true),
    xlCell('ΑΜΚΑ', true),
    xlCell('ΑΦΜ', true),
    xlCell('ΩΡΑ ΕΝΑΡΞΗΣ', true),
    xlCell('ΩΡΑ ΛΗΞΗΣ', true),
    xlCell('ΣΥΝΟΛΟ ΩΡΩΝ', true),
  )

  const dataRows = entries.map((e, i) => {
    const mins = e.clockOut
      ? Math.round((new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / 60000)
      : 0
    return xlRow(
      xlCell(e.memberName, false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell('', false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell('', false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell(fmtDateTime(e.clockIn), false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell(e.clockOut ? fmtDateTime(e.clockOut) : '—', false, i % 2 === 1 ? '#F5F0EA' : undefined),
      xlCell(minsToHHMM(mins), false, i % 2 === 1 ? '#F5F0EA' : undefined),
    )
  })

  // Totals row
  const totalMins = entries.reduce((acc, e) => {
    if (!e.clockOut) return acc
    return acc + Math.round((new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / 60000)
  }, 0)
  const totalsRow = xlRow(
    xlCell('ΣΥΝΟΛΟ', true),
    xlCell('', true), xlCell('', true), xlCell('', true), xlCell('', true),
    xlCell(minsToHHMM(totalMins), true),
  )

  const sheet = `<Worksheet ss:Name="Ε8 Παρουσιολόγιο">
 <Table ss:DefaultColumnWidth="120">
  <Column ss:Width="180"/>
  <Column ss:Width="100"/>
  <Column ss:Width="100"/>
  <Column ss:Width="130"/>
  <Column ss:Width="130"/>
  <Column ss:Width="100"/>
  ${[...infoRows, header, ...dataRows, totalsRow].join('\n  ')}
 </Table>
</Worksheet>`

  const filename = `E8_${dateLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xls`
  downloadXml(xlWorkbook([sheet]), filename)
}
