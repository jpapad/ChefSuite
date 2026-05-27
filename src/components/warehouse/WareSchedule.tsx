import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Truck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import type { WhSupplier } from '../../types/warehouse.types'

const DAY_NAMES = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ']
const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  // weekday of first day: 0=Sun → shift to Mon-based (0=Mon)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

export function WareSchedule() {
  const [suppliers, setSuppliers] = useState<WhSupplier[]>([])
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  useEffect(() => {
    void supabase.from('wh_suppliers').select('*').order('name')
      .then(({ data }) => setSuppliers((data ?? []) as WhSupplier[]))
  }, [])

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  const cells = getMonthDays(year, month)

  // Build a map: weekdayIdx → suppliers delivering on that day
  const byWeekday: Record<number, WhSupplier[]> = {}
  suppliers.forEach((s) => {
    (s.delivery_days ?? []).forEach((d) => {
      if (!byWeekday[d]) byWeekday[d] = []
      byWeekday[d].push(s)
    })
  })

  const todayStr = today.toISOString().slice(0, 10)

  // Suppliers with no delivery days set
  const unscheduled = suppliers.filter((s) => (s.delivery_days ?? []).length === 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Πρόγραμμα Παραδόσεων</h2>
          <p className="text-xs text-white/40">{suppliers.length} προμηθευτές</p>
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between rounded-xl border border-glass-border bg-white/3 px-4 py-2.5">
        <button onClick={prevMonth} className="p-1 text-white/50 hover:text-white transition rounded-lg hover:bg-white/10">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-white">{MONTH_NAMES[month]} {year}</p>
        <button onClick={nextMonth} className="p-1 text-white/50 hover:text-white transition rounded-lg hover:bg-white/10">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-name header */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-white/30">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />
          const weekday = (date.getDay() + 6) % 7  // Mon=0
          const deliveries = byWeekday[weekday] ?? []
          const dateStr = date.toISOString().slice(0, 10)
          const isToday = dateStr === todayStr
          const isPast  = date < today && !isToday

          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-[4rem] rounded-xl border p-1.5 transition',
                isToday
                  ? 'border-brand-orange/50 bg-brand-orange/10'
                  : isPast
                    ? 'border-glass-border/30 bg-white/1 opacity-50'
                    : 'border-glass-border bg-white/3',
                deliveries.length > 0 && !isPast && 'bg-sky-500/5 border-sky-500/20',
              )}
            >
              <p className={cn(
                'text-[11px] font-semibold mb-1',
                isToday ? 'text-brand-orange' : 'text-white/50',
              )}>
                {date.getDate()}
              </p>
              <div className="space-y-0.5">
                {deliveries.slice(0, 2).map((s) => (
                  <p
                    key={s.id}
                    className="truncate rounded bg-sky-500/15 px-1 py-0.5 text-[9px] font-semibold text-sky-300 leading-tight"
                    title={s.name}
                  >
                    {s.name}
                  </p>
                ))}
                {deliveries.length > 2 && (
                  <p className="text-[9px] text-white/30">+{deliveries.length - 2}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend / this-week deliveries */}
      <div className="rounded-xl border border-glass-border bg-white/3 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Εβδομαδιαίο Πρόγραμμα</p>
        <div className="space-y-2">
          {DAY_NAMES.map((label, idx) => {
            const sups = byWeekday[idx] ?? []
            if (sups.length === 0) return null
            return (
              <div key={idx} className="flex items-start gap-3">
                <span className="w-10 shrink-0 text-xs font-semibold text-white/40 pt-0.5">{label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {sups.map((s) => (
                    <div key={s.id} className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5">
                      <Truck className="h-2.5 w-2.5 text-sky-400" />
                      <span className="text-[11px] text-sky-300 font-medium">{s.name}</span>
                      {s.order_deadline_time && (
                        <span className="text-[10px] text-white/30">έως {s.order_deadline_time}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Unscheduled suppliers */}
      {unscheduled.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/60">
            Χωρίς Πρόγραμμα ({unscheduled.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((s) => (
              <span key={s.id} className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
