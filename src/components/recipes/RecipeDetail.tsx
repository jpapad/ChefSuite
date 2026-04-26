import { AlertTriangle, Euro, Minus, Package, PackageCheck, PackageX, Plus, UtensilsCrossed, Mic, MicOff, ChevronLeft, ChevronRight, X, Tag, TrendingUp, Clock, Flame, Users, Share2, Printer, CheckCheck, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { printRecipe } from '../../lib/printRecipe'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTeam } from '../../hooks/useTeam'
import type { Profile } from '../../types/database.types'
import { useAutoTranslate, useAutoTranslateMany } from '../../hooks/useAutoTranslate'

interface SRResult { readonly [i: number]: { transcript: string }; readonly length: number }
interface SRResultList { readonly [i: number]: SRResult; readonly length: number }
interface SREvent { readonly results: SRResultList }
interface SRInstance {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: SREvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void; stop(): void
}
type SRCtor = new () => SRInstance
import { useTranslation } from 'react-i18next'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import type { InventoryItem, Recipe, RecipeIngredient } from '../../types/database.types'

function splitSteps(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
}

function HandsFreeMode({ steps, onClose }: { steps: string[]; onClose: () => void }) {
  const { t } = useTranslation()
  const [idx, setIdx] = useState(0)
  const [listening, setListening] = useState(false)
  const recogRef = useRef<SRInstance | null>(null)

  const current = steps[idx]
  const progress = ((idx + 1) / steps.length) * 100

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utt)
  }

  function goNext() { if (idx < steps.length - 1) { setIdx(idx + 1); speak(steps[idx + 1]) } }
  function goPrev() { if (idx > 0) { setIdx(idx - 1); speak(steps[idx - 1]) } }
  function reread() { speak(current) }

  function toggleVoice() {
    const w = window as unknown as Record<string, SRCtor | undefined>
    const SR: SRCtor | undefined = w['SpeechRecognition'] ?? w['webkitSpeechRecognition']
    if (!SR) { alert('Speech recognition not supported in this browser'); return }
    if (listening) {
      recogRef.current?.stop(); setListening(false); return
    }
    const r = new SR()
    r.lang = 'en-US'; r.continuous = true; r.interimResults = false
    r.onresult = (e) => {
      const cmd = e.results[e.results.length - 1][0].transcript.toLowerCase().trim()
      if (cmd.includes('next')) goNext()
      else if (cmd.includes('back') || cmd.includes('previous')) goPrev()
      else if (cmd.includes('repeat') || cmd.includes('again')) reread()
      else if (cmd.includes('stop') || cmd.includes('exit') || cmd.includes('close')) onClose()
    }
    r.onerror = () => setListening(false)
    r.onend = () => { if (listening) r.start() }
    r.start()
    recogRef.current = r
    setListening(true)
  }

  useEffect(() => { speak(current) }, [])
  useEffect(() => () => { recogRef.current?.stop(); window.speechSynthesis.cancel() }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-chef-dark" style={{ touchAction: 'manipulation' }}>
      <div className="h-1 bg-white/10">
        <div className="h-1 bg-brand-orange transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-b border-glass-border">
        <span className="text-white/50 text-sm">{t('recipes.detail.stepOf', { current: idx + 1, total: steps.length })}</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={toggleVoice}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${listening ? 'bg-brand-orange text-white-fixed' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            {listening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            {listening ? t('recipes.detail.listening') : t('recipes.detail.voiceControl')}
          </button>
          <button type="button" onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-8">
        <p className="text-center text-2xl md:text-4xl font-medium leading-relaxed text-white max-w-3xl">
          {current}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 px-6 pb-8 pt-4 border-t border-glass-border">
        <button type="button" onClick={goPrev} disabled={idx === 0}
          className="flex items-center gap-2 rounded-2xl px-6 py-4 text-lg font-medium bg-white/10 text-white/70 hover:bg-white/15 disabled:opacity-30 transition min-w-[120px] justify-center">
          <ChevronLeft className="h-6 w-6" /> {t('common.back')}
        </button>
        <button type="button" onClick={reread}
          className="rounded-2xl px-6 py-4 text-sm font-medium bg-white/5 text-white/50 hover:text-white transition">
          {t('recipes.detail.repeatStep')}
        </button>
        {idx < steps.length - 1 ? (
          <button type="button" onClick={goNext}
            className="flex items-center gap-2 rounded-2xl px-6 py-4 text-lg font-medium bg-brand-orange text-white-fixed hover:bg-brand-orange/90 transition min-w-[120px] justify-center">
            {t('common.next')} <ChevronRight className="h-6 w-6" />
          </button>
        ) : (
          <button type="button" onClick={onClose}
            className="rounded-2xl px-6 py-4 text-lg font-medium bg-emerald-500 text-white hover:bg-emerald-500/90 transition min-w-[120px] text-center">
            {t('common.done')}
          </button>
        )}
      </div>
      {listening && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-xs text-white/40 text-center">
          Say "next", "back", "repeat" or "stop"
        </div>
      )}
    </div>
  )
}

