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
import type { Profile } from '../types/database.types'

export type { Profile }

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, team_id, role, full_name, permissions, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('fetchProfile failed', error)
    return null
  }
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Safety net: never stay stuck on loading longer than 4s
    const safetyTimer = setTimeout(() => {
      if (active) setLoading(false)
    }, 4000)

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return
        setSession(nextSession)

        if (event === 'INITIAL_SESSION') {
          clearTimeout(safetyTimer)
          setLoading(false) // unlock immediately — don't wait for profile
        }

        if (nextSession?.user) {
          // fetch profile in background, never blocks loading
          fetchProfile(nextSession.user.id).then((p) => {
            if (active) setProfile(p)
          })
        } else {
          setProfile(null)
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
        setProfile(await fetchProfile(session.user.id))
      },
    }),
    [session, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
