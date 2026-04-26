import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  Profile,
  Team,
  TeamInvite,
  UserRole,
} from '../types/database.types'

interface State {
  team: Team | null
  members: Profile[]
  invites: TeamInvite[]
  loading: boolean
  error: string | null
}

export function useTeam() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [state, setState] = useState<State>({
    team: null,
    members: [],
    invites: [],
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    if (!teamId) {
      setState({
        team: null,
        members: [],
        invites: [],
        loading: false,
        error: null,
      })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))

    const [teamRes, membersRes, invitesRes] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).maybeSingle(),
      supabase
        .from('profiles')
        .select('*')
        .eq('team_id', teamId)
        .order('full_name', { ascending: true }),
      supabase
        .from('team_invites')
        .select('*')
        .eq('team_id', teamId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ])

    const firstError =
      teamRes.error?.message ??
      membersRes.error?.message ??
      invitesRes.error?.message ??
      null

    setState({
      team: (teamRes.data as Team | null) ?? null,
      members: (membersRes.data ?? []) as Profile[],
      invites: (invitesRes.data ?? []) as TeamInvite[],
      loading: false,
      error: firstError,
    })
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!teamId) return

    const channel = supabase
      .channel(`team:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          setState((s) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Profile
              if (s.members.some((m) => m.id === row.id)) return s
              return {
                ...s,
                members: [...s.members, row].sort((a, b) =>
                  (a.full_name ?? '').localeCompare(b.full_name ?? ''),
                ),
              }
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Profile
              const exists = s.members.some((m) => m.id === row.id)
              if (row.team_id !== teamId) {
                return exists
                  ? { ...s, members: s.members.filter((m) => m.id !== row.id) }
                  : s
              }
              if (!exists) {
                return {
                  ...s,
                  members: [...s.members, row].sort((a, b) =>
                    (a.full_name ?? '').localeCompare(b.full_name ?? ''),
                  ),
                }
              }
              return {
                ...s,
                members: s.members
                  .map((m) => (m.id === row.id ? row : m))
                  .sort((a, b) =>
                    (a.full_name ?? '').localeCompare(b.full_name ?? ''),
                  ),
              }
            }
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as { id?: string }
              if (!oldRow.id) return s
              return {
                ...s,
                members: s.members.filter((m) => m.id !== oldRow.id),
              }
            }
            return s
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_invites',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          setState((s) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as TeamInvite
              if (row.accepted_at) return s
              if (s.invites.some((i) => i.id === row.id)) return s
              return { ...s, invites: [row, ...s.invites] }
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as TeamInvite
              if (row.accepted_at) {
                return {
                  ...s,
                  invites: s.invites.filter((i) => i.id !== row.id),
                }
              }
              return {
                ...s,
                invites: s.invites.map((i) => (i.id === row.id ? row : i)),
              }
            }
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as { id?: string }
              if (!oldRow.id) return s
              return {
                ...s,
                invites: s.invites.filter((i) => i.id !== oldRow.id),
              }
            }
            return s
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [teamId])

  const createInvite = useCallback(
    async (email: string, role: UserRole) => {
      const { data, error } = await supabase.rpc('create_team_invite', {
        invite_email: email,
        invite_role: role,
      })
      if (error) throw error
      const row = data as TeamInvite
      setState((s) => ({ ...s, invites: [row, ...s.invites] }))
      return row
    },
    [],
  )

  const revokeInvite = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('team_invites')
      .delete()
      .eq('id', id)
    if (error) throw error
    setState((s) => ({
      ...s,
      invites: s.invites.filter((i) => i.id !== id),
    }))
  }, [])

  return { ...state, reload: load, createInvite, revokeInvite }
}
