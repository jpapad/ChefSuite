import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface DirectMessage {
  id: string
  team_id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
  sender_name?: string | null
}

export interface TeamMember {
  id: string
  full_name: string | null
  role: string
}

export function useTeamMembers() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])

  useEffect(() => {
    if (!profile?.team_id) return
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('team_id', profile.team_id)
      .neq('id', profile.id)
      .then(({ data }) => {
        setMembers((data ?? []) as TeamMember[])
      })
  }, [profile?.team_id, profile?.id])

  return members
}

const PAGE_SIZE = 60

export function useDirectMessages(recipientId: string | null) {
  const { profile, user } = useAuth()
  const teamId = profile?.team_id ?? null

  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const namesRef = useRef<Map<string, string | null>>(new Map())

  useEffect(() => {
    if (!teamId || !recipientId || !user) {
      setMessages([])
      return
    }
    setLoading(true)

    supabase
      .from('direct_messages')
      .select('*, sender:sender_id(full_name)')
      .eq('team_id', teamId)
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        const rows = (data ?? []) as Array<DirectMessage & { sender: { full_name: string | null } | null }>
        rows.forEach((r) => namesRef.current.set(r.sender_id, r.sender?.full_name ?? null))
        setMessages(rows.map((r) => ({ ...r, sender_name: r.sender?.full_name ?? null })))
        setLoading(false)
      })
  }, [teamId, recipientId, user])

  // Realtime for DMs
  useEffect(() => {
    if (!teamId || !recipientId || !user) return

    const channel = supabase
      .channel(`dm:${[user.id, recipientId].sort().join(':')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `team_id=eq.${teamId}`,
        },
        async (payload) => {
          const msg = payload.new as DirectMessage
          const isRelevant =
            (msg.sender_id === user.id && msg.recipient_id === recipientId) ||
            (msg.sender_id === recipientId && msg.recipient_id === user.id)
          if (!isRelevant) return

          if (!namesRef.current.has(msg.sender_id)) {
            const { data } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', msg.sender_id)
              .single()
            namesRef.current.set(
              msg.sender_id,
              (data as { full_name: string | null } | null)?.full_name ?? null,
            )
          }
          setMessages((s) => [...s, { ...msg, sender_name: namesRef.current.get(msg.sender_id) ?? null }])
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [teamId, recipientId, user])

  const sendMessage = useCallback(async (content: string) => {
    if (!teamId || !user || !recipientId) return
    const trimmed = content.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const { error } = await supabase.from('direct_messages').insert({
        team_id: teamId,
        sender_id: user.id,
        recipient_id: recipientId,
        content: trimmed,
      })
      if (error) throw error

      void supabase.functions.invoke('send-push', {
        body: {
          team_id: teamId,
          exclude_user_id: user.id,
          title: `💬 ${profile?.full_name ?? 'Someone'} (DM)`,
          body: trimmed.length > 100 ? trimmed.slice(0, 97) + '…' : trimmed,
          url: '/chat',
          tag: `dm-${recipientId}`,
        },
      })
    } finally {
      setSending(false)
    }
  }, [teamId, user, recipientId, profile])

  return { messages, loading, sending, sendMessage }
}
