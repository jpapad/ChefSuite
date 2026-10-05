import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { UtensilsCrossed } from 'lucide-react'
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
      <div className="flex min-h-screen items-center justify-center bg-[#F1F2EE]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0F1210]/15 border-t-[#0F1210]/60" />
      </div>
    )
  }

  // No daily menu set
  if (!menuId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F1F2EE] p-4 text-[#0F1210]">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[2rem] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,18,16,0.06),0_8px_24px_-12px_rgba(15,18,16,0.12)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C8F03C]">
            <UtensilsCrossed className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">Δεν υπάρχει μενού για σήμερα</h1>
          <p className="text-sm text-[#0F1210]/55">
            Το εστιατόριο δεν έχει ορίσει το μενού της ημέρας ακόμα. Η σελίδα ανανεώνεται αυτόματα.
          </p>
          <p className="mt-2 text-xs text-[#0F1210]/35">Powered by ChefSuite</p>
        </div>
      </div>
    )
  }

  // Render menu — key forces fresh fetch when daily menu changes
  return <MenuPublicContent key={menuId} menuId={menuId} />
}
