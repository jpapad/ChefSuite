import { useRef, useState, useCallback } from 'react'
import { Upload, FileText, Loader2, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, X, ShoppingCart, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'

interface DishIngredient {
  name: string
  quantity: number | null
  unit: string | null
}

interface ExtractedDish {
  name: string
  category: string | null
  description: string | null
  price: number | null
  allergens: string[]
  ingredients: DishIngredient[]
}

interface Props {
  open: boolean
  onClose: () => void
}

const ALLERGEN_ICON: Record<string, string> = {
  gluten: '🌾', dairy: '🥛', eggs: '🥚', nuts: '🌰', peanuts: '🥜',
  soy: '🫘', fish: '🐟', shellfish: '🦐', sesame: '🌱', celery: '🌿',
  mustard: '🌭', sulphites: '🍷', lupin: '🫘', molluscs: '🦑',
}

export function MenuPdfImportDrawer({ open, onClose }: Props) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dishes, setDishes] = useState<ExtractedDish[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setDishes([])
    setError(null)
    setFileName(null)
    setExpandedIdx(null)
  }

  async function processFile(file: File) {
    if (!file.type.includes('pdf') && !file.type.includes('image')) {
      setError('Παρακαλώ επιλέξτε αρχείο PDF ή εικόνα.')
      return
    }
    reset()
    setFileName(file.name)
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      const { data, error: fnErr } = await supabase.functions.invoke('parse-menu-pdf', {
        body: { file_base64: base64, media_type: file.type || 'application/pdf' },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error)
      if (!data?.dishes?.length) throw new Error('Δεν βρέθηκαν πιάτα στο αρχείο.')

      setDishes(data.dishes as ExtractedDish[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Σφάλμα επεξεργασίας αρχείου.')
    } finally {
      setLoading(false)
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void processFile(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }, [])

  function buildShoppingList(): string {
    const lines: string[] = []
    const seen = new Set<string>()
    for (const dish of dishes) {
      lines.push(`\n## ${dish.name}`)
      for (const ing of dish.ingredients) {
        const key = ing.name.toLowerCase()
        const qty = ing.quantity ? `${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}` : ''
        const mark = seen.has(key) ? '' : ''
        seen.add(key)
        lines.push(`${mark} - ${ing.name}${qty ? ' (' + qty + ')' : ''}`)
      }
    }
    return lines.join('\n').trim()
  }

  function copyShoppingList() {
    navigator.clipboard.writeText(buildShoppingList()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function downloadCsv() {
    const header = 'Πιάτο,Κατηγορία,Τιμή,Υλικό,Ποσότητα,Μονάδα,Αλλεργιογόνα'
    const rows: string[] = [header]
    for (const dish of dishes) {
      if (dish.ingredients.length === 0) {
        rows.push([dish.name, dish.category ?? '', dish.price ?? '', '', '', '', dish.allergens.join('; ')].join(','))
      } else {
        for (const ing of dish.ingredients) {
          rows.push([dish.name, dish.category ?? '', dish.price ?? '', ing.name, ing.quantity ?? '', ing.unit ?? '', dish.allergens.join('; ')].join(','))
        }
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `menu-ingredients-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const categories = [...new Set(dishes.map((d) => d.category ?? 'Γενικά'))]

  return (
    <Drawer open={open} onClose={onClose} title={t('menuPdf.title')}>
      <div className="flex flex-col gap-5">
        <p className="text-xs text-white/50">{t('menuPdf.subtitle')}</p>

        {/* Upload zone */}
        {!dishes.length && !loading && (
          <div
            className={cn(
              'relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 px-6 transition cursor-pointer',
              dragging ? 'border-brand-orange bg-brand-orange/10' : 'border-white/15 hover:border-white/30 hover:bg-white/3',
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="h-14 w-14 rounded-2xl bg-brand-orange/15 flex items-center justify-center">
              <Upload className="h-7 w-7 text-brand-orange" />
            </div>
            <div className="text-center">
              <p className="font-medium text-white/90">{t('menuPdf.dropPdf')}</p>
              <p className="text-xs text-white/40 mt-1">{t('menuPdf.orClick')}</p>
            </div>
            <p className="text-[10px] text-white/25 uppercase tracking-wider">PDF · JPG · PNG</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={onFileInput}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-brand-orange/20" />
              <div className="absolute inset-0 rounded-full border-2 border-t-brand-orange border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-brand-orange animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium text-white/80">{t('menuPdf.processing')}</p>
              <p className="text-xs text-white/40 mt-1">{fileName}</p>
            </div>
            <p className="text-xs text-white/30">{t('menuPdf.processingHint')}</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/25 p-4">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300">{error}</p>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-white/30 hover:text-white/60">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Results */}
        {dishes.length > 0 && (
          <>
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="font-semibold">{t('menuPdf.found', { count: dishes.length })}</span>
                <span className="text-xs text-white/40">· {fileName}</span>
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
              >
                <Upload className="h-3.5 w-3.5" /> {t('menuPdf.uploadNew')}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="md"
                leftIcon={copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <ShoppingCart className="h-4 w-4" />}
                onClick={copyShoppingList}
              >
                {copied ? t('menuPdf.copied') : t('menuPdf.copyShoppingList')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={downloadCsv}
              >
                {t('menuPdf.downloadCsv')}
              </Button>
            </div>

            {/* Dishes grouped by category */}
            {categories.map((cat) => (
              <div key={cat} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> {cat}
                </p>
                {dishes
                  .filter((d) => (d.category ?? 'Γενικά') === cat)
                  .map((dish) => {
                    const idx = dishes.indexOf(dish)
                    const isOpen = expandedIdx === idx
                    return (
                      <div key={idx} className="glass rounded-xl overflow-hidden border border-white/8">
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/3 transition"
                          onClick={() => setExpandedIdx(isOpen ? null : idx)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{dish.name}</span>
                              {dish.price != null && (
                                <span className="text-xs text-brand-orange font-semibold">{dish.price.toFixed(2)}€</span>
                              )}
                            </div>
                            {dish.description && (
                              <p className="text-xs text-white/45 mt-0.5 truncate">{dish.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-white/30">
                                {dish.ingredients.length} {t('menuPdf.ingredients')}
                              </span>
                              {dish.allergens.slice(0, 4).map((a) => (
                                <span key={a} title={a}>{ALLERGEN_ICON[a] ?? '⚠️'}</span>
                              ))}
                              {dish.allergens.length > 4 && (
                                <span className="text-[10px] text-white/30">+{dish.allergens.length - 4}</span>
                              )}
                            </div>
                          </div>
                          {isOpen
                            ? <ChevronUp className="h-4 w-4 text-white/30 flex-shrink-0" />
                            : <ChevronDown className="h-4 w-4 text-white/30 flex-shrink-0" />
                          }
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 border-t border-white/8">
                            {dish.description && (
                              <p className="text-xs text-white/60 py-2 italic">{dish.description}</p>
                            )}
                            {dish.ingredients.length > 0 && (
                              <div className="mt-2">
                                <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">{t('menuPdf.ingredientsNeeded')}</p>
                                <ul className="space-y-1">
                                  {dish.ingredients.map((ing, i) => (
                                    <li key={i} className="flex items-center justify-between text-sm">
                                      <span className="text-white/80">{ing.name}</span>
                                      {(ing.quantity || ing.unit) && (
                                        <span className="text-xs text-white/40 tabular-nums">
                                          {ing.quantity}{ing.unit ? ' ' + ing.unit : ''}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {dish.allergens.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1">{t('menuPdf.allergens')}</p>
                                <div className="flex flex-wrap gap-1">
                                  {dish.allergens.map((a) => (
                                    <span key={a} className="inline-flex items-center gap-1 text-[11px] rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-white/60">
                                      {ALLERGEN_ICON[a]} {a}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            ))}
          </>
        )}
      </div>
    </Drawer>
  )
}
