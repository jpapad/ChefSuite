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
        <span className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.20em] text-white/40">
          {label}
        </span>
      )}
      <div
        className={cn(
          'flex items-center gap-3 px-3 h-[38px] transition-all',
          'bg-[#13161c] border border-[rgba(242,240,236,0.08)] rounded-sm',
          'focus-within:border-brand-orange/60 focus-within:ring-1 focus-within:ring-brand-orange/20',
          error && 'border-red-500/60 ring-1 ring-red-500/20',
        )}
      >
        {leftIcon && <span className="text-white/30 shrink-0">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex-1 bg-transparent outline-none text-[13px] text-[#f2f0ec] placeholder:text-white/25',
            className,
          )}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <span
          className={cn(
            'mt-1.5 block font-mono text-[10px] tracking-wide',
            error ? 'text-red-400' : 'text-white/30',
          )}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  )
})
