import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Copy, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Drawer } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { MenuWithSections, Recipe } from '../../types/database.types'

interface IngredientRow {
  recipe_id: string
  quantity: number
  inventory: { name: string; unit: string; cost_per_unit: number | null } | null
}

interface ShoppingLine {
  name: string
  unit: string
  quantity: number
  estimatedCost: number | null
  missingCost: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  menu: MenuWithSections
  recipes: Recipe[]
}

export function ShoppingListDrawer({ open, onClose, menu, recipes }: Props) {
  const { t } = useTranslation()
  const [pax, setPax] = useState('10')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const linkedRecipeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const section of menu.sections) {
      for (const item of section.items) {
        if (item.recipe_id) ids.add(item.recipe_id)
      }
    }
    return [...ids]
  }, [menu])

  useEffect(() => {
    if (!open || linkedRecipeIds.length === 0) return
    setLoading(true)
    supabase
      .from('recipe_ingredients')
      .select('recipe_id, quantity, inventory:inventory_item_id(name, unit, cost_per_unit)')
      .in('recipe_id', linkedRecipeIds)
      .then(({ data }) => {
        setIngredients((data ?? []) as unknown as IngredientRow[])
        setLoading(false)
      })
  }, [open, linkedRecipeIds.join(',')])

  const covers = Math.max(1, parseInt(pax) || 1)

  const shoppingLines = useMemo((): ShoppingLine[] => {
    const map = new Map<string, ShoppingLine>()

    for (const section of menu.sections) {
      for (const item of section.items) {
        if (!item.recipe_id) continue
        const recipeIngredients = ingredients.filter((i) => i.recipe_id === item.recipe_id)
        for (const ri of recipeIngredients) {
          if (!ri.inventory) continue
          const key = ri.inventory.name
          const qty = ri.quantity * covers
          const cpu = ri.inventory.cost_per_unit
          const existing = map.get(key)
          if (existing) {
            existing.quantity = Math.round((existing.quantity + qty) * 100) / 100
            if (cpu != null && existing.estimatedCost != null) {
              existing.estimatedCost = Math.round((existing.estimatedCost + qty * cpu) * 100) / 100
            } else {
              existing.estimatedCost = null
              existing.missingCost = true
            }
          } else {
            map.set(key, {
              name: key,
              unit: ri.inventory.unit,
              quantity: Math.round(qty * 100) / 100,
              estimatedCost: cpu != null ? Math.round(qty * cpu * 100) / 100 : null,
              missingCost: cpu == null,
            })
          }
        }
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [menu, ingredients, covers])

  const totalCost = useMemo(() => {
    const lines = shoppingLines.filter((l) => l.estimatedCost != null)
    if (lines.length === 0) return null
    return Math.round(lines.reduce((s, l) => s + l.estimatedCost!, 0) * 100) / 100
  }, [shoppingLines])

  const missingCostCount = shoppingLines.filter((l) => l.missingCost).length

  async function copyList() {
    const text = [
      `${menu.name} — ${t('menus.shopping.basedOn', { count: covers })}`,
      '',
      ...shoppingLines.map((l) =>
        `${l.name}: ${l.quantity} ${l.unit}${l.estimatedCost != null ? ` (€${l.estimatedCost.toFixed(2)})` : ''}`,
      ),
      '',
      totalCost != null ? `Total: €${totalCost.toFixed(2)}` : '',
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Drawer open={open} onClose={onClose} title={t('menus.shopping.drawerTitle')}>
      <div className="space-y-5">
        {linkedRecipeIds.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ShoppingCart className="h-10 w-10 text-white/20" />
            <p className="text-white/50 text-sm">{t('menus.shopping.noRecipes')}</p>
          </div>
        ) : (
          <>
            <Input
              name="pax"
              type="number"
              min="1"
              label={t('menus.shopping.coversLabel')}
              placeholder={t('menus.shopping.coversPlaceholder')}
              value={pax}
              onChange={(e) => setPax(e.target.value)}
            />

            {loading ? (
              <p className="text-white/50 text-sm">{t('common.loading')}</p>
            ) : shoppingLines.length === 0 ? (
              <p className="text-white/50 text-sm">{t('menus.shopping.noIngredients')}</p>
            ) : (
              <>
                <p className="text-xs text-white/50">
                  {t('menus.shopping.basedOn', { count: covers })}
                  {missingCostCount > 0 && (
                    <span className="ml-2 text-amber-400">
                      · {t('menus.shopping.missingCost', { count: missingCostCount })}
                    </span>
                  )}
                </p>

                {/* Table */}
                <div className="rounded-xl border border-glass-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-glass-border bg-white/5">
                        <th className="text-left px-3 py-2 text-xs text-white/50 font-medium">{t('menus.shopping.ingredient')}</th>
                        <th className="text-right px-3 py-2 text-xs text-white/50 font-medium">{t('menus.shopping.quantity')}</th>
                        <th className="text-right px-3 py-2 text-xs text-white/50 font-medium">{t('menus.shopping.estimatedCost')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shoppingLines.map((line, idx) => (
                        <tr key={idx} className="border-b border-glass-border/50 last:border-0">
                          <td className="px-3 py-2 font-medium">{line.name}</td>
                          <td className="px-3 py-2 text-right text-white/70 tabular-nums">
                            {line.quantity} <span className="text-white/40">{line.unit}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {line.estimatedCost != null
                              ? <span className="text-brand-orange font-semibold">€{line.estimatedCost.toFixed(2)}</span>
                              : <span className="text-white/20">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {totalCost != null && (
                      <tfoot>
                        <tr className="border-t border-glass-border bg-white/5">
                          <td colSpan={2} className="px-3 py-2 text-xs text-white/50 font-medium">
                            {t('menus.shopping.totalEstimated')}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-brand-orange">
                            €{totalCost.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  onClick={copyList}
                  className="w-full"
                >
                  {copied ? t('menus.shopping.copied') : t('menus.shopping.copyList')}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}
