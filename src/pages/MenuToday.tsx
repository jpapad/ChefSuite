import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MenuPublicContent } from './MenuPublic'

// Public page: /menu/today/:teamId
// Renders today's menu directly (no redirect) and polls every 30s for changes.
// When the admin sets a new daily menu, the page updates automatically.

const POLL_MS = 30_000

export default function MenuToday() {
  const { teamId } = useParams<{ teamId: string }>()
  const [menuId, setMenuId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!teamId) { setMenuId(null); return }

    let mounted = true

    async function check() {
      const { data } = await supabase.rpc('get_daily_menu', { p_team_id: teamId! })
      if (mounted) setMenuId(data as string | null)
    }

    check()
    const interval = setInterval(check, POLL_MS)
    return () => { mounted = false; clearInterval(interval) }
  }, [teamId])

  // Loading
  if (menuId === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
        <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    )
  }

  // No daily menu set
  if (!menuId) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ background: 'linear-gradient(135deg, #f8f6f3 0%, #fdfcfb 50%, #f8f6f3 100%)' }}
      >
        <div className="text-5xl">🍽️</div>
        <h1 className="text-xl font-bold text-neutral-800">Δεν υπάρχει μενού για σήμερα</h1>
        <p className="text-sm text-neutral-500 max-w-xs">
          Το εστιατόριο δεν έχει ορίσει το μενού της ημέρας ακόμα. Δοκιμάστε ξανά αργότερα.
        </p>
        <p className="text-xs text-neutral-400 mt-4">Powered by ChefSuite</p>
      </div>
    )
  }

  // Render menu — key forces fresh fetch when daily menu changes
  return <MenuPublicContent key={menuId} menuId={menuId} />
}
