import { ChefHat } from 'lucide-react'
import { cn } from '../../lib/cn'

/** The ChefSuite mark: a chef's hat in a signal-orange square, plus the wordmark. */
export function BrandMark({ size = 'md', wordmark = true, className }: {
  size?: 'sm' | 'md' | 'lg'
  wordmark?: boolean
  className?: string
}) {
  const box = size === 'sm' ? 'h-8 w-8 border-[3px]' : size === 'lg' ? 'h-11 w-11 border-[3px]' : 'h-9 w-9 border-[3px]'
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
  const text = size === 'sm' ? 'text-[22px]' : size === 'lg' ? 'text-[30px]' : 'text-[26px]'
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className={cn('flex shrink-0 items-center justify-center border-signal', box)}>
        <ChefHat className={cn(icon, 'text-white-fixed')} strokeWidth={2} />
      </span>
      {wordmark && (
        <span className={cn('font-display font-extrabold leading-none text-white-fixed', text)}>
          CHEF<span className="text-signal">SUITE</span>
        </span>
      )}
    </span>
  )
}
