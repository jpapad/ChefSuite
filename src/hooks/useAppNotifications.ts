import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { AppNotification } from '../types/database.types'

export function useAppNotifications() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  const load = useCallback(async () => {
    if (!userId) { setNotifications([]); return }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications((data ?? []) as AppNotification[])
  }, [userId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!userId) return
    const ch = supabase
      .channel(`app_notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as AppNotification, ...prev])
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [userId])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (userId) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    }
  }, [userId])

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, markRead, markAllRead }
}
