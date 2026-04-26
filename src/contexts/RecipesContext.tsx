import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Recipe, RecipeInsert, RecipeUpdate } from '../types/database.types'
import { useRecipeVersions } from '../hooks/useRecipeVersions'

interface RecipesContextValue {
  recipes: Recipe[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (payload: Omit<RecipeInsert, 'team_id'>) => Promise<Recipe>
  update: (id: string, patch: RecipeUpdate) => Promise<Recipe>
  remove: (id: string) => Promise<void>
  consumeRecipe: (id: string, portions: number) => Promise<void>
}

const RecipesContext = createContext<RecipesContextValue | undefined>(undefined)

export function RecipesProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { saveVersion } = useRecipeVersions()

  const load = useCallback(async () => {
    if (!teamId) { setRecipes([]); setLoading(false); return }
    setLoading(true); setError(null)
    const { data, error: err } = await supabase
      .from('recipes').select('*').order('created_at', { ascending: false })
    setRecipes((data ?? []) as Recipe[])
    setError(err?.message ?? null)
    setLoading(false)
  }, [teamId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`recipes:${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes', filter: `team_id=eq.${teamId}` },
        (payload) => {
          setRecipes((s) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Recipe
              if (s.some((r) => r.id === row.id)) return s
              return [row, ...s]
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Recipe
              return s.map((r) => (r.id === row.id ? row : r))
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id?: string }
              return old.id ? s.filter((r) => r.id !== old.id) : s
            }
            return s
          })
        })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [teamId])

  const create = useCallback(async (payload: Omit<RecipeInsert, 'team_id'>) => {
    if (!teamId) throw new Error('No team')
    const { data, error: err } = await supabase.from('recipes')
      .insert({ ...payload, team_id: teamId }).select('*').single()
    if (err) throw err
    const row = data as Recipe
    setRecipes((s) => [row, ...s])
    return row
  }, [teamId])

  const update = useCallback(async (id: string, patch: RecipeUpdate) => {
    const { data, error: err } = await supabase.from('recipes')
      .update(patch).eq('id', id).select('*').single()
    if (err) throw err
    const row = data as Recipe
    setRecipes((s) => s.map((r) => (r.id === id ? row : r)))
    void saveVersion(row)
    return row
  }, [saveVersion])

  const remove = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('recipes').delete().eq('id', id)
    if (err) throw err
    setRecipes((s) => s.filter((r) => r.id !== id))
  }, [])

  const consumeRecipe = useCallback(async (id: string, portions: number) => {
    const { error: err } = await supabase.rpc('consume_recipe', {
      p_recipe_id: id,
      p_portions: portions,
    })
    if (err) throw err
  }, [])

  const value = useMemo<RecipesContextValue>(
    () => ({ recipes, loading, error, reload: load, create, update, remove, consumeRecipe }),
    [recipes, loading, error, load, create, update, remove, consumeRecipe],
  )

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>
}

export function useRecipes(): RecipesContextValue {
  const ctx = useContext(RecipesContext)
  if (!ctx) throw new Error('useRecipes must be used inside <RecipesProvider>')
  return ctx
}
