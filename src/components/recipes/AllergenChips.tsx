import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

interface AllergenChipsProps {
  value: string[]
  onChange: (next: string[]) => void
  label?: string
  suggestions?: string[]
}

const defaultSuggestions = [
  'gluten',
  'dairy',
  'eggs',
  'nuts',
  'peanuts',
  'soy',
  'shellfish',
  'fish',
  'sesame',
]

export function AllergenChips({
  value,
  onChange,
  label = 'Allergens',
  suggestions = defaultSuggestions,
}: AllergenChipsProps) {
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

  const remaining = suggestions.filter((s) => !value.includes(s))

  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-white/80">
        {label}
      </span>
      <div className="glass rounded-xl px-3 py-2 min-h-touch-target flex flex-wrap items-center gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-orange/20 text-brand-orange px-2 py-1 text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
              className="hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? '' : 'Type and press Enter'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-base placeholder:text-white/40 py-1"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cn(
                'rounded-lg border border-glass-border px-2 py-1 text-xs',
                'text-white/60 hover:text-white hover:bg-white/5',
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
