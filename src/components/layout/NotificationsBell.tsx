import { useEffect, useRef, useState } from 'react'
import { Bell, AlertTriangle, Package, ClipboardList, CheckCheck, ChefHat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useInventory, isLowStock } from '../../hooks/useInventory'
import { useAppNotifications } from '../../hooks/useAppNotifications'
import type { AppNotification } from '../../types/database.types'

function formatQty(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'prep_assigned') return <ClipboardList className="h-4 w-4 text-brand-orange shrink-0" />
  if (type === 'recipe_shared') return <ChefHat className="h-4 w-4 text-brand-orange shrink-0" />
  return <Bell className="h-4 w-4 text-white/40 shrink-0" />
}

export function NotificationsBell() {
  const { t } = useTranslation()
  const { items } = useInventory()
  const lowStock = items.filter(isLowStock)
  const { notifications, unreadCount, markRead, markAllRead } = useAppNotifications()

  const totalBadge = unreadCount + lowStock.length
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'app' | 'stock'>('app')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function handleOpen() {
    setOpen((v) => !v)
  }

  async function handleMarkAllRead() {
    await markAllRead()
  }

  async function handleNotifClick(n: AppNotification) {
    if (!n.read) await markRead(n.id)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={handleOpen}
        className="relative flex h-12 w-12 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition"
      >
        <Bell className="h-6 w-6" />
        {totalBadge > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-orange text-[10px] font-bold text-white leading-none">
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-strong border border-glass-border rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
            <span className="font-semibold">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-glass-border">
            <button
              type="button"
              onClick={() => setTab('app')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition ${
                tab === 'app' ? 'text-brand-orange border-b-2 border-brand-orange' : 'text-white/50 hover:text-white'
              }`}
            >
              {t('notifications.tabActivity')}
              {unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-orange px-1.5 py-0.5 text-[10px] text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('stock')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition ${
                tab === 'stock' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-white/50 hover:text-white'
              }`}
            >
              {t('notifications.tabStock')}
              {lowStock.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] text-black">
                  {lowStock.length}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          {tab === 'app' ? (
            notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Bell className="h-8 w-8 text-white/20" />
                <p className="text-sm text-white/40">{t('notifications.empty')}</p>
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y divide-glass-border">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => void handleNotifClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition hover:bg-white/5 ${
                      !n.read ? 'bg-brand-orange/5' : ''
                    }`}
                  >
                    <div className="mt-0.5">
                      <NotifIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${!n.read ? 'font-medium text-white' : 'text-white/70'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-white/40 truncate mt-0.5">{n.body}</p>
                      )}
                      <p className="text-[11px] text-white/30 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-orange shrink-0" />
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : (
            lowStock.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Package className="h-8 w-8 text-white/30" />
                <p className="text-sm text-white/50">{t('notifications.stockOk')}</p>
              </div>
            ) : (
              <>
                <ul className="max-h-64 overflow-y-auto divide-y divide-glass-border">
                  {lowStock.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-xs text-amber-300/80">
                          {formatQty(item.quantity)} / {formatQty(item.min_stock_level)} {item.unit}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="px-4 py-3 border-t border-glass-border">
                  <Link
                    to="/inventory"
                    onClick={() => setOpen(false)}
                    className="block text-center text-sm text-brand-orange hover:underline"
                  >
                    {t('notifications.viewInventory')}
                  </Link>
                </div>
              </>
            )
          )}
        </div>
      )}
    </div>
  )
}
