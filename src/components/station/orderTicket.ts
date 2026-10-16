import { mmss } from '../../lib/useNow'
import type { OnlineOrderWithItems } from '../../types/database.types'
import type { TicketTone } from './Station'

/** A ticket on the fire for longer than this is shown as late. */
export const LATE_AFTER_S = 15 * 60

/** Seconds since an ISO timestamp (never negative). */
function since(iso: string, now: number) {
  return Math.max(0, (now - new Date(iso).getTime()) / 1000)
}

/**
 * Display data for an online order as a kitchen ticket. New tickets time from
 * when they arrived, the rest from their last status change.
 */
export function ticketFor(o: OnlineOrderWithItems, now: number, t: (k: string) => string) {
  const started = o.status === 'pending' ? o.created_at : o.updated_at
  const secs = since(started, now)
  const late = o.status === 'preparing' && secs > LATE_AFTER_S
  const tone: TicketTone = late ? 'late' : o.status === 'pending' ? 'new' : o.status === 'preparing' ? 'fire' : 'ready'
  const tag = late ? t('station.ticketLate') : tone === 'new' ? t('station.ticketNew') : tone === 'fire' ? t('station.ticketFire') : t('station.ticketReady')
  return {
    tone, tag, secs, late,
    timer: mmss(secs),
    title: o.table_ref ?? o.customer_name ?? t('station.orderFallback'),
    meta: o.table_ref && o.customer_name ? o.customer_name : undefined,
    lines: (o.items ?? []).map((i) => ({ qty: i.quantity, name: i.name, note: i.notes })),
  }
}
