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
        <span className="mb-1.5 block text-sm font-medium text-white/70 tracking-wide">
          {label}
        </span>
      )}
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl px-4 h-11 transition-all',
          'bg-white-fixed/55 border border-white/70',
          'focus-within:ring-2 focus-within:ring-brand-orange/50 focus-within:border-brand-orange/30',
          error && 'ring-2 ring-red-500/60 border-red-500/30',
        )}
      >
        {leftIcon && <span className="text-white/40 shrink-0">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30',
            className,
          )}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <span
          className={cn(
            'mt-1.5 block text-xs',
            error ? 'text-red-400' : 'text-white/40',
          )}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  )
})
