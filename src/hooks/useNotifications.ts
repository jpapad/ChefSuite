import { useCallback, useEffect, useState } from 'react'

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export function useNotifications() {
  const supported = typeof Notification !== 'undefined'

  const [permission, setPermission] = useState<NotifPermission>(() => {
    if (!supported) return 'unsupported'
    return Notification.permission as NotifPermission
  })

  useEffect(() => {
    if (!supported) return
    setPermission(Notification.permission as NotifPermission)
  }, [supported])

  const request = useCallback(async () => {
    if (!supported) return
    const result = await Notification.requestPermission()
    setPermission(result as NotifPermission)
  }, [supported])

  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (!supported || Notification.permission !== 'granted') return
    new Notification(title, { icon: '/favicon.ico', ...options })
  }, [supported])

  return { supported, permission, request, notify }
}
