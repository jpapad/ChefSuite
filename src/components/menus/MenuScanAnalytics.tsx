import { cn } from '../../lib/cn'
import { useMenuScanLive } from '../../hooks/useMenuScanLive'

const DAYS_LABEL: Record<string, string> = {
  '0': 'Κυρ', '1': 'Δευ', '2': 'Τρι', '3': 'Τετ',
  '4': 'Πεμ', '5': 'Παρ', '6': 'Σαβ',
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr)
  return DAYS_LABEL[d.getDay().toString()] ?? ''
}

function TimelineChart({ perDay }: { perDay: { date: string; count: number }[] }) {
  const todayKey = new Date().toISOString().slice(0, 10)
  const max = Math.max(...perDay.map((d) => d.count), 1)
  const H = 52
  const barW = 10
  const gap = 3
  const W = perDay.length * (barW + gap)

  return (
    <div className="space-y-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full overflow-visible"
        style={{ height: H }}
      >
        {perDay.map(({ date, count }, i) => {
          const h = Math.max((count / max) * H, count > 0 ? 4 : 1.5)
          const isToday = date === todayKey
          return (
            <g key={date}>
              <rect
                x={i * (barW + gap)}
                y={H - h}
                width={barW}
                height={h}
                rx={3}
                fill={isToday ? 'rgba(249,115,22,0.85)' : 'rgba(255,255,255,0.14)'}
              />
              {/* Tooltip value on hover — shown as title */}
              <title>{date}: {count} scans</title>
            </g>
          )
        })}
      </svg>
      {/* Day labels for every 5 days */}
      <div className="flex justify-between text-[10px] text-white/25 tabular-nums px-0.5">
        {perDay.map((d, i) => (
          <span key={d.date} className={cn(
            'w-[13px] text-center',
            i % 5 !== 0 && i !== perDay.length - 1 ? 'opacity-0' : '',
          )}>
            {i % 5 === 0 || i === perDay.length - 1 ? d.date.slice(5) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MenuScanAnalytics() {
  const { perMenu, perDay, todayTotal, loading, flash } = useMenuScanLive(30)

  const totalAll = perMenu.reduce((s, m) => s + m.totalCount, 0)

  return (
    <div className="flex flex-col gap-5 p-1">

      {/* ── Live today counter ─────────────────────────────── */}
      <div className={cn(
        'rounded-2xl border p-4 flex items-center justify-between transition-all duration-300',
        flash
          ? 'border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_24px_rgba(52,211,153,0.2)]'
          : 'border-white/10 bg-white/4',
      )}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Live</span>
          </div>
          <p className="text-xs text-white/40">Σήμερα</p>
        </div>
        <div className="text-right">
          <div className={cn(
            'text-5xl font-bold tabular-nums transition-all duration-300',
            flash ? 'text-emerald-300 scale-110' : 'text-white',
          )}>
            {loading ? '…' : todayTotal}
          </div>
          <p className="text-xs text-white/40 mt-0.5">scans</p>
        </div>
      </div>

      {/* ── Timeline ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/70">Ιστορικό 30 ημερών</p>
          <p className="text-xs text-white/30 tabular-nums">{totalAll} σύνολο</p>
        </div>
        {loading ? (
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
        ) : (
          <TimelineChart perDay={perDay} />
        )}
      </div>

      {/* ── Per-menu table ─────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-white/30 border-b border-white/8">
          <span>Μενού</span>
          <span className="text-right">Σήμερα</span>
          <span className="text-right">7 μέρες</span>
          <span className="text-right">Σύνολο</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : perMenu.length === 0 ? (
          <div className="py-10 text-center text-white/30 text-sm">
            Δεν υπάρχουν scans ακόμα
          </div>
        ) : (
          <ul className="divide-y divide-white/6">
            {perMenu.map((m) => (
              <li
                key={m.menuId}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center hover:bg-white/4 transition-colors"
              >
                <span className="text-sm font-medium text-white/85 truncate">{m.menuName}</span>
                <span className={cn(
                  'text-sm font-bold tabular-nums text-right w-10',
                  m.todayCount > 0 ? 'text-emerald-400' : 'text-white/25',
                )}>
                  {m.todayCount}
                </span>
                <span className="text-sm tabular-nums text-white/50 text-right w-12">
                  {m.weekCount}
                </span>
                <span className="text-sm font-semibold tabular-nums text-brand-orange text-right w-12">
                  {m.totalCount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
