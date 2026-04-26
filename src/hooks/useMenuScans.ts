import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function recordScan(menuId: string) {
  void supabase.from('menu_scans').insert({
    menu_id: menuId,
    user_agent: navigator.userAgent.slice(0, 200),
  })
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
