import { Euro, Minus, Package, PackageCheck, PackageX, Plus, UtensilsCrossed, Mic, MicOff, ChevronLeft, ChevronRight, X, Tag, TrendingUp, Clock, Flame, Users, Share2, Printer, CheckCheck, UserPlus, MessageSquare, Trash2, Sparkles, Loader2, Activity, GitBranch, Check, Layers, Pencil, Play, MoreHorizontal, Timer, Send, AlertTriangle, Volume2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { ActionMenu, PillButton, StatTile } from '../ui/page'
import { AllergenBadge } from '../ui/AllergenIcon'
import { useEffect, useRef, useState } from 'react'
import { printRecipe } from '../../lib/printRecipe'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTeam } from '../../hooks/useTeam'
import type { Profile } from '../../types/database.types'
import { useAutoTranslate, useAutoTranslateMany } from '../../hooks/useAutoTranslate'
import { useRecipeComments } from '../../hooks/useRecipeComments'
import { useRecipes } from '../../hooks/useRecipes'
import { estimateNutrition } from '../../lib/gemini'

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
import type { InventoryItem, Recipe, RecipeIngredient, RecipeSubRecipe } from '../../types/database.types'
import { expandedNeeds, inheritedAllergens, recipePortionCost } from '../../lib/recipeTree'