interface RecipeDetailProps {
  recipe: Recipe | null
  ingredients: RecipeIngredient[]
  inventory: InventoryItem[]
  onClose: () => void
  onEdit: (recipe: Recipe) => void
  onConsume: (recipe: Recipe, portions: number) => Promise<void>
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMin(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60); const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

const DIFFICULTY_STYLE = {
  easy:   'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/40  bg-amber-500/10  text-amber-300',
  hard:   'border-red-500/40    bg-red-500/10    text-red-300',
}

export function RecipeDetail({
  recipe,
  ingredients,
  inventory,
  onClose,
  onEdit,
  onConsume,
}: RecipeDetailProps) {
  const { t } = useTranslation()
  const { profile: myProfile } = useAuth()
  const { members } = useTeam()
  const [consuming, setConsuming] = useState(false)
  const [consumeError, setConsumeError] = useState<string | null>(null)
  const [handsFree, setHandsFree] = useState(false)
  const [portions, setPortions] = useState(1)
  const [copied, setCopied] = useState(false)
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const otherMembers = members.filter((m) => m.id !== myProfile?.id)

  useEffect(() => {
    if (!showMemberPicker) return
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowMemberPicker(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showMemberPicker])

  async function handleSendToMember(member: Profile) {
    if (!recipe || !myProfile?.team_id) return
    const senderName = myProfile.full_name ?? t('common.someone')
    await supabase.from('notifications').insert({
      team_id: myProfile.team_id,
      user_id: member.id,
      type: 'recipe_shared',
      title: t('recipes.detail.sentNotifTitle', { name: senderName }),
      body: recipe.title,
      data: { recipe_id: recipe.id, recipe_title: recipe.title },
    })
    setSentTo(member.id)
    setShowMemberPicker(false)
    setTimeout(() => setSentTo(null), 2500)
  }

  useEffect(() => { setPortions(1) }, [recipe?.id])

  async function handleShare() {
    if (!recipe) return
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: recipe.title, text: recipe.description ?? recipe.title, url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handlePrint() {
    if (!recipe) return
    printRecipe(recipe, ingredients, inventory)
  }

  async function handleMake() {
    if (!recipe) return
    const input = window.prompt(t('recipes.detail.makePrompt', { title: recipe.title }), '1')
    if (input === null) return
    const p = parseFloat(input)
    if (isNaN(p) || p <= 0) { window.alert(t('recipes.detail.makeInvalid')); return }
    setConsuming(true)
    setConsumeError(null)
    try { await onConsume(recipe, p) }
    catch (err) { setConsumeError(err instanceof Error ? err.message : 'Failed.') }
    finally { setConsuming(false) }
  }

  const canMake = ingredients.length > 0 && ingredients.every((ing) => {
    const item = inventory.find((i) => i.id === ing.inventory_item_id)
    return item && item.quantity >= ing.quantity
  })

  // Auto-translate user-generated content
  const trTitle       = useAutoTranslate(recipe?.title ?? null)
  const trDescription = useAutoTranslate(recipe?.description ?? null)
  // Split steps first, then translate each one individually (avoids MyMemory 500-char limit)
  const steps = recipe?.instructions ? splitSteps(recipe.instructions) : []
  const trSteps = useAutoTranslateMany(steps)
  const ingNames = ingredients.map((ing) => inventory.find((i) => i.id === ing.inventory_item_id)?.name ?? null)
  const trIngNames = useAutoTranslateMany(ingNames)

  const effectiveCost = recipe?.cost_per_portion ?? (() => {
    if (!recipe || ingredients.length === 0) return null
    let total = 0
    for (const ing of ingredients) {
      const item = inventory.find((i) => i.id === ing.inventory_item_id)
      if (item?.cost_per_unit == null) return null
      total += item.cost_per_unit * ing.quantity
    }
    return total
  })()

  const foodCostPct =
    effectiveCost != null && recipe?.selling_price != null && recipe.selling_price > 0
      ? (effectiveCost / recipe.selling_price) * 100
      : null

  return (
    <>
      {handsFree && steps.length > 0 && (
        <HandsFreeMode steps={steps} onClose={() => setHandsFree(false)} />
      )}
      <Drawer
        open={!!recipe}
        onClose={onClose}
        title={trTitle ?? recipe?.title ?? ''}
        footer={
          recipe ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { onClose(); onEdit(recipe) }} className="flex-1">
                  {t('common.edit')}
                </Button>
                {steps.length > 0 && (
                  <Button variant="secondary" leftIcon={<Mic className="h-4 w-4" />}
                    onClick={() => setHandsFree(true)} className="flex-1">
                    {t('recipes.detail.handsFree')}
                  </Button>
                )}
                {ingredients.length > 0 && (
                  <Button leftIcon={<UtensilsCrossed className="h-4 w-4" />}
                    onClick={handleMake} disabled={consuming || !canMake} className="flex-1">
                    {consuming ? t('recipes.detail.making') : t('recipes.detail.make')}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" leftIcon={copied ? <CheckCheck className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  onClick={handleShare} className="flex-1">
                  {copied ? t('recipes.detail.copied') : t('recipes.detail.share')}
                </Button>
                <Button variant="secondary" leftIcon={<Printer className="h-4 w-4" />}
                  onClick={handlePrint} className="flex-1">
                  {t('recipes.detail.print')}
                </Button>
                <div ref={pickerRef} className="relative flex-1">
                  <Button
                    variant="secondary"
                    leftIcon={sentTo ? <CheckCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    onClick={() => setShowMemberPicker((v) => !v)}
                    className="w-full"
                  >
                    {sentTo ? t('recipes.detail.sent') : t('recipes.detail.sendToMember')}
                  </Button>

                  {showMemberPicker && (
                    <div className="absolute bottom-full mb-2 right-0 w-56 glass-strong border border-glass-border rounded-2xl shadow-xl z-50 overflow-hidden">
                      <p className="px-3 py-2.5 text-xs font-semibold text-white/50 uppercase tracking-wider border-b border-glass-border">
                        {t('recipes.detail.sendToMemberTitle')}
                      </p>
                      {otherMembers.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-white/40 text-center">
                          {t('recipes.detail.noOtherMembers')}
                        </p>
                      ) : (
                        <ul className="max-h-52 overflow-y-auto">
                          {otherMembers.map((m) => (
                            <li key={m.id}>
                              <button
                                type="button"
                                onClick={() => void handleSendToMember(m)}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-white/5 transition text-left"
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/20 text-xs font-semibold text-brand-orange">
                                  {(m.full_name ?? '?').charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate">{m.full_name ?? t('common.unnamed')}</span>
                                <span className="ml-auto text-[10px] text-white/30 shrink-0">{m.role}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null
        }
      >
        {recipe && (
          <div className="space-y-6">
            {/* Hero image */}
            {recipe.image_url && (
              <div className="-mx-6 -mt-2">
                <img
                  src={recipe.image_url}
                  alt={recipe.title}
                  className="w-full h-52 object-cover"
                />
              </div>
            )}

            {/* Category + description */}
            {(recipe.category || recipe.description) && (
              <div className="space-y-2">
                {recipe.category && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/50">
                    <Tag className="h-3 w-3" />
                    {t(`recipes.categories.${recipe.category}`)}
                  </span>
                )}
                {recipe.description && (
                  <p className="text-white/70 leading-relaxed">{trDescription ?? recipe.description}</p>
                )}
              </div>
            )}

            {/* Time / servings / difficulty */}
            {(recipe.prep_time || recipe.cook_time || recipe.servings || recipe.difficulty) && (
              <div className="flex flex-wrap gap-3 text-sm">
                {recipe.prep_time != null && (
                  <div className="flex items-center gap-1.5 text-white/70">
                    <Clock className="h-4 w-4 text-white/40" />
                    <span className="text-white/40 text-xs">{t('recipes.detail.prepTime')}</span>
                    <span className="font-medium">{fmtMin(recipe.prep_time)}</span>
                  </div>
                )}
                {recipe.cook_time != null && (
                  <div className="flex items-center gap-1.5 text-white/70">
                    <Flame className="h-4 w-4 text-white/40" />
                    <span className="text-white/40 text-xs">{t('recipes.detail.cookTime')}</span>
                    <span className="font-medium">{fmtMin(recipe.cook_time)}</span>
                  </div>
                )}
                {recipe.prep_time != null && recipe.cook_time != null && (
                  <div className="flex items-center gap-1.5 text-white/70">
                    <span className="text-white/40 text-xs">{t('recipes.detail.totalTime')}</span>
                    <span className="font-medium">{fmtMin(recipe.prep_time + recipe.cook_time)}</span>
                  </div>
                )}
                {recipe.servings != null && (
                  <div className="flex items-center gap-1.5 text-white/70">
                    <Users className="h-4 w-4 text-white/40" />
                    <span className="font-medium">{recipe.servings} {t('recipes.detail.servings')}</span>
                  </div>
                )}
                {recipe.difficulty && (
                  <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${DIFFICULTY_STYLE[recipe.difficulty]}`}>
                    {t(`recipes.form.difficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`)}
                  </span>
                )}
              </div>
            )}

            {/* Metric badges */}
            <div className="flex flex-wrap gap-2">
              {ingredients.length > 0 && (
                <span className={
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border ' +
                  (canMake
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300')
                }>
                  {canMake ? <PackageCheck className="h-4 w-4" /> : <PackageX className="h-4 w-4" />}
                  {canMake ? t('recipes.detail.inStock') : t('recipes.detail.missingIngredients')}
                </span>
              )}
              {effectiveCost != null && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border border-glass-border text-white/70">
                  <Euro className="h-4 w-4" />
                  €{fmt(effectiveCost)} / {t('recipes.detail.portion')}
                </span>
              )}
              {recipe.selling_price != null && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border border-glass-border text-white/70">
                  <Euro className="h-4 w-4" />
                  {t('recipes.detail.selling')} €{fmt(recipe.selling_price)}
                </span>
              )}
              {foodCostPct != null && (
                <span className={
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border ' +
                  (foodCostPct <= 30
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : foodCostPct <= 40
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-red-500/40 bg-red-500/10 text-red-300')
                }>
                  <TrendingUp className="h-4 w-4" />
                  {t('recipes.detail.foodCost')} {foodCostPct.toFixed(1)}%
                </span>
              )}
              {recipe.allergens.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border border-amber-500/40 bg-amber-500/10 text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  {recipe.allergens.join(', ')}
                </span>
              )}
            </div>

            {/* Ingredients */}
            {ingredients.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                    {t('recipes.detail.ingredients')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">{t('recipes.detail.portions')}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPortions((p) => Math.max(1, p - 1))}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={portions}
                        onChange={(e) => setPortions(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                        className="w-12 text-center rounded-lg border border-white/20 bg-white/5 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-brand-orange"
                      />
                      <button
                        type="button"
                        onClick={() => setPortions((p) => p + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <ul className="space-y-2">
                  {ingredients.map((ing, idx) => {
                    const item = inventory.find((i) => i.id === ing.inventory_item_id)
                    const scaledQty = ing.quantity * portions
                    const enough = item ? item.quantity >= scaledQty : false
                    const displayName = trIngNames[idx] ?? item?.name ?? t('common.unknown')
                    return (
                      <li key={ing.id} className="flex items-center justify-between gap-3 py-2 border-b border-glass-border last:border-0">
                        <span className="flex items-center gap-2">
                          <Package className={`h-4 w-4 shrink-0 ${enough ? 'text-white/40' : 'text-amber-400'}`} />
                          <span className={item ? 'text-white' : 'text-white/50 italic'}>
                            {displayName}
                          </span>
                        </span>
                        <span className="text-white/60 text-sm shrink-0">
                          {scaledQty % 1 === 0 ? scaledQty : scaledQty.toFixed(2)} {item?.unit ?? ''}
                          {portions > 1 && (
                            <span className="ml-1 text-white/30 text-xs">({ing.quantity} ×{portions})</span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {effectiveCost != null && portions > 1 && (
                  <p className="mt-3 text-sm text-white/50">
                    {t('recipes.detail.totalCost')}: <span className="text-white font-medium">€{fmt(effectiveCost * portions)}</span>
                  </p>
                )}
              </section>
            )}

            {/* Instructions — numbered steps */}
            {steps.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                  {t('recipes.detail.instructions')}
                </h3>
                <ol className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-orange/20 text-xs font-semibold text-brand-orange mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-white/80 leading-relaxed pt-0.5">{trSteps[i] ?? step}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {consumeError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {consumeError}
              </p>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}
