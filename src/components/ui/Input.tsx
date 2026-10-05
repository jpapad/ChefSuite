import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name
  return (
    <label htmlFor={inputId} className="block w-full">
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-white/60">
          {label}
        </span>
      )}
      <div
        className={cn(
          'flex items-center gap-3 px-3.5 h-11 transition-all',
          'bg-bg-input border border-inv-border rounded-xl',
          'focus-within:border-brand-orange/60 focus-within:ring-1 focus-within:ring-brand-orange/20',
          error && 'border-red-500/60 ring-1 ring-red-500/20',
        )}
      >
        {leftIcon && <span className="text-white/30 shrink-0">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/35',
            className,
          )}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <span
          className={cn(
            'mt-1.5 block text-xs',
            error ? 'text-red-400' : 'text-white/50',
          )}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  )
})
