import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { TeamMessage, TeamMessageWithSender } from '../types/database.types'

function fireNotif(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  if (!document.hidden) return
  new Notification(title, { body, icon: '/favicon.ico' })
}

const PAGE_SIZE = 50

export function useTeamChat() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null

  const [messages, setMessages] = useState<TeamMessageWithSender[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Map of profile id → full_name for local enrichment
  const namesRef = useRef<Map<string, string | null>>(new Map())

  function enrich(msg: TeamMessage): TeamMessageWithSender {
    return { ...msg, sender_name: namesRef.current.get(msg.sender_id) ?? null }
  }

  const load = useCallback(async () => {
    if (!teamId) { setMessages([]); setLoading(false); return }
    setLoading(true)

    const { data, error: err } = await supabase
      .from('team_messages')
      .select('*, profiles:sender_id(full_name)')
      .order('created_at', { ascending: true })
      .limit(PAGE_SIZE)

    if (err) { setError(err.message); setLoading(false); return }

    const rows = (data ?? []) as Array<TeamMessage & { profiles: { full_name: string | null } | null }>
    rows.forEach((r) => {
      namesRef.current.set(r.sender_id, r.profiles?.full_name ?? null)
    })
    setMessages(rows.map((r) => ({ ...r, sender_name: r.profiles?.full_name ?? null })))
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`chat:${teamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `team_id=eq.${teamId}` },
        async (payload) => {
          const msg = payload.new as TeamMessage
          // Fetch sender name if not cached
          if (!namesRef.current.has(msg.sender_id)) {
            const { data } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', msg.sender_id)
              .single()
            namesRef.current.set(msg.sender_id, (data as { full_name: string | null } | null)?.full_name ?? null)
          }
          const enriched = enrich(msg)
          setMessages((s) => [...s, enriched])
          if (msg.sender_id !== profile?.id) {
            const senderName = namesRef.current.get(msg.sender_id) ?? 'Team'
            fireNotif(`💬 ${senderName}`, msg.content)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'team_messages', filter: `team_id=eq.${teamId}` },
        (payload) => {
          const old = payload.old as { id?: string }
          if (old.id) setMessages((s) => s.filter((m) => m.id !== old.id))
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  const sendMessage = useCallback(async (content: string) => {
    if (!teamId || !profile) throw new Error('No team')
    const trimmed = content.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const { error: err } = await supabase.from('team_messages').insert({
        team_id: teamId,
        sender_id: profile.id,
        content: trimmed,
      })
      if (err) throw err
    } finally {
      setSending(false)
    }
  }, [teamId, profile])

  const deleteMessage = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('team_messages').delete().eq('id', id)
    if (err) throw err
  }, [])

  return { messages, loading, sending, error, sendMessage, deleteMessage }
}
