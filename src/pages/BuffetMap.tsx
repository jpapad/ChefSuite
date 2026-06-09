import { useEffect, useRef, useState } from 'react'
import {
  Map, Plus, Trash2, Save, ChefHat, LayoutGrid, QrCode,
  Undo2, Redo2, Grid3x3, Copy, Download, Image, AlignLeft,
  AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Camera, Wand2, Activity, ScanLine,
} from 'lucide-react'
import QRCodeLib from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { cn } from '../lib/cn'

// ── Constants ─────────────────────────────────────────────────────────────────

const SVG_W  = 900
const SVG_H  = 550
const GRID   = 20
const TODAY  = new Date().toISOString().split('T')[0]!

const COLORS = [
  '#4ade80', '#60a5fa', '#fb923c', '#f87171',
  '#a78bfa', '#fbbf24', '#22d3ee', '#f472b6',
]

const QUICK_EMOJIS = [
  '🥗','🍲','🍖','🍗','🍕','🧆','🥘','🍣',
  '🥙','🍱','🍞','🧀','🍰','🎂','🍮','🍨',
  '🍦','☕','🥤','🍹','🍽️','⭐','🌿','🫕',
]

// ── Types ─────────────────────────────────────────────────────────────────────

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
interface MenuItem { id: string; name: string }

interface DragState {
  stationId: string
  type: 'move' | 'resize' | 'rotate'
  startX: number; startY: number
  origX: number; origY: number
  origW: number; origH: number
  origRotation?: number
  centerX?: number; centerY?: number
}

interface SlotKey { stationId: string; slotIndex: number }

type LiveStatus = 'full' | 'low' | 'empty'
type LiveStatusMap = Record<string, LiveStatus>

interface LivePopup {
  stationId: string
  slotIndex: number
  menuItemId: string
  dishName: string
}

type AdvScanStep = 'aerial' | 'video' | 'processing' | null

