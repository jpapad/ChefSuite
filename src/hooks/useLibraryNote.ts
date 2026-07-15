import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useLibraryNote(contextType: 'technique' | 'glossary' | 'spice', contextKey: string) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const userId = profile?.id ?? null

  const [note, setNote]       = useState<string>('')
  const [saved, setSaved]     = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!teamId || !userId || !contextKey) return
    setLoading(true)
    void supabase
      .from('library_notes')
      .select('note')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('context_type', contextType)
      .eq('context_key', contextKey)
      .maybeSingle()
      .then(({ data }) => {
        const text = (data as { note: string } | null)?.note ?? ''
        setNote(text)
        setSaved(text)
        setLoading(false)
      })
  }, [teamId, userId, contextType, contextKey])

  const save = useCallback(async (text: string) => {
    if (!teamId || !userId) return
    setSaving(true)
    if (text.trim() === '') {
      await supabase.from('library_notes')
        .delete()
        .eq('team_id', teamId).eq('user_id', userId)
        .eq('context_type', contextType).eq('context_key', contextKey)
    } else {
      await supabase.from('library_notes').upsert({
        team_id: teamId, user_id: userId,
        context_type: contextType, context_key: contextKey,
        note: text.trim(), updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id,user_id,context_type,context_key' })
    }
    setSaved(text.trim())
    setSaving(false)
  }, [teamId, userId, contextType, contextKey])

  return { note, setNote, saved, loading, saving, save, isDirty: note !== saved }
}
