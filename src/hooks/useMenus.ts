import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  Menu, MenuInsert, MenuUpdate,
  MenuSection, MenuSectionInsert, MenuSectionUpdate,
  MenuItem, MenuItemInsert, MenuItemUpdate,
  MenuWithSections, MenuSectionWithItems,
} from '../types/database.types'

export function useMenus() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? null
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) { setMenus([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('menus')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setMenus((data ?? []) as Menu[])
        setLoading(false)
      })
  }, [teamId])

  const create = useCallback(async (values: Omit<MenuInsert, 'team_id'>): Promise<Menu> => {
    if (!teamId) throw new Error('No team')
    const { data, error } = await supabase
      .from('menus')
      .insert({ ...values, team_id: teamId })
      .select()
      .single()
    if (error) throw error
    const row = data as Menu
    setMenus((prev) => [row, ...prev])
    return row
  }, [teamId])

  const update = useCallback(async (id: string, values: MenuUpdate): Promise<Menu> => {
    const { data, error } = await supabase
      .from('menus')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const row = data as Menu
    setMenus((prev) => prev.map((m) => m.id === id ? row : m))
    return row
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('menus').delete().eq('id', id)
    if (error) throw error
    setMenus((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const duplicate = useCallback(async (id: string): Promise<Menu> => {
    if (!teamId) throw new Error('No team')
    const { data: menuData } = await supabase.from('menus').select('*').eq('id', id).single()
    if (!menuData) throw new Error('Menu not found')
    const original = menuData as Menu

    const { data: newMenuData, error: menuError } = await supabase
      .from('menus')
      .insert({
        team_id: teamId,
        name: `Copy of ${original.name}`,
        type: original.type,
        description: original.description,
        price_per_person: original.price_per_person,
        active: false,
        show_prices: original.show_prices,
        valid_from: null,
        valid_to: null,
      })
      .select()
      .single()
    if (menuError) throw menuError
    const newMenu = newMenuData as Menu

    const { data: sectionsData } = await supabase
      .from('menu_sections')
      .select('*')
      .eq('menu_id', id)
      .order('sort_order', { ascending: true })
    const sections = (sectionsData ?? []) as MenuSection[]

    for (const section of sections) {
      const { data: newSectionData } = await supabase
        .from('menu_sections')
        .insert({ menu_id: newMenu.id, name: section.name, sort_order: section.sort_order })
        .select()
        .single()
      if (!newSectionData) continue
      const newSection = newSectionData as MenuSection

      const { data: itemsData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('section_id', section.id)
        .order('sort_order', { ascending: true })
      const items = (itemsData ?? []) as MenuItem[]

      if (items.length > 0) {
        await supabase.from('menu_items').insert(
          items.map((item) => ({
            section_id: newSection.id,
            name: item.name,
            description: item.description,
            price: item.price,
            available: item.available,
            tags: item.tags,
            sort_order: item.sort_order,
            recipe_id: item.recipe_id,
          })),
        )
      }
    }

    setMenus((prev) => [newMenu, ...prev])
    return newMenu
  }, [teamId])

  return { menus, loading, create, update, remove, duplicate }
}

export function useMenuDetail(menuId: string | null) {
  const [menu, setMenu] = useState<MenuWithSections | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!menuId) { setMenu(null); setLoading(false); return }
    setLoading(true)
    const { data: menuData } = await supabase
      .from('menus')
      .select('*')
      .eq('id', menuId)
      .single()
    if (!menuData) { setLoading(false); return }

    const { data: sectionsData } = await supabase
      .from('menu_sections')
      .select('*')
      .eq('menu_id', menuId)
      .order('sort_order', { ascending: true })

    const sections = (sectionsData ?? []) as MenuSection[]
    const sectionIds = sections.map((s) => s.id)

    let items: MenuItem[] = []
    if (sectionIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('menu_items')
        .select('*')
        .in('section_id', sectionIds)
        .order('sort_order', { ascending: true })
      items = (itemsData ?? []) as MenuItem[]
    }

    const sectionsWithItems: MenuSectionWithItems[] = sections.map((s) => ({
      ...s,
      items: items.filter((i) => i.section_id === s.id),
    }))

    setMenu({ ...(menuData as Menu), sections: sectionsWithItems })
    setLoading(false)
  }, [menuId])

  useEffect(() => { void load() }, [load])

  // Sections
  const addSection = useCallback(async (name: string): Promise<MenuSection> => {
    if (!menuId) throw new Error('No menu')
    const { data: existing } = await supabase
      .from('menu_sections')
      .select('sort_order')
      .eq('menu_id', menuId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const nextOrder = ((existing as { sort_order: number }[] | null)?.[0]?.sort_order ?? -1) + 1
    const insert: MenuSectionInsert = { menu_id: menuId, name: name.trim(), sort_order: nextOrder }
    const { data, error } = await supabase.from('menu_sections').insert(insert).select().single()
    if (error) throw error
    const section = { ...(data as MenuSection), items: [] }
    setMenu((prev) => prev ? { ...prev, sections: [...prev.sections, section] } : prev)
    return data as MenuSection
  }, [menuId])

  const updateSection = useCallback(async (id: string, values: MenuSectionUpdate) => {
    const { data, error } = await supabase.from('menu_sections').update(values).eq('id', id).select().single()
    if (error) throw error
    const updated = data as MenuSection
    setMenu((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) => s.id === id ? { ...s, ...updated } : s),
    } : prev)
  }, [])

  const removeSection = useCallback(async (id: string) => {
    const { error } = await supabase.from('menu_sections').delete().eq('id', id)
    if (error) throw error
    setMenu((prev) => prev ? { ...prev, sections: prev.sections.filter((s) => s.id !== id) } : prev)
  }, [])

  const moveSectionUp = useCallback(async (id: string) => {
    setMenu((prev) => {
      if (!prev) return prev
      const idx = prev.sections.findIndex((s) => s.id === id)
      if (idx <= 0) return prev
      const sections = [...prev.sections]
      ;[sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]]
      sections.forEach((s, i) => { s.sort_order = i })
      void supabase.from('menu_sections').upsert(sections.map((s) => ({ id: s.id, sort_order: s.sort_order, menu_id: s.menu_id, name: s.name })))
      return { ...prev, sections }
    })
  }, [])

  const moveSectionDown = useCallback(async (id: string) => {
    setMenu((prev) => {
      if (!prev) return prev
      const idx = prev.sections.findIndex((s) => s.id === id)
      if (idx >= prev.sections.length - 1) return prev
      const sections = [...prev.sections]
      ;[sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]]
      sections.forEach((s, i) => { s.sort_order = i })
      void supabase.from('menu_sections').upsert(sections.map((s) => ({ id: s.id, sort_order: s.sort_order, menu_id: s.menu_id, name: s.name })))
      return { ...prev, sections }
    })
  }, [])

  // Items
  const addItem = useCallback(async (sectionId: string, values: Omit<MenuItemInsert, 'section_id' | 'sort_order'>): Promise<MenuItem> => {
    const section = menu?.sections.find((s) => s.id === sectionId)
    const nextOrder = (section?.items.length ?? 0)
    const { data, error } = await supabase
      .from('menu_items')
      .insert({ ...values, section_id: sectionId, sort_order: nextOrder })
      .select()
      .single()
    if (error) throw error
    const item = data as MenuItem
    setMenu((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, item] } : s,
      ),
    } : prev)
    return item
  }, [menu])

  const updateItem = useCallback(async (id: string, sectionId: string, values: MenuItemUpdate) => {
    const { data, error } = await supabase.from('menu_items').update(values).eq('id', id).select().single()
    if (error) throw error
    const updated = data as MenuItem
    setMenu((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.map((i) => i.id === id ? { ...i, ...updated } : i) }
          : s,
      ),
    } : prev)
  }, [])

  const removeItem = useCallback(async (id: string, sectionId: string) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) throw error
    setMenu((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== id) } : s,
      ),
    } : prev)
  }, [])

  const moveItemUp = useCallback((id: string, sectionId: string) => {
    setMenu((prev) => {
      if (!prev) return prev
      const sIdx = prev.sections.findIndex((s) => s.id === sectionId)
      if (sIdx < 0) return prev
      const section = prev.sections[sIdx]
      const iIdx = section.items.findIndex((i) => i.id === id)
      if (iIdx <= 0) return prev
      const items = [...section.items]
      ;[items[iIdx - 1], items[iIdx]] = [items[iIdx], items[iIdx - 1]]
      items.forEach((it, i) => { it.sort_order = i })
      void supabase.from('menu_items').upsert(items.map((it) => ({ id: it.id, sort_order: it.sort_order, section_id: it.section_id, name: it.name, available: it.available })))
      const sections = [...prev.sections]
      sections[sIdx] = { ...section, items }
      return { ...prev, sections }
    })
  }, [])

  const moveItemDown = useCallback((id: string, sectionId: string) => {
    setMenu((prev) => {
      if (!prev) return prev
      const sIdx = prev.sections.findIndex((s) => s.id === sectionId)
      if (sIdx < 0) return prev
      const section = prev.sections[sIdx]
      const iIdx = section.items.findIndex((i) => i.id === id)
      if (iIdx >= section.items.length - 1) return prev
      const items = [...section.items]
      ;[items[iIdx], items[iIdx + 1]] = [items[iIdx + 1], items[iIdx]]
      items.forEach((it, i) => { it.sort_order = i })
      void supabase.from('menu_items').upsert(items.map((it) => ({ id: it.id, sort_order: it.sort_order, section_id: it.section_id, name: it.name, available: it.available })))
      const sections = [...prev.sections]
      sections[sIdx] = { ...section, items }
      return { ...prev, sections }
    })
  }, [])

  return {
    menu, loading, reload: load,
    addSection, updateSection, removeSection, moveSectionUp, moveSectionDown,
    addItem, updateItem, removeItem, moveItemUp, moveItemDown,
  }
}

// Public fetch — no auth needed
export async function fetchPublicMenu(id: string): Promise<MenuWithSections | null> {
  const { data: menuData } = await supabase
    .from('menus')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .single()
  if (!menuData) return null

  const { data: sectionsData } = await supabase
    .from('menu_sections')
    .select('*')
    .eq('menu_id', id)
    .order('sort_order', { ascending: true })

  const sections = (sectionsData ?? []) as MenuSection[]
  const sectionIds = sections.map((s) => s.id)

  let items: MenuItem[] = []
  if (sectionIds.length > 0) {
    const { data: itemsData } = await supabase
      .from('menu_items')
      .select('*')
      .in('section_id', sectionIds)
      .eq('available', true)
      .order('sort_order', { ascending: true })
    items = (itemsData ?? []) as MenuItem[]
  }

  const sectionsWithItems: MenuSectionWithItems[] = sections.map((s) => ({
    ...s,
    items: items.filter((i) => i.section_id === s.id),
  }))

  return { ...(menuData as Menu), sections: sectionsWithItems }
}
