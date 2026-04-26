import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  PrepTemplate,
  PrepTemplateItem,
  PrepTemplateItemInsert,
  PrepTemplateItemUpdate,
} from '../types/database.types'

export interface PrepTemplateWithItems extends PrepTemplate {
  items: PrepTemplateItem[]
}

interface State {
  templates: PrepTemplateWithItems[]
  loading: boolean
  error: string | null
}

export function usePrepTemplates() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [state, setState] = useState<State>({ templates: [], loading: true, error: null })

  const load = useCallback(async () => {
    if (!teamId) { setState({ templates: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true, error: null }))
    const { data, error } = await supabase
      .from('prep_templates')
      .select('*, items:prep_template_items(*)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })
    if (error) { setState({ templates: [], loading: false, error: error.message }); return }
    const templates = (data ?? []).map((t: PrepTemplate & { items: PrepTemplateItem[] }) => ({
      ...t,
      items: (t.items ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }))
    setState({ templates, loading: false, error: null })
  }, [teamId])

  useEffect(() => { void load() }, [load])

  const createTemplate = useCallback(async (name: string): Promise<PrepTemplateWithItems> => {
    if (!teamId) throw new Error('No team')
    const { data, error } = await supabase
      .from('prep_templates')
      .insert({ name: name.trim(), team_id: teamId })
      .select('*')
      .single()
    if (error) throw error
    const tmpl = { ...(data as PrepTemplate), items: [] }
    setState((s) => ({ ...s, templates: [...s.templates, tmpl] }))
    return tmpl
  }, [teamId])

  const updateTemplate = useCallback(async (id: string, name: string) => {
    const { data, error } = await supabase.from('prep_templates').update({ name: name.trim() }).eq('id', id).select('*').single()
    if (error) throw error
    setState((s) => ({
      ...s,
      templates: s.templates.map((t) => t.id === id ? { ...t, ...(data as PrepTemplate) } : t),
    }))
  }, [])

  const removeTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from('prep_templates').delete().eq('id', id)
    if (error) throw error
    setState((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }))
  }, [])

  const addItem = useCallback(async (templateId: string, payload: Omit<PrepTemplateItemInsert, 'template_id' | 'sort_order'>): Promise<PrepTemplateItem> => {
    const existing = state.templates.find((t) => t.id === templateId)
    const maxOrder = (existing?.items ?? []).reduce((m, i) => Math.max(m, i.sort_order), -1)
    const { data, error } = await supabase
      .from('prep_template_items')
      .insert({ ...payload, template_id: templateId, sort_order: maxOrder + 1 })
      .select('*')
      .single()
    if (error) throw error
    const item = data as PrepTemplateItem
    setState((s) => ({
      ...s,
      templates: s.templates.map((t) =>
        t.id === templateId ? { ...t, items: [...t.items, item] } : t,
      ),
    }))
    return item
  }, [state.templates])

  const updateItem = useCallback(async (templateId: string, itemId: string, patch: PrepTemplateItemUpdate) => {
    const { data, error } = await supabase.from('prep_template_items').update(patch).eq('id', itemId).select('*').single()
    if (error) throw error
    const item = data as PrepTemplateItem
    setState((s) => ({
      ...s,
      templates: s.templates.map((t) =>
        t.id === templateId ? { ...t, items: t.items.map((i) => i.id === itemId ? item : i) } : t,
      ),
    }))
  }, [])

  const removeItem = useCallback(async (templateId: string, itemId: string) => {
    const { error } = await supabase.from('prep_template_items').delete().eq('id', itemId)
    if (error) throw error
    setState((s) => ({
      ...s,
      templates: s.templates.map((t) =>
        t.id === templateId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t,
      ),
    }))
  }, [])

  return {
    ...state, reload: load,
    createTemplate, updateTemplate, removeTemplate,
    addItem, updateItem, removeItem,
  }
}
