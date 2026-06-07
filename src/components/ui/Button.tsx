import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 font-mono font-bold uppercase tracking-[0.14em] ' +
  'transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d10] ' +
  'disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-orange text-[#0b0d10] rounded-sm hover:opacity-80',
  secondary:
    'bg-white/[0.04] border border-[rgba(242,240,236,0.08)] text-white/70 rounded-sm hover:bg-white/[0.08] hover:text-white',
  ghost:
    'text-white/50 hover:text-white hover:bg-white/[0.06] rounded-sm',
  danger:
    'bg-red-600/90 text-white rounded-sm hover:bg-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.35)]',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8  px-3  text-[10px]',
  md: 'h-10 px-5  text-[11px]',
  lg: 'h-12 px-7  text-[12px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  )
}
