import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '../lib/cn'

interface Produce {
  name: string
  emoji: string
  type: 'vegetable' | 'fruit' | 'herb'
  peak?: boolean  // peak season this month
}

const MONTHS: { label: string; short: string; season: 'winter' | 'spring' | 'summer' | 'autumn'; produce: Produce[] }[] = [
  {
    label: 'Ιανουάριος', short: 'ΙΑΝ', season: 'winter',
    produce: [
      { name: 'Πορτοκάλια',   emoji: '🍊', type: 'fruit',     peak: true  },
      { name: 'Μανταρίνια',   emoji: '🍊', type: 'fruit',     peak: true  },
      { name: 'Ακτινίδια',    emoji: '🥝', type: 'fruit'                  },
      { name: 'Λεμόνια',      emoji: '🍋', type: 'fruit'                  },
      { name: 'Λάχανο',       emoji: '🥬', type: 'vegetable', peak: true  },
      { name: 'Κουνουπίδι',   emoji: '🥦', type: 'vegetable', peak: true  },
      { name: 'Μπρόκολο',     emoji: '🥦', type: 'vegetable'              },
      { name: 'Σπανάκι',      emoji: '🌿', type: 'vegetable', peak: true  },
      { name: 'Πράσα',        emoji: '🌿', type: 'vegetable'              },
      { name: 'Σέλινο',       emoji: '🌿', type: 'herb'                   },
    ],
  },
  {
    label: 'Φεβρουάριος', short: 'ΦΕΒ', season: 'winter',
    produce: [
      { name: 'Πορτοκάλια',   emoji: '🍊', type: 'fruit',     peak: true  },
      { name: 'Μανταρίνια',   emoji: '🍊', type: 'fruit'                  },
      { name: 'Ακτινίδια',    emoji: '🥝', type: 'fruit',     peak: true  },
      { name: 'Λεμόνια',      emoji: '🍋', type: 'fruit'                  },
      { name: 'Κουνουπίδι',   emoji: '🥦', type: 'vegetable', peak: true  },
      { name: 'Μπρόκολο',     emoji: '🥦', type: 'vegetable', peak: true  },
      { name: 'Σπανάκι',      emoji: '🌿', type: 'vegetable'              },
      { name: 'Πράσα',        emoji: '🌿', type: 'vegetable'              },
    ],
  },
  {
    label: 'Μάρτιος', short: 'ΜΑΡ', season: 'spring',
    produce: [
      { name: 'Φράουλες',     emoji: '🍓', type: 'fruit'                  },
      { name: 'Ακτινίδια',    emoji: '🥝', type: 'fruit'                  },
      { name: 'Αγκινάρες',    emoji: '🌿', type: 'vegetable', peak: true  },
      { name: 'Αρακάς',       emoji: '🫛', type: 'vegetable', peak: true  },
      { name: 'Μαρούλι',      emoji: '🥬', type: 'vegetable', peak: true  },
      { name: 'Σπανάκι',      emoji: '🌿', type: 'vegetable', peak: true  },
      { name: 'Σκόρδο φρέσκο',emoji: '🧄', type: 'vegetable'              },
      { name: 'Κρεμμυδάκια',  emoji: '🧅', type: 'vegetable'              },
    ],
  },
  {
    label: 'Απρίλιος', short: 'ΑΠΡ', season: 'spring',
    produce: [
      { name: 'Φράουλες',     emoji: '🍓', type: 'fruit',     peak: true  },
      { name: 'Κεράσια',      emoji: '🍒', type: 'fruit'                  },
      { name: 'Αγκινάρες',    emoji: '🌿', type: 'vegetable', peak: true  },
      { name: 'Σπαράγγια',    emoji: '🌿', type: 'vegetable', peak: true  },
      { name: 'Αρακάς',       emoji: '🫛', type: 'vegetable', peak: true  },
      { name: 'Μαρούλι',      emoji: '🥬', type: 'vegetable'              },
      { name: 'Ντομάτες',     emoji: '🍅', type: 'vegetable'              },
      { name: 'Βασιλικός',    emoji: '🌿', type: 'herb'                   },
    ],
  },
  {
    label: 'Μάιος', short: 'ΜΑΙ', season: 'spring',
    produce: [
      { name: 'Φράουλες',     emoji: '🍓', type: 'fruit',     peak: true  },
      { name: 'Κεράσια',      emoji: '🍒', type: 'fruit',     peak: true  },
      { name: 'Βερίκοκα',     emoji: '🍑', type: 'fruit'                  },
      { name: 'Κολοκυθάκια',  emoji: '🥒', type: 'vegetable', peak: true  },
      { name: 'Ντομάτες',     emoji: '🍅', type: 'vegetable', peak: true  },
      { name: 'Αγγούρια',     emoji: '🥒', type: 'vegetable'              },
      { name: 'Βασιλικός',    emoji: '🌿', type: 'herb',      peak: true  },
      { name: 'Μαϊντανός',    emoji: '🌿', type: 'herb'                   },
    ],
  },
  {
    label: 'Ιούνιος', short: 'ΙΟΥ', season: 'summer',
    produce: [
      { name: 'Κεράσια',      emoji: '🍒', type: 'fruit',     peak: true  },
      { name: 'Βερίκοκα',     emoji: '🍑', type: 'fruit',     peak: true  },
      { name: 'Ροδάκινα',     emoji: '🍑', type: 'fruit',     peak: true  },
      { name: 'Καρπούζι',     emoji: '🍉', type: 'fruit'                  },
      { name: 'Ντομάτες',     emoji: '🍅', type: 'vegetable', peak: true  },
      { name: 'Αγγούρια',     emoji: '🥒', type: 'vegetable', peak: true  },
      { name: 'Πιπεριές',     emoji: '🫑', type: 'vegetable', peak: true  },
      { name: 'Μελιτζάνες',   emoji: '🍆', type: 'vegetable'              },
      { name: 'Βασιλικός',    emoji: '🌿', type: 'herb',      peak: true  },
    ],
  },
  {
    label: 'Ιούλιος', short: 'ΙΟΥ', season: 'summer',
    produce: [
      { name: 'Ροδάκινα',     emoji: '🍑', type: 'fruit',     peak: true  },
      { name: 'Νεκταρίνια',   emoji: '🍑', type: 'fruit',     peak: true  },
      { name: 'Καρπούζι',     emoji: '🍉', type: 'fruit',     peak: true  },
      { name: 'Πεπόνι',       emoji: '🍈', type: 'fruit',     peak: true  },
      { name: 'Σύκα',         emoji: '🟣', type: 'fruit'                  },
      { name: 'Ντομάτες',     emoji: '🍅', type: 'vegetable', peak: true  },
      { name: 'Μελιτζάνες',   emoji: '🍆', type: 'vegetable', peak: true  },
      { name: 'Πιπεριές',     emoji: '🫑', type: 'vegetable', peak: true  },
      { name: 'Κολοκυθάκια',  emoji: '🥒', type: 'vegetable', peak: true  },
    ],
  },
  {
    label: 'Αύγουστος', short: 'ΑΥΓ', season: 'summer',
    produce: [
      { name: 'Σύκα',         emoji: '🟣', type: 'fruit',     peak: true  },
      { name: 'Σταφύλια',     emoji: '🍇', type: 'fruit',     peak: true  },
      { name: 'Καρπούζι',     emoji: '🍉', type: 'fruit',     peak: true  },
      { name: 'Ροδάκινα',     emoji: '🍑', type: 'fruit'                  },
      { name: 'Ντομάτες',     emoji: '🍅', type: 'vegetable', peak: true  },
      { name: 'Μελιτζάνες',   emoji: '🍆', type: 'vegetable', peak: true  },
      { name: 'Πιπεριές',     emoji: '🫑', type: 'vegetable'              },
      { name: 'Βασιλικός',    emoji: '🌿', type: 'herb'                   },
    ],
  },
  {
    label: 'Σεπτέμβριος', short: 'ΣΕΠ', season: 'autumn',
    produce: [
      { name: 'Σύκα',         emoji: '🟣', type: 'fruit',     peak: true  },
      { name: 'Σταφύλια',     emoji: '🍇', type: 'fruit',     peak: true  },
      { name: 'Ρόδια',        emoji: '🔴', type: 'fruit'                  },
      { name: 'Κυδώνια',      emoji: '🟡', type: 'fruit'                  },
      { name: 'Κολοκύθα',     emoji: '🎃', type: 'vegetable', peak: true  },
      { name: 'Ντομάτες',     emoji: '🍅', type: 'vegetable'              },
      { name: 'Πιπεριές',     emoji: '🫑', type: 'vegetable'              },
      { name: 'Δεντρολίβανο', emoji: '🌿', type: 'herb'                   },
    ],
  },
  {
    label: 'Οκτώβριος', short: 'ΟΚΤ', season: 'autumn',
    produce: [
      { name: 'Ρόδια',        emoji: '🔴', type: 'fruit',     peak: true  },
      { name: 'Κυδώνια',      emoji: '🟡', type: 'fruit',     peak: true  },
      { name: 'Μήλα',         emoji: '🍎', type: 'fruit',     peak: true  },
      { name: 'Αχλάδια',      emoji: '🍐', type: 'fruit',     peak: true  },
      { name: 'Σταφύλια',     emoji: '🍇', type: 'fruit'                  },
      { name: 'Κολοκύθα',     emoji: '🎃', type: 'vegetable', peak: true  },
      { name: 'Κουνουπίδι',   emoji: '🥦', type: 'vegetable'              },
      { name: 'Μπρόκολο',     emoji: '🥦', type: 'vegetable'              },
    ],
  },
  {
    label: 'Νοέμβριος', short: 'ΝΟΕ', season: 'autumn',
    produce: [
      { name: 'Ρόδια',        emoji: '🔴', type: 'fruit',     peak: true  },
      { name: 'Πορτοκάλια',   emoji: '🍊', type: 'fruit'                  },
      { name: 'Μήλα',         emoji: '🍎', type: 'fruit'                  },
      { name: 'Κολοκύθα',     emoji: '🎃', type: 'vegetable'              },
      { name: 'Κουνουπίδι',   emoji: '🥦', type: 'vegetable', peak: true  },
      { name: 'Μπρόκολο',     emoji: '🥦', type: 'vegetable', peak: true  },
      { name: 'Σπανάκι',      emoji: '🌿', type: 'vegetable', peak: true  },
      { name: 'Πράσα',        emoji: '🌿', type: 'vegetable'              },
    ],
  },
  {
    label: 'Δεκέμβριος', short: 'ΔΕΚ', season: 'winter',
    produce: [
      { name: 'Πορτοκάλια',   emoji: '🍊', type: 'fruit',     peak: true  },
      { name: 'Μανταρίνια',   emoji: '🍊', type: 'fruit',     peak: true  },
      { name: 'Ακτινίδια',    emoji: '🥝', type: 'fruit'                  },
      { name: 'Λεμόνια',      emoji: '🍋', type: 'fruit'                  },
      { name: 'Κουνουπίδι',   emoji: '🥦', type: 'vegetable', peak: true  },
      { name: 'Σπανάκι',      emoji: '🌿', type: 'vegetable', peak: true  },
      { name: 'Πράσα',        emoji: '🌿', type: 'vegetable'              },
      { name: 'Σέλινο',       emoji: '🌿', type: 'herb'                   },
    ],
  },
]

