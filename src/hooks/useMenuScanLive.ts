import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface MenuScanRow {
  menuId: string
  menuName: string
  todayCount: number
  weekCount: number
  totalCount: number
}

export interface DayTotal {
  date: string
  count: number
}

export function useMenuScanLive(days = 30) {
  const [perMenu, setPerMenu] = useState<MenuScanRow[]>([])
  const [perDay, setPerDay] = useState<DayTotal[]>([])
  const [todayTotal, setTodayTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayIso = todayStart.toISOString()
    const weekIso = new Date(Date.now() - 7 * 86_400_000).toISOString()

    // Fetch scans (no join — avoids FK resolution issues)
    const { data: rows, error } = await supabase
      .from('menu_scans')
      .select('scanned_at, menu_id')
      .gte('scanned_at', since)
      .order('scanned_at', { ascending: false })

    if (error) {
      console.error('[useMenuScanLive] fetch error:', error.message, error.details)
      setLoading(false)
      return
    }

    if (!rows?.length) {
      setPerMenu([])
      setPerDay(buildEmptyDays(days))
      setTodayTotal(0)
      setLoading(false)
      return
    }

    // Fetch menu names separately
    const uniqueMenuIds = [...new Set(rows.map((r) => r.menu_id as string))]
    const { data: menuData } = await supabase
      .from('menus')
      .select('id, name')
      .in('id', uniqueMenuIds)

    const menuNames = new Map<string, string>(
      (menuData ?? []).map((m) => [m.id as string, m.name as string]),
    )

    // Group by menu
    const menuMap = new Map<string, { name: string; today: number; week: number; total: number }>()
    const dayCounts: Record<string, number> = {}
    let todaySum = 0

    for (const row of rows) {
      const menuId = row.menu_id as string
      const menuName = menuNames.get(menuId) ?? menuId.slice(0, 8)
      const scannedAt = row.scanned_at as string
      const dateKey = scannedAt.slice(0, 10)

      const entry = menuMap.get(menuId) ?? { name: menuName, today: 0, week: 0, total: 0 }
      entry.total++
      if (scannedAt >= weekIso) entry.week++
      if (scannedAt >= todayIso) { entry.today++; todaySum++ }
      menuMap.set(menuId, entry)

      dayCounts[dateKey] = (dayCounts[dateKey] ?? 0) + 1
    }

    setPerMenu(
      Array.from(menuMap.entries())
        .map(([menuId, d]) => ({
          menuId,
          menuName: d.name,
          todayCount: d.today,
          weekCount: d.week,
          totalCount: d.total,
        }))
        .sort((a, b) => b.totalCount - a.totalCount),
    )

    const perDayArr: DayTotal[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
      perDayArr.push({ date: d, count: dayCounts[d] ?? 0 })
    }

    setPerDay(perDayArr)
    setTodayTotal(todaySum)
    setLoading(false)
  }, [days])

  useEffect(() => { void load() }, [load])

  // Realtime — requires menu_scans added to supabase_realtime publication:
  // ALTER PUBLICATION supabase_realtime ADD TABLE menu_scans;
  useEffect(() => {
    const channel = supabase
      .channel('menu-scans-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'menu_scans' }, () => {
        void load()
        if (flashTimer.current) clearTimeout(flashTimer.current)
        setFlash(true)
        flashTimer.current = setTimeout(() => setFlash(false), 1800)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [load])

  return { perMenu, perDay, todayTotal, loading, flash }
}

function buildEmptyDays(days: number): DayTotal[] {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    count: 0,
  }))
}
