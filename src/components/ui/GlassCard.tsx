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
        'rounded-lg p-6',
        hover && 'card-hover glass-shimmer cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
