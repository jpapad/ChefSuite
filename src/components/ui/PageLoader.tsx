import { Flame } from 'lucide-react'

export function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange animate-pulse">
          <Flame className="h-6 w-6 text-white" />
        </div>
        <div className="h-1 w-24 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-brand-orange/60 rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  )
}
