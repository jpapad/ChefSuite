import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User as AuthUser } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types/database.types'
import i18n from '../i18n'

export type { Profile }

export interface MyTeam {
  id: string
  name: string
  role: UserRole
}

interface AuthContextValue {
  session: Session | null
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ hasSession: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  switchTeam: (teamId: string) => Promise<void>
  myTeams: MyTeam[]
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, team_id, active_team_id, role, full_name, permissions, preferred_lang, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('fetchProfile failed', error)
    return null
  }
  return data as Profile | null
}

async function fetchMyTeams(userId: string): Promise<MyTeam[]> {
  const { data } = await supabase
    .from('team_memberships')
    .select('team_id, role, teams(id, name)')
    .eq('user_id', userId)

  if (!data) return []
  return data.map((row) => {
    const team = row.teams as { id: string; name: string } | null
    return {
      id: row.team_id as string,
      name: team?.name ?? '—',
      role: row.role as UserRole,
    }
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [rawProfile, setRawProfile] = useState<Profile | null>(null)
  const [myTeams, setMyTeams] = useState<MyTeam[]>([])
  const [loading, setLoading] = useState(true)

  // Derived profile: team_id is overridden by active_team_id when set
  const profile = useMemo<Profile | null>(() => {
    if (!rawProfile) return null
    return {
      ...rawProfile,
      team_id: rawProfile.active_team_id ?? rawProfile.team_id,
    }
  }, [rawProfile])

  useEffect(() => {
    let active = true

    const safetyTimer = setTimeout(() => {
      if (active) setLoading(false)
    }, 4000)

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return
        setSession(nextSession)

        if (event === 'INITIAL_SESSION') {
          clearTimeout(safetyTimer)
          setLoading(false)
        }

        if (nextSession?.user) {
          void Promise.all([
            fetchProfile(nextSession.user.id),
            fetchMyTeams(nextSession.user.id),
          ]).then(([p, teams]) => {
            if (!active) return
            setRawProfile(p)
            setMyTeams(teams)
            if (p?.preferred_lang) {
              const validLangs = ['en', 'el', 'bg']
              if (validLangs.includes(p.preferred_lang)) {
                void i18n.changeLanguage(p.preferred_lang)
                localStorage.setItem('chefsuite_lang', p.preferred_lang)
              }
            }
          })
        } else {
          setRawProfile(null)
          setMyTeams([])
        }
      },
    )

    return () => {
      active = false
      clearTimeout(safetyTimer)
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      myTeams,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      },
      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        return { hasSession: !!data.session }
      },
      async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
      async refreshProfile() {
        if (!session?.user) return
        const [p, teams] = await Promise.all([
          fetchProfile(session.user.id),
          fetchMyTeams(session.user.id),
        ])
        setRawProfile(p)
        setMyTeams(teams)
      },
      async switchTeam(teamId: string) {
        if (!session?.user) return
        const { error } = await supabase
          .from('profiles')
          .update({ active_team_id: teamId })
          .eq('id', session.user.id)
        if (error) throw error
        setRawProfile((prev) => (prev ? { ...prev, active_team_id: teamId } : prev))
      },
    }),
    [session, profile, rawProfile, loading, myTeams],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
