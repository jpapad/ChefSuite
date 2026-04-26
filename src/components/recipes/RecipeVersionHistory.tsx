import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { History, RotateCcw } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { useRecipeVersions } from '../../hooks/useRecipeVersions'
import type { Recipe, RecipeVersion } from '../../types/database.types'

interface Props {
  recipe: Recipe
  open: boolean
  onClose: () => void
  onRestore: (version: RecipeVersion) => void
}

export function RecipeVersionHistory({ recipe, open, onClose, onRestore }: Props) {
  const { t } = useTranslation()
  const { versions, loading, loadVersions } = useRecipeVersions()

  useEffect(() => {
    if (open) void loadVersions(recipe.id)
  }, [open, recipe.id, loadVersions])

  function fmt(iso: string) {
    return new Date(iso).toLocaleString([], {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <Drawer open={open} onClose={onClose} title={t('recipes.versions.title')}>
      {loading ? (
        <p className="text-white/60 text-sm">{t('common.loading')}</p>
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/40">
            <History className="h-6 w-6" />
          </div>
          <p className="text-white/60 text-sm">{t('recipes.versions.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {versions.map((v, idx) => (
            <li key={v.id} className="rounded-xl border border-glass-border bg-white/3 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">{v.title}</div>
                  <div className="text-xs text-white/50 mt-0.5">{fmt(v.created_at)}</div>
                  {idx === 0 && (
                    <span className="inline-block mt-1 rounded-md bg-brand-orange/20 px-1.5 py-0.5 text-[11px] text-brand-orange font-medium">
                      {t('recipes.versions.latest')}
                    </span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={() => onRestore(v)}
                >
                  {t('recipes.versions.restore')}
                </Button>
              </div>
              {v.description && (
                <p className="text-xs text-white/50 line-clamp-2">{v.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-white/40">
                {v.category && <span className="rounded bg-white/5 px-1.5 py-0.5">{v.category}</span>}
                {v.cost_per_portion != null && (
                  <span>{t('recipes.versions.cost', { cost: v.cost_per_portion.toFixed(2) })}</span>
                )}
                {v.allergens.length > 0 && (
                  <span>{v.allergens.join(', ')}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
