/**
 * EU Regulation 1169/2011 — 14 major allergens
 * Simple monochrome SVG icons at viewBox 0 0 24 24
 */
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'

/* ─────────────────────────── SVG icons ─────────────────────────── */

function GlutenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* wheat stalk */}
      <rect x="11.3" y="8" width="1.4" height="13" rx="0.7" />
      {/* top grain */}
      <ellipse cx="12" cy="5.5" rx="2.5" ry="3.5" />
      {/* left grain */}
      <ellipse cx="8.5" cy="11" rx="2" ry="3" transform="rotate(-30 8.5 11)" />
      {/* right grain */}
      <ellipse cx="15.5" cy="11" rx="2" ry="3" transform="rotate(30 15.5 11)" />
      {/* left lower grain */}
      <ellipse cx="9" cy="15.5" rx="1.8" ry="2.5" transform="rotate(-20 9 15.5)" />
      {/* right lower grain */}
      <ellipse cx="15" cy="15.5" rx="1.8" ry="2.5" transform="rotate(20 15 15.5)" />
    </svg>
  )
}

function DairyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* milk jug body */}
      <path d="M8 6 L7 20 Q7 22 12 22 Q17 22 17 20 L16 6 Z" />
      {/* jug neck/opening */}
      <rect x="9" y="3" width="6" height="4" rx="1" />
      {/* handle suggestion */}
      <path d="M16 9 Q20 9 20 13 Q20 17 16 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EggsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      <path d="M12 2 C7.5 2 4 7.5 4 13.5 C4 18.5 7.6 22 12 22 C16.4 22 20 18.5 20 13.5 C20 7.5 16.5 2 12 2 Z" />
    </svg>
  )
}

function FishIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* tail */}
      <path d="M3 6 L8 12 L3 18 Z" />
      {/* body */}
      <ellipse cx="15" cy="12" rx="8" ry="5.5" />
      {/* eye */}
      <circle cx="19.5" cy="10.5" r="1.2" fill="white" />
      <circle cx="19.5" cy="10.5" r="0.5" fill="currentColor" />
    </svg>
  )
}

function PeanutsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* top half of peanut */}
      <ellipse cx="12" cy="7.5" rx="4.5" ry="5" />
      {/* bottom half */}
      <ellipse cx="12" cy="16.5" rx="4.5" ry="5" />
      {/* waist connector */}
      <rect x="10" y="11.5" width="4" height="2" />
      {/* waist indent */}
      <rect x="9.5" y="11.8" width="5" height="1.4" rx="0.7" fill="white" />
    </svg>
  )
}

function SoyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* pod curve */}
      <path d="M5 19 C5 19 5 5 12 3 C19 5 19 19 19 19 Q16 22 12 22 Q8 22 5 19 Z" />
      {/* three beans inside */}
      <ellipse cx="12" cy="8.5" rx="2" ry="2.5" fill="white" opacity="0.6" />
      <ellipse cx="12" cy="13.5" rx="2" ry="2.5" fill="white" opacity="0.6" />
      <ellipse cx="12" cy="18" rx="2" ry="2" fill="white" opacity="0.6" />
    </svg>
  )
}

function NutsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* nut body */}
      <ellipse cx="12" cy="14" rx="7.5" ry="7" />
      {/* nut cap */}
      <path d="M4.5 13 C4.5 13 5 6 12 5 C19 6 19.5 13 19.5 13 Z" />
      {/* stem */}
      <rect x="11.3" y="2" width="1.4" height="4" rx="0.7" />
      {/* center ridge */}
      <line x1="12" y1="7.5" x2="12" y2="21" stroke="white" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

function ShellfishIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* shrimp body - curved segments */}
      <path d="M17 4 C20 6 21 9 19 12 C17 15 14 16 13 18 C12 20 13 22 11 22 C9 22 9 20 10 18 C8 17 6 15 5 12 C4 9 5 6 8 5 C11 4 14 6 17 4 Z" />
      {/* tail fan */}
      <path d="M11 22 L9 20 M11 22 L13 20 M11 22 L11 19.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* antenna */}
      <path d="M17 4 L20 2 M17 4 L19 1" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function SesameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* stem */}
      <rect x="11.3" y="13" width="1.4" height="9" rx="0.7" />
      {/* seed pods along stem */}
      <ellipse cx="12" cy="11" rx="2.8" ry="2" />
      <ellipse cx="12" cy="7.5" rx="2.5" ry="1.8" />
      <ellipse cx="12" cy="4.5" rx="2" ry="1.5" />
      {/* side seeds */}
      <ellipse cx="8" cy="10.5" rx="2.2" ry="1.5" transform="rotate(-25 8 10.5)" />
      <ellipse cx="16" cy="10.5" rx="2.2" ry="1.5" transform="rotate(25 16 10.5)" />
      <ellipse cx="8.5" cy="7" rx="2" ry="1.4" transform="rotate(-20 8.5 7)" />
      <ellipse cx="15.5" cy="7" rx="2" ry="1.4" transform="rotate(20 15.5 7)" />
    </svg>
  )
}

function CeleryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* 5 stalks as arcs */}
      <path d="M12 22 C12 22 6 18 5 10 C5 7 7 5 9 6 C9 6 8 10 10 14 C11 17 12 22 12 22 Z" />
      <path d="M12 22 C12 22 9 17 10 10 C10.5 6 12 4 12 4 C12 4 12 4 12 4 C12 4 13.5 6 14 10 C15 17 12 22 12 22 Z" />
      <path d="M12 22 C12 22 13 17 14 14 C16 10 15 6 15 6 C17 5 19 7 19 10 C18 18 12 22 12 22 Z" />
      {/* small left stalk */}
      <path d="M12 22 C12 22 7.5 17 7 12 C6.7 9 8 7 9 8 C8.5 11 10 15 12 22 Z" opacity="0.7" />
      {/* small right stalk */}
      <path d="M12 22 C12 22 16.5 17 17 12 C17.3 9 16 7 15 8 C15.5 11 14 15 12 22 Z" opacity="0.7" />
    </svg>
  )
}

function MustardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* 4 petals */}
      <ellipse cx="12" cy="6.5" rx="3" ry="4.5" />
      <ellipse cx="17.5" cy="12" rx="4.5" ry="3" />
      <ellipse cx="12" cy="17.5" rx="3" ry="4.5" />
      <ellipse cx="6.5" cy="12" rx="4.5" ry="3" />
      {/* center */}
      <circle cx="12" cy="12" r="3.5" fill="white" />
      <circle cx="12" cy="12" r="2.5" />
      {/* stem */}
      <rect x="11.3" y="20" width="1.4" height="3" rx="0.7" />
    </svg>
  )
}

function SulphitesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* wine glass bowl */}
      <path d="M7 3 L17 3 L15 12 Q14 15 12 15 Q10 15 9 12 Z" />
      {/* stem */}
      <rect x="11.3" y="15" width="1.4" height="5" rx="0.7" />
      {/* base */}
      <rect x="8" y="20" width="8" height="1.5" rx="0.75" />
      {/* liquid level inside glass */}
      <path d="M9.5 7 L14.5 7 L14 10 Q13 12 12 12 Q11 12 10 10 Z" fill="white" opacity="0.5" />
    </svg>
  )
}

function LupinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* bean pod */}
      <path d="M7 19 C5 17 5 7 12 3 C19 7 19 17 17 19 Q14.5 22 12 22 Q9.5 22 7 19 Z" />
      {/* seeds inside */}
      <circle cx="12" cy="7.5" r="2.2" fill="white" opacity="0.65" />
      <circle cx="12" cy="12.5" r="2.2" fill="white" opacity="0.65" />
      <circle cx="12" cy="17.5" r="2" fill="white" opacity="0.65" />
    </svg>
  )
}

function MolluscsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      {/* shell ribs */}
      <path d="M12 21 C12 21 4 17 3 10 C2.5 6 5 3 9 3 C11 3 12 4 12 4 C12 4 13 3 15 3 C19 3 21.5 6 21 10 C20 17 12 21 12 21 Z" />
      {/* shell ridges as lines */}
      <path d="M12 21 C8 17 5 13 5 9" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <path d="M12 21 C9 16 7 12 7.5 7.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <path d="M12 21 L12 4" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <path d="M12 21 C15 16 17 12 16.5 7.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <path d="M12 21 C16 17 19 13 19 9" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
    </svg>
  )
}

/* ─────────────────────────── Data map ─────────────────────────── */

