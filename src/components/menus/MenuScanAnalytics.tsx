import { cn } from '../../lib/cn'
import { useMenuScanLive } from '../../hooks/useMenuScanLive'

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Σήμερα'
  if (dateStr === yesterday) return 'Χθες'
  return new Date(dateStr).toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short' })
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
          return (
            <g key={date}>
              <rect
                x={i * (barW + gap)}
                y={H - h}
                width={barW}
                height={h}
                rx={3}
                fill={date === todayKey ? 'rgba(249,115,22,0.85)' : 'rgba(255,255,255,0.14)'}
              />
              <title>{date}: {count} scans</title>
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-white/25 tabular-nums">
        <span>{perDay[0]?.date?.slice(5)}</span>
        <span>{perDay[Math.floor(perDay.length / 2)]?.date?.slice(5)}</span>
        <span>{perDay[perDay.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

export function MenuScanAnalytics() {
  const { perDay, history, todayTotal, loading, flash } = useMenuScanLive(30)

  const totalAll = perDay.reduce((s, d) => s + d.count, 0)

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

      {/* ── Timeline chart ────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/70">Τελευταίες 30 ημέρες</p>
          <p className="text-xs text-white/30 tabular-nums">{totalAll} σύνολο</p>
        </div>
        {loading ? (
          <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
        ) : (
          <TimelineChart perDay={perDay} />
        )}
      </div>

      {/* ── History: per day + per menu ───────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/8">
          <p className="text-sm font-semibold text-white/70">Ιστορικό ανά ημέρα</p>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="py-10 text-center text-white/30 text-sm">
            Δεν υπάρχουν scans ακόμα
          </div>
        ) : (
          <ul className="divide-y divide-white/6">
            {history.map(({ date, total, menus }) => (
              <li key={date} className="px-4 py-3 space-y-2">
                {/* Date header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                    {formatDate(date)}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-brand-orange">
                    {total} scans
                  </span>
                </div>
                {/* Menus that day */}
                <ul className="space-y-1">
                  {menus.map((m) => (
                    <li key={m.menuId} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/25 shrink-0" />
                      <span className="text-sm text-white/80 flex-1 truncate">{m.menuName}</span>
                      <span className="text-sm font-semibold tabular-nums text-white/50 shrink-0">
                        {m.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
