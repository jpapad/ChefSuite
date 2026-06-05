import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Constants ────────────────────────────────────────────────────────────────

const SVG_W = 900
const SVG_H = 550

const TODAY = new Date().toISOString().split('T')[0]!

// ── Types ────────────────────────────────────────────────────────────────────

interface Station {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string
  slotCount: number
}

interface SlotValue { menuItemId: string; dishName: string }
type SlotsMap = Record<string, SlotValue>
type StatusMap = Record<string, 'full' | 'low' | 'empty'>

interface PopupInfo {
  station: Station
  slotIndex: number
  dishName: string
  status: 'full' | 'low' | 'empty' | null
  x: number
  y: number
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  full:  '#22c55e',
  low:   '#f59e0b',
  empty: '#ef4444',
}

const STATUS_LABEL: Record<string, string> = {
  full:  'Διαθέσιμο',
  low:   'Λίγο',
  empty: 'Τελείωσε',
}

function slotKey(stationId: string, slotIndex: number) {
  return `${stationId}_${slotIndex}`
}

// ── Pulse animation component ────────────────────────────────────────────────

function PulseDot({ cx, cy, color, pulse }: { cx: number; cy: number; color: string; pulse: boolean }) {
  return (
    <g>
      {pulse && (
        <circle cx={cx} cy={cy} r="6" fill={color} opacity="0.3">
          <animate attributeName="r" values="4;9;4" dur="1.8s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.4;0;0.4" dur="1.8s" repeatCount="indefinite"/>
        </circle>
      )}
      <circle cx={cx} cy={cy} r="4" fill={color}/>
    </g>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BuffetMapPublic() {
  const { teamId } = useParams<{ teamId: string }>()

  const [stations, setStations]   = useState<Station[]>([])
  const [slots, setSlots]         = useState<SlotsMap>({})
  const [statusMap, setStatusMap] = useState<StatusMap>({})
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [popup, setPopup]         = useState<PopupInfo | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsSince, setSecondsSince] = useState(0)

  const svgRef = useRef<SVGSVGElement>(null)

  // ── Load map data ──────────────────────────────────────────────────────────

  async function loadData() {
    if (!teamId) return

    const [mapRes, statusRes] = await Promise.all([
      supabase
        .from('buffet_maps')
        .select('id, stations')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('buffet_live_status')
        .select('menu_item_id, status')
        .eq('team_id', teamId),
    ])

    if (!mapRes.data || mapRes.data.length === 0) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const mapRow = mapRes.data[0]!
    setStations((mapRow.stations as Station[]) ?? [])

    const assignRes = await supabase
      .from('buffet_map_assignments')
      .select('slots')
      .eq('map_id', mapRow.id)
      .eq('date', TODAY)
      .maybeSingle()

    setSlots((assignRes.data?.slots as SlotsMap) ?? {})

    const sm: StatusMap = {}
    for (const row of statusRes.data ?? []) {
      sm[row.menu_item_id] = row.status as 'full' | 'low' | 'empty'
    }
    setStatusMap(sm)
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  // ── Polling every 10s (reliable for anon) ─────────────────────────────────

  useEffect(() => {
    if (!teamId) return

    async function pollStatuses() {
      const { data } = await supabase
        .from('buffet_live_status')
        .select('menu_item_id, status')
        .eq('team_id', teamId!)
      if (!data) return
      const sm: StatusMap = {}
      for (const row of data) sm[row.menu_item_id] = row.status as 'full' | 'low' | 'empty'
      setStatusMap(sm)
      setLastUpdated(new Date())
    }

    void pollStatuses() // run immediately on mount too
    const interval = setInterval(() => void pollStatuses(), 5_000)
    return () => clearInterval(interval)
  }, [teamId])

  // ── Seconds-since-update counter ───────────────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsSince(lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : 0)
    }, 1000)
    return () => clearInterval(t)
  }, [lastUpdated])

  // ── Popup helpers ──────────────────────────────────────────────────────────

  function openPopup(station: Station, slotIndex: number, e: React.MouseEvent) {
    const key = slotKey(station.id, slotIndex)
    const assignment = slots[key]
    if (!assignment) return

    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const scaleX = SVG_W / rect.width

    const sx = station.x + slotIndex * (station.width / station.slotCount)
    const screenX = sx / scaleX + rect.left

    setPopup({
      station,
      slotIndex,
      dishName: assignment.dishName,
      status: statusMap[assignment.menuItemId] ?? null,
      x: screenX,
      y: e.clientY,
    })
  }

  // ── Loading / not found ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070c12' }}>
        <div className="h-10 w-10 rounded-full border-2 border-white/10 border-t-white/50 animate-spin"/>
      </div>
    )
  }

  if (notFound) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ background: 'linear-gradient(135deg, #f8f6f3 0%, #fdfcfb 50%, #f8f6f3 100%)' }}
      >
        <div className="text-5xl">🗺️</div>
        <h1 className="text-xl font-bold text-neutral-800">Δεν βρέθηκε χάρτης μπουφέ</h1>
        <p className="text-sm text-neutral-500 max-w-xs">Ο χάρτης δεν έχει δημιουργηθεί ακόμα.</p>
        <p className="text-xs text-neutral-400 mt-4">Powered by ChefSuite</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalSlots = stations.reduce((a, s) => a + s.slotCount, 0)
  const assignedSlots = Object.keys(slots).length

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#070c12' }}
      onClick={() => setPopup(null)}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'rgba(196,149,106,0.15)', border: '1px solid rgba(196,149,106,0.3)' }}
          >
            🗺️
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Χάρτης Μπουφέ</h1>
            <p className="text-white/40 text-xs">
              {new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          <span className="text-xs text-white/40">
            {lastUpdated ? `${secondsSince}δ` : 'Live'}
          </span>
        </div>
      </div>

      {/* Map canvas */}
      <div className="flex-1 px-2 sm:px-4 pb-4">
        <div
          className="w-full rounded-2xl overflow-hidden relative"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full block"
            style={{ background: '#070c12' }}
          >
            {/* Grid */}
            <defs>
              <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="15" r="0.8" fill="rgba(255,255,255,0.06)"/>
              </pattern>
              {stations.map((s) => (
                <filter key={`glow-${s.id}`} id={`glow-pub-${s.id}`} x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              ))}
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#dots)"/>

            {/* Stations */}
            {stations.map((s) => {
              const slotW = s.width / s.slotCount

              // Compute station's worst status for glow
              const stationStatuses = Array.from({ length: s.slotCount }, (_, i) => {
                const key = slotKey(s.id, i)
                const assignment = slots[key]
                if (!assignment) return null
                return statusMap[assignment.menuItemId] ?? null
              }).filter(Boolean) as string[]

              const hasEmpty = stationStatuses.includes('empty')
              const hasLow   = stationStatuses.includes('low')
              const glowColor = hasEmpty ? '#ef4444' : hasLow ? '#f59e0b' : s.color

              return (
                <g key={s.id} filter={`url(#glow-pub-${s.id})`}>
                  {/* Outer glow */}
                  <rect
                    x={s.x - 2} y={s.y - 2}
                    width={s.width + 4} height={s.height + 4}
                    rx="10"
                    fill="none"
                    stroke={glowColor}
                    strokeWidth="1"
                    strokeOpacity="0.2"
                  />

                  {/* Station body */}
                  <rect
                    x={s.x} y={s.y}
                    width={s.width} height={s.height}
                    rx="8"
                    fill={`${s.color}14`}
                    stroke={s.color}
                    strokeWidth="1.5"
                  />

                  {/* Station label */}
                  <text
                    x={s.x + s.width / 2}
                    y={s.y - 8}
                    textAnchor="middle"
                    fill={s.color}
                    fontSize="10.5"
                    fontWeight="700"
                    letterSpacing="1.2"
                    fontFamily="'Plus Jakarta Sans', sans-serif"
                  >
                    {s.name.toUpperCase()}
                  </text>

                  {/* Slots */}
                  {Array.from({ length: s.slotCount }).map((_, i) => {
                    const key = slotKey(s.id, i)
                    const assignment = slots[key]
                    const st = assignment ? (statusMap[assignment.menuItemId] ?? null) : null
                    const statusColor = st ? STATUS_COLOR[st]! : 'rgba(255,255,255,0.15)'
                    const sx = s.x + i * slotW

                    return (
                      <g key={i}>
                        {/* Divider */}
                        {i > 0 && (
                          <line
                            x1={sx} y1={s.y + 8}
                            x2={sx} y2={s.y + s.height - 8}
                            stroke={s.color} strokeWidth="0.5" strokeOpacity="0.25"
                          />
                        )}

                        {/* Clickable slot area */}
                        {assignment && (
                          <rect
                            x={sx + 1} y={s.y + 1}
                            width={slotW - 2} height={s.height - 2}
                            rx="6"
                            fill="transparent"
                            stroke="transparent"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); openPopup(s, i, e) }}
                          />
                        )}

                        {/* Slot background (subtle highlight) */}
                        {assignment && (
                          <rect
                            x={sx + 3} y={s.y + 3}
                            width={slotW - 6} height={s.height - 6}
                            rx="5"
                            fill={`${statusColor}10`}
                            style={{ pointerEvents: 'none' }}
                          />
                        )}

                        {/* Dish name */}
                        <text
                          x={sx + slotW / 2}
                          y={s.y + s.height / 2 + (assignment ? 6 : 4)}
                          textAnchor="middle"
                          fill="white"
                          fontSize="9"
                          opacity={assignment ? 0.9 : 0.2}
                          fontFamily="'Plus Jakarta Sans', sans-serif"
                          fontWeight={assignment ? '600' : '400'}
                          style={{ pointerEvents: 'none' }}
                        >
                          {assignment
                            ? (assignment.dishName.length > 14
                                ? assignment.dishName.slice(0, 13) + '…'
                                : assignment.dishName)
                            : '—'}
                        </text>

                        {/* Status indicator */}
                        {assignment && (
                          <PulseDot
                            cx={sx + slotW - 9}
                            cy={s.y + 9}
                            color={statusColor}
                            pulse={st === 'low'}
                          />
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* Popup overlay */}
      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPopup(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{
              background: 'rgba(12,22,36,0.97)',
              border: `1px solid ${popup.station.color}40`,
              boxShadow: `0 0 40px ${popup.station.color}25`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: popup.station.color }}>
                  {popup.station.name}
                </p>
                <h2 className="text-xl font-bold text-white mt-1">{popup.dishName}</h2>
              </div>
              {popup.status && (
                <div
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: `${STATUS_COLOR[popup.status]}20`,
                    color: STATUS_COLOR[popup.status],
                    border: `1px solid ${STATUS_COLOR[popup.status]}40`,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: STATUS_COLOR[popup.status],
                      boxShadow: popup.status === 'low' ? `0 0 6px ${STATUS_COLOR[popup.status]}` : 'none',
                    }}
                  />
                  {STATUS_LABEL[popup.status]}
                </div>
              )}
            </div>

            <div
              className="rounded-xl p-3 text-sm text-white/60"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p>Θέση <strong className="text-white">{popup.slotIndex + 1}</strong> από τα αριστερά στον σταθμό <strong style={{ color: popup.station.color }}>{popup.station.name}</strong></p>
            </div>

            <button
              onClick={() => setPopup(null)}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white transition"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      )}

      {/* Status legend */}
      <div className="px-4 pb-5 flex items-center justify-center gap-5 flex-wrap">
        {(['full', 'low', 'empty'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }}/>
            <span className="text-xs text-white/40">{STATUS_LABEL[s]}</span>
          </div>
        ))}
        <span className="text-xs text-white/25 ml-2">
          {assignedSlots}/{totalSlots} θέσεις
        </span>
      </div>

      {/* Footer */}
      <div className="pb-4 text-center">
        <p className="text-xs text-white/20">Powered by ChefSuite</p>
      </div>
    </div>
  )
}
