import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Public page: /menu/today/:teamId
// Looks up the team's daily_menu_id and redirects to /menu/:id
// If no daily menu is set, shows a friendly message.

export default function MenuToday() {
  const { teamId } = useParams<{ teamId: string }>()
  const [menuId, setMenuId] = useState<string | null | undefined>(undefined) // undefined = loading

  useEffect(() => {
    if (!teamId) { setMenuId(null); return }
    supabase
      .rpc('get_daily_menu', { p_team_id: teamId })
      .then(({ data }) => setMenuId(data as string | null))
  }, [teamId])

  // Loading
  if (menuId === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
        <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    )
  }

  // Daily menu set → redirect to public menu page
  if (menuId) return <Navigate to={`/menu/${menuId}`} replace />

  // No daily menu set
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
