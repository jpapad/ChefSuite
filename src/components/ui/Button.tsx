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
  'inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium ' +
  'transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface ' +
  'disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-orange text-on-accent hover:bg-brand-orange/85',
  secondary:
    'bg-bg-card border border-white/15 text-white/80 hover:bg-white/[0.06] hover:text-white',
  ghost:
    'text-white/60 hover:text-white hover:bg-white/[0.06]',
  danger:
    'bg-red-600 text-white-fixed hover:bg-red-500',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9  px-4  text-[13px]',
  md: 'h-11 px-5  text-sm',
  lg: 'h-12 px-7  text-[15px]',
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
