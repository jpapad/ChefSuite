import { Link } from 'react-router-dom'
import {
  Tag, Monitor, Building2, ShieldCheck,
  ArrowUpRight, Flame, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/cn'
import { useAuth } from '../contexts/AuthContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeKind = 'active' | 'beta' | 'coming-soon'

interface AppDef {
  id:          string
  to:          string
  icon:        LucideIcon
  iconColor:   string
  iconBg:      string
  hoverShadow: string
  accentGlow:  string
  title:       string
  subtitle:    string
  description: string
  badge:       BadgeKind
}

// ── App definitions ───────────────────────────────────────────────────────────

const APPS: AppDef[] = [
  {
    id:          'buffet',
    to:          '/menus',
    icon:        Tag,
    iconColor:   'text-brand-orange',
    iconBg:      'bg-brand-orange/10',
    hoverShadow: '0 24px 64px rgba(196,149,106,0.20)',
    accentGlow:  'rgba(196,149,106,0.18)',
    title:       'Buffet & Labels',
    subtitle:    'ChefSuite',
    description: 'Αυτοματοποιημένη δημιουργία ετικετών μπουφέ σε 7 γλώσσες με AI Parser και minimal QR εκτύπωση.',
    badge:       'active',
  },
  {
    id:          'kds',
    to:          '/kds',
    icon:        Monitor,
    iconColor:   'text-sky-500',
    iconBg:      'bg-sky-500/10',
    hoverShadow: '0 24px 64px rgba(14,165,233,0.14)',
    accentGlow:  'rgba(14,165,233,0.14)',
    title:       'Κουζίνα · KDS',
    subtitle:    'ChefSuite',
    description: 'Live οθόνη διαχείρισης παραγγελιών και προετοιμασίας για το προσωπικό της κουζίνας.',
    badge:       'beta',
  },
  {
    id:          'warehouse',
    to:          '/warehouse',
    icon:        Building2,
    iconColor:   'text-emerald-500',
    iconBg:      'bg-emerald-500/10',
    hoverShadow: '0 24px 64px rgba(16,185,129,0.14)',
    accentGlow:  'rgba(16,185,129,0.14)',
    title:       'Αποθήκη & Smart Inventory',
    subtitle:    'ChefSuite',
    description: 'Καταγραφή αποθεμάτων, AI Scanning τιμολογίων και Food Costing σε πραγματικό χρόνο.',
    badge:       'beta',
  },
  {
    id:          'haccp',
    to:          '/haccp-logbook',
    icon:        ShieldCheck,
    iconColor:   'text-rose-400',
    iconBg:      'bg-rose-500/10',
    hoverShadow: '0 24px 64px rgba(244,63,94,0.10)',
    accentGlow:  'rgba(244,63,94,0.10)',
    title:       'HACCP & Logs',
    subtitle:    'ChefSuite',
    description: 'Ψηφιακή καταγραφή ασφάλειας τροφίμων, θερμοκρασιών και υποχρεωτικών ελέγχων.',
    badge:       'coming-soon',
  },
]

// ── Badge config ──────────────────────────────────────────────────────────────

const BADGE_CLS: Record<BadgeKind, string> = {
  'active':      'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  'beta':        'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  'coming-soon': 'bg-white/10 text-white/35 border border-white/12',
}

// ── Greeting ──────────────────────────────────────────────────────────────────

function getGreeting(morning: string, afternoon: string, evening: string, name: string): string {
  const h = new Date().getHours()
  const word = h < 12 ? morning : h < 18 ? afternoon : evening
  return `${word}, ${name}`
}

// ── Single app card ───────────────────────────────────────────────────────────

const CARD_BASE = cn(
  'group relative glass gradient-border rounded-3xl p-7 flex flex-col gap-5 overflow-hidden',
  'transition-all duration-300 ease-out select-none',
)

function CardInner({ app, locked, badgeLabel, openLabel, comingSoonLabel }: {
  app: AppDef
  locked: boolean
  badgeLabel: string
  openLabel: string
  comingSoonLabel: string
}) {
  const Icon = app.icon
  return (
    <>
      {!locked && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: app.accentGlow }}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105', app.iconBg)}>
          <Icon className={cn('h-5 w-5', app.iconColor)} strokeWidth={1.8} />
        </div>
        <span className={cn('mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide shrink-0', BADGE_CLS[app.badge])}>
          {badgeLabel}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-white/28">{app.subtitle}</p>
        <h2 className="text-[17px] font-bold text-white/88 leading-snug tracking-tight">{app.title}</h2>
        <p className="text-[13px] text-white/48 leading-relaxed mt-0.5">{app.description}</p>
      </div>
      <div className={cn('flex items-center gap-1 text-[11px] font-semibold tracking-wide transition-all duration-200', locked ? 'text-white/22' : 'text-white/28 group-hover:text-brand-orange group-hover:translate-x-0.5')}>
        {locked ? comingSoonLabel : openLabel}
        {!locked && <ArrowUpRight className="h-3 w-3" />}
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </>
  )
}