const SEASON_STYLE: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  winter: { bg: 'bg-sky-400/8',    border: 'border-sky-400/20',   text: 'text-sky-300',   badge: 'bg-sky-400/15 text-sky-300'    },
  spring: { bg: 'bg-emerald-400/8', border: 'border-emerald-400/20', text: 'text-emerald-300', badge: 'bg-emerald-400/15 text-emerald-300' },
  summer: { bg: 'bg-amber-400/8',  border: 'border-amber-400/20', text: 'text-amber-300', badge: 'bg-amber-400/15 text-amber-300' },
  autumn: { bg: 'bg-orange-400/8', border: 'border-orange-400/20', text: 'text-orange-300', badge: 'bg-orange-400/15 text-orange-300' },
}

const SEASON_LABEL: Record<string, string> = {
  winter: 'Χειμώνας', spring: 'Άνοιξη', summer: 'Καλοκαίρι', autumn: 'Φθινόπωρο',
}

const TYPE_LABEL: Record<string, string> = {
  vegetable: 'Λαχανικά', fruit: 'Φρούτα / Εσπεριδοειδή', herb: 'Βότανα & Αρωματικά',
}

export default function SeasonalCalendar() {
  const currentMonth = new Date().getMonth()
  const [selected, setSelected] = useState(currentMonth)
  const [typeFilter, setTypeFilter] = useState<'all' | 'vegetable' | 'fruit' | 'herb'>('all')

  const month     = MONTHS[selected]!
  const style     = SEASON_STYLE[month.season]!
  const filtered  = typeFilter === 'all' ? month.produce : month.produce.filter((p) => p.type === typeFilter)
  const peakItems = filtered.filter((p) => p.peak)
  const restItems = filtered.filter((p) => !p.peak)

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15">
          <Calendar className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-none">Εποχικά Προϊόντα</h1>
          <p className="text-xs text-white/40 mt-0.5">Τι είναι σε εποχή κάθε μήνα στην Ελλάδα</p>
        </div>
      </div>

      {/* Month picker */}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {MONTHS.map((m, i) => {
          const s = SEASON_STYLE[m.season]!
          const isSelected = i === selected
          const isCurrent  = i === currentMonth
          return (
            <button key={i} type="button" onClick={() => setSelected(i)}
              className={cn(
                'rounded-xl py-2 text-xs font-medium transition-all border',
                isSelected
                  ? cn(s.bg, s.border, s.text, 'ring-1 ring-current')
                  : 'border-white/8 text-white/40 hover:text-white/70 hover:bg-white/5',
              )}>
              {m.short}
              {isCurrent && <span className="block w-1 h-1 rounded-full bg-current mx-auto mt-0.5 opacity-70" />}
            </button>
          )
        })}
      </div>

      {/* Selected month */}
      <div className={cn('rounded-2xl border px-5 py-4', style.bg, style.border)}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={cn('text-lg font-semibold', style.text)}>{month.label}</h2>
            <p className="text-xs text-white/40">{SEASON_LABEL[month.season]}</p>
          </div>
          {/* Type filter */}
          <div className="flex gap-1.5">
            {(['all', 'vegetable', 'fruit', 'herb'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTypeFilter(t)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-medium border transition',
                  typeFilter === t
                    ? cn(style.badge, style.border)
                    : 'border-white/10 text-white/30 hover:text-white/60',
                )}>
                {t === 'all' ? 'Όλα' : t === 'vegetable' ? '🥦' : t === 'fruit' ? '🍊' : '🌿'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Produce grid */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {peakItems.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">⭐ Κορυφή εποχής</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {peakItems.map((p) => (
                <div key={p.name} className={cn(
                  'rounded-xl border px-3 py-2.5 flex items-center gap-2',
                  style.bg, style.border,
                )}>
                  <span className="text-xl">{p.emoji}</span>
                  <div>
                    <p className={cn('text-sm font-semibold', style.text)}>{p.name}</p>
                    <p className="text-[10px] text-white/30">{TYPE_LABEL[p.type]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {restItems.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Διαθέσιμα</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {restItems.map((p) => (
                <div key={p.name} className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 flex items-center gap-2">
                  <span className="text-xl">{p.emoji}</span>
                  <div>
                    <p className="text-sm text-white/70">{p.name}</p>
                    <p className="text-[10px] text-white/25">{TYPE_LABEL[p.type]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
