import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AlertTriangle, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, accountExpired, signOut } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-chef-dark">
        <div className="text-white/60">Loading…</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (accountExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-chef-dark p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white mb-2">Ο λογαριασμός σου έληξε</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Η πρόσβασή σου στην ομάδα έχει λήξει. Επικοινώνησε με τον ιδιοκτήτη για να ανανεωθεί ο λογαριασμός σου.
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/8 border border-white/12 px-5 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/12 transition"
          >
            <LogOut className="h-4 w-4" />
            Αποσύνδεση
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
