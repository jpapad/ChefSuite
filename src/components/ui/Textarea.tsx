import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, error, className, id, ...rest }, ref) {
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
            'rounded-xl px-4 py-3',
            'bg-bg-input border border-inv-border',
            'focus-within:ring-2 focus-within:ring-brand-orange/50 focus-within:border-brand-orange/30',
            error && 'ring-2 ring-red-500/60 border-red-500/30',
          )}
        >
          <textarea
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-transparent outline-none text-base text-white placeholder:text-white/40 resize-y min-h-[96px]',
              className,
            )}
            {...rest}
          />
        </div>
        {(hint || error) && (
          <span
            className={cn(
              'mt-1 block text-xs',
              error ? 'text-red-400' : 'text-white/50',
            )}
          >
            {error ?? hint}
          </span>
        )}
      </label>
    )
  },
)
