import { useCallback, useEffect, useRef, useState } from 'react'
import { Map, Plus, Trash2, Save, ChefHat, LayoutGrid, QrCode } from 'lucide-react'
import QRCodeLib from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { cn } from '../lib/cn'

// ── Constants ────────────────────────────────────────────────────────────────

const SVG_W = 900
const SVG_H = 550

const COLORS = [
  '#4ade80', '#60a5fa', '#fb923c', '#f87171',
  '#a78bfa', '#fbbf24', '#22d3ee', '#f472b6',
]

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

interface SlotKey { stationId: string; slotIndex: number }
interface SlotValue { menuItemId: string; dishName: string }
type SlotsMap = Record<string, SlotValue>

interface MenuItem { id: string; name: string }

interface DragState {
  stationId: string
  type: 'move' | 'resize'
  startX: number
  startY: number
  origX: number
  origY: number
  origW: number
  origH: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slotKey(stationId: string, slotIndex: number) {
  return `${stationId}_${slotIndex}`
}

function getSvgPoint(e: MouseEvent | React.MouseEvent, svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * SVG_W,
    y: ((e.clientY - rect.top) / rect.height) * SVG_H,
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BuffetMap() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  // Map data
  const [mapId, setMapId]           = useState<string | null>(null)
  const [stations, setStations]     = useState<Station[]>([])
  const [slots, setSlots]           = useState<SlotsMap>({})
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [tab, setTab]               = useState<'design' | 'assign'>('design')

  // Builder state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen]       = useState(false)
  const [newName, setNewName]       = useState('')
  const [newColor, setNewColor]     = useState(COLORS[0]!)
  const [newSlots, setNewSlots]     = useState(4)

  // Assign state
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([])
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null)
  const [slotSearch, setSlotSearch] = useState('')

  // QR
  const [qrOpen, setQrOpen]         = useState(false)
  const [qrDataUrl, setQrDataUrl]   = useState<string | null>(null)

  const svgRef  = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragState | null>(null)

