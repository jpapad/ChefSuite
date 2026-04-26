import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export function RequireTeam({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-chef-dark">
        <div className="text-white/60">Loading…</div>
      </div>
    )
  }

  if (!profile?.team_id) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
