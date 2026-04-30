import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { RecipeCommentWithAuthor, RecipeCommentInsert } from '../types/database.types'

interface State {
  comments: RecipeCommentWithAuthor[]
  loading: boolean
  error: string | null
}

export function useRecipeComments(recipeId: string | null) {
  const { profile } = useAuth()
  const [state, setState] = useState<State>({ comments: [], loading: false, error: null })

  const load = useCallback(async () => {
    if (!recipeId || !profile?.team_id) return
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('recipe_comments')
      .select('*, author:author_id(full_name)')
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: true })
    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }))
      return
    }
    const comments: RecipeCommentWithAuthor[] = (data ?? []).map((row) => ({
      id: row.id,
      team_id: row.team_id,
      recipe_id: row.recipe_id,
      author_id: row.author_id,
      content: row.content,
      created_at: row.created_at,
      author_name: (row.author as { full_name?: string } | null)?.full_name ?? null,
    }))
    setState({ comments, loading: false, error: null })
  }, [recipeId, profile?.team_id])

  useEffect(() => { void load() }, [load])

  const addComment = useCallback(async (content: string) => {
    if (!profile?.team_id || !recipeId) return
    const insert: RecipeCommentInsert = {
      team_id: profile.team_id,
      recipe_id: recipeId,
      author_id: profile.id,
      content: content.trim(),
    }
    const { data, error } = await supabase
      .from('recipe_comments')
      .insert(insert)
      .select('*, author:author_id(full_name)')
      .single()
    if (error) throw error
    const newComment: RecipeCommentWithAuthor = {
      ...data,
      author_name: (data.author as { full_name?: string } | null)?.full_name ?? null,
    }
    setState((s) => ({ ...s, comments: [...s.comments, newComment] }))
  }, [profile, recipeId])

  const deleteComment = useCallback(async (id: string) => {
    const { error } = await supabase.from('recipe_comments').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== id) }))
  }, [])

  return { ...state, addComment, deleteComment, reload: load }
}
