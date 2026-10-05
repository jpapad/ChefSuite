// Building blocks of the "Bento & Lime" page design: one header per page, a
// row of KPI tiles, soft panels, pill filters and a single overflow menu
// instead of rows of secondary buttons.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Search, X, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

// ── Page header ──────────────────────────────────────────────────────────────

export function PageHeader({
  eyebrow, title, subtitle, actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pt-1">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-white/55">{eyebrow}</p>}
        <h1 className="mt-0.5 text-3xl sm:text-4xl font-medium tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-white/55 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

// ── Buttons (pill) ───────────────────────────────────────────────────────────

type PillButtonProps = {
  children: ReactNode
  icon?: LucideIcon
  onClick?: () => void
  to?: string
  variant?: 'primary' | 'secondary' | 'lime' | 'ai' | 'danger'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}

const PILL: Record<NonNullable<PillButtonProps['variant']>, string> = {
  primary:   'bg-brand-orange text-on-accent hover:bg-brand-orange/85',
  secondary: 'bg-bg-card text-white shadow-card hover:bg-white/[0.04]',
  lime:      'bg-lime text-ink hover:brightness-95',
  ai:        'bg-violet-500/10 text-violet-500 hover:bg-violet-500/15',
  danger:    'bg-red-600 text-white-fixed hover:bg-red-500',
}

export function PillButton({ children, icon: Icon, onClick, to, variant = 'secondary', disabled, className, type = 'button' }: PillButtonProps) {
  const cls = cn(
    'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition',
    'disabled:opacity-40 disabled:pointer-events-none',
    PILL[variant], className,
  )
  const inner = <>{Icon && <Icon className="h-4 w-4" strokeWidth={1.9} />}{children}</>
  if (to) return <Link to={to} className={cls}>{inner}</Link>
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{inner}</button>
}

// ── Overflow menu: groups secondary actions behind one pill ─────────────────

export interface MenuAction {
  label: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  onClick: () => void
  hidden?: boolean
}

export function ActionMenu({ label, icon, actions, variant = 'secondary' }: {
  label: ReactNode
  icon?: LucideIcon
  actions: MenuAction[]
  variant?: PillButtonProps['variant']
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc) }
  }, [open])
  const visible = actions.filter((a) => !a.hidden)
  if (visible.length === 0) return null
  const Icon = icon
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn('inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition', PILL[variant])}
      >
        {Icon && <Icon className="h-4 w-4" strokeWidth={1.9} />}
        {label}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-72 rounded-3xl bg-bg-card p-2 shadow-[0_20px_60px_rgba(15,18,16,0.18)]">
          {visible.map((a, i) => {
            const AIcon = a.icon
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); a.onClick() }}
                className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-white/[0.05]"
              >
                {AIcon && <AIcon className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{a.label}</span>
                  {a.hint && <span className="block text-xs text-white/50">{a.hint}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── KPI tiles ────────────────────────────────────────────────────────────────

export function StatTile({
  label, value, hint, icon: Icon, tone = 'default', to, onClick, className,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  tone?: 'default' | 'ink' | 'lime' | 'warn' | 'bad' | 'good'
  to?: string
  onClick?: () => void
  className?: string
}) {
  const shell = cn(
    'rounded-3xl p-5 flex flex-col gap-2 text-left transition-transform',
    (to || onClick) && 'hover:-translate-y-0.5',
    tone === 'ink' ? 'bg-ink text-white-fixed' : tone === 'lime' ? 'bg-lime text-ink' : 'bg-bg-card shadow-card',
    className,
  )
  const muted = tone === 'ink' ? 'text-[#C9CEC8]' : tone === 'lime' ? 'text-ink/70' : 'text-white/55'
  const valueTone =
    tone === 'ink' ? 'text-lime' : tone === 'warn' ? 'text-amber-500' : tone === 'bad' ? 'text-red-500' : tone === 'good' ? 'text-emerald-500' : ''
  const inner = (
    <>
      <span className={cn('flex items-center justify-between gap-2 text-sm', muted)}>
        {label}{Icon && <Icon className="h-4 w-4" />}
      </span>
      <span className={cn('text-3xl sm:text-4xl font-medium tracking-[-0.03em] tabular-nums leading-none', valueTone)}>{value}</span>
      {hint && <span className={cn('text-xs', muted)}>{hint}</span>}
    </>
  )
  if (to) return <Link to={to} className={shell}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={shell}>{inner}</button>
  return <div className={shell}>{inner}</div>
}

export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4', className)}>{children}</section>
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function Panel({ title, actions, children, className, padded = true }: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('rounded-3xl bg-bg-card shadow-card flex flex-col', padded && 'p-5 sm:p-6 gap-4', className)}>
      {(title || actions) && (
        <div className={cn('flex flex-wrap items-center justify-between gap-3', !padded && 'px-5 sm:px-6 pt-5')}>
          {title && <h2 className="text-lg font-medium">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

// ── Filters ──────────────────────────────────────────────────────────────────

export function Chip({ active, onClick, children, count, tone }: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  count?: number
  tone?: 'good'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition',
        active
          ? tone === 'good' ? 'bg-emerald-600 text-white-fixed' : 'bg-brand-orange text-on-accent'
          : 'bg-bg-card text-white/70 shadow-card hover:text-white',
      )}
    >
      {children}
      {count != null && <span className={cn('tabular-nums', active ? 'opacity-70' : 'text-white/40')}>{count}</span>}
    </button>
  )
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-2 overflow-x-auto scrollbar-none pb-1', className)}>{children}</div>
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; icon?: LucideIcon }[]
}) {
  return (
    <div className="inline-flex shrink-0 rounded-full bg-white/[0.06] p-1">
      {options.map((o) => {
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition',
              value === o.value ? 'bg-bg-card text-white shadow-card' : 'text-white/60 hover:text-white',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}{o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SearchField({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <label className={cn('flex h-11 min-w-[220px] items-center gap-2 rounded-full bg-bg-card px-4 shadow-card focus-within:ring-2 focus-within:ring-brand-orange/40', className)}>
      <Search className="h-4 w-4 shrink-0 text-white/45" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
      />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => onChange('')} className="text-white/45 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  )
}

// ── Empty / loading states ───────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, body, action }: {
  icon?: LucideIcon
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="rounded-3xl bg-bg-card shadow-card flex flex-col items-center text-center gap-3 px-6 py-14">
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime text-ink">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <h2 className="text-xl font-medium">{title}</h2>
      {body && <p className="max-w-sm text-sm text-white/55">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Notice({ tone = 'bad', children }: { tone?: 'bad' | 'warn' | 'info'; children: ReactNode }) {
  return (
    <div className={cn(
      'rounded-2xl px-4 py-3 text-sm',
      tone === 'bad' ? 'bg-red-500/10 text-red-500' : tone === 'warn' ? 'bg-amber-500/12 text-amber-500' : 'bg-sky-500/10 text-sky-500',
    )}>
      {children}
    </div>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1360px] flex flex-col gap-6', className)}>{children}</div>
}
