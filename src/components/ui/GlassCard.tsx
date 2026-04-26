import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'strong'
  hover?: boolean
  children: ReactNode
}

export function GlassCard({
  variant = 'default',
  hover = false,
  className,
  children,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={cn(
        variant === 'strong' ? 'glass-strong' : 'glass',
        'rounded-2xl p-6 gradient-border',
        hover && 'card-hover glass-shimmer cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
