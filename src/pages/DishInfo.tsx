import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

interface DishPayload {
  n: string    // primary (Greek)
  ne?: string  // English
  nb?: string  // Bulgarian
  d?: string   // description primary
  de?: string  // description EN
  db?: string  // description BG
}

type Lang = 'el' | 'en' | 'bg'

const LANG_META: Record<Lang, { flag: string; label: string; native: string }> = {
  el: { flag: '🇬🇷', label: 'Greek',     native: 'Ελληνικά'  },
  en: { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', label: 'English',   native: 'English'   },
  bg: { flag: '🇧🇬', label: 'Bulgarian', native: 'Български' },
}

function decode(raw: string): DishPayload | null {
  try {
    return JSON.parse(decodeURIComponent(atob(raw))) as DishPayload
  } catch {
    return null
  }
}

export default function DishInfo() {
  const [params] = useSearchParams()
  const payload = useMemo(() => {
    const d = params.get('d')
    return d ? decode(d) : null
  }, [params])

  const available = useMemo<Lang[]>(() => {
    if (!payload) return []
    const langs: Lang[] = ['el']
    if (payload.ne) langs.push('en')
    if (payload.nb) langs.push('bg')
    return langs
  }, [payload])

  const [lang, setLang] = useState<Lang>('el')

  if (!payload) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-white/40 text-sm">Invalid or expired QR code.</p>
        </div>
      </div>
    )
  }

  const name =
    lang === 'en' ? (payload.ne ?? payload.n) :
    lang === 'bg' ? (payload.nb ?? payload.n) :
    payload.n

  const desc =
    lang === 'en' ? (payload.de ?? payload.d ?? null) :
    lang === 'bg' ? (payload.db ?? payload.d ?? null) :
    (payload.d ?? null)

  const currentLang = available.includes(lang) ? lang : 'el'

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 text-white/30 text-xs tracking-widest uppercase">
          <span>🍽️</span>
          <span>ChefSuite</span>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur">

        {/* Language picker */}
        {available.length > 1 && (
          <div className="flex border-b border-white/10">
            {available.map((l) => {
              const meta = LANG_META[l]
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={[
                    'flex-1 flex flex-col items-center gap-0.5 py-3 px-2 text-xs font-medium transition',
                    currentLang === l
                      ? 'bg-emerald-500/15 text-emerald-300 border-b-2 border-emerald-400'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5',
                  ].join(' ')}
                >
                  <span className="text-lg leading-none">{meta.flag}</span>
                  <span>{meta.native}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-white leading-tight">{name}</h1>
          {desc ? (
            <p className="text-white/70 text-base leading-relaxed">{desc}</p>
          ) : (
            <p className="text-white/25 text-sm italic">No description available.</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-white/15 text-xs">
        Powered by ChefSuite
      </p>
    </div>
  )
}
