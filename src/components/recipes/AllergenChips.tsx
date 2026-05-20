import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AllergenBadge, ALLERGEN_GROUPS, ALLERGEN_META } from '../ui/AllergenIcon'

interface AllergenChipsProps {
  value: string[]
  onChange: (next: string[]) => void
  label?: string
}

export function AllergenChips({ value, onChange, label = 'Allergens' }: AllergenChipsProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
    setDraft('')
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="space-y-3">
      <span className="block text-sm font-medium text-white/80">{label}</span>

      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1">
              <AllergenBadge allergen={tag} size="md" />
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove ${tag}`}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom text entry */}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => draft && add(draft)}
        placeholder="Προσθήκη custom… (Enter)"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
      />

      {/* Grouped suggestions */}
      <div className="space-y-3">
        {ALLERGEN_GROUPS.map((group) => {
          const available = group.keys.filter((k) => !value.includes(k))
          if (available.length === 0) return null
          const groupLabel = lang.startsWith('el') ? group.labelEl : group.labelEl
          return (
            <div key={group.labelEl}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {groupLabel}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {available.map((key) => {
                  const meta = ALLERGEN_META[key]
                  if (!meta) return null
                  const displayLabel = lang.startsWith('el') ? meta.labelEl : lang.startsWith('bg') ? meta.labelBg : meta.label
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => add(key)}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                        'border-white/10 text-white/60 hover:border-white/30 hover:text-white hover:bg-white/5',
                      ].join(' ')}
                    >
                      <span className={['h-4 w-4 shrink-0', meta.text].join(' ')}>{meta.icon}</span>
                      {displayLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
