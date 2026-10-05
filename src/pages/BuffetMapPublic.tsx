import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Map as MapIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Constants ────────────────────────────────────────────────────────────────

const SVG_W = 900
const SVG_H = 550

const TODAY = new Date().toISOString().split('T')[0]!

// ── Types ────────────────────────────────────────────────────────────────────

interface Station {
  id: string
  name: string
  icon: string
  x: number
  y: number
  width: number
  height: number
  color: string
  slotCount: number
  rotation: number
  shape: 'rect' | 'circle'
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

const STATUS_TEXT: Record<string, string> = {
  full:  '#15803d',
  low:   '#b45309',
  empty: '#b91c1c',
}

const CARD_SHADOW = 'shadow-[0_1px_2px_rgba(15,18,16,0.05),0_10px_30px_-18px_rgba(15,18,16,0.25)]'

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
  const [bgImage, setBgImage]     = useState('')
  const [slots, setSlots]         = useState<SlotsMap>({})
  const [statusMap, setStatusMap] = useState<StatusMap>({})
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)
  const [popup, setPopup]         = useState<PopupInfo | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsSince, setSecondsSince] = useState(0)

  const svgRef   = useRef<SVGSVGElement>(null)
  const mapIdRef = useRef<string | null>(null)

  // ── Load + poll (fetches everything) ──────────────────────────────────────

  const fetchAll = useCallback(async (isInitial = false) => {
    if (!teamId) return

    // On first load, get the map id by team
    if (!mapIdRef.current) {
      const { data: maps } = await supabase
        .from('buffet_maps')
        .select('id, stations, background_image')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!maps || maps.length === 0) {
        if (isInitial) { setNotFound(true); setLoading(false) }
        return
      }
      const m = maps[0]!
      mapIdRef.current = m.id
      setStations(((m.stations as any[]) ?? []).map((s) => ({ icon: '', rotation: 0, shape: 'rect', ...s })))
      setBgImage((m as any).background_image ?? '')
    } else {
      // Subsequent polls: refresh map layout too
      const { data: m } = await supabase
        .from('buffet_maps')
        .select('stations, background_image')
        .eq('id', mapIdRef.current)
        .single()
      if (m) {
        setStations(((m.stations as any[]) ?? []).map((s) => ({ icon: '', rotation: 0, shape: 'rect', ...s })))
        setBgImage((m as any).background_image ?? '')
      }
    }

    const [assignRes, statusRes] = await Promise.all([
      supabase
        .from('buffet_map_assignments')
        .select('slots')
        .eq('map_id', mapIdRef.current!)
        .eq('date', TODAY)
        .maybeSingle(),
      supabase
        .from('buffet_live_status')
        .select('menu_item_id, status')
        .eq('team_id', teamId),
    ])

    setSlots((assignRes.data?.slots as SlotsMap) ?? {})

    const sm: StatusMap = {}
    for (const row of statusRes.data ?? []) sm[row.menu_item_id] = row.status as 'full' | 'low' | 'empty'
    setStatusMap(sm)
    setLastUpdated(new Date())
    if (isInitial) setLoading(false)
  }, [teamId])

  useEffect(() => {
    void fetchAll(true)
  }, [fetchAll])

  // ── Poll every 5s — refreshes layout, assignments AND statuses ─────────────

  useEffect(() => {
    if (!teamId) return
    const interval = setInterval(() => void fetchAll(), 5_000)
    return () => clearInterval(interval)
  }, [teamId, fetchAll])

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
      <div className="flex min-h-screen items-center justify-center bg-[#F1F2EE]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60"/>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F1F2EE] p-4 text-ink">
        <div className={`flex w-full max-w-sm flex-col items-center gap-3 rounded-[2rem] bg-white-fixed p-8 text-center ${CARD_SHADOW}`}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime"><MapIcon className="h-6 w-6"/></span>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">Δεν βρέθηκε χάρτης μπουφέ</h1>
          <p className="text-sm text-ink/55">Ο χάρτης δεν έχει δημιουργηθεί ακόμα.</p>
          <p className="mt-2 text-xs text-ink/35">Powered by ChefSuite</p>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalSlots = stations.reduce((a, s) => a + s.slotCount, 0)
  const assignedSlots = Object.keys(slots).length
  const counts = { full: 0, low: 0, empty: 0 }
  for (const v of Object.values(slots)) {
    const st = statusMap[v.menuItemId]
    if (st) counts[st]++
  }

  return (
    <div className="min-h-screen bg-[#F1F2EE] px-3 py-3 text-ink sm:py-6" onClick={() => setPopup(null)}>
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 rounded-[2rem] bg-ink px-6 pb-6 pt-5 text-white-fixed">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-[11px] font-semibold text-ink">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink"/>
              {lastUpdated ? `Live · ${secondsSince}δ` : 'Live'}
            </span>
            <h1 className="mt-4 text-4xl font-medium tracking-[-0.03em]">Χάρτης Μπουφέ</h1>
            <p className="mt-1 capitalize text-white-fixed/55">
              {new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex gap-2">
            {(['full', 'low', 'empty'] as const).map((k) => (
              <div key={k} className="min-w-[5.5rem] rounded-2xl bg-white-fixed/[0.06] px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[11px] text-white-fixed/55">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[k] }}/>{STATUS_LABEL[k]}
                </span>
                <span className="mt-0.5 block text-2xl font-medium tabular-nums">{counts[k]}</span>
              </div>
            ))}
          </div>
        </header>

        {/* Map canvas */}
        <div className={`overflow-hidden rounded-3xl bg-white-fixed p-2 ${CARD_SHADOW}`}>
          <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="block w-full rounded-2xl" style={{ background: '#FAFAF7' }}>
            <defs>
              <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="15" r="1" fill="rgba(15,18,16,0.09)"/>
              </pattern>
              {stations.map((s) => (
                <clipPath key={`clip-pub-${s.id}`} id={`clip-pub-${s.id}`}>
                  {s.shape === 'circle'
                    ? <ellipse cx={s.x + s.width/2} cy={s.y + s.height/2} rx={s.width/2 - 2} ry={s.height/2 - 2}/>
                    : <rect x={s.x + 1} y={s.y + 1} width={s.width - 2} height={s.height - 2} rx="12"/>}
                </clipPath>
              ))}
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#dots)"/>

            {bgImage && (
              <image href={bgImage} x="0" y="0" width={SVG_W} height={SVG_H}
                preserveAspectRatio="xMidYMid slice" opacity="0.15" style={{ pointerEvents: 'none' }}/>
            )}

            {stations.map((s) => {
              const slotW = s.width / s.slotCount
              const cx = s.x + s.width / 2
              const cy = s.y + s.height / 2

              return (
                <g key={s.id} transform={`rotate(${s.rotation ?? 0},${cx},${cy})`}>
                  {s.shape === 'circle' ? (
                    <ellipse cx={cx} cy={cy} rx={s.width/2} ry={s.height/2}
                      fill="#ffffff" stroke={s.color} strokeWidth="2"/>
                  ) : (
                    <rect x={s.x} y={s.y} width={s.width} height={s.height}
                      rx="12" fill="#ffffff" stroke={s.color} strokeWidth="2"/>
                  )}

                  <text x={cx} y={s.y - 9} textAnchor="middle"
                    fill="#0F1210" fontSize="11" fontWeight="600" letterSpacing="0.6"
                    fontFamily="Geologica, sans-serif">
                    {s.name.toUpperCase()}
                  </text>

                  <g clipPath={`url(#clip-pub-${s.id})`}>
                    {Array.from({ length: s.slotCount }).map((_, i) => {
                      const assignment = slots[slotKey(s.id, i)]
                      const st = assignment ? (statusMap[assignment.menuItemId] ?? null) : null
                      const statusColor = st ? STATUS_COLOR[st]! : 'rgba(15,18,16,0.2)'
                      const sx = s.x + i * slotW

                      return (
                        <g key={i}>
                          {i > 0 && (
                            <line x1={sx} y1={s.y + 8} x2={sx} y2={s.y + s.height - 8}
                              stroke="#0F1210" strokeWidth="0.6" strokeOpacity="0.12"/>
                          )}
                          {assignment && (
                            <rect x={sx + 3} y={s.y + 3} width={slotW - 6} height={s.height - 6}
                              rx="8" fill={`${s.color}1f`}
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); openPopup(s, i, e) }}/>
                          )}
                          <text x={sx + slotW / 2} y={s.y + s.height / 2 + 4}
                            textAnchor="middle" fill="#0F1210" fontSize="9.5"
                            opacity={assignment ? 0.9 : 0.25}
                            fontFamily="Geologica, sans-serif"
                            fontWeight={assignment ? '600' : '400'}
                            style={{ pointerEvents: 'none' }}>
                            {assignment
                              ? (assignment.dishName.length > 14 ? assignment.dishName.slice(0, 13) + '…' : assignment.dishName)
                              : '—'}
                          </text>
                          {assignment && (
                            <PulseDot cx={sx + slotW - 9} cy={s.y + 9} color={statusColor} pulse={st === 'low'}/>
                          )}
                        </g>
                      )
                    })}
                  </g>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Stations list — readable on phones */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stations.map((s) => {
            const dishes = Array.from({ length: s.slotCount }, (_, i) => ({ i, a: slots[slotKey(s.id, i)] }))
              .filter((d): d is { i: number; a: SlotValue } => !!d.a)
            if (dishes.length === 0) return null
            return (
              <section key={s.id} className={`rounded-3xl bg-white-fixed p-4 ${CARD_SHADOW}`}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }}/>{s.name}
                </h2>
                <ul className="flex flex-col">
                  {dishes.map(({ i, a }) => {
                    const st = statusMap[a.menuItemId] ?? null
                    return (
                      <li key={i}>
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setPopup({ station: s, slotIndex: i, dishName: a.dishName, status: st, x: 0, y: 0 }) }}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[#F1F2EE]">
                          <span className="w-5 text-xs tabular-nums text-ink/35">{i + 1}</span>
                          <span className={`min-w-0 flex-1 truncate text-[15px] ${st === 'empty' ? 'text-ink/40 line-through' : ''}`}>{a.dishName}</span>
                          {st && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[st] }}/>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>

        <p className="pb-2 text-center text-xs text-ink/35">
          {assignedSlots}/{totalSlots} θέσεις · Powered by ChefSuite
        </p>
      </div>

      {/* Dish sheet */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setPopup(null)}>
          <div className={`flex w-full max-w-sm flex-col gap-4 rounded-[2rem] bg-white-fixed p-5 text-ink ${CARD_SHADOW}`}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink/55">
                  <span className="h-2 w-2 rounded-full" style={{ background: popup.station.color }}/>{popup.station.name}
                </p>
                <h2 className="mt-1 text-2xl font-medium tracking-[-0.02em]">{popup.dishName}</h2>
              </div>
              {popup.status && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: `${STATUS_COLOR[popup.status]}1f`, color: STATUS_TEXT[popup.status] }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[popup.status] }}/>
                  {STATUS_LABEL[popup.status]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-[#F1F2EE] p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime text-lg font-semibold tabular-nums">
                {popup.slotIndex + 1}
              </span>
              <p className="text-sm text-ink/65">
                Θέση <strong className="text-ink">{popup.slotIndex + 1}</strong> από τα αριστερά στον σταθμό <strong className="text-ink">{popup.station.name}</strong>
              </p>
            </div>
            <button onClick={() => setPopup(null)}
              className="h-12 rounded-full bg-ink text-[15px] font-medium text-white-fixed hover:bg-ink/90">
              Κλείσιμο
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