export const ALLERGEN_META: Record<string, {
  icon: React.ReactNode
  label: string
  labelEl: string
  labelBg: string
  bg: string
  text: string
}> = {
  gluten:    { icon: <GlutenIcon />,    label: 'Gluten',      labelEl: 'Γλουτένη',       labelBg: 'Глутен',             bg: 'bg-amber-500/20',   text: 'text-amber-300' },
  dairy:     { icon: <DairyIcon />,     label: 'Dairy',       labelEl: 'Γαλακτοκομικά',  labelBg: 'Млечни',             bg: 'bg-sky-500/20',     text: 'text-sky-300' },
  eggs:      { icon: <EggsIcon />,      label: 'Eggs',        labelEl: 'Αυγά',            labelBg: 'Яйца',               bg: 'bg-yellow-500/20',  text: 'text-yellow-300' },
  fish:      { icon: <FishIcon />,      label: 'Fish',        labelEl: 'Ψάρι',            labelBg: 'Риба',               bg: 'bg-cyan-500/20',    text: 'text-cyan-300' },
  peanuts:   { icon: <PeanutsIcon />,   label: 'Peanuts',     labelEl: 'Φιστίκια',        labelBg: 'Фъстъци',            bg: 'bg-orange-500/20',  text: 'text-orange-300' },
  soy:       { icon: <SoyIcon />,       label: 'Soy',         labelEl: 'Σόγια',           labelBg: 'Соя',                bg: 'bg-green-500/20',   text: 'text-green-300' },
  nuts:      { icon: <NutsIcon />,      label: 'Nuts',        labelEl: 'Ξηροί Καρποί',    labelBg: 'Ядки',               bg: 'bg-amber-600/20',   text: 'text-amber-400' },
  shellfish: { icon: <ShellfishIcon />, label: 'Shellfish',   labelEl: 'Οστρακοειδή',     labelBg: 'Ракообразни',        bg: 'bg-pink-500/20',    text: 'text-pink-300' },
  sesame:    { icon: <SesameIcon />,    label: 'Sesame',      labelEl: 'Σησάμι',          labelBg: 'Сусам',              bg: 'bg-lime-500/20',    text: 'text-lime-300' },
  celery:    { icon: <CeleryIcon />,    label: 'Celery',      labelEl: 'Σέλινο',          labelBg: 'Целина',             bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  mustard:   { icon: <MustardIcon />,   label: 'Mustard',     labelEl: 'Μουστάρδα',       labelBg: 'Горчица',            bg: 'bg-yellow-600/20',  text: 'text-yellow-400' },
  sulphites: { icon: <SulphitesIcon />, label: 'Sulphites',   labelEl: 'Θειώδη',          labelBg: 'Сулфити',            bg: 'bg-purple-500/20',  text: 'text-purple-300' },
  lupin:     { icon: <LupinIcon />,     label: 'Lupin',       labelEl: 'Λούπινο',         labelBg: 'Лупина',             bg: 'bg-violet-500/20',  text: 'text-violet-300' },
  molluscs:  { icon: <MolluscsIcon />,  label: 'Molluscs',    labelEl: 'Μαλάκια',         labelBg: 'Мекотели',           bg: 'bg-blue-500/20',    text: 'text-blue-300' },
}

/* ─────────────────────────── Components ─────────────────────────── */

interface AllergenBadgeProps {
  allergen: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function AllergenBadge({ allergen, size = 'md', showLabel = true, className }: AllergenBadgeProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const meta = ALLERGEN_META[allergen.toLowerCase()]

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'
  const px = size === 'sm' ? 'px-1.5 py-0.5' : size === 'lg' ? 'px-3 py-1.5' : 'px-2 py-1'

  if (!meta) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-lg bg-white/10 text-white/60 font-medium', px, textSize, className)}>
        {allergen}
      </span>
    )
  }

  const displayLabel = lang.startsWith('el') ? meta.labelEl : lang.startsWith('bg') ? meta.labelBg : meta.label

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium',
        meta.bg, meta.text, px, className,
      )}
      title={displayLabel}
    >
      <span className={cn('shrink-0', iconSize)}>{meta.icon}</span>
      {showLabel && <span className={textSize}>{displayLabel}</span>}
    </span>
  )
}

/** Compact icon-only version for tight spaces (RecipeCard) */
export function AllergenDot({ allergen, className }: { allergen: string; className?: string }) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const meta = ALLERGEN_META[allergen.toLowerCase()]
  if (!meta) return null
  const title = lang.startsWith('el') ? meta.labelEl : lang.startsWith('bg') ? meta.labelBg : meta.label
  return (
    <span
      className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md', meta.bg, meta.text, className)}
      title={title}
    >
      <span className="h-3.5 w-3.5">{meta.icon}</span>
    </span>
  )
}
