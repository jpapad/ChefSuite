import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Trash2, Check, X, ChevronDown, ChevronRight, Zap,
} from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { cn } from '../../lib/cn'
import { usePrepTemplates, type PrepTemplateWithItems } from '../../hooks/usePrepTemplates'
import type { Recipe, Workstation } from '../../types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  recipes: Recipe[]
  workstations: Workstation[]
  onApply: (template: PrepTemplateWithItems) => Promise<void>
}

interface ItemFormState {
  title: string
  quantity: string
  recipe_id: string
  workstation_id: string
}

function blankItemForm(): ItemFormState {
  return { title: '', quantity: '', recipe_id: '', workstation_id: '' }
}

export function PrepTemplatesDrawer({ open, onClose, recipes, workstations, onApply }: Props) {
  const { t } = useTranslation()
  const { templates, loading, createTemplate, removeTemplate, addItem, removeItem } = usePrepTemplates()

  const [newTemplateName, setNewTemplateName] = useState('')
  const [addingTemplate, setAddingTemplate] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormState>(blankItemForm())
  const [savingItem, setSavingItem] = useState(false)

  const [applying, setApplying] = useState<string | null>(null)

  async function handleCreateTemplate() {
    if (!newTemplateName.trim()) return
    setSavingTemplate(true)
    try {
      const tmpl = await createTemplate(newTemplateName)
      setNewTemplateName('')
      setAddingTemplate(false)
      setExpandedId(tmpl.id)
    } finally {
      setSavingTemplate(false)
    }
  }

  async function handleAddItem(templateId: string) {
    if (!itemForm.title.trim()) return
    setSavingItem(true)
    try {
      await addItem(templateId, {
        title: itemForm.title.trim(),
        description: null,
        recipe_id: itemForm.recipe_id || null,
        workstation_id: itemForm.workstation_id || null,
        quantity: itemForm.quantity ? parseFloat(itemForm.quantity) : null,
      })
      setItemForm(blankItemForm())
      setAddingItemFor(null)
    } finally {
      setSavingItem(false)
    }
  }

  async function handleApply(tmpl: PrepTemplateWithItems) {
    setApplying(tmpl.id)
    try {
      await onApply(tmpl)
      onClose()
    } finally {
      setApplying(null)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={t('prep.templates.drawerTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-white/50">{t('prep.templates.hint')}</p>

        {loading ? (
          <p className="text-white/50 text-sm">{t('common.loading')}</p>
        ) : (
          <div className="space-y-3">
            {templates.map((tmpl) => {
              const isExpanded = expandedId === tmpl.id
              return (
                <div key={tmpl.id} className="rounded-xl border border-glass-border overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-white/5">
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                      className="flex-1 flex items-center gap-2 text-left text-sm font-semibold">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />}
                      {tmpl.name}
                      <span className="text-white/40 font-normal text-xs">({tmpl.items.length})</span>
                    </button>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Zap className="h-3.5 w-3.5" />}
                      onClick={() => handleApply(tmpl)}
                      disabled={tmpl.items.length === 0 || applying === tmpl.id}
                    >
                      {applying === tmpl.id ? t('common.saving') : t('prep.templates.apply')}
                    </Button>
                    <button type="button" onClick={() => removeTemplate(tmpl.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Items */}
                  {isExpanded && (
                    <div className="border-t border-glass-border divide-y divide-glass-border/50">
                      {tmpl.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{item.title}</span>
                            {item.quantity != null && (
                              <span className="ml-2 text-white/40 text-xs">×{item.quantity}</span>
                            )}
                            {item.recipe_id && (
                              <span className="ml-2 text-white/30 text-xs">
                                {recipes.find((r) => r.id === item.recipe_id)?.title}
                              </span>
                            )}
                            {item.workstation_id && (
                              <span className="ml-2 text-white/30 text-xs">
                                @ {workstations.find((w) => w.id === item.workstation_id)?.name}
                              </span>
                            )}
                          </div>
                          <button type="button" onClick={() => removeItem(tmpl.id, item.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Add item row */}
                      {addingItemFor === tmpl.id ? (
                        <div className="px-4 py-3 space-y-3 bg-white/5">
                          <Input
                            name="item_title"
                            label={t('prep.templates.itemTitle')}
                            placeholder={t('prep.templates.itemTitlePlaceholder')}
                            value={itemForm.title}
                            onChange={(e) => setItemForm((v) => ({ ...v, title: e.target.value }))}
                            autoFocus
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              name="item_qty"
                              type="number"
                              label={t('prep.templates.itemQty')}
                              placeholder="20"
                              step="any"
                              min={0}
                              value={itemForm.quantity}
                              onChange={(e) => setItemForm((v) => ({ ...v, quantity: e.target.value }))}
                            />
                            <div>
                              <span className="mb-2 block text-xs font-medium text-white/70">{t('prep.templates.itemWorkstation')}</span>
                              <div className="glass flex items-center rounded-xl px-3 min-h-[2.5rem] focus-within:ring-2 focus-within:ring-brand-orange">
                                <select value={itemForm.workstation_id}
                                  onChange={(e) => setItemForm((v) => ({ ...v, workstation_id: e.target.value }))}
                                  className="flex-1 bg-transparent outline-none text-sm text-white">
                                  <option value="" className="bg-[#f5ede0]">—</option>
                                  {workstations.map((w) => (
                                    <option key={w.id} value={w.id} className="bg-[#f5ede0]">{w.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                          <div>
                            <span className="mb-2 block text-xs font-medium text-white/70">{t('prep.templates.itemRecipe')}</span>
                            <div className="glass flex items-center rounded-xl px-3 min-h-[2.5rem] focus-within:ring-2 focus-within:ring-brand-orange">
                              <select value={itemForm.recipe_id}
                                onChange={(e) => setItemForm((v) => ({ ...v, recipe_id: e.target.value }))}
                                className="flex-1 bg-transparent outline-none text-sm text-white">
                                <option value="" className="bg-[#f5ede0]">— {t('prep.form.noRecipe')} —</option>
                                {recipes.map((r) => (
                                  <option key={r.id} value={r.id} className="bg-[#f5ede0]">{r.title}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleAddItem(tmpl.id)} disabled={savingItem || !itemForm.title.trim()}
                              leftIcon={<Check className="h-3.5 w-3.5" />}>
                              {t('common.add')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAddingItemFor(null); setItemForm(blankItemForm()) }}>
                              {t('common.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button type="button"
                          onClick={() => { setAddingItemFor(tmpl.id); setItemForm(blankItemForm()) }}
                          className={cn(
                            'w-full flex items-center gap-2 px-4 py-3 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition',
                          )}>
                          <Plus className="h-3.5 w-3.5" />
                          {t('prep.templates.addItem')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* New template */}
        {addingTemplate ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateTemplate()
                if (e.key === 'Escape') { setAddingTemplate(false); setNewTemplateName('') }
              }}
              placeholder={t('prep.templates.namePlaceholder')}
              className="flex-1 min-w-0 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-brand-orange"
            />
            <button type="button" onClick={() => void handleCreateTemplate()} disabled={savingTemplate}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-white-fixed hover:bg-brand-orange/80 transition">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => { setAddingTemplate(false); setNewTemplateName('') }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 text-white/50 hover:text-white transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingTemplate(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-sm text-white/50 hover:text-white hover:border-white/40 transition">
            <Plus className="h-4 w-4" />
            {t('prep.templates.newTemplate')}
          </button>
        )}
      </div>
    </Drawer>
  )
}
