import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Mail, MessageCircle, Copy, Check, Printer, X, Phone } from 'lucide-react'
import type { PurchaseOrder, PurchaseOrderItem, Supplier } from '../../types/database.types'

interface SendOrderSheetProps {
  order: PurchaseOrder
  items: PurchaseOrderItem[]
  supplier: Supplier | undefined
  teamName: string
  senderName: string
  onClose: () => void
  /** Called after the order left through any channel (mark as sent) */
  onSent: () => void
}

/** Greek numbers → international format for wa.me / viber (e.g. 69xxxxxxxx → 3069xxxxxxxx). */
function intlPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (d.length === 10 && /^[26]/.test(d)) d = '30' + d
  return d.length >= 10 ? d : null
}

function qty(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

export function SendOrderSheet({ order, items, supplier, teamName, senderName, onClose, onSent }: SendOrderSheetProps) {
  const { t, i18n } = useTranslation()
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  const generated = useMemo(() => {
    const date = new Date(deliveryDate + 'T00:00:00').toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })
    const lines = items.map((it) => `• ${it.name} — ${qty(it.quantity)} ${it.unit}`)
    return [
      t('sendOrder.msg.greeting', { name: supplier?.contact_name || supplier?.name || '' }).trim(),
      '',
      t('sendOrder.msg.intro', { team: teamName }),
      '',
      ...lines,
      '',
      t('sendOrder.msg.delivery', { date }),
      ...(note.trim() ? ['', note.trim()] : []),
      '',
      t('sendOrder.msg.thanks'),
      senderName ? `${senderName} — ${teamName}` : teamName,
    ].join('\n')
  }, [items, supplier, teamName, senderName, deliveryDate, note, t, i18n.language])

  const [text, setText] = useState(generated)
  const [edited, setEdited] = useState(false)
  useEffect(() => { if (!edited) setText(generated) }, [generated, edited])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const phone = intlPhone(supplier?.phone)
  const subject = t('sendOrder.msg.subject', { team: teamName, date: new Date().toLocaleDateString(i18n.language) })

  function go(url: string) {
    window.open(url, '_blank', 'noopener')
    onSent()
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onSent()
  }

  function print() {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return
    const rows = items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td class="n">${qty(it.quantity)}</td><td>${escapeHtml(it.unit)}</td></tr>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title>
      <style>body{font-family:Geologica,system-ui,sans-serif;color:#0F1210;padding:40px;max-width:640px;margin:auto}
      h1{font-size:26px;margin:0 0 4px}p{color:#555;margin:0 0 24px}table{width:100%;border-collapse:collapse}
      td,th{padding:10px 8px;border-bottom:1px solid #e5e5e0;text-align:left}th{font-size:12px;color:#777;font-weight:500}
      .n{text-align:right;font-variant-numeric:tabular-nums}.note{margin-top:24px;white-space:pre-wrap;color:#333}</style></head>
      <body><h1>${escapeHtml(teamName)}</h1><p>${escapeHtml(t('sendOrder.printTo'))}: ${escapeHtml(supplier?.name ?? '—')} · ${escapeHtml(t('sendOrder.deliveryDate'))}: ${escapeHtml(new Date(deliveryDate + 'T00:00:00').toLocaleDateString(i18n.language))}</p>
      <table><thead><tr><th>${escapeHtml(t('sendOrder.item'))}</th><th class="n">${escapeHtml(t('sendOrder.qty'))}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      ${note.trim() ? `<div class="note">${escapeHtml(note.trim())}</div>` : ''}
      <script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
    onSent()
  }

  const channel = 'flex flex-col items-center gap-1.5 rounded-2xl bg-bg-input px-2 py-3 text-xs font-medium transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35'

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('sendOrder.title')} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[2rem] bg-bg-card p-5 shadow-[0_20px_60px_rgba(15,18,16,0.25)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-medium tracking-[-0.02em]">{t('sendOrder.title')}</h2>
            <p className="text-sm text-white/55">
              {supplier?.name ?? t('sendOrder.noSupplier')}
              {supplier?.email && <> · {supplier.email}</>}
              {supplier?.phone && <> · <Phone className="inline h-3 w-3" /> {supplier.phone}</>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/[0.06]"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/55">{t('sendOrder.deliveryDate')}</span>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
              className="h-11 rounded-2xl bg-bg-input px-3 text-sm outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/55">{t('sendOrder.note')}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('sendOrder.notePlaceholder')}
              className="h-11 rounded-2xl bg-bg-input px-3 text-sm outline-none placeholder:text-white/35" />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs text-white/55">
            {t('sendOrder.message')}
            {edited && <button type="button" onClick={() => { setEdited(false); setText(generated) }} className="font-medium underline-offset-4 hover:underline">{t('sendOrder.reset')}</button>}
          </span>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setEdited(true) }} rows={Math.min(16, items.length + 9)}
            className="resize-none rounded-2xl bg-bg-input px-4 py-3 font-mono text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-brand-orange/40" />
        </label>

        <div className="grid grid-cols-5 gap-2">
          <button type="button" className={channel} disabled={!supplier?.email}
            onClick={() => go(`mailto:${supplier?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`)}>
            <Mail className="h-5 w-5" />Email
          </button>
          <button type="button" className={channel} disabled={!phone}
            onClick={() => go(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`)}>
            <MessageCircle className="h-5 w-5" />WhatsApp
          </button>
          <button type="button" className={channel} disabled={!phone}
            onClick={() => go(`viber://forward?text=${encodeURIComponent(text)}`)}>
            <MessageCircle className="h-5 w-5" />Viber
          </button>
          <button type="button" className={channel} onClick={() => void copy()}>
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}{copied ? t('sendOrder.copied') : t('sendOrder.copy')}
          </button>
          <button type="button" className={channel} onClick={print}>
            <Printer className="h-5 w-5" />PDF
          </button>
        </div>
        {!supplier?.email && !phone && <p className="text-xs text-white/50">{t('sendOrder.noContact')}</p>}
        {order.status === 'draft' && <p className="text-xs text-white/50">{t('sendOrder.marksSent')}</p>}
      </div>
    </div>,
    document.body,
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
