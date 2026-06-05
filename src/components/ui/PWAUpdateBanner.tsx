import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // Check for updates every 60 seconds
      setInterval(() => { void r?.update() }, 60_000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-between gap-3 px-4 py-3 bg-brand-orange text-white text-sm font-semibold shadow-xl">
      <span>🔄 Νέα έκδοση διαθέσιμη</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="shrink-0 px-4 py-1.5 rounded-xl bg-white/25 hover:bg-white/35 transition active:scale-95 text-sm font-bold"
      >
        Ανανέωση τώρα
      </button>
    </div>
  )
}
