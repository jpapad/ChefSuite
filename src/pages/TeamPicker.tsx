import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChefHat, ArrowRight, Plus, Key } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { AuthShell } from '../components/layout/AuthShell'

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
    <AuthShell>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-4xl font-medium tracking-[-0.03em]">Σε ποια κουζίνα μπαίνεις;</h2>
          <p className="mt-1.5 text-white/55">Ο λογαριασμός σου ανήκει σε {myTeams.length} κουζίνες.</p>
        </div>

        <div className="flex flex-col gap-2">
          {myTeams.map((team) => {
            const isCurrent = profile?.active_team_id === team.id
            const isLoading = selecting === team.id
            return (
              <button
                key={team.id}
                type="button"
                disabled={!!selecting}
                onClick={() => void handleSelect(team.id)}
                className={`flex w-full items-center gap-4 rounded-3xl p-4 text-left transition disabled:opacity-60 ${isCurrent ? 'bg-ink text-white-fixed' : 'bg-bg-card shadow-card hover:-translate-y-0.5'}`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isCurrent ? 'bg-lime text-ink' : 'bg-white/[0.06]'}`}>
                  <ChefHat className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-medium">{team.name}</span>
                  <span className={`block text-sm ${isCurrent ? 'text-white-fixed/60' : 'text-white/50'}`}>{roleLabel(team.role)}</span>
                </span>
                {isLoading
                  ? <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                  : <ArrowRight className="h-5 w-5 shrink-0 opacity-50" />}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link to="/onboarding" className="flex h-12 items-center justify-center gap-2 rounded-full bg-bg-card text-sm font-medium shadow-card hover:bg-white/[0.04]">
            <Plus className="h-4 w-4" />Νέα κουζίνα
          </Link>
          <Link to="/onboarding" className="flex h-12 items-center justify-center gap-2 rounded-full bg-bg-card text-sm font-medium shadow-card hover:bg-white/[0.04]">
            <Key className="h-4 w-4" />Με κωδικό πρόσκλησης
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
