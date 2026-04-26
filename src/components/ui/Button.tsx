import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-chef-dark disabled:opacity-40 disabled:cursor-not-allowed ' +
  'active:scale-[0.97]'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-orange text-white-fixed hover:bg-[#d4a478] hover:shadow-orange-glow',
  secondary:
    'glass gradient-border text-white hover:bg-white/10',
  ghost:
    'text-white/60 hover:text-white hover:bg-white/8',
  danger:
    'bg-red-600/90 text-white-fixed hover:bg-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.35)]',
}

const sizes: Record<ButtonSize, string> = {
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
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
