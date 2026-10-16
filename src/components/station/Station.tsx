// Shared "Station Board" pieces: section headings, split-flap numbers,
// paper tickets and the scrolling alert strip.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function SectionHead({ no, title, meta, action, className }: {
  no?: string
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1', className)}>
      {no && <span className="font-mono text-[15px] font-bold text-signal">{no}</span>}
      <h2 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.01em]">{title}</h2>
      {meta && <span className="sb-label text-white/60">{meta}</span>}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  )
}

/** A number that flips like a departure board whenever it changes. */
export function FlipNumber({ value, className }: { value: ReactNode; className?: string }) {
  const [flip, setFlip] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setFlip((f) => !f)
  }, [value])
  return <span className={cn(first.current ? 'inline-block' : flip ? 'sb-flip-a' : 'sb-flip-b', className)}>{value}</span>
}

export type TicketTone = 'new' | 'fire' | 'ready' | 'late'

const HEAD: Record<TicketTone, string> = {
  new:   'bg-signal text-ink',
  fire:  'bg-[#FFD60A] text-ink',
  ready: 'bg-emerald-500 text-ink',
  late:  'bg-[#FF3B30] text-white-fixed',
}

export interface TicketLine { qty: number; name: string; note?: string | null }

/** A kitchen ticket on thermal paper. `children` goes at the bottom (e.g. a bump button). */
export function Ticket({ tone, tag, timer, title, meta, lines, allergens, pattern, className, children }: {
  tone: TicketTone
  tag: ReactNode
  timer?: ReactNode
  title: ReactNode
  meta?: ReactNode
  lines: TicketLine[]
  allergens?: string | null
  /** Station pattern class, e.g. "pat-hot". */
  pattern?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <article className={cn('sb-ticket mb-2.5 flex flex-col', tone === 'late' && 'sb-late', className)}>
      <div className={cn('flex items-center justify-between gap-2 px-3 py-2', HEAD[tone])}>
        <span className="sb-label">{tag}</span>
        {timer != null && <span className="font-mono text-[20px] font-bold tabular-nums tracking-[-0.03em]">{timer}</span>}
      </div>
      {pattern && <div className={cn('h-2 text-ink', pattern)} aria-hidden="true" />}
      <div className="flex items-baseline justify-between gap-2 px-3 pt-2.5">
        <span className="font-display text-[34px] font-extrabold uppercase leading-none">{title}</span>
        {meta && <span className="sb-label shrink-0 text-[#525252]">{meta}</span>}
      </div>
      <ul className="flex flex-col gap-1 px-3 pb-3 pt-2 text-[17px]">
        {lines.map((l, i) => (
          <li key={i}>
            <b className="inline-block w-8 font-bold">{l.qty}×</b>{l.name}
            {l.note && <span className="ml-8 block text-[14px] font-semibold text-[#9A3412]">{l.note}</span>}
          </li>
        ))}
      </ul>
      {allergens && (
        <span className="mx-3 mb-2 self-start rounded-sm border-2 border-red-600 px-2 py-0.5 font-display text-[13px] font-bold uppercase tracking-[0.05em] text-red-700">
          {allergens}
        </span>
      )}
      {children}
    </article>
  )
}

/** Orange strip of live alerts that scrolls sideways (pauses on hover). */
export function Ticker({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) return null
  const loop = [...items, ...items]
  return (
    <div className="sb-ticker bg-signal text-ink" role="region" aria-label={label}>
      <div>
        {loop.map((text, i) => (
          <span key={i} aria-hidden={i >= items.length} className="inline-flex items-center gap-3 whitespace-nowrap px-7 py-3.5 font-display text-[20px] font-bold uppercase tracking-[0.04em]">
            <b className="inline-block h-2 w-2 bg-ink" />{text}
          </span>
        ))}
      </div>
    </div>
  )
}
