import { useState } from 'react'
import { Sparkles, Minus, Plus, X, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { generateMenuFromPrompt } from '../../lib/gemini'
import { useAuth } from '../../contexts/AuthContext'
import type { MenuType } from '../../types/database.types'

interface AIMenuGeneratorDrawerProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const MENU_TYPES: MenuType[] = ['a_la_carte', 'buffet', 'tasting', 'daily']

export function AIMenuGeneratorDrawer({ open, onClose, onCreated }: AIMenuGeneratorDrawerProps) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [prompt, setPrompt] = useState('')
  const [menuType, setMenuType] = useState<MenuType>('a_la_carte')
  const [covers, setCovers] = useState(20)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<import('../../lib/gemini').AIGeneratedMenu | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]))

  function toggleSection(idx: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    setPreview(null)
    try {
      const result = await generateMenuFromPrompt(prompt.trim(), menuType, covers)
      setPreview(result)
      setExpandedSections(new Set(result.sections.map((_, i) => i)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCreate() {
    if (!preview || !profile?.team_id || !profile?.id) return
    setGenerating(true)
    setError(null)
    try {
      // 1. Create menu
      const { data: menuData, error: menuErr } = await supabase
        .from('menus')
        .insert({
          team_id: profile.team_id,
          name: preview.name,
          description: preview.description ?? null,
          type: menuType,
          active: true,
          show_prices: menuType !== 'buffet',
        })
        .select('id')
        .single()
      if (menuErr) throw menuErr
      const menuId = (menuData as { id: string }).id

      for (let si = 0; si < preview.sections.length; si++) {
        const section = preview.sections[si]

        // 2. Create section
        const { data: sectionData, error: sectionErr } = await supabase
          .from('menu_sections')
          .insert({ menu_id: menuId, name: section.name, sort_order: si })
          .select('id')
          .single()
        if (sectionErr) throw sectionErr
        const sectionId = (sectionData as { id: string }).id

        for (let ii = 0; ii < section.items.length; ii++) {
          const item = section.items[ii]
          let recipeId: string | null = null

          // 3. Create recipe if provided
          if (item.recipe) {
            const { data: recipeData } = await supabase
              .from('recipes')
              .insert({
                team_id: profile.team_id,
                created_by: profile.id,
                title: item.recipe.title,
                description: item.recipe.description ?? null,
                instructions: item.recipe.instructions ?? null,
                allergens: item.recipe.allergens ?? [],
                prep_time: item.recipe.prep_time ?? null,
                cook_time: item.recipe.cook_time ?? null,
                servings: item.recipe.servings ?? 4,
              })
              .select('id')
              .single()
            recipeId = (recipeData as { id: string } | null)?.id ?? null
          }

          // 4. Create menu item
          await supabase.from('menu_items').insert({
            section_id: sectionId,
            name: item.name,
            description: item.description ?? null,
            price: item.price ?? null,
            available: true,
            sort_order: ii,
            recipe_id: recipeId,
          })
        }
      }

      onCreated()
      onClose()
      navigate(`/menus/${menuId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create menu')
    } finally {
      setGenerating(false)
    }
  }

  function handleClose() {
    if (generating) return
    setPrompt('')
    setPreview(null)
    setError(null)
    onClose()
  }

  const totalItems = preview?.sections.reduce((s, sec) => s + sec.items.length, 0) ?? 0

  return (
    <Drawer open={open} onClose={handleClose} title={t('menus.aiGenerator.title')}>
      <div className="space-y-5">

        {/* Prompt */}
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80">
            {t('menus.aiGenerator.prompt')}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('menus.aiGenerator.promptPlaceholder')}
            rows={4}
            disabled={generating}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:ring-2 focus:ring-brand-orange resize-none"
          />
        </div>

        {/* Type + Covers row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">{t('menus.aiGenerator.menuType')}</label>
            <div className="glass flex items-center rounded-xl px-4 min-h-[44px] focus-within:ring-2 focus-within:ring-brand-orange">
              <select
                value={menuType}
                onChange={(e) => setMenuType(e.target.value as MenuType)}
                disabled={generating}
                className="flex-1 bg-transparent outline-none text-sm text-white"
              >
                {MENU_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#1a1208]">{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">{t('menus.aiGenerator.covers')}</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCovers((c) => Math.max(1, c - 5))} disabled={generating}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition disabled:opacity-40">
                <Minus className="h-4 w-4" />
              </button>
              <input type="number" min={1} value={covers} onChange={(e) => setCovers(Math.max(1, Number(e.target.value) || 1))}
                disabled={generating}
                className="flex-1 min-w-0 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white text-center outline-none focus:ring-2 focus:ring-brand-orange" />
              <button type="button" onClick={() => setCovers((c) => c + 5)} disabled={generating}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition disabled:opacity-40">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Generate button */}
        {!preview && (
          <Button
            className="w-full"
            leftIcon={<Sparkles className="h-4 w-4" />}
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
          >
            {generating ? t('menus.aiGenerator.generating') : t('menus.aiGenerator.generate')}
          </Button>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3">
              <p className="font-semibold text-white">{preview.name}</p>
              {preview.description && <p className="text-sm text-white/50 mt-1">{preview.description}</p>}
              <p className="text-xs text-brand-orange/70 mt-2">
                {preview.sections.length} {t('menus.aiGenerator.sections')} · {totalItems} {t('menus.aiGenerator.dishes')}
              </p>
            </div>

            {/* Sections accordion */}
            <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/8">
              {preview.sections.map((section, si) => (
                <div key={si}>
                  <button
                    type="button"
                    onClick={() => toggleSection(si)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition"
                  >
                    {expandedSections.has(si)
                      ? <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />
                    }
                    <span className="flex-1 text-sm font-semibold text-white/80">{section.name}</span>
                    <span className="text-xs text-white/35">{section.items.length}</span>
                  </button>
                  {expandedSections.has(si) && (
                    <ul className="divide-y divide-white/5 bg-white/2">
                      {section.items.map((item, ii) => (
                        <li key={ii} className="px-4 py-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-white/80 font-medium truncate">{item.name}</p>
                            {item.description && <p className="text-xs text-white/35 truncate mt-0.5">{item.description}</p>}
                            {item.recipe?.allergens && item.recipe.allergens.length > 0 && (
                              <p className="text-xs text-amber-400/60 mt-0.5">{item.recipe.allergens.join(', ')}</p>
                            )}
                          </div>
                          {item.price != null && (
                            <span className="text-sm font-semibold text-white/60 shrink-0">€{item.price.toFixed(2)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleCreate} disabled={generating}>
                {generating ? t('common.saving') : t('menus.aiGenerator.createMenu')}
              </Button>
              <Button variant="secondary" leftIcon={<Sparkles className="h-4 w-4" />} onClick={handleGenerate} disabled={generating}>
                {t('menus.aiGenerator.regenerate')}
              </Button>
              <Button variant="ghost" leftIcon={<X className="h-4 w-4" />} onClick={() => setPreview(null)} disabled={generating}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
