import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

interface DishPayload {
  n: string     // primary name (Greek fallback)
  nb?: string   // Bulgarian
  ns?: string   // Slovenian
  nsr?: string  // Serbian
  nsk?: string  // Slovak
  npl?: string  // Polish
  ncs?: string  // Czech
  de?: string   // English description (fallback)
  db?: string   // Bulgarian description
  ds?: string   // Slovenian description
  dsr?: string  // Serbian description
  dsk?: string  // Slovak description
  dpl?: string  // Polish description
  dcs?: string  // Czech description
}

type Lang = 'el' | 'bg' | 'sl' | 'sr' | 'sk' | 'pl' | 'cs'

const LANG_META: Record<Lang, { flag: string; label: string; native: string }> = {
  el:  { flag: '🇬🇷', label: 'Greek',      native: 'Ελληνικά'   },
  bg:  { flag: '🇧🇬', label: 'Bulgarian',  native: 'Български'  },
  sl:  { flag: '🇸🇮', label: 'Slovenian',  native: 'Slovenščina'},
  sr:  { flag: '🇷🇸', label: 'Serbian',    native: 'Српски'     },
  sk:  { flag: '🇸🇰', label: 'Slovak',     native: 'Slovenčina' },
  pl:  { flag: '🇵🇱', label: 'Polish',     native: 'Polski'     },
  cs:  { flag: '🇨🇿', label: 'Czech',      native: 'Čeština'    },
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
    const langs: Lang[] = []
    if (payload.nb)  langs.push('bg')
    if (payload.ns)  langs.push('sl')
    if (payload.nsr) langs.push('sr')
    if (payload.nsk) langs.push('sk')
    if (payload.npl) langs.push('pl')
    if (payload.ncs) langs.push('cs')
    return langs
  }, [payload])

  // Default to first available worker language, fall back to Greek
  const defaultLang = useMemo<Lang>(() => {
    if (!payload) return 'el'
    if (payload.nb)  return 'bg'
    if (payload.ns)  return 'sl'
    if (payload.nsr) return 'sr'
    if (payload.nsk) return 'sk'
    if (payload.npl) return 'pl'
    if (payload.ncs) return 'cs'
    return 'el'
  }, [payload])

  const [lang, setLang] = useState<Lang>(defaultLang)

  if (!payload) {
    return (
      <div
        style={{ '--app-white': '255 255 255' } as React.CSSProperties}
        className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6"
      >
        <div className="text-center space-y-3">
          <p className="text-4xl">🍽️</p>
          <p className="text-white text-base font-medium">Μη έγκυρο QR code</p>
          <p className="text-white/50 text-sm">Invalid or expired QR code.</p>
        </div>
      </div>
    )
  }

  const name =
    lang === 'bg' ? (payload.nb  ?? payload.n) :
    lang === 'sl' ? (payload.ns  ?? payload.n) :
    lang === 'sr' ? (payload.nsr ?? payload.n) :
    lang === 'sk' ? (payload.nsk ?? payload.n) :
    lang === 'pl' ? (payload.npl ?? payload.n) :
    lang === 'cs' ? (payload.ncs ?? payload.n) :
    payload.n

  const desc =
    lang === 'bg' ? (payload.db  ?? payload.de ?? null) :
    lang === 'sl' ? (payload.ds  ?? payload.de ?? null) :
    lang === 'sr' ? (payload.dsr ?? payload.de ?? null) :
    lang === 'sk' ? (payload.dsk ?? payload.de ?? null) :
    lang === 'pl' ? (payload.dpl ?? payload.de ?? null) :
    lang === 'cs' ? (payload.dcs ?? payload.de ?? null) :
    (payload.de ?? null)

  const currentLang = available.includes(lang) ? lang : (available[0] ?? 'el')

  return (
    <div
      style={{ '--app-white': '255 255 255' } as React.CSSProperties}
      className="min-h-screen bg-[#0f1117] flex flex-col items-center px-4 py-10"
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 text-white/30 text-xs tracking-widest uppercase">
          <span>🍽️</span>
          <span>ChefSuite</span>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur">

        {/* Language picker — separate overflow-hidden wrapper so scroll isn't blocked */}
        {available.length > 1 && (
          <div className="overflow-hidden rounded-t-2xl border-b border-white/10">
            <div className="flex overflow-x-scroll scrollbar-none">
              {available.map((l) => {
                const meta = LANG_META[l]
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={[
                      'flex-shrink-0 flex flex-col items-center gap-0.5 py-3 px-4 text-xs font-medium transition',
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