const LIVE_STATUS_CFG: Record<LiveStatus, { label: string; dot: string; bg: string; text: string }> = {
  full:  { label: 'Γεμάτο',    dot: '#22c55e', bg: 'bg-emerald-600 hover:bg-emerald-500', text: 'text-white' },
  low:   { label: 'Λίγο',      dot: '#f59e0b', bg: 'bg-amber-600   hover:bg-amber-500',   text: 'text-white' },
  empty: { label: 'Τελείωσε', dot: '#ef4444', bg: 'bg-red-600     hover:bg-red-500',     text: 'text-white' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slotKey(stationId: string, idx: number) { return `${stationId}_${idx}` }
function uid() { return Math.random().toString(36).slice(2, 10) }

function snapV(v: number, enabled: boolean) {
  return enabled ? Math.round(v / GRID) * GRID : v
}

function getSvgPoint(e: MouseEvent | React.MouseEvent, svg: SVGSVGElement) {
  const r = svg.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * SVG_W, y: ((e.clientY - r.top) / r.height) * SVG_H }
}

function normalize(s: any): Station {
  return { icon: '', rotation: 0, shape: 'rect', ...s }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BuffetMap() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  // Map
  const [mapId, setMapId]       = useState<string | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [bgImage, setBgImage]   = useState('')
  const [slots, setSlots]       = useState<SlotsMap>({})
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [tab, setTab]           = useState<'design' | 'assign' | 'live'>('design')

  // Builder
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [addOpen, setAddOpen]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState(COLORS[0]!)
  const [newSlots, setNewSlots] = useState(4)
  const [newIcon, setNewIcon]   = useState('')
  const [newShape, setNewShape] = useState<'rect' | 'circle'>('rect')

  // Assign
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([])
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null)
  const [slotSearch, setSlotSearch] = useState('')

  // QR
  const [qrOpen, setQrOpen]     = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Live tab
  const [liveStatus, setLiveStatus]   = useState<LiveStatusMap>({})
  const [livePopup, setLivePopup]     = useState<LivePopup | null>(null)
  const [liveUpdating, setLiveUpdating] = useState<string | null>(null)

  // Camera scan
  const [scanMode, setScanMode]       = useState<'off' | 'draw'>('off')
  const [drawStart, setDrawStart]     = useState<{x:number;y:number}|null>(null)
  const [drawRect, setDrawRect]       = useState<{x:number;y:number;w:number;h:number}|null>(null)
  const [pendingRect, setPendingRect] = useState<{x:number;y:number;w:number;h:number}|null>(null)
  const [pendingName, setPendingName] = useState('')
  const [aiLoading, setAiLoading]     = useState(false)

  // In-app camera (avoids iOS PWA capture bug)
  const [cameraOpen, setCameraOpen]   = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // Advanced scan: aerial photo + video sweep
  const [advScanStep, setAdvScanStep]     = useState<AdvScanStep>(null)
  const [advCountdown, setAdvCountdown]   = useState(7)
  const [aerialDataUrl, setAerialDataUrl] = useState<string | null>(null)
  const videoRef   = useRef<HTMLVideoElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const scanPurposeRef = useRef<'draw' | 'ai'>('draw')

  const svgRef           = useRef<SVGSVGElement>(null)
  const dragRef          = useRef<DragState | null>(null)
  const bgFileRef        = useRef<HTMLInputElement>(null)   // Φόντο button
  const scanFallbackRef   = useRef<HTMLInputElement>(null)   // getUserMedia fallback
  const advVideoRef       = useRef<HTMLVideoElement>(null)
  const advStreamRef      = useRef<MediaStream | null>(null)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const videoChunksRef    = useRef<Blob[]>([])
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Always-fresh ref for saveLayout
  const latestRef = useRef({ stations, bgImage, mapId, teamId })
  useEffect(() => { latestRef.current = { stations, bgImage, mapId, teamId } })

  // History
  const historyRef = useRef<{ stack: { stations: Station[]; bg: string }[]; idx: number }>({
    stack: [{ stations: [], bg: '' }], idx: 0,
  })

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId) return
    ;(async () => {
      const { data: maps } = await supabase
        .from('buffet_maps').select('*')
        .eq('team_id', teamId).order('created_at', { ascending: false }).limit(1)
      if (maps && maps.length > 0) {
        const m = maps[0]!
        setMapId(m.id)
        const s = ((m.stations as any[]) ?? []).map(normalize)
        setStations(s)
        setBgImage(m.background_image ?? '')
        historyRef.current = { stack: [{ stations: s, bg: m.background_image ?? '' }], idx: 0 }
        const { data: a } = await supabase.from('buffet_map_assignments')
          .select('slots').eq('map_id', m.id).eq('date', TODAY).maybeSingle()
        setSlots((a?.slots as SlotsMap) ?? {})
      }
    })()
  }, [teamId])

  // ── Load menu items ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId || tab !== 'assign') return
    ;(async () => {
      const { data: team } = await supabase.from('teams')
        .select('daily_menu_id').eq('id', teamId).single()
      if (!team?.daily_menu_id) return
      const { data } = await supabase.from('menus')
        .select('menu_sections(menu_items(id,name))').eq('id', team.daily_menu_id).single()
      if (!data) return
      const items: MenuItem[] = ((data as any).menu_sections ?? [])
        .flatMap((s: any) => (s.menu_items ?? []).map((i: any) => ({ id: i.id, name: i.name })))
      setMenuItems(items)
    })()
  }, [teamId, tab])

  // ── Save layout ─────────────────────────────────────────────────────────────

  async function saveLayout(overrides?: { stations?: Station[]; bg?: string }) {
    const { stations: s, bgImage: bg, mapId: mid, teamId: tid } = latestRef.current
    const st = overrides?.stations ?? s
    const bi = overrides?.bg ?? bg
    if (!tid) return
    setSaving(true)
    try {
      if (mid) {
        await supabase.from('buffet_maps')
          .update({ stations: st, background_image: bi || null, updated_at: new Date().toISOString() })
          .eq('id', mid)
      } else {
        const { data } = await supabase.from('buffet_maps')
          .insert({ team_id: tid, name: 'Χάρτης Μπουφέ', stations: st, background_image: bi || null })
          .select('id').single()
        if (data) setMapId(data.id)
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  // ── Save assignments ────────────────────────────────────────────────────────

  async function saveAssignments(updated: SlotsMap) {
    const { mapId: mid, teamId: tid } = latestRef.current
    if (!tid || !mid) return
    await supabase.from('buffet_map_assignments').upsert(
      { map_id: mid, team_id: tid, date: TODAY, slots: updated, updated_at: new Date().toISOString() },
      { onConflict: 'map_id,date' },
    )
  }

  // ── Live status ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!teamId || tab !== 'live') return
    const fetchLive = async () => {
      const { data } = await supabase.from('buffet_live_status')
        .select('menu_item_id, status').eq('team_id', teamId)
      if (!data) return
      const sm: LiveStatusMap = {}
      for (const r of data) sm[r.menu_item_id] = r.status as LiveStatus
      setLiveStatus(sm)
    }
    void fetchLive()
    const interval = setInterval(fetchLive, 5_000)
    return () => clearInterval(interval)
  }, [teamId, tab])

  async function upsertLiveStatus(menuItemId: string, dishName: string, status: LiveStatus) {
    if (!teamId || !profile?.id) return
    setLiveUpdating(menuItemId)
    await supabase.from('buffet_live_status').upsert(
      { team_id: teamId, menu_item_id: menuItemId, item_name: dishName, status,
        status_changed_at: new Date().toISOString(), changed_by: profile.id },
      { onConflict: 'team_id,menu_item_id' },
    )
    setLiveStatus((prev) => ({ ...prev, [menuItemId]: status }))
    setLiveUpdating(null)
    setLivePopup(null)
  }

  // ── History ─────────────────────────────────────────────────────────────────

  function pushHistory(st: Station[], bg: string) {
    const h = historyRef.current
    const stack = [...h.stack.slice(0, h.idx + 1), { stations: st, bg }]
    historyRef.current = { stack, idx: stack.length - 1 }
  }

  function commit(st: Station[], bg?: string) {
    const b = bg ?? latestRef.current.bgImage
    pushHistory(st, b)
    void saveLayout({ stations: st, bg: b })
  }

  function undo() {
    const h = historyRef.current
    if (h.idx <= 0) return
    h.idx -= 1
    const { stations: st, bg } = h.stack[h.idx]!
    setStations(st); setBgImage(bg)
    void saveLayout({ stations: st, bg })
  }

  function redo() {
    const h = historyRef.current
    if (h.idx >= h.stack.length - 1) return
    h.idx += 1
    const { stations: st, bg } = h.stack[h.idx]!
    setStations(st); setBgImage(bg)
    void saveLayout({ stations: st, bg })
  }

  // ── Station management ──────────────────────────────────────────────────────

  function addStation() {
    if (!newName.trim()) return
    const isCircle = newShape === 'circle'
    const w = Math.max(120, newSlots * 80)
    const s: Station = {
      id: uid(), name: newName.trim(), icon: newIcon, shape: newShape,
      x: snapV(40 + Math.floor(Math.random() * 300), snapEnabled),
      y: snapV(60 + Math.floor(Math.random() * 200), snapEnabled),
      width: w, height: isCircle ? w : 70,
      color: newColor, slotCount: newSlots, rotation: 0,
    }
    const next = [...stations, s]
    setStations(next); commit(next)
    setSelectedId(s.id); setNewName(''); setNewIcon(''); setAddOpen(false)
  }

  function deleteSelected() {
    if (!selectedId) return
    const next = stations.filter((s) => s.id !== selectedId)
    setStations(next); commit(next); setSelectedId(null)
  }

  function duplicateSelected() {
    if (!selectedId) return
    const orig = stations.find((s) => s.id === selectedId)
    if (!orig) return
    const copy: Station = { ...orig, id: uid(), x: orig.x + 30, y: orig.y + 30 }
    const next = [...stations, copy]
    setStations(next); commit(next); setSelectedId(copy.id)
  }

  function updateSelected(patch: Partial<Station>) {
    setStations((prev) => prev.map((s) => s.id === selectedId ? { ...s, ...patch } : s))
  }

  function alignSelected(type: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') {
    if (!selectedId) return
    const next = stations.map((s) => {
      if (s.id !== selectedId) return s
      switch (type) {
        case 'left':    return { ...s, x: 0 }
        case 'centerH': return { ...s, x: (SVG_W - s.width) / 2 }
        case 'right':   return { ...s, x: SVG_W - s.width }
        case 'top':     return { ...s, y: 20 }
        case 'centerV': return { ...s, y: (SVG_H - s.height) / 2 }
        case 'bottom':  return { ...s, y: SVG_H - s.height }
        default:        return s
      }
    })
    setStations(next); commit(next)
  }

  // ── SVG drag ─────────────────────────────────────────────────────────────────

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

  function onRotateMouseDown(e: React.MouseEvent, station: Station) {
    e.stopPropagation()
    if (!svgRef.current) return
    const pt = getSvgPoint(e, svgRef.current)
    dragRef.current = {
      stationId: station.id, type: 'rotate',
      startX: pt.x, startY: pt.y,
      origX: station.x, origY: station.y,
      origW: station.width, origH: station.height,
      origRotation: station.rotation,
      centerX: station.x + station.width / 2,
      centerY: station.y + station.height / 2,
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
        x: snapV(Math.max(0, Math.min(SVG_W - s.width, d.origX + dx)), snapEnabled),
        y: snapV(Math.max(20, Math.min(SVG_H - s.height, d.origY + dy)), snapEnabled),
      }
      if (d.type === 'resize') return {
        ...s,
        width:  snapV(Math.max(80, d.origW + dx), snapEnabled),
        height: snapV(Math.max(44, d.origH + dy), snapEnabled),
      }
      if (d.type === 'rotate') {
        const angle = Math.atan2(pt.y - d.centerY!, pt.x - d.centerX!) * 180 / Math.PI + 90
        const norm  = ((angle % 360) + 360) % 360
        return { ...s, rotation: snapEnabled ? Math.round(norm / 15) * 15 : Math.round(norm) }
      }
      return s
    }))
  }

  function onSvgMouseUp() {
    if (dragRef.current) {
      dragRef.current = null
      commit(latestRef.current.stations)
    }
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inInput = ['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)
      if (e.key === 'Escape') setSelectedId(null)
      if (!inInput && (e.key === 'Delete' || e.key === 'Backspace') && selectedId) deleteSelected()
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelected() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, stations])

  // ── Export PNG ───────────────────────────────────────────────────────────────

  function exportPNG() {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const img  = document.createElement('img')
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = SVG_W; canvas.height = SVG_H
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png'); a.download = 'buffet-map.png'; a.click()
    }
    img.src = url
  }

  // ── Background image ─────────────────────────────────────────────────────────

  function handleBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      setBgImage(url)
      commit(latestRef.current.stations, url)
    }
    reader.readAsDataURL(file)
  }

  // ── Camera scan / Draw mode ──────────────────────────────────────────────────

  async function openCamera(purpose: 'draw' | 'ai') {
    scanPurposeRef.current = purpose
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      setCameraReady(false)
      setCameraOpen(true)
      // Attach stream after modal mounts (next tick)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch {
      // getUserMedia not available or denied — fall back to file input
      scanFallbackRef.current?.click()
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOpen(false)
    setCameraReady(false)
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    closeCamera()
    if (scanPurposeRef.current === 'draw') {
      setBgImage(dataUrl)
      commit(latestRef.current.stations, dataUrl)
      setScanMode('draw')
    } else {
      canvas.toBlob((blob) => {
        if (!blob) return
        const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
        void runAiScan(file, dataUrl)
      }, 'image/jpeg', 0.92)
    }
  }

  function handleBgFileForScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      if (scanPurposeRef.current === 'draw') {
        setBgImage(url)
        commit(latestRef.current.stations, url)
        setScanMode('draw')
      } else {
        void runAiScan(file, url)
      }
    }
    reader.readAsDataURL(file)
  }

  async function runAiScan(file: File, dataUrl: string) {
    setAiLoading(true)
    try {
      const base64 = dataUrl.split(',')[1] ?? ''
      const { data, error } = await supabase.functions.invoke('detect-buffet-stations', {
        body: { imageBase64: base64, mimeType: file.type || 'image/jpeg' },
      })
      if (error || !data?.stations?.length) {
        alert('Η AI ανίχνευση δεν βρήκε σταθμούς. Δοκίμασε ξανά ή σχεδίασε χειροκίνητα.')
        return
      }
      const detected: Station[] = (data.stations as any[]).map((s, i) => ({
        id: uid(),
        name: s.name || `Σταθμός ${i + 1}`,
        icon: '',
        x: Math.max(0, Math.min(SVG_W - 120, Math.round(s.x))),
        y: Math.max(20, Math.min(SVG_H - 70, Math.round(s.y))),
        width:  Math.max(120, Math.min(SVG_W - 40, Math.round(s.width))),
        height: Math.max(60,  Math.min(200, Math.round(s.height))),
        color: COLORS[i % COLORS.length]!,
        slotCount: Math.max(1, Math.min(8, s.slotCount || 4)),
        rotation: 0,
        shape: 'rect' as const,
      }))
      setBgImage(dataUrl)
      setStations(detected)
      commit(detected, dataUrl)
    } catch (err) {
      console.error(err)
      alert('Σφάλμα κατά την AI ανίχνευση.')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Advanced scan (aerial + video sweep) ────────────────────────────────────

  function sharpnessScore(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let sum = 0, sumSq = 0, n = 0
    for (let i = 0; i < data.length; i += 16) {
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
      sum += lum; sumSq += lum * lum; n++
    }
    const mean = sum / n
    return sumSq / n - mean * mean
  }

  async function extractBestFrames(videoBlob: Blob, count: number): Promise<string[]> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.muted = true
      const objectUrl = URL.createObjectURL(videoBlob)
      video.src = objectUrl
      video.onloadedmetadata = async () => {
        const duration = video.duration
        const sampleCount = Math.min(8, Math.max(count * 2, 4))
        const timestamps = Array.from({ length: sampleCount }, (_, i) => (i + 0.5) * duration / sampleCount)
        const frames: { dataUrl: string; score: number }[] = []
        for (const t of timestamps) {
          await new Promise<void>((r) => {
            video.currentTime = t
            video.onseeked = () => {
              const canvas = document.createElement('canvas')
              const scale = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight))
              canvas.width  = Math.round(video.videoWidth  * scale)
              canvas.height = Math.round(video.videoHeight * scale)
              canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
              frames.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.78), score: sharpnessScore(canvas) })
              r()
            }
          })
        }
        URL.revokeObjectURL(objectUrl)
        frames.sort((a, b) => b.score - a.score)
        resolve(frames.slice(0, count).map(f => f.dataUrl))
      }
      video.load()
    })
  }

  async function openAdvancedScan() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      advStreamRef.current = stream
      setAdvScanStep('aerial')
      setAdvCountdown(5)
      setTimeout(() => {
        if (advVideoRef.current) {
          advVideoRef.current.srcObject = stream
          advVideoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch {
      alert('Η κάμερα δεν είναι διαθέσιμη ή δεν δόθηκε άδεια.')
    }
  }

  function captureAerialAndProceed() {
    const video = advVideoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width  = Math.round(video.videoWidth  * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    setAerialDataUrl(dataUrl)
    setAdvScanStep('video')
    setAdvCountdown(5)
    startVideoRecording()
  }

  function startVideoRecording() {
    const stream = advStreamRef.current
    if (!stream) return
    videoChunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = recorder
    recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data) }
    recorder.onstop = () => { void processAdvancedScan() }
    recorder.start(100)
    let remaining = 5
    const timer = setInterval(() => {
      remaining--
      setAdvCountdown(remaining)
      if (remaining <= 0) { clearInterval(timer); stopAdvancedRecording() }
    }, 1000)
    countdownTimerRef.current = timer
  }

  function stopAdvancedRecording() {
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    advStreamRef.current?.getTracks().forEach((t) => t.stop())
    advStreamRef.current = null
    setAdvScanStep('processing')
  }

  async function processAdvancedScan() {
    const aerial = aerialDataUrl
    if (!aerial) { setAdvScanStep(null); return }
    try {
      const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' })
      const groundUrls = await extractBestFrames(videoBlob, 3)
      const images = [
        { imageBase64: aerial.split(',')[1] ?? '', mimeType: 'image/jpeg', role: 'aerial' as const },
        ...groundUrls.map(url => ({ imageBase64: url.split(',')[1] ?? '', mimeType: 'image/jpeg', role: 'ground' as const })),
      ]
      const { data, error } = await supabase.functions.invoke('detect-buffet-stations', { body: { images } })
      if (error || !data?.stations?.length) {
        alert('Η AI ανίχνευση δεν βρήκε σταθμούς. Δοκίμασε ξανά.')
        return
      }
      const detected: Station[] = (data.stations as any[]).map((s, i) => ({
        id: uid(), name: s.name || `Σταθμός ${i + 1}`, icon: '',
        x: Math.max(0, Math.min(SVG_W - 120, Math.round(s.x))),
        y: Math.max(20, Math.min(SVG_H - 70, Math.round(s.y))),
        width:  Math.max(120, Math.min(SVG_W - 40, Math.round(s.width))),
        height: Math.max(60,  Math.min(200, Math.round(s.height))),
        color: COLORS[i % COLORS.length]!, slotCount: Math.max(1, Math.min(8, s.slotCount || 4)),
        rotation: 0, shape: 'rect' as const,
      }))
      setBgImage(aerial)
      setStations(detected)
      commit(detected, aerial)
    } catch (err) {
      console.error(err)
      alert('Σφάλμα κατά την AI επεξεργασία.')
    } finally {
      setAdvScanStep(null)
      setAerialDataUrl(null)
      videoChunksRef.current = []
    }
  }

  function cancelAdvancedScan() {
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    advStreamRef.current?.getTracks().forEach((t) => t.stop())
    advStreamRef.current = null
    mediaRecorderRef.current = null
    videoChunksRef.current = []
    setAdvScanStep(null)
    setAerialDataUrl(null)
    setAdvCountdown(5)
  }

  // ── Draw mode ────────────────────────────────────────────────────────────────

  function onDrawMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || pendingRect) return
    const pt = getSvgPoint(e, svgRef.current)
    setDrawStart(pt)
    setDrawRect({ x: pt.x, y: pt.y, w: 0, h: 0 })
  }

  function onDrawMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawStart || !svgRef.current) return
    const pt = getSvgPoint(e, svgRef.current)
    setDrawRect({
      x: Math.min(drawStart.x, pt.x),
      y: Math.min(drawStart.y, pt.y),
      w: Math.abs(pt.x - drawStart.x),
      h: Math.abs(pt.y - drawStart.y),
    })
  }

  function onDrawMouseUp() {
    if (drawRect && drawRect.w >= 40 && drawRect.h >= 30) {
      setPendingRect(drawRect)
      setPendingName('')
    }
    setDrawRect(null)
    setDrawStart(null)
  }

  function confirmPendingStation() {
    if (!pendingRect || !pendingName.trim()) return
    const s: Station = {
      id: uid(), name: pendingName.trim(), icon: '',
      x: snapV(pendingRect.x, snapEnabled),
      y: snapV(pendingRect.y, snapEnabled),
      width:  snapV(Math.max(120, pendingRect.w), snapEnabled),
      height: snapV(Math.max(60,  pendingRect.h), snapEnabled),
      color: COLORS[stations.length % COLORS.length]!,
      slotCount: Math.max(1, Math.round(pendingRect.w / 80)),
      rotation: 0, shape: 'rect',
    }
    const next = [...stations, s]
    setStations(next); commit(next)
    setSelectedId(s.id)
    setPendingRect(null); setPendingName('')
  }

  // ── QR ───────────────────────────────────────────────────────────────────────

  async function openQr() {
    if (!teamId) return
    const url = `${window.location.origin}/buffet-map/${teamId}`
    const dataUrl = await QRCodeLib.toDataURL(url, { width: 512, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    setQrDataUrl(dataUrl); setQrOpen(true)
  }

  // ── Assign ───────────────────────────────────────────────────────────────────

  function assignDish(item: MenuItem) {
    if (!activeSlot) return
    const key = slotKey(activeSlot.stationId, activeSlot.slotIndex)
    const updated = { ...slots, [key]: { menuItemId: item.id, dishName: item.name } }
    setSlots(updated); void saveAssignments(updated)
    setActiveSlot(null); setSlotSearch('')
  }

  function clearSlot(stationId: string, slotIndex: number) {
    const key = slotKey(stationId, slotIndex)
    const updated = { ...slots }; delete updated[key]
    setSlots(updated); void saveAssignments(updated)
  }

  const selected       = stations.find((s) => s.id === selectedId) ?? null
  const filteredItems  = menuItems.filter((i) => i.name.toLowerCase().includes(slotSearch.toLowerCase()))
  const canUndo        = historyRef.current.idx > 0
  const canRedo        = historyRef.current.idx < historyRef.current.stack.length - 1

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <Map className="h-7 w-7 text-brand-orange" />Χάρτης Μπουφέ
          </h1>
          <p className="text-white/60 mt-1">Σχεδίασε τον χώρο σου και τοποθέτησε τα φαγητά</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" leftIcon={<QrCode className="h-4 w-4" />} onClick={openQr}>QR Χάρτη</Button>
          <Button leftIcon={<Save className="h-4 w-4" />} onClick={() => void saveLayout()} disabled={saving}>
            {saved ? '✓ Αποθηκεύτηκε' : saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
        {(['design', 'assign', 'live'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setLivePopup(null) }} className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition',
            tab === t ? 'bg-brand-orange text-white' : 'text-white/60 hover:text-white',
          )}>
            {t === 'design'
              ? <span className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Σχεδιασμός</span>
              : t === 'assign'
              ? <span className="flex items-center gap-1.5"><ChefHat className="h-3.5 w-3.5" />Διάταξη Φαγητών</span>
              : <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Ζωντανά</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* Canvas */}
        <GlassCard className="flex-1 overflow-hidden p-0 relative">
          {/* Toolbar */}
          <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/10 flex-wrap">
            {tab === 'design' && (
              <>
                <button onClick={() => setAddOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-orange/15 text-brand-orange hover:bg-brand-orange/25 transition text-xs font-medium">
                  <Plus className="h-3.5 w-3.5" />Νέος Σταθμός
                </button>
                <button onClick={duplicateSelected} disabled={!selectedId}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition text-xs font-medium disabled:opacity-30">
                  <Copy className="h-3.5 w-3.5" />Αντιγραφή
                </button>
                <button onClick={deleteSelected} disabled={!selectedId}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-xs font-medium disabled:opacity-30">
                  <Trash2 className="h-3.5 w-3.5" />Διαγραφή
                </button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button onClick={undo} disabled={!canUndo} title="Ctrl+Z"
                  className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition disabled:opacity-30">
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={redo} disabled={!canRedo} title="Ctrl+Y"
                  className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition disabled:opacity-30">
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button onClick={() => setSnapEnabled((v) => !v)} title="Snap to grid"
                  className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition text-xs font-medium',
                    snapEnabled ? 'bg-brand-orange/20 text-brand-orange' : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10')}>
                  <Grid3x3 className="h-3.5 w-3.5" />{snapEnabled ? 'Snap ON' : 'Snap OFF'}
                </button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button onClick={() => bgFileRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition text-xs font-medium">
                  <Image className="h-3.5 w-3.5" />Φόντο
                </button>
                <button onClick={exportPNG}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition text-xs font-medium">
                  <Download className="h-3.5 w-3.5" />Export PNG
                </button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                {/* Scan buttons — use in-app camera to avoid iOS PWA redirect bug */}
                <button
                  onClick={() => { if (scanMode === 'draw') setScanMode('off'); else void openCamera('draw') }}
                  className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition text-xs font-medium',
                    scanMode === 'draw'
                      ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10')}>
                  <Camera className="h-3.5 w-3.5" />
                  {scanMode === 'draw' ? 'Τέλος Σχεδίου' : 'Σκανάρισμα'}
                </button>
                <button
                  onClick={() => void openCamera('ai')}
                  disabled={aiLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 transition text-xs font-medium disabled:opacity-50">
                  <Wand2 className="h-3.5 w-3.5" />
                  {aiLoading ? 'Ανίχνευση…' : 'AI Ανίχνευση'}
                </button>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button
                  onClick={() => void openAdvancedScan()}
                  disabled={aiLoading || advScanStep !== null}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500/15 text-teal-400 hover:bg-teal-500/25 transition text-xs font-medium disabled:opacity-50">
                  <ScanLine className="h-3.5 w-3.5" />
                  Σάρωση χώρου
                </button>
                {/* Background file input (Φόντο button) */}
                <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgFile} />
                {/* Fallback file input (used only when getUserMedia unavailable) */}
                <input ref={scanFallbackRef} type="file" accept="image/*" className="hidden" onChange={handleBgFileForScan} />
              </>
            )}
            {tab === 'assign' && (
              <span className="text-sm text-white/60">
                Κλικ σε θέση → επιλογή φαγητού
                {menuItems.length === 0 && <span className="ml-3 text-amber-400 text-xs">⚠ Ορίσε πρώτα Μενού Ημέρας</span>}
              </span>
            )}
            {tab === 'live' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/60">Κλικ σε θέση → αλλαγή κατάστασης</span>
                <div className="flex items-center gap-2 ml-2">
                  {(Object.entries(LIVE_STATUS_CFG) as [LiveStatus, typeof LIVE_STATUS_CFG[LiveStatus]][]).map(([, cfg]) => (
                    <span key={cfg.label} className="flex items-center gap-1 text-xs text-white/50">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cfg.dot }}/>
                      {cfg.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Draw mode banner */}
          {scanMode === 'draw' && (
            <div className="flex items-center justify-between px-3 py-2 bg-cyan-500/10 border-b border-cyan-500/20">
              <span className="text-xs text-cyan-300 font-medium">
                ✏️ Σχεδίασε ορθογώνια πάνω στη φωτογραφία — κάθε ορθογώνιο γίνεται σταθμός
              </span>
              <button onClick={() => setScanMode('off')}
                className="text-xs text-cyan-400 hover:text-white transition px-2 py-0.5 rounded-md hover:bg-white/10">
                Τέλος
              </button>
            </div>
          )}

          {/* SVG Canvas */}
          <div className="relative w-full" style={{ paddingBottom: `${(SVG_H / SVG_W) * 100}%` }}>
            {/* Pending station name popup */}
            {pendingRect && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="bg-[#0d1520] border border-white/20 rounded-xl p-4 space-y-3 shadow-2xl" style={{ width: 260 }}>
                  <p className="text-sm font-semibold text-white">Όνομα σταθμού</p>
                  <input autoFocus value={pendingName}
                    onChange={(e) => setPendingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmPendingStation(); if (e.key === 'Escape') setPendingRect(null) }}
                    placeholder="π.χ. Σαλάτες, Ψητά…"
                    className="w-full rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-brand-orange/60"/>
                  <div className="flex gap-2">
                    <button onClick={confirmPendingStation} disabled={!pendingName.trim()}
                      className="flex-1 py-1.5 rounded-lg bg-brand-orange text-white text-sm font-medium disabled:opacity-40 transition hover:bg-brand-orange/90">
                      Προσθήκη
                    </button>
                    <button onClick={() => setPendingRect(null)}
                      className="flex-1 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm transition hover:bg-white/15">
                      Ακύρωση
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Live popup overlay */}
            {livePopup && tab === 'live' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="bg-[#0d1520] border border-white/20 rounded-xl p-4 space-y-3 shadow-2xl" style={{ width: 240 }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white leading-tight">{livePopup.dishName}</p>
                    <button onClick={() => setLivePopup(null)} className="text-white/40 hover:text-white text-lg leading-none shrink-0">×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.entries(LIVE_STATUS_CFG) as [LiveStatus, typeof LIVE_STATUS_CFG[LiveStatus]][]).map(([s, cfg]) => {
                      const isCurrent = liveStatus[livePopup.menuItemId] === s
                      const isUpdating = liveUpdating === livePopup.menuItemId
                      return (
                        <button key={s} disabled={isUpdating}
                          onClick={() => void upsertLiveStatus(livePopup.menuItemId, livePopup.dishName, s)}
                          className={cn(
                            'py-2 rounded-lg text-xs font-bold transition text-white text-center',
                            cfg.bg,
                            isCurrent ? 'ring-2 ring-white/60 scale-105' : 'opacity-70 hover:opacity-100',
                            isUpdating && 'opacity-40 cursor-not-allowed',
                          )}>
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="absolute inset-0 w-full h-full select-none"
              style={{ background: '#070c12', cursor: tab === 'design' ? (scanMode === 'draw' ? 'crosshair' : 'default') : 'default' }}
              onMouseDown={tab === 'design' && scanMode === 'draw' ? onDrawMouseDown : undefined}
              onMouseMove={tab === 'design' ? (scanMode === 'draw' ? onDrawMouseMove : onSvgMouseMove) : undefined}
              onMouseUp={tab === 'design' ? (scanMode === 'draw' ? onDrawMouseUp : onSvgMouseUp) : undefined}
              onMouseLeave={tab === 'design' ? (scanMode === 'draw' ? onDrawMouseUp : onSvgMouseUp) : undefined}
              onClick={(e) => { if ((e.target as SVGElement).tagName === 'svg') { setSelectedId(null); setLivePopup(null) } }}
            >
              <defs>
                <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>
                </pattern>
                {stations.map((s) => (
                  <filter key={s.id} id={`glow-${s.id}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                ))}
                {stations.map((s) => (
                  <clipPath key={`clip-${s.id}`} id={`clip-${s.id}`}>
                    {s.shape === 'circle'
                      ? <ellipse cx={s.x + s.width/2} cy={s.y + s.height/2} rx={s.width/2 - 2} ry={s.height/2 - 2}/>
                      : <rect x={s.x + 1} y={s.y + 1} width={s.width - 2} height={s.height - 2} rx="7"/>}
                  </clipPath>
                ))}
              </defs>

              <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

              {/* Background image */}
              {bgImage && (
                <image href={bgImage} x="0" y="0" width={SVG_W} height={SVG_H}
                  preserveAspectRatio="xMidYMid slice"
                  opacity={tab === 'live' ? 0.45 : scanMode === 'draw' ? 0.55 : 0.25}
                  style={{ pointerEvents: 'none' }}/>
              )}

              {/* Draw mode: rectangle preview */}
              {scanMode === 'draw' && drawRect && drawRect.w > 5 && drawRect.h > 5 && (
                <rect x={drawRect.x} y={drawRect.y} width={drawRect.w} height={drawRect.h}
                  fill="rgba(6,182,212,0.12)" stroke="#06b6d4" strokeWidth="2" strokeDasharray="6 3" rx="6"
                  style={{ pointerEvents: 'none' }}/>
              )}

              {stations.map((s) => {
                const isSelected = selectedId === s.id && tab === 'design'
                const cx = s.x + s.width / 2
                const cy = s.y + s.height / 2
                const slotW = s.width / s.slotCount

                return (
                  <g key={s.id} transform={`rotate(${s.rotation},${cx},${cy})`} filter={`url(#glow-${s.id})`}>
                    {/* Station outline */}
                    {s.shape === 'circle' ? (
                      <ellipse cx={cx} cy={cy} rx={s.width/2} ry={s.height/2}
                        fill={`${s.color}18`} stroke={s.color}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeDasharray={isSelected ? '6 3' : undefined}
                        style={{ cursor: tab === 'design' ? 'move' : 'default' }}
                        onMouseDown={tab === 'design' && scanMode !== 'draw' ? (e) => onStationMouseDown(e, s) : undefined}/>
                    ) : (
                      <rect x={s.x} y={s.y} width={s.width} height={s.height} rx="8"
                        fill={`${s.color}18`} stroke={s.color}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeDasharray={isSelected ? '6 3' : undefined}
                        style={{ cursor: tab === 'design' && scanMode !== 'draw' ? 'move' : 'default' }}
                        onMouseDown={tab === 'design' && scanMode !== 'draw' ? (e) => onStationMouseDown(e, s) : undefined}/>
                    )}

                    {/* Station label */}
                    <text x={cx} y={s.y - 7} textAnchor="middle"
                      fill={s.color} fontSize="11" fontWeight="700" letterSpacing="0.5"
                      fontFamily="'Apple Color Emoji','Segoe UI Emoji','Plus Jakarta Sans',sans-serif"
                      style={{ textTransform: 'uppercase', pointerEvents: 'none' }}>
                      {s.icon ? `${s.icon} ${s.name}` : s.name}
                    </text>

                    {/* Slots (clipped) */}
                    <g clipPath={`url(#clip-${s.id})`}>
                      {Array.from({ length: s.slotCount }).map((_, i) => {
                        const key        = slotKey(s.id, i)
                        const assignment = slots[key]
                        const sx         = s.x + i * slotW

                        return (
                          <g key={i}>
                            {i > 0 && (
                              <line x1={sx} y1={s.y + 6} x2={sx} y2={s.y + s.height - 6}
                                stroke={s.color} strokeWidth="0.5" strokeOpacity="0.3"
                                style={{ pointerEvents: 'none' }}/>
                            )}

                            {tab === 'assign' && (
                              <rect x={sx + 1} y={s.y + 1} width={slotW - 2} height={s.height - 2} rx="6"
                                fill={activeSlot?.stationId === s.id && activeSlot?.slotIndex === i
                                  ? `${s.color}35` : 'transparent'}
                                stroke={activeSlot?.stationId === s.id && activeSlot?.slotIndex === i
                                  ? s.color : 'transparent'}
                                strokeWidth="1.5" style={{ cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); setActiveSlot({ stationId: s.id, slotIndex: i }); setSlotSearch('') }}/>
                            )}

                            <text x={sx + slotW / 2} y={s.y + s.height / 2 + 5}
                              textAnchor="middle" fill="white" fontSize="9.5"
                              opacity={assignment ? 0.85 : 0.25}
                              style={{ pointerEvents: 'none' }}>
                              {assignment?.dishName ?? `${i + 1}`}
                            </text>

                            {tab === 'assign' && assignment && (
                              <g style={{ cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); clearSlot(s.id, i) }}>
                                <circle cx={sx + slotW - 10} cy={s.y + 11} r="7"
                                  fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.5)" strokeWidth="0.8"/>
                                <text x={sx + slotW - 10} y={s.y + 15.5} textAnchor="middle"
                                  fill="#f87171" fontSize="9" fontWeight="bold">×</text>
                              </g>
                            )}

                            {/* Live tab: clickable slot overlay + status dot */}
                            {tab === 'live' && assignment && (() => {
                              const st = liveStatus[assignment.menuItemId]
                              const dotColor = st ? LIVE_STATUS_CFG[st].dot : '#6b7280'
                              const isActive = livePopup?.stationId === s.id && livePopup?.slotIndex === i
                              return (
                                <>
                                  <rect x={sx + 1} y={s.y + 1} width={slotW - 2} height={s.height - 2} rx="6"
                                    fill={isActive ? `${s.color}25` : 'transparent'}
                                    stroke={isActive ? s.color : 'transparent'} strokeWidth="1.5"
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); setLivePopup({ stationId: s.id, slotIndex: i, menuItemId: assignment.menuItemId, dishName: assignment.dishName }) }}/>
                                  <circle cx={sx + slotW - 9} cy={s.y + 10} r="5" fill={dotColor} opacity="0.9"
                                    style={{ pointerEvents: 'none' }}/>
                                </>
                              )
                            })()}
                          </g>
                        )
                      })}
                    </g>

                    {/* Design-mode handles */}
                    {tab === 'design' && isSelected && (
                      <>
                        {/* Resize handle */}
                        <rect x={s.x + s.width - 12} y={s.y + s.height - 12}
                          width="12" height="12" rx="3"
                          fill={s.color} opacity="0.6" style={{ cursor: 'se-resize' }}
                          onMouseDown={(e) => onResizeMouseDown(e, s)}/>
                        {/* Rotate handle */}
                        <line x1={cx} y1={s.y} x2={cx} y2={s.y - 22}
                          stroke={s.color} strokeWidth="1.5" strokeDasharray="3 2"
                          style={{ pointerEvents: 'none' }}/>
                        <circle cx={cx} cy={s.y - 24} r="8"
                          fill={s.color} opacity="0.75" style={{ cursor: 'grab' }}
                          onMouseDown={(e) => onRotateMouseDown(e, s)}/>
                        <text x={cx} y={s.y - 19} textAnchor="middle"
                          fill="white" fontSize="10" fontWeight="bold"
                          style={{ pointerEvents: 'none' }}>↻</text>
                      </>
                    )}
                  </g>
                )
              })}

              {stations.length === 0 && (
                <g>
                  <text x={SVG_W/2} y={SVG_H/2 - 14} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14">
                    Δεν υπάρχουν σταθμοί ακόμα
                  </text>
                  <text x={SVG_W/2} y={SVG_H/2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.1)" fontSize="11">
                    Πάτα «Νέος Σταθμός» για να αρχίσεις
                  </text>
                </g>
              )}
            </svg>
          </div>
        </GlassCard>

        {/* Right panel */}
        <div className="w-64 shrink-0 space-y-3">

          {/* Design: selected station */}
          {tab === 'design' && selected && (
            <GlassCard className="space-y-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Σταθμός</h3>

              <input value={selected.name}
                onChange={(e) => updateSelected({ name: e.target.value })}
                onBlur={() => commit(latestRef.current.stations)}
                className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-orange/60"
                placeholder="Όνομα"/>

              {/* Emoji icon */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/40">Εικονίδιο</label>
                <input value={selected.icon}
                  onChange={(e) => updateSelected({ icon: e.target.value })}
                  onBlur={() => commit(latestRef.current.stations)}
                  className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-orange/60"
                  placeholder="Emoji π.χ. 🥗"/>
                <div className="flex flex-wrap gap-1">
                  {QUICK_EMOJIS.map((em) => (
                    <button key={em} onClick={() => { updateSelected({ icon: em }); commit([...latestRef.current.stations.filter(s => s.id !== selected.id), { ...selected, icon: em }].sort((a,b) => stations.findIndex(s=>s.id===a.id) - stations.findIndex(s=>s.id===b.id))) }}
                      className="text-base hover:scale-125 transition-transform leading-none p-0.5">{em}</button>
                  ))}
                </div>
              </div>

              {/* Shape */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/40">Σχήμα</label>
                <div className="flex gap-2">
                  {(['rect', 'circle'] as const).map((sh) => (
                    <button key={sh} onClick={() => { updateSelected({ shape: sh }); commit(latestRef.current.stations) }}
                      className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition border',
                        selected.shape === sh ? 'bg-brand-orange border-brand-orange text-white' : 'border-white/15 text-white/50 hover:text-white hover:bg-white/5')}>
                      {sh === 'rect' ? '▭ Ορθ.' : '⬤ Κύκλος'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => { updateSelected({ color: c }); commit(latestRef.current.stations) }}
                    className={cn('h-6 w-6 rounded-full transition', selected.color === c ? 'ring-2 ring-white scale-110' : '')}
                    style={{ background: c }}/>
                ))}
              </div>

              {/* Slots & Rotation */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Θέσεις</label>
                  <input type="number" min="1" max="12" value={selected.slotCount}
                    onChange={(e) => { const n = Math.max(1, Math.min(12, Number(e.target.value))); updateSelected({ slotCount: n, width: Math.max(80, n * 80) }) }}
                    onBlur={() => commit(latestRef.current.stations)}
                    className="w-full rounded-lg px-2 py-1.5 bg-white/5 border border-white/10 text-white text-center text-sm focus:outline-none"/>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Γωνία °</label>
                  <input type="number" min="0" max="360" value={Math.round(selected.rotation)}
                    onChange={(e) => { updateSelected({ rotation: Number(e.target.value) }) }}
                    onBlur={() => commit(latestRef.current.stations)}
                    className="w-full rounded-lg px-2 py-1.5 bg-white/5 border border-white/10 text-white text-center text-sm focus:outline-none"/>
                </div>
              </div>

              {/* Align */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/40">Ευθυγράμμιση</label>
                <div className="grid grid-cols-3 gap-1">
                  {([
                    ['left','left',<AlignLeft className="h-3.5 w-3.5"/>],
                    ['centerH','center-h',<AlignCenter className="h-3.5 w-3.5"/>],
                    ['right','right',<AlignRight className="h-3.5 w-3.5"/>],
                    ['top','top',<AlignStartVertical className="h-3.5 w-3.5"/>],
                    ['centerV','center-v',<AlignCenterVertical className="h-3.5 w-3.5"/>],
                    ['bottom','bottom',<AlignEndVertical className="h-3.5 w-3.5"/>],
                  ] as [Parameters<typeof alignSelected>[0], string, React.ReactNode][]).map(([a, , icon]) => (
                    <button key={a} onClick={() => alignSelected(a)}
                      className="flex items-center justify-center h-7 rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition">
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={deleteSelected}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm text-red-400 hover:bg-red-500/10 transition">
                <Trash2 className="h-3.5 w-3.5" />Διαγραφή
              </button>
            </GlassCard>
          )}

          {/* Design: nothing selected */}
          {tab === 'design' && !selected && (
            <GlassCard className="space-y-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Καμβάς</h3>
              <div className="space-y-1.5">
                <label className="text-xs text-white/40">URL Φόντου</label>
                <input value={bgImage} onChange={(e) => setBgImage(e.target.value)}
                  onBlur={() => commit(latestRef.current.stations, bgImage)}
                  placeholder="https://…" className="w-full rounded-lg px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-orange/60"/>
              </div>
              {bgImage && (
                <button onClick={() => { setBgImage(''); commit(latestRef.current.stations, '') }}
                  className="w-full text-xs text-red-400 hover:text-red-300 transition">✕ Αφαίρεση φόντου</button>
              )}
              <p className="text-xs text-white/30 text-center">Κλικ σε σταθμό<br/>για επεξεργασία</p>
            </GlassCard>
          )}

          {/* Assign: dish picker */}
          {tab === 'assign' && activeSlot && (
            <GlassCard className="space-y-3">
              <h3 className="text-sm font-semibold text-white/80">Επιλογή φαγητού</h3>
              <input autoFocus value={slotSearch} onChange={(e) => setSlotSearch(e.target.value)}
                placeholder="Αναζήτηση…"
                className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:border-brand-orange/60"/>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredItems.length === 0 && <p className="text-xs text-white/40 text-center py-4">Δεν βρέθηκαν</p>}
                {filteredItems.map((item) => (
                  <button key={item.id} onClick={() => assignDish(item)}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition">
                    {item.name}
                  </button>
                ))}
              </div>
              <button onClick={() => setActiveSlot(null)} className="w-full text-xs text-white/40 hover:text-white/60 transition">Ακύρωση</button>
            </GlassCard>
          )}

          {tab === 'assign' && !activeSlot && (
            <GlassCard className="text-center py-6">
              <p className="text-xs text-white/40">Κλικ σε θέση<br/>για ανάθεση φαγητού</p>
            </GlassCard>
          )}

          {/* Live: status summary */}
          {tab === 'live' && (
            <GlassCard className="space-y-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-3 w-3" />Live Status
              </h3>
              {stations.flatMap((s) =>
                Array.from({ length: s.slotCount }, (_, i) => {
                  const assignment = slots[slotKey(s.id, i)]
                  if (!assignment) return null
                  const st = liveStatus[assignment.menuItemId]
                  const cfg = st ? LIVE_STATUS_CFG[st] : null
                  return (
                    <div key={`${s.id}_${i}`} className="flex items-center gap-2 py-0.5">
                      <span className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ background: cfg?.dot ?? '#6b7280' }}/>
                      <span className="text-xs text-white/70 truncate flex-1 min-w-0">{assignment.dishName}</span>
                      {cfg && <span className="text-[10px] text-white/40 shrink-0">{cfg.label}</span>}
                    </div>
                  )
                })
              ).filter(Boolean)}
              {Object.keys(slots).length === 0 && (
                <p className="text-xs text-white/30 text-center py-2">Δεν υπάρχουν ανατεθειμένα φαγητά</p>
              )}
            </GlassCard>
          )}

          {/* Stats */}
          <GlassCard className="space-y-1 text-xs text-white/50">
            <p>Σταθμοί: <span className="text-white/80">{stations.length}</span></p>
            <p>Θέσεις: <span className="text-white/80">{stations.reduce((a, s) => a + s.slotCount, 0)}</span></p>
            <p>Ανατεθειμένα: <span className="text-white/80">{Object.keys(slots).length}</span></p>
            <p className="text-white/25 pt-1">Ctrl+Z Αναίρεση · Ctrl+D Αντιγραφή</p>
          </GlassCard>
        </div>
      </div>

      {/* Add station drawer */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Νέος Σταθμός">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-white/70">Όνομα σταθμού</label>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStation()}
              placeholder="π.χ. Σαλάτες, Ζεστά Πιάτα…"
              className="w-full rounded-xl px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"/>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">Εικονίδιο (emoji)</label>
            <input value={newIcon} onChange={(e) => setNewIcon(e.target.value)}
              placeholder="Επέλεξε ή γράψε emoji"
              className="w-full rounded-xl px-3 py-2 text-sm bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50"/>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EMOJIS.map((em) => (
                <button key={em} onClick={() => setNewIcon(em)}
                  className={cn('text-xl p-1 rounded-lg transition hover:scale-125', newIcon === em ? 'bg-brand-orange/20 ring-1 ring-brand-orange' : 'hover:bg-white/10')}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">Σχήμα</label>
            <div className="flex gap-2">
              {(['rect', 'circle'] as const).map((sh) => (
                <button key={sh} onClick={() => setNewShape(sh)}
                  className={cn('flex-1 py-2 rounded-xl text-sm font-medium transition border',
                    newShape === sh ? 'bg-brand-orange border-brand-orange text-white' : 'border-white/15 text-white/60 hover:text-white hover:bg-white/5')}>
                  {sh === 'rect' ? '▭ Ορθογώνιο' : '⬤ Κύκλος/Island'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">Χρώμα</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={cn('h-8 w-8 rounded-full transition', newColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110' : '')}
                  style={{ background: c }}/>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">Αριθμός θέσεων</label>
            <div className="flex gap-2 flex-wrap">
              {[2,3,4,5,6,8].map((n) => (
                <button key={n} onClick={() => setNewSlots(n)}
                  className={cn('h-9 w-9 rounded-xl text-sm font-medium transition border',
                    newSlots === n ? 'bg-brand-orange border-brand-orange text-white' : 'border-white/15 text-white/60 hover:text-white hover:bg-white/5')}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={addStation} className="flex-1" disabled={!newName.trim()}>Προσθήκη</Button>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Ακύρωση</Button>
          </div>
        </div>
      </Drawer>

      {/* ── In-app camera overlay ─────────────────────────────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          {/* Video preview */}
          <div className="relative flex-1 overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onCanPlay={() => setCameraReady(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/50 text-sm">Εκκίνηση κάμερας…</p>
              </div>
            )}
            {/* Purpose label */}
            <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-black/60 text-white/70 text-xs font-mono uppercase tracking-wider">
                {scanPurposeRef.current === 'draw' ? '📷 Σκανάρισμα χώρου' : '🤖 AI Ανίχνευση σταθμών'}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-black px-6 py-8 flex items-center justify-between gap-6">
            <button
              onClick={closeCamera}
              className="text-white/60 hover:text-white text-sm font-mono uppercase tracking-wider transition"
            >
              Ακύρωση
            </button>

            {/* Shutter button */}
            <button
              onClick={capturePhoto}
              disabled={!cameraReady}
              className="relative flex items-center justify-center w-20 h-20 rounded-full border-4 border-white/80 disabled:opacity-30 active:scale-95 transition-transform"
            >
              <span className="block w-14 h-14 rounded-full bg-white" />
            </button>

            {/* Placeholder to balance layout */}
            <div className="w-16" />
          </div>
        </div>
      )}

      {/* ── Advanced scan overlay (aerial + video sweep) ──────────────────────── */}
      {advScanStep !== null && (
        <div className="fixed inset-0 z-[210] bg-black flex flex-col">
          {/* Camera preview — shown during aerial + video steps */}
          {(advScanStep === 'aerial' || advScanStep === 'video') && (
            <div className="relative flex-1 overflow-hidden bg-black">
              <video
                ref={advVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Step badge */}
              <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                <span className="px-4 py-1.5 rounded-full bg-black/70 text-white/80 text-xs font-mono uppercase tracking-widest flex items-center gap-2">
                  {advScanStep === 'aerial'
                    ? <><ScanLine className="h-3.5 w-3.5 text-teal-400" /> Βήμα 1 / 2 — Εναέρια Φωτογραφία</>
                    : <><span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC — {advCountdown}s</>}
                </span>
              </div>

              {/* Instruction card */}
              <div className="absolute bottom-36 left-0 right-0 flex justify-center pointer-events-none px-6">
                <div className="bg-black/70 rounded-2xl px-5 py-3 text-center max-w-sm">
                  {advScanStep === 'aerial' ? (
                    <>
                      <p className="text-white font-semibold text-sm">Κράτα το κινητό ψηλά</p>
                      <p className="text-white/50 text-xs mt-1">Φωτογράφισε ολόκληρο τον χώρο του μπουφέ από ψηλά (bird's-eye view)</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white font-semibold text-sm">Γύρνα ΑΡΓΑ την κάμερα</p>
                      <p className="text-white/50 text-xs mt-1">Κάλυψε όλες τις γωνίες του χώρου — {advCountdown} δευτερόλεπτα απομένουν</p>
                    </>
                  )}
                </div>
              </div>

              {/* Countdown ring (video step) */}
              {advScanStep === 'video' && (
                <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none">
                  <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4"/>
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#ef4444" strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - advCountdown / 5)}`}
                      strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Processing step */}
          {advScanStep === 'processing' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-[#0b0d10]">
              <div className="relative flex items-center justify-center w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
                <ScanLine className="h-8 w-8 text-teal-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Επεξεργασία…</p>
                <p className="text-white/40 text-sm mt-1">Εξαγωγή frames · Ανάλυση AI</p>
              </div>
            </div>
          )}

          {/* Controls bar */}
          {advScanStep !== 'processing' && (
            <div className="bg-black px-6 py-8 flex items-center justify-between gap-6">
              <button
                onClick={cancelAdvancedScan}
                className="text-white/60 hover:text-white text-sm font-mono uppercase tracking-wider transition"
              >
                Ακύρωση
              </button>

              {advScanStep === 'aerial' ? (
                /* Shutter button */
                <button
                  onClick={captureAerialAndProceed}
                  className="relative flex items-center justify-center w-20 h-20 rounded-full border-4 border-teal-400/80 active:scale-95 transition-transform"
                >
                  <span className="block w-14 h-14 rounded-full bg-teal-400" />
                </button>
              ) : (
                /* Early-stop button */
                <button
                  onClick={stopAdvancedRecording}
                  className="flex items-center justify-center w-20 h-20 rounded-full border-4 border-red-400/80 active:scale-95 transition-transform"
                >
                  <span className="block w-10 h-10 rounded-sm bg-red-400" />
                </button>
              )}

              <div className="w-16" />
            </div>
          )}
        </div>
      )}

      {/* QR Drawer */}
      <Drawer open={qrOpen} onClose={() => setQrOpen(false)} title="QR Χάρτη Μπουφέ">
        <div className="space-y-5">
          <p className="text-sm text-white/60">Τοποθέτησε αυτό το QR στην είσοδο. Ο πελάτης βλέπει live τον χάρτη.</p>
          {qrDataUrl && <div className="flex justify-center"><img src={qrDataUrl} alt="QR" className="w-56 h-56 rounded-2xl bg-white p-3"/></div>}
          <div className="flex gap-2">
            <Button onClick={() => { if (!qrDataUrl) return; const a = document.createElement('a'); a.href = qrDataUrl; a.download = 'buffet-map-qr.png'; a.click() }}
              className="flex-1" disabled={!qrDataUrl}>Κατέβασμα QR</Button>
            <Button variant="secondary" onClick={() => setQrOpen(false)}>Κλείσιμο</Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