function AppCard({ app, openLabel, comingSoonLabel }: { app: AppDef; openLabel: string; comingSoonLabel: string }) {
  const { t } = useTranslation()
  const locked = app.badge === 'coming-soon'
  const badgeLabel = t(`launchpad.apps.${app.id}.badge`, {
    defaultValue: app.badge === 'active' ? 'Active' : app.badge === 'beta' ? 'Beta' : t('launchpad.comingSoon'),
  })

  if (locked) {
    return (
      <div className={cn(CARD_BASE, 'opacity-55 cursor-default')}>
        <CardInner app={app} locked badgeLabel={badgeLabel} openLabel={openLabel} comingSoonLabel={comingSoonLabel} />
      </div>
    )
  }
  return (
    <Link to={app.to} className={cn(CARD_BASE, 'cursor-pointer hover:-translate-y-[3px]')} style={{ ['--hover-shadow' as string]: app.hoverShadow }}>
      <CardInner app={app} locked={false} badgeLabel={badgeLabel} openLabel={openLabel} comingSoonLabel={comingSoonLabel} />
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppLaunchpad() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Chef'
  const greeting  = getGreeting(
    t('launchpad.greetingMorning'),
    t('launchpad.greetingAfternoon'),
    t('launchpad.greetingEvening'),
    firstName,
  )
  const openLabel       = t('launchpad.open')
  const comingSoonLabel = t('launchpad.comingSoon')

  const apps: AppDef[] = [
    { id: 'buffet',    to: '/menus',          icon: Tag,         iconColor: 'text-brand-orange', iconBg: 'bg-brand-orange/10',  hoverShadow: '0 24px 64px rgba(196,149,106,0.20)', accentGlow: 'rgba(196,149,106,0.18)', title: t('launchpad.apps.buffet.title'),    subtitle: 'ChefSuite', description: t('launchpad.apps.buffet.description'),    badge: 'active'      },
    { id: 'kds',       to: '/kds',            icon: Monitor,     iconColor: 'text-sky-500',       iconBg: 'bg-sky-500/10',       hoverShadow: '0 24px 64px rgba(14,165,233,0.14)',  accentGlow: 'rgba(14,165,233,0.14)',  title: t('launchpad.apps.kds.title'),       subtitle: 'ChefSuite', description: t('launchpad.apps.kds.description'),       badge: 'beta'        },
    { id: 'warehouse', to: '/warehouse',      icon: Building2,   iconColor: 'text-emerald-500',   iconBg: 'bg-emerald-500/10',   hoverShadow: '0 24px 64px rgba(16,185,129,0.14)',  accentGlow: 'rgba(16,185,129,0.14)', title: t('launchpad.apps.warehouse.title'), subtitle: 'ChefSuite', description: t('launchpad.apps.warehouse.description'), badge: 'beta'        },
    { id: 'haccp',     to: '/haccp-logbook',  icon: ShieldCheck, iconColor: 'text-rose-400',      iconBg: 'bg-rose-500/10',      hoverShadow: '0 24px 64px rgba(244,63,94,0.10)',   accentGlow: 'rgba(244,63,94,0.10)',  title: t('launchpad.apps.haccp.title'),     subtitle: 'ChefSuite', description: t('launchpad.apps.haccp.description'),     badge: 'coming-soon' },
  ]

  return (
    <div className="mx-auto max-w-2xl px-1 py-6 sm:py-10 flex flex-col gap-8">

      {/* ── Header ── */}
      <header className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange shadow-orange-glow mt-0.5">
          <Flame className="h-5 w-5 text-white-fixed" />
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.20em] uppercase text-brand-orange mb-1">ChefSuite Platform</p>
          <h1 className="text-2xl sm:text-[26px] font-bold text-white/88 tracking-tight leading-none">{greeting}</h1>
          <p className="text-sm text-white/38 mt-1.5">{t('launchpad.selectApp')}</p>
        </div>
      </header>

      {/* ── App grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} openLabel={openLabel} comingSoonLabel={comingSoonLabel} />
        ))}
      </div>

      {/* ── Footer ── */}
      <footer className="flex items-center justify-center gap-3">
        <span className="h-px w-12 bg-white/10" />
        <p className="text-[10px] tracking-[0.22em] uppercase text-white/20 font-medium">
          ChefSuite &middot; v2.0
        </p>
        <span className="h-px w-12 bg-white/10" />
      </footer>

    </div>
  )
}
