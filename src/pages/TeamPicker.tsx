import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChefHat, ArrowRight, Plus, Key } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    owner: 'Ιδιοκτήτης',
    executive_chef: 'Executive Chef',
    head_chef: 'Head Chef',
    sous_chef: 'Sous Chef',
    line_cook: 'Line Cook',
    prep_cook: 'Prep Cook',
    pastry_chef: 'Pastry Chef',
    manager: 'Manager',
    server: 'Σερβιτόρος',
    dishwasher: 'Πλύντης',
    staff: 'Προσωπικό',
  }
  return map[role] ?? role
}

export default function TeamPicker() {
  const { myTeams, switchTeam, profile } = useAuth()
  const navigate = useNavigate()
  const [selecting, setSelecting] = useState<string | null>(null)

  async function handleSelect(teamId: string) {
    setSelecting(teamId)
    try {
      await switchTeam(teamId)
      navigate('/', { replace: true })
    } catch {
      setSelecting(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-chef-dark px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl font-black text-lg text-white mb-4"
            style={{ background: 'linear-gradient(135deg, #d8b08c 0%, #C5A059 100%)' }}
          >
            CS
          </div>
          <h1 className="text-2xl font-bold text-white">Επιλογή Κουζίνας</h1>
          <p className="text-sm text-white/50">
            Ο λογαριασμός σου ανήκει σε {myTeams.length} κουζίνες. Επίλεξε με ποια θέλεις να συνδεθείς.
          </p>
        </div>

        {/* Team list */}
        <div className="space-y-2">
          {myTeams.map((team) => {
            const isCurrent = profile?.active_team_id === team.id
            const isLoading = selecting === team.id
            return (
              <button
                key={team.id}
                type="button"
                disabled={!!selecting}
                onClick={() => void handleSelect(team.id)}
                className="w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 disabled:opacity-60"
                style={
                  isCurrent
                    ? {
                        background: 'rgba(197,160,89,0.12)',
                        borderColor: 'rgba(197,160,89,0.4)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.04)',
                        borderColor: 'rgba(255,255,255,0.1)',
                      }
                }
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'rgba(197,160,89,0.15)' }}
                >
                  <ChefHat className="h-5 w-5 text-[#C5A059]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{team.name}</p>
                  <p className="text-xs text-white/40 mt-0.5">{roleLabel(team.role)}</p>
                </div>
                {isLoading ? (
                  <div className="h-5 w-5 rounded-full border-2 border-[#C5A059]/30 border-t-[#C5A059] animate-spin shrink-0" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-white/25 shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            to="/onboarding"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:border-white/20 transition"
          >
            <Plus className="h-4 w-4" />
            Νέα κουζίνα
          </Link>
          <Link
            to="/onboarding"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:border-white/20 transition"
          >
            <Key className="h-4 w-4" />
            Εγγραφή με κωδικό
          </Link>
        </div>
      </div>
    </div>
  )
}
