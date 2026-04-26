import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { WalkieMessage, WalkieMessageWithSender } from '../types/database.types'

const PAGE_SIZE = 60

export function useWalkie() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [messages, setMessages] = useState<WalkieMessageWithSender[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const namesRef = useRef<Map<string, string | null>>(new Map())

  function enrich(msg: WalkieMessage): WalkieMessageWithSender {
    return { ...msg, sender_name: namesRef.current.get(msg.sender_id) ?? null }
  }

  useEffect(() => {
    if (!teamId) { setMessages([]); setLoading(false); return }
    setLoading(true)

    async function load() {
      const { data } = await supabase
        .from('walkie_messages')
        .select('*, profiles:sender_id(full_name)')
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE)

      type Row = WalkieMessage & { profiles: { full_name: string | null } | null }
      const rows = (data ?? []) as Row[]
      rows.forEach((r) => namesRef.current.set(r.sender_id, r.profiles?.full_name ?? null))
      setMessages(rows.map((r) => ({ ...r, sender_name: r.profiles?.full_name ?? null })))
      setLoading(false)
    }

    void load()
  }, [teamId])

  // Realtime
  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`walkie:${teamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'walkie_messages', filter: `team_id=eq.${teamId}` },
        async (payload) => {
          const msg = payload.new as WalkieMessage
          if (!namesRef.current.has(msg.sender_id)) {
            const { data } = await supabase
              .from('profiles').select('full_name').eq('id', msg.sender_id).single()
            namesRef.current.set(msg.sender_id, (data as { full_name: string | null } | null)?.full_name ?? null)
          }
          setMessages((s) => [...s, enrich(msg)])
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'walkie_messages', filter: `team_id=eq.${teamId}` },
        (payload) => {
          const old = payload.old as { id?: string }
          if (old.id) setMessages((s) => s.filter((m) => m.id !== old.id))
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  const sendTranscript = useCallback(async (transcript: string) => {
    if (!teamId || !profile) throw new Error('No team')
    setSending(true)
    try {
      const { error } = await supabase.from('walkie_messages').insert({
        team_id: teamId,
        sender_id: profile.id,
        transcript: transcript.trim(),
      })
      if (error) throw error
    } finally {
      setSending(false)
    }
  }, [teamId, profile])

  const deleteMessage = useCallback(async (id: string) => {
    const { error } = await supabase.from('walkie_messages').delete().eq('id', id)
    if (error) throw error
  }, [])

  return { messages, loading, sending, sendTranscript, deleteMessage }
}
