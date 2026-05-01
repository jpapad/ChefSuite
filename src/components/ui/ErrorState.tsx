import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ message = 'Something went wrong', onRetry, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 gap-4 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <div>
        <p className="font-medium text-white/80">Failed to load</p>
        <p className="text-sm text-white/40 mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-white/8 hover:bg-white/15 transition px-4 py-2 text-sm text-white/70 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  )
}