const NO_SUBS: RecipeSubRecipe[] = []

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

  const next = steps[idx + 1]

  return (
    <div className="theme-dark fixed inset-0 z-[60] flex flex-col bg-ink text-white" style={{ touchAction: 'manipulation' }}>
      <div className="flex items-center gap-4 px-5 pt-5 sm:px-8">
        <span className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink tabular-nums">
          {t('recipes.detail.stepOf', { current: idx + 1, total: steps.length })}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button type="button" onClick={toggleVoice}
          className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${listening ? 'bg-lime text-ink' : 'bg-white/10 text-white/70 hover:text-white'}`}>
          {listening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          <span className="hidden sm:inline">{listening ? t('recipes.detail.listening') : t('recipes.detail.voiceControl')}</span>
        </button>
        <button type="button" onClick={onClose} aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8 px-6 sm:px-12 lg:px-24">
        <span className="text-[7rem] font-medium leading-none tracking-[-0.06em] text-lime tabular-nums sm:text-[10rem]">{idx + 1}</span>
        <p className="max-w-4xl text-3xl font-medium leading-snug tracking-[-0.02em] md:text-5xl">{current}</p>
        {next && (
          <p className="max-w-3xl text-base text-white/45 md:text-lg">
            <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-white/35">{t('recipes.v3.upNext')}</span>
            {next}
          </p>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pb-8 sm:px-8">
        <button type="button" onClick={goPrev} disabled={idx === 0}
          className="flex h-16 items-center justify-center gap-2 rounded-full bg-white/10 text-lg font-medium text-white/80 transition hover:bg-white/15 disabled:opacity-30">
          <ChevronLeft className="h-6 w-6" /> {t('common.back')}
        </button>
        <button type="button" onClick={reread} aria-label={t('recipes.detail.repeatStep')}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] text-white/60 hover:text-white">
          <Volume2 className="h-6 w-6" />
        </button>
        {idx < steps.length - 1 ? (
          <button type="button" onClick={goNext}
            className="flex h-16 items-center justify-center gap-2 rounded-full bg-lime text-lg font-medium text-ink transition hover:brightness-95">
            {t('common.next')} <ChevronRight className="h-6 w-6" />
          </button>
        ) : (
          <button type="button" onClick={onClose}
            className="flex h-16 items-center justify-center gap-2 rounded-full bg-lime text-lg font-medium text-ink transition hover:brightness-95">
            <CheckCheck className="h-6 w-6" /> {t('common.done')}
          </button>
        )}
      </div>
      {listening && (
        <p className="absolute bottom-28 left-1/2 -translate-x-1/2 text-xs text-white/40">{t('recipes.v3.sayCommands')}</p>
      )}
    </div>
  )
}

interface RecipeDetailProps {
  recipe: Recipe | null
  ingredients: RecipeIngredient[]
  subRecipes?: RecipeSubRecipe[]
  getIngredients?: (recipeId: string) => RecipeIngredient[]
  getSubRecipes?: (recipeId: string) => RecipeSubRecipe[]
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

const DIFFICULTY_DOTS = { easy: 1, medium: 2, hard: 3 } as const

export function RecipeDetail({
  recipe,
  ingredients,
  subRecipes = NO_SUBS,
  getIngredients,
  getSubRecipes,
  inventory,
  onClose,
  onEdit,
  onConsume,
}: RecipeDetailProps) {
  const { t } = useTranslation()
  const { profile: myProfile } = useAuth()
  const { members } = useTeam()
  const { recipes: allRecipes, update: updateRecipe } = useRecipes()
  const [consuming, setConsuming] = useState(false)
  const [consumeError, setConsumeError] = useState<string | null>(null)
  const [handsFree, setHandsFree] = useState(false)
  const [portions, setPortions] = useState(1)
  const [copied, setCopied] = useState(false)
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Comments
  const { comments, addComment, deleteComment } = useRecipeComments(recipe?.id ?? null)
  const [commentDraft, setCommentDraft] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Nutrition
  const [nutritionLoading, setNutritionLoading] = useState(false)
  const [nutritionError, setNutritionError] = useState<string | null>(null)

  const otherMembers = members.filter((m) => m.id !== myProfile?.id)

  // Recipe variations: other recipes that share the same parent OR have this recipe as parent
  const variations = recipe
    ? allRecipes.filter((r) => r.id !== recipe.id && (
        (recipe.parent_recipe_id && r.parent_recipe_id === recipe.parent_recipe_id) ||
        r.parent_recipe_id === recipe.id ||
        (recipe.parent_recipe_id === null && r.parent_recipe_id === recipe.id)
      ))
    : []

  async function handleAnalyzeNutrition() {
    if (!recipe) return
    setNutritionLoading(true)
    setNutritionError(null)
    try {
      const ingList = ingredients.map((ing) => {
        const item = inventory.find((i) => i.id === ing.inventory_item_id)
        return { name: item?.name ?? 'ingredient', quantity: ing.quantity, unit: item?.unit ?? '' }
      })
      const nutrition = await estimateNutrition(recipe.title, ingList, recipe.servings ?? 1)
      await updateRecipe(recipe.id, nutrition)
    } catch (err) {
      setNutritionError(err instanceof Error ? err.message : 'Failed to analyze nutrition.')
    } finally {
      setNutritionLoading(false)
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentDraft.trim()) return
    setSubmittingComment(true)
    try {
      await addComment(commentDraft.trim())
      setCommentDraft('')
    } finally {
      setSubmittingComment(false)
    }
  }

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

  // Ingredient/sub-recipe lookups — fall back to this recipe's own rows
  const ingOf = (id: string) => getIngredients ? getIngredients(id) : (id === recipe?.id ? ingredients : [])
  const subsOf = (id: string) => getSubRecipes ? getSubRecipes(id) : (id === recipe?.id ? subRecipes : NO_SUBS)
  const shortages = (n: number) => {
    if (!recipe) return []
    return [...expandedNeeds(recipe.id, n, ingOf, subsOf)].filter(([itemId, need]) => {
      const item = inventory.find((i) => i.id === itemId)
      return !item || item.quantity < need
    })
  }
  const hasComponents = ingredients.length > 0 || subRecipes.length > 0
  const canMake = hasComponents && shortages(1).length === 0

  // Auto-translate user-generated content
  const trTitle       = useAutoTranslate(recipe?.title ?? null)
  const trDescription = useAutoTranslate(recipe?.description ?? null)
  // Split steps first, then translate each one individually (avoids MyMemory 500-char limit)
  const steps = recipe?.instructions ? splitSteps(recipe.instructions) : []
  const trSteps = useAutoTranslateMany(steps)
  const ingNames = ingredients.map((ing) => inventory.find((i) => i.id === ing.inventory_item_id)?.name ?? null)
  const trIngNames = useAutoTranslateMany(ingNames)

  const effectiveCost = recipe?.cost_per_portion ??
    (recipe && hasComponents ? recipePortionCost(recipe.id, allRecipes, ingOf, subsOf, inventory, { useOverride: false }) : null)

  const foodCostPct =
    effectiveCost != null && recipe?.selling_price != null && recipe.selling_price > 0
      ? (effectiveCost / recipe.selling_price) * 100
      : null

  // Checklists for mise en place / cooking — local to this viewing
  const [checkedIng, setCheckedIng] = useState<Set<string>>(new Set())
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  useEffect(() => { setCheckedIng(new Set()); setDoneSteps(new Set()) }, [recipe?.id])
  function toggleIn<T>(set: Set<T>, v: T) { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n }

  // Overlay behaviour (was handled by Drawer)
  useEffect(() => {
    if (!recipe) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !handsFree) onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [recipe, handsFree, onClose])

  if (!recipe) return null

  const missingCount = shortages(portions).length
  const allergens = subRecipes.length > 0 ? inheritedAllergens(recipe.id, allRecipes, subsOf) : recipe.allergens
  const fcTone = foodCostPct == null ? 'default' : foodCostPct <= 30 ? 'good' : foodCostPct <= 40 ? 'warn' : 'bad'
  const nutrients = [
    { label: t('recipes.detail.nutrients.calories'), value: recipe.calories, unit: 'kcal' },
    { label: t('recipes.detail.nutrients.protein'),  value: recipe.protein_g, unit: 'g' },
    { label: t('recipes.detail.nutrients.carbs'),    value: recipe.carbs_g,   unit: 'g' },
    { label: t('recipes.detail.nutrients.fat'),      value: recipe.fat_g,     unit: 'g' },
    { label: t('recipes.detail.nutrients.fiber'),    value: recipe.fiber_g,   unit: 'g' },
    { label: t('recipes.detail.nutrients.sodium'),   value: recipe.sodium_mg, unit: 'mg' },
  ].filter((n): n is { label: string; value: number; unit: string } => n.value != null)
  const macroTotal = (recipe.protein_g ?? 0) + (recipe.carbs_g ?? 0) + (recipe.fat_g ?? 0)
  const title = trTitle ?? recipe.title
  const facts = [
    recipe.prep_time != null && { icon: Clock, label: t('recipes.detail.prepTime'), value: fmtMin(recipe.prep_time) },
    recipe.cook_time != null && { icon: Flame, label: t('recipes.detail.cookTime'), value: fmtMin(recipe.cook_time) },
    recipe.prep_time != null && recipe.cook_time != null && { icon: Timer, label: t('recipes.detail.totalTime'), value: fmtMin(recipe.prep_time + recipe.cook_time) },
    recipe.servings != null && { icon: Users, label: t('recipes.detail.servings'), value: String(recipe.servings) },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string }[]

  return createPortal(
    <>
      {handsFree && steps.length > 0 && (
        <HandsFreeMode steps={trSteps.map((x, i) => x ?? steps[i])} onClose={() => setHandsFree(false)} />
      )}

      <div role="dialog" aria-modal="true" aria-label={title}
        className="fixed inset-0 z-50 overflow-y-auto bg-bg-surface">
        {/* ── Top bar ── */}
        <div className="sticky top-0 z-20 bg-bg-surface/85 px-3 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <button type="button" onClick={onClose} aria-label={t('recipes.v3.back')}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-bg-card pl-3 pr-4 text-sm font-medium shadow-card hover:bg-white/[0.04]">
              <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">{t('recipes.v3.back')}</span>
            </button>
            <span className="min-w-0 flex-1 truncate px-2 text-sm font-medium text-white/60">{title}</span>
            <ActionMenu label={t('recipes.v3.more')} icon={MoreHorizontal} actions={[
              { label: copied ? t('recipes.detail.copied') : t('recipes.detail.share'), icon: copied ? CheckCheck : Share2, onClick: () => void handleShare() },
              { label: t('recipes.detail.print'), icon: Printer, onClick: handlePrint },
              { label: sentTo ? t('recipes.detail.sent') : t('recipes.detail.sendToMemberTitle'), icon: UserPlus, onClick: () => setShowMemberPicker(true) },
            ]} />
            <PillButton icon={Pencil} onClick={() => { onClose(); onEdit(recipe) }} className="hidden sm:inline-flex">{t('common.edit')}</PillButton>
            {steps.length > 0 && (
              <PillButton variant="lime" icon={Play} onClick={() => setHandsFree(true)}>
                <span className="hidden sm:inline">{t('recipes.v3.cookMode')}</span>
              </PillButton>
            )}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 pb-28 sm:gap-4 sm:px-6">
          {/* ── Hero ── */}
          <section className={`grid gap-3 sm:gap-4 ${recipe.image_url ? 'lg:grid-cols-[1.15fr_1fr]' : ''}`}>
            <div className="flex flex-col justify-between gap-8 rounded-[2rem] bg-ink p-6 text-white-fixed sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {recipe.category && (
                  <span className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink">{t(`recipes.categories.${recipe.category}`)}</span>
                )}
                {recipe.difficulty && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white-fixed/10 px-3 py-1 text-xs">
                    <span className="flex gap-0.5">
                      {[1, 2, 3].map((d) => (
                        <span key={d} className={`h-1.5 w-1.5 rounded-full ${d <= DIFFICULTY_DOTS[recipe.difficulty!] ? 'bg-lime' : 'bg-white-fixed/25'}`} />
                      ))}
                    </span>
                    {t(`recipes.form.difficulty${recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}`)}
                  </span>
                )}
                {recipe.variation_label && (
                  <span className="rounded-full bg-white-fixed/10 px-3 py-1 text-xs">{recipe.variation_label}</span>
                )}
              </div>
              <div>
                <h1 className="text-4xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-6xl">{title}</h1>
                {recipe.description && (
                  <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white-fixed/65 sm:text-base">{trDescription ?? recipe.description}</p>
                )}
              </div>
              {facts.length > 0 && (
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {facts.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-2xl bg-white-fixed/[0.06] px-4 py-3">
                      <dt className="flex items-center gap-1.5 text-xs text-white-fixed/50"><Icon className="h-3.5 w-3.5" />{label}</dt>
                      <dd className="mt-1 text-2xl font-medium tabular-nums text-lime">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {recipe.image_url && (
              <div className="relative min-h-[16rem] overflow-hidden rounded-[2rem] bg-bg-card-2">
                <img src={recipe.image_url} alt={recipe.title} className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
          </section>

          {/* ── Numbers ── */}
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile label={t('recipes.v3.costPerPortion')} icon={Euro}
              value={effectiveCost != null ? `€${fmt(effectiveCost)}` : '—'}
              hint={effectiveCost != null && portions > 1 ? `${t('recipes.detail.totalCost')} €${fmt(effectiveCost * portions)}` : undefined} />
            <StatTile label={t('recipes.v3.sellingPrice')} icon={Tag}
              value={recipe.selling_price != null ? `€${fmt(recipe.selling_price)}` : '—'}
              hint={effectiveCost != null && recipe.selling_price != null ? `${t('recipes.v3.margin')} €${fmt(recipe.selling_price - effectiveCost)}` : undefined} />
            <StatTile label={t('recipes.detail.foodCost')} icon={TrendingUp} tone={fcTone}
              value={foodCostPct != null ? `${foodCostPct.toFixed(1)}%` : '—'} hint={t('recipes.v3.fcTarget')} />
            {hasComponents ? (
              <StatTile label={t('recipes.v3.stock')} icon={canMake ? PackageCheck : PackageX} tone={canMake ? 'lime' : 'warn'}
                value={canMake ? t('recipes.v3.ready') : t('recipes.v3.missingN', { count: missingCount })}
                hint={t('recipes.v3.forPortions', { count: portions })} />
            ) : (
              <StatTile label={t('recipes.v3.stock')} icon={Package} value="—" hint={t('recipes.v3.noIngredients')} />
            )}
          </section>

          {allergens.length > 0 && (
            <section className="flex flex-wrap items-center gap-2 rounded-3xl bg-bg-card px-5 py-4 shadow-card">
              <span className="mr-2 flex items-center gap-1.5 text-sm font-medium text-white/60"><AlertTriangle className="h-4 w-4 text-amber-500" />{t('recipes.v3.allergens')}</span>
              {allergens.map((a) => <AllergenBadge key={a} allergen={a} size="md" />)}
            </section>
          )}

          {/* ── Ingredients + method ── */}
          <section className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(320px,400px)_1fr]">
            {hasComponents && (
              <div className="flex flex-col gap-4 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">{t('recipes.detail.ingredients')}</h2>
                    <p className="text-xs text-white/50">{t('recipes.v3.checked', { done: checkedIng.size, total: ingredients.length + subRecipes.length })}</p>
                  </div>
                  <div className="flex items-center rounded-full bg-bg-input p-1">
                    <button type="button" onClick={() => setPortions((p) => Math.max(1, p - 1))} aria-label="−"
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-bg-card"><Minus className="h-3.5 w-3.5" /></button>
                    <input type="number" min={1} value={portions}
                      onChange={(e) => setPortions(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                      className="w-10 bg-transparent text-center text-sm font-semibold tabular-nums outline-none" aria-label={t('recipes.detail.portions')} />
                    <button type="button" onClick={() => setPortions((p) => p + 1)} aria-label="+"
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-bg-card"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                <ul className="-mx-2 flex flex-col">
                  {ingredients.map((ing, idx) => {
                    const item = inventory.find((i) => i.id === ing.inventory_item_id)
                    const scaledQty = ing.quantity * portions
                    const enough = item ? item.quantity >= scaledQty : false
                    const displayName = trIngNames[idx] ?? item?.name ?? t('common.unknown')
                    const done = checkedIng.has(ing.id)
                    return (
                      <li key={ing.id}>
                        <button type="button" onClick={() => setCheckedIng((s) => toggleIn(s, ing.id))}
                          className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-white/[0.04]">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${done ? 'bg-ink text-lime' : 'border-2 border-white/15'}`}>
                            {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                          </span>
                          <span className={`min-w-0 flex-1 truncate text-[15px] ${done ? 'text-white/35 line-through' : item ? '' : 'italic text-white/50'}`}>{displayName}</span>
                          <span className={`shrink-0 text-sm font-medium tabular-nums ${done ? 'text-white/30' : ''}`}>
                            {scaledQty % 1 === 0 ? scaledQty : scaledQty.toFixed(2)} <span className="font-normal text-white/50">{item?.unit ?? ''}</span>
                          </span>
                          <span title={enough ? t('recipes.detail.inStock') : t('recipes.detail.missingIngredients')}
                            className={`h-2 w-2 shrink-0 rounded-full ${enough ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        </button>
                      </li>
                    )
                  })}
                  {subRecipes.map((sr) => {
                    const base = allRecipes.find((r) => r.id === sr.sub_recipe_id)
                    const qty = sr.quantity * portions
                    const done = checkedIng.has(sr.id)
                    const baseShort = base ? [...expandedNeeds(base.id, qty, ingOf, subsOf)].some(([itemId, need]) => {
                      const item = inventory.find((i) => i.id === itemId)
                      return !item || item.quantity < need
                    }) : true
                    return (
                      <li key={sr.id}>
                        <button type="button" onClick={() => setCheckedIng((s) => toggleIn(s, sr.id))}
                          className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-white/[0.04]">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${done ? 'bg-ink text-lime' : 'bg-lime text-ink'}`}>
                            {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Layers className="h-3.5 w-3.5" />}
                          </span>
                          <span className={`min-w-0 flex-1 truncate text-[15px] font-medium ${done ? 'text-white/35 line-through' : ''}`}>
                            {base?.title ?? t('common.unknown')}
                            <span className="ml-1.5 text-[11px] font-normal text-white/45">{t('recipes.sub.baseTag')}</span>
                          </span>
                          <span className={`shrink-0 text-sm font-medium tabular-nums ${done ? 'text-white/30' : ''}`}>
                            {qty % 1 === 0 ? qty : qty.toFixed(2)} <span className="font-normal text-white/50">{base?.yield_unit ?? t('recipes.sub.portionShort')}</span>
                          </span>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${baseShort ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <div className="flex gap-2">
                  {checkedIng.size > 0 && (
                    <button type="button" onClick={() => setCheckedIng(new Set())}
                      className="h-11 rounded-full bg-bg-input px-4 text-sm font-medium text-white/70 hover:text-white">
                      {t('recipes.v3.reset')}
                    </button>
                  )}
                  <button type="button" onClick={() => void handleMake()} disabled={consuming || !canMake}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand-orange text-sm font-medium text-on-accent hover:bg-brand-orange/85 disabled:cursor-not-allowed disabled:opacity-40">
                    <UtensilsCrossed className="h-4 w-4" />
                    {consuming ? t('recipes.detail.making') : t('recipes.v3.makeDeduct')}
                  </button>
                </div>
                {consumeError && <p className="rounded-2xl bg-red-500/10 px-4 py-2.5 text-sm text-red-500">{consumeError}</p>}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:gap-4">
              {steps.length > 0 && (
                <div className="flex flex-col gap-4 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-medium">{t('recipes.detail.instructions')}</h2>
                      <p className="text-xs text-white/50">{t('recipes.v3.stepsDone', { done: doneSteps.size, total: steps.length })}</p>
                    </div>
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-bg-input">
                      <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${(doneSteps.size / steps.length) * 100}%` }} />
                    </div>
                  </div>
                  <ol className="flex flex-col gap-2">
                    {steps.map((step, i) => {
                      const done = doneSteps.has(i)
                      return (
                        <li key={i}>
                          <button type="button" onClick={() => setDoneSteps((s) => toggleIn(s, i))}
                            className={`flex w-full gap-4 rounded-2xl p-4 text-left transition ${done ? 'bg-bg-input/60' : 'bg-bg-input hover:bg-white/[0.07]'}`}>
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold tabular-nums ${done ? 'bg-ink text-lime' : 'bg-bg-card shadow-card'}`}>
                              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                            </span>
                            <p className={`pt-2 text-[15px] leading-relaxed sm:text-base ${done ? 'text-white/40' : 'text-white/85'}`}>{trSteps[i] ?? step}</p>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}

              {/* Nutrition */}
              <div className="flex flex-col gap-4 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-medium"><Activity className="h-4 w-4 text-white/50" />{t('recipes.detail.nutrition')}</h2>
                  <button type="button" onClick={() => void handleAnalyzeNutrition()} disabled={nutritionLoading}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-violet-500/10 px-3.5 text-sm font-medium text-violet-500 hover:bg-violet-500/15 disabled:opacity-50">
                    {nutritionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {nutrients.length > 0 ? t('recipes.detail.reanalyzeNutrition') : t('recipes.detail.analyzeNutrition')}
                  </button>
                </div>
                {nutrients.length > 0 ? (
                  <>
                    {macroTotal > 0 && (
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-bg-input">
                        <span className="bg-ink" style={{ width: `${((recipe.protein_g ?? 0) / macroTotal) * 100}%` }} />
                        <span className="bg-lime" style={{ width: `${((recipe.carbs_g ?? 0) / macroTotal) * 100}%` }} />
                        <span className="bg-amber-400" style={{ width: `${((recipe.fat_g ?? 0) / macroTotal) * 100}%` }} />
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {nutrients.map(({ label, value, unit }) => (
                        <div key={label} className="rounded-2xl bg-bg-input px-3 py-3">
                          <div className="text-xl font-medium tabular-nums">{value % 1 === 0 ? value : value.toFixed(1)}<span className="ml-0.5 text-xs text-white/45">{unit}</span></div>
                          <div className="mt-0.5 text-[11px] text-white/55">{label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-white/50">{t('recipes.v3.noNutrition')}</p>
                )}
                {nutritionError && <p className="text-sm text-red-500">{nutritionError}</p>}
              </div>

              <div className={`grid gap-3 sm:gap-4 ${variations.length > 0 ? 'xl:grid-cols-[1fr_1.4fr]' : ''}`}>
                {variations.length > 0 && (
                  <div className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6">
                    <h2 className="flex items-center gap-2 text-lg font-medium"><GitBranch className="h-4 w-4 text-white/50" />{t('recipes.detail.variations')}</h2>
                    <ul className="flex flex-col gap-1.5">
                      {variations.map((v) => (
                        <li key={v.id} className="flex items-center justify-between gap-3 rounded-2xl bg-bg-input px-4 py-3 text-sm">
                          <span className="truncate font-medium">{v.title}</span>
                          {v.variation_label && <span className="shrink-0 rounded-full bg-lime px-2.5 py-0.5 text-[11px] font-semibold text-ink">{v.variation_label}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Team notes */}
                <div className="flex flex-col gap-3 rounded-3xl bg-bg-card p-5 shadow-card sm:p-6">
                  <h2 className="flex items-center gap-2 text-lg font-medium">
                    <MessageSquare className="h-4 w-4 text-white/50" />{t('recipes.detail.comments')}
                    {comments.length > 0 && <span className="text-sm font-normal text-white/40">{comments.length}</span>}
                  </h2>
                  {comments.length > 0 && (
                    <ul className="flex flex-col gap-3">
                      {comments.map((c) => (
                        <li key={c.id} className="group flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-lime">
                            {(c.author_name ?? '?').charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-bg-input px-4 py-2.5">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium">{c.author_name ?? t('common.unknown')}</span>
                              <span className="text-[11px] text-white/40">{new Date(c.created_at).toLocaleDateString()}</span>
                              {c.author_id === myProfile?.id && (
                                <button type="button" onClick={() => void deleteComment(c.id)} aria-label="Delete"
                                  className="ml-auto text-white/30 opacity-0 transition hover:text-red-500 group-hover:opacity-100">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm leading-relaxed text-white/80">{c.content}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={(e) => void handleAddComment(e)} className="flex items-center gap-2 rounded-full bg-bg-input p-1 pl-4">
                    <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder={t('recipes.detail.addComment')}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35" />
                    <button type="submit" disabled={submittingComment || !commentDraft.trim()} aria-label={t('common.send')}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-lime disabled:opacity-30">
                      {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Mobile action dock */}
        <div className="fixed inset-x-3 bottom-3 z-20 flex gap-2 rounded-full bg-bg-card p-1.5 shadow-[0_12px_40px_-12px_rgba(15,18,16,0.35)] sm:hidden">
          <button type="button" onClick={() => { onClose(); onEdit(recipe) }}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-bg-input text-sm font-medium">
            <Pencil className="h-4 w-4" />{t('common.edit')}
          </button>
          {steps.length > 0 && (
            <button type="button" onClick={() => setHandsFree(true)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-lime text-sm font-medium text-ink">
              <Play className="h-4 w-4" />{t('recipes.v3.cookMode')}
            </button>
          )}
        </div>
      </div>

      {/* Send-to-member sheet */}
      {showMemberPicker && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setShowMemberPicker(false)}>
          <div ref={pickerRef} onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-2 rounded-[2rem] bg-bg-card p-3 shadow-card">
            <div className="flex items-center justify-between px-3 pt-2">
              <h2 className="text-lg font-medium">{t('recipes.detail.sendToMemberTitle')}</h2>
              <button type="button" onClick={() => setShowMemberPicker(false)} aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
            </div>
            {otherMembers.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-white/50">{t('recipes.detail.noOtherMembers')}</p>
            ) : (
              <ul className="flex max-h-72 flex-col overflow-y-auto">
                {otherMembers.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => void handleSendToMember(m)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-lime">
                        {(m.full_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 truncate font-medium">{m.full_name ?? t('common.unnamed')}</span>
                      <span className="shrink-0 text-xs text-white/45">{m.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