  // ── Load map ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) return
    ;(async () => {
      const { data: maps } = await supabase
        .from('buffet_maps')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (maps && maps.length > 0) {
        const m = maps[0]!
        setMapId(m.id)
        setStations((m.stations as Station[]) ?? [])

        const { data: assign } = await supabase
          .from('buffet_map_assignments')
          .select('slots')
          .eq('map_id', m.id)
          .eq('date', TODAY)
          .maybeSingle()
        setSlots((assign?.slots as SlotsMap) ?? {})
      }
    })()
  }, [teamId])

  // ── Load menu items for today's daily menu ─────────────────────────────────

  useEffect(() => {
    if (!teamId || tab !== 'assign') return
    ;(async () => {
      const { data: team } = await supabase
        .from('teams')
        .select('daily_menu_id')
        .eq('id', teamId)
        .single()
      if (!team?.daily_menu_id) return

      const { data } = await supabase
        .from('menus')
        .select('menu_sections(menu_items(id,name))')
        .eq('id', team.daily_menu_id)
        .single()
      if (!data) return
      const sections = (data as any).menu_sections ?? []
      const items: MenuItem[] = sections.flatMap((s: any) =>
        (s.menu_items ?? []).map((i: any) => ({ id: i.id, name: i.name }))
      )
      setMenuItems(items)
    })()
  }, [teamId, tab])

  // ── Save layout ────────────────────────────────────────────────────────────

  const saveLayout = useCallback(async () => {
    if (!teamId) return
    setSaving(true)
    try {
      if (mapId) {
        await supabase
          .from('buffet_maps')
          .update({ stations, updated_at: new Date().toISOString() })
          .eq('id', mapId)
      } else {
        const { data } = await supabase
          .from('buffet_maps')
          .insert({ team_id: teamId, name: 'Χάρτης Μπουφέ', stations })
          .select('id')
          .single()
        if (data) setMapId(data.id)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [teamId, mapId, stations])

  // ── Save assignments ───────────────────────────────────────────────────────

  const saveAssignments = useCallback(async (updated: SlotsMap) => {
    if (!teamId || !mapId) return
    await supabase
      .from('buffet_map_assignments')
      .upsert(
        { map_id: mapId, team_id: teamId, date: TODAY, slots: updated, updated_at: new Date().toISOString() },
        { onConflict: 'map_id,date' },
      )
  }, [teamId, mapId])

  // ── Station management ─────────────────────────────────────────────────────

  function addStation() {
    if (!newName.trim()) return
    const s: Station = {
      id: uid(),
      name: newName.trim(),
      x: 40 + Math.floor(Math.random() * 200),
      y: 40 + Math.floor(Math.random() * 200),
      width: Math.max(120, newSlots * 80),
      height: 70,
      color: newColor,
      slotCount: newSlots,
    }
    setStations((prev) => [...prev, s])
    setNewName(''); setNewSlots(4); setAddOpen(false)
  }

  function deleteSelected() {
    if (!selectedId) return
    setStations((prev) => prev.filter((s) => s.id !== selectedId))
    setSelectedId(null)
  }

  function updateSelected(patch: Partial<Station>) {
    setStations((prev) =>
      prev.map((s) => s.id === selectedId ? { ...s, ...patch } : s)
    )
  }

  // ── SVG drag ───────────────────────────────────────────────────────────────

  function onStationMouseDown(e: React.MouseEvent, station: Station) {
    e.stopPropagation()
    if (!svgRef.current) return
    const pt = getSvgPoint(e, svgRef.current)
    dragRef.current = {
      stationId: station.id, type: 'move',
      startX: pt.x, startY: pt.y,
      origX: station.x, origY: station.y,
      origW: station.width, origH: station.height,
    }
    setSelectedId(station.id)
  }

  function onResizeMouseDown(e: React.MouseEvent, station: Station) {
    e.stopPropagation()
    if (!svgRef.current) return
    const pt = getSvgPoint(e, svgRef.current)
    dragRef.current = {
      stationId: station.id, type: 'resize',
      startX: pt.x, startY: pt.y,
      origX: station.x, origY: station.y,
      origW: station.width, origH: station.height,
    }
  }

  function onSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragRef.current || !svgRef.current) return
    const pt = getSvgPoint(e, svgRef.current)
    const d = dragRef.current
    const dx = pt.x - d.startX
    const dy = pt.y - d.startY
    setStations((prev) => prev.map((s) => {
      if (s.id !== d.stationId) return s
      if (d.type === 'move') return {
        ...s,
        x: Math.max(0, Math.min(SVG_W - s.width, d.origX + dx)),
        y: Math.max(20, Math.min(SVG_H - s.height, d.origY + dy)),
      }
      return {
        ...s,
        width:  Math.max(80, d.origW + dx),
        height: Math.max(44, d.origH + dy),
      }
    }))
  }

  function onSvgMouseUp() {
    if (dragRef.current) {
      dragRef.current = null
      void saveLayout()
    }
  }

  function onSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if ((e.target as SVGElement).tagName === 'svg') setSelectedId(null)
  }

  // ── QR ────────────────────────────────────────────────────────────────────

  async function openQr() {
    if (!teamId) return
    const url = `${window.location.origin}/buffet-map/${teamId}`
    const dataUrl = await QRCodeLib.toDataURL(url, { width: 512, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    setQrDataUrl(dataUrl)
    setQrOpen(true)
  }

  // ── Assign dish to slot ────────────────────────────────────────────────────

  function assignDish(menuItem: MenuItem) {
    if (!activeSlot) return
    const key = slotKey(activeSlot.stationId, activeSlot.slotIndex)
    const updated = { ...slots, [key]: { menuItemId: menuItem.id, dishName: menuItem.name } }
    setSlots(updated)
    void saveAssignments(updated)
    setActiveSlot(null)
    setSlotSearch('')
  }

  function clearSlot(stationId: string, slotIndex: number) {
    const key = slotKey(stationId, slotIndex)
    const updated = { ...slots }
    delete updated[key]
    setSlots(updated)
    void saveAssignments(updated)
  }

  const selected = stations.find((s) => s.id === selectedId) ?? null
  const filteredItems = menuItems.filter((i) =>
    i.name.toLowerCase().includes(slotSearch.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <Map className="h-7 w-7 text-brand-orange" />
            Χάρτης Μπουφέ
          </h1>
          <p className="text-white/60 mt-1">Σχεδίασε τον χώρο σου και τοποθέτησε τα φαγητά</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" leftIcon={<QrCode className="h-4 w-4" />} onClick={openQr}>
            QR Χάρτη
          </Button>
          <Button leftIcon={<Save className="h-4 w-4" />} onClick={saveLayout} disabled={saving}>
            {saved ? '✓ Αποθηκεύτηκε' : saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
        {(['design', 'assign'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition',
              tab === t ? 'bg-brand-orange text-white' : 'text-white/60 hover:text-white',
            )}
          >
            {t === 'design' ? <span className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Σχεδιασμός</span>
                            : <span className="flex items-center gap-1.5"><ChefHat className="h-3.5 w-3.5" />Διάταξη Φαγητών</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* Canvas */}
        <GlassCard className="flex-1 overflow-hidden p-0 relative">
          {/* Toolbar */}
          {tab === 'design' && (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-orange/15 text-brand-orange hover:bg-brand-orange/25 transition text-sm font-medium"
              >
                <Plus className="h-4 w-4" /> Νέος Σταθμός
              </button>
              {selectedId && (
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition text-sm font-medium"
                >
                  <Trash2 className="h-4 w-4" /> Διαγραφή
                </button>
              )}
              <span className="ml-auto text-xs text-white/30">Drag για μετακίνηση · Γωνία για resize</span>
            </div>
          )}
          {tab === 'assign' && (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <span className="text-sm text-white/60">Κλικ σε θέση → επιλογή φαγητού</span>
              {menuItems.length === 0 && (
                <span className="ml-auto text-xs text-amber-400">⚠ Ορίσε πρώτα Μενού Ημέρας από τη σελίδα Μενού</span>
              )}
            </div>
          )}

          {/* SVG Canvas */}
          <div className="relative w-full" style={{ paddingBottom: `${(SVG_H / SVG_W) * 100}%` }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="absolute inset-0 w-full h-full select-none"
              style={{ background: '#070c12', cursor: tab === 'design' ? 'crosshair' : 'default' }}
              onMouseMove={tab === 'design' ? onSvgMouseMove : undefined}
              onMouseUp={tab === 'design' ? onSvgMouseUp : undefined}
              onMouseLeave={tab === 'design' ? onSvgMouseUp : undefined}
              onClick={onSvgClick}
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                </pattern>
                {stations.map((s) => (
                  <filter key={`glow-${s.id}`} id={`glow-${s.id}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feMerge>
                      <feMergeNode in="blur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                ))}
              </defs>
              <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

              {/* Stations */}
              {stations.map((s) => {
                const isSelected = selectedId === s.id && tab === 'design'
                const slotW = s.width / s.slotCount

                return (
                  <g key={s.id} filter={`url(#glow-${s.id})`}>
                    {/* Station body */}
                    <rect
                      x={s.x} y={s.y}
                      width={s.width} height={s.height}
                      rx="8"
                      fill={`${s.color}18`}
                      stroke={s.color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeDasharray={isSelected ? '6 3' : undefined}
                      style={{ cursor: tab === 'design' ? 'move' : 'default' }}
                      onMouseDown={tab === 'design' ? (e) => onStationMouseDown(e, s) : undefined}
                    />

                    {/* Station label (above) */}
                    <text
                      x={s.x + s.width / 2}
                      y={s.y - 6}
                      textAnchor="middle"
                      fill={s.color}
                      fontSize="11"
                      fontWeight="700"
                      letterSpacing="0.5"
                      style={{ textTransform: 'uppercase', pointerEvents: 'none' }}
                    >
                      {s.name}
                    </text>

                    {/* Slots */}
                    {Array.from({ length: s.slotCount }).map((_, i) => {
                      const key = slotKey(s.id, i)
                      const assignment = slots[key]
                      const sx = s.x + i * slotW

                      return (
                        <g key={i}>
                          {/* Slot divider */}
                          {i > 0 && (
                            <line
                              x1={sx} y1={s.y + 6}
                              x2={sx} y2={s.y + s.height - 6}
                              stroke={s.color} strokeWidth="0.5" strokeOpacity="0.3"
                              style={{ pointerEvents: 'none' }}
                            />
                          )}

                          {/* Slot click area (assign mode) */}
                          {tab === 'assign' && (
                            <rect
                              x={sx + 1} y={s.y + 1}
                              width={slotW - 2} height={s.height - 2}
                              rx="6"
                              fill={activeSlot?.stationId === s.id && activeSlot?.slotIndex === i
                                ? `${s.color}35` : 'transparent'}
                              stroke={activeSlot?.stationId === s.id && activeSlot?.slotIndex === i
                                ? s.color : 'transparent'}
                              strokeWidth="1.5"
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveSlot({ stationId: s.id, slotIndex: i })
                                setSlotSearch('')
                              }}
                            />
                          )}

                          {/* Dish name */}
                          <text
                            x={sx + slotW / 2}
                            y={s.y + s.height / 2 + 5}
                            textAnchor="middle"
                            fill="white"
                            fontSize="9.5"
                            opacity={assignment ? 0.85 : 0.25}
                            style={{ pointerEvents: 'none' }}
                          >
                            {assignment?.dishName ?? `Θέση ${i + 1}`}
                          </text>

                          {/* Clear button (assign mode, if assigned) */}
                          {tab === 'assign' && assignment && (
                            <g
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); clearSlot(s.id, i) }}
                            >
                              <circle
                                cx={sx + slotW - 10} cy={s.y + 11}
                                r="7" fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.5)" strokeWidth="0.8"
                              />
                              <text x={sx + slotW - 10} y={s.y + 15.5} textAnchor="middle" fill="#f87171" fontSize="9" fontWeight="bold">×</text>
                            </g>
                          )}
                        </g>
                      )
                    })}

                    {/* Resize handle (design mode) */}
                    {tab === 'design' && (
                      <rect
                        x={s.x + s.width - 12} y={s.y + s.height - 12}
                        width="12" height="12" rx="3"
                        fill={s.color} opacity="0.5"
                        style={{ cursor: 'se-resize' }}
                        onMouseDown={(e) => onResizeMouseDown(e, s)}
                      />
                    )}
                  </g>
                )
              })}

              {/* Empty state */}
              {stations.length === 0 && (
                <g>
                  <text x={SVG_W / 2} y={SVG_H / 2 - 16} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14">
                    Δεν υπάρχουν σταθμοί ακόμα
                  </text>
                  <text x={SVG_W / 2} y={SVG_H / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="11">
                    Πάτα «Νέος Σταθμός» για να αρχίσεις
                  </text>
                </g>
              )}
            </svg>
          </div>
        </GlassCard>

        {/* Right panel */}
        <div className="w-64 shrink-0 space-y-3">
          {/* Design mode: selected station properties */}
          {tab === 'design' && selected && (
            <GlassCard className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Σταθμός</h3>
              <div className="space-y-2">
                <input
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                  onBlur={() => void saveLayout()}
                  className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-orange/60"
                  placeholder="Όνομα"
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { updateSelected({ color: c }); void saveLayout() }}
                      className={cn('h-6 w-6 rounded-full transition', selected.color === c ? 'ring-2 ring-white scale-110' : '')}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <span>Θέσεις:</span>
                  <input
                    type="number" min="1" max="12"
                    value={selected.slotCount}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(12, Number(e.target.value)))
                      updateSelected({ slotCount: n, width: Math.max(80, n * 80) })
                    }}
                    onBlur={() => void saveLayout()}
                    className="w-16 rounded-lg px-2 py-1 bg-white/5 border border-white/10 text-white text-center focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={deleteSelected}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Διαγραφή σταθμού
              </button>
            </GlassCard>
          )}

          {tab === 'design' && !selected && (
            <GlassCard className="text-center py-6 space-y-2">
              <p className="text-xs text-white/40">Κλικ σε σταθμό<br/>για επεξεργασία</p>
            </GlassCard>
          )}

          {/* Assign mode: dish picker */}
          {tab === 'assign' && activeSlot && (
            <GlassCard className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Επιλογή φαγητού</h3>
              <input
                autoFocus
                value={slotSearch}
                onChange={(e) => setSlotSearch(e.target.value)}
                placeholder="Αναζήτηση…"
                className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-orange/60"
              />
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredItems.length === 0 && (
                  <p className="text-xs text-white/40 text-center py-4">Δεν βρέθηκαν</p>
                )}
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => assignDish(item)}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setActiveSlot(null)}
                className="w-full text-xs text-white/40 hover:text-white/60 transition"
              >
                Ακύρωση
              </button>
            </GlassCard>
          )}

          {tab === 'assign' && !activeSlot && (
            <GlassCard className="text-center py-6">
              <p className="text-xs text-white/40">Κλικ σε θέση<br/>για ανάθεση φαγητού</p>
            </GlassCard>
          )}

          {/* Stats */}
          <GlassCard className="space-y-1 text-xs text-white/50">
            <p>Σταθμοί: <span className="text-white/80">{stations.length}</span></p>
            <p>Θέσεις: <span className="text-white/80">{stations.reduce((a, s) => a + s.slotCount, 0)}</span></p>
            <p>Ανατεθειμένα: <span className="text-white/80">{Object.keys(slots).length}</span></p>
          </GlassCard>
        </div>
      </div>

      {/* Add station drawer */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Νέος Σταθμός">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-white/70">Όνομα σταθμού</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStation()}
              placeholder="π.χ. Σαλάτες, Ζεστά Πιάτα…"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">Χρώμα</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn('h-8 w-8 rounded-full transition', newColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110' : '')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">Αριθμός θέσεων</label>
            <div className="flex gap-2 flex-wrap">
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setNewSlots(n)}
                  className={cn(
                    'h-9 w-9 rounded-xl text-sm font-medium transition border',
                    newSlots === n
                      ? 'bg-brand-orange border-brand-orange text-white'
                      : 'border-white/15 text-white/60 hover:text-white hover:bg-white/5',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={addStation} className="flex-1" disabled={!newName.trim()}>
              Προσθήκη
            </Button>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Ακύρωση</Button>
          </div>
        </div>
      </Drawer>

      {/* QR Drawer */}
      <Drawer open={qrOpen} onClose={() => setQrOpen(false)} title="QR Χάρτη Μπουφέ">
        <div className="space-y-5">
          <p className="text-sm text-white/60">
            Τοποθέτησε αυτό το QR στην είσοδο του μπουφέ. Ο πελάτης βλέπει live τον χάρτη με τα φαγητά.
          </p>
          {qrDataUrl && (
            <div className="flex justify-center">
              <img src={qrDataUrl} alt="QR Χάρτη" className="w-56 h-56 rounded-2xl bg-white p-3" />
            </div>
          )}
          {qrDataUrl && (
            <p className="text-xs text-white/40 text-center break-all">
              {window.location.origin}/buffet-map/{teamId}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (!qrDataUrl) return
                const a = document.createElement('a')
                a.href = qrDataUrl; a.download = 'buffet-map-qr.png'; a.click()
              }}
              className="flex-1"
              disabled={!qrDataUrl}
            >
              Κατέβασμα QR
            </Button>
            <Button variant="secondary" onClick={() => setQrOpen(false)}>Κλείσιμο</Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
