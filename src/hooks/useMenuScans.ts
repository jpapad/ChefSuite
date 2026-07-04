import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function recordScan(menuId: string) {
  void supabase.from('menu_scans').insert({
    menu_id: menuId,
    user_agent: navigator.userAgent.slice(0, 200),
  })
}

export interface DayScan { date: string; count: number }

export function useQrScanHistory(days = 14) {
  const [history, setHistory] = useState<DayScan[]>([])
  const [today, setToday] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since = new Date(Date.now() - days * 86_400_000).toISOString()
      const { data: rows } = await supabase
        .from('menu_scans')
        .select('scanned_at')
        .gte('scanned_at', since)

      const counts: Record<string, number> = {}
      for (const row of rows ?? []) {
        const d = (row.scanned_at as string).slice(0, 10)
        counts[d] = (counts[d] ?? 0) + 1
      }

      const todayKey = new Date().toISOString().slice(0, 10)
      setToday(counts[todayKey] ?? 0)

      const result: DayScan[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
        result.push({ date: d, count: counts[d] ?? 0 })
      }
      setHistory(result)
      setLoading(false)
    }
    void load()
  }, [days])

  return { today, history, loading }
}

interface ScanStats {
  total: number
  today: number
  last7days: number
}

export function useMenuScans(menuId: string | null) {
  const [stats, setStats] = useState<ScanStats>({ total: 0, today: 0, last7days: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!menuId) return
    setLoading(true)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [totalRes, todayRes, weekRes] = await Promise.all([
      supabase.from('menu_scans').select('id', { count: 'exact', head: true }).eq('menu_id', menuId),
      supabase.from('menu_scans').select('id', { count: 'exact', head: true }).eq('menu_id', menuId).gte('scanned_at', todayStart),
      supabase.from('menu_scans').select('id', { count: 'exact', head: true }).eq('menu_id', menuId).gte('scanned_at', week),
    ])

    setStats({
      total: totalRes.count ?? 0,
      today: todayRes.count ?? 0,
      last7days: weekRes.count ?? 0,
    })
    setLoading(false)
  }, [menuId])

  useEffect(() => { void load() }, [load])

  return { stats, loading, reload: load }
}
