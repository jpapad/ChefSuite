import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Payload shape ─────────────────────────────────────────────────────────────

interface DishPayload {
  n: string     // primary name (Greek fallback)
  nb?: string   // Bulgarian
  nuk?: string  // Ukrainian
  nro?: string  // Romanian
  nsr?: string  // Serbian
  nsk?: string  // Slovak
  npl?: string  // Polish
  ncs?: string  // Czech
  de?: string   // description (fallback)
  db?: string   // Bulgarian description
  duk?: string  // Ukrainian description
  dro?: string  // Romanian description
  dsr?: string  // Serbian description
  dsk?: string  // Slovak description
  dpl?: string  // Polish description
  dcs?: string  // Czech description
}

type Lang = 'el' | 'bg' | 'uk' | 'ro' | 'sr' | 'sk' | 'pl' | 'cs'

const LANG_META: Record<Lang, { flag: string; label: string; native: string }> = {
  el:  { flag: '🇬🇷', label: 'Greek',      native: 'Ελληνικά'   },
  bg:  { flag: '🇧🇬', label: 'Bulgarian',  native: 'Български'  },
  uk:  { flag: '🇺🇦', label: 'Ukrainian',  native: 'Українська' },
  ro:  { flag: '🇷🇴', label: 'Romanian',   native: 'Română'     },
  sr:  { flag: '🇷🇸', label: 'Serbian',    native: 'Српски'     },
  sk:  { flag: '🇸🇰', label: 'Slovak',     native: 'Slovenčina' },
  pl:  { flag: '🇵🇱', label: 'Polish',     native: 'Polski'     },
  cs:  { flag: '🇨🇿', label: 'Czech',      native: 'Čeština'    },
}

// ── Legacy: decode names from URL (?d=BASE64) ─────────────────────────────────

function decode(raw: string): DishPayload | null {
  try {
    const binary = atob(raw)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return JSON.parse(new TextDecoder().decode(bytes)) as DishPayload
  } catch {
    try {
      return JSON.parse(decodeURIComponent(atob(raw))) as DishPayload
    } catch {
      return null
    }
  }
}

// ── Live: map DB row → DishPayload ────────────────────────────────────────────

type DishRow = Record<string, string | null | Record<string, string | null>>

function rowToPayload(row: DishRow): DishPayload {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const extra = (row.descriptions_extra ?? {}) as Record<string, string | null>
  return {
    n:   str(row.name_el) ?? str(row.name) ?? '—',
    nb:  str(row.name_bg),
    nuk: str(row.name_uk),
    nro: str(row.name_ro),
    nsr: str(row.name_sr),
    nsk: str(row.name_sk),
    npl: str(row.name_pl),
    ncs: str(row.name_cs),
    de:  str(row.description_el) ?? str(row.description),
    db:  str(row.description_bg) ?? str(extra?.bg),
    duk: str(extra?.uk),
    dro: str(extra?.ro),
    dsr: str(extra?.sr),
    dsk: str(extra?.sk),
    dpl: str(extra?.pl),
    dcs: str(extra?.cs),
  }
}

// ── Shared display component ──────────────────────────────────────────────────

function DishCard({ payload }: { payload: DishPayload }) {
  const available = useMemo<Lang[]>(() => {
    const langs: Lang[] = []
    if (payload.nb)  langs.push('bg')
    if (payload.nuk) langs.push('uk')
    if (payload.nro) langs.push('ro')
    if (payload.nsr) langs.push('sr')
    if (payload.nsk) langs.push('sk')
    if (payload.npl) langs.push('pl')
    if (payload.ncs) langs.push('cs')
    return langs
  }, [payload])

  const defaultLang = useMemo<Lang>(() => {
    if (payload.nb)  return 'bg'
    if (payload.nuk) return 'uk'
    if (payload.nro) return 'ro'
    if (payload.nsr) return 'sr'
    if (payload.nsk) return 'sk'
    if (payload.npl) return 'pl'
    if (payload.ncs) return 'cs'
    return 'el'
  }, [payload])

  const [lang, setLang] = useState<Lang>(defaultLang)
  const currentLang = available.includes(lang) ? lang : (available[0] ?? 'el')

  const name =
    lang === 'bg' ? (payload.nb  ?? payload.n) :
    lang === 'uk' ? (payload.nuk ?? payload.n) :
    lang === 'ro' ? (payload.nro ?? payload.n) :
    lang === 'sr' ? (payload.nsr ?? payload.n) :
    lang === 'sk' ? (payload.nsk ?? payload.n) :
    lang === 'pl' ? (payload.npl ?? payload.n) :
    lang === 'cs' ? (payload.ncs ?? payload.n) :
    payload.n

  const desc =
    lang === 'bg' ? (payload.db  ?? payload.de ?? null) :
    lang === 'uk' ? (payload.duk ?? payload.de ?? null) :
    lang === 'ro' ? (payload.dro ?? payload.de ?? null) :
    lang === 'sr' ? (payload.dsr ?? payload.de ?? null) :
    lang === 'sk' ? (payload.dsk ?? payload.de ?? null) :
    lang === 'pl' ? (payload.dpl ?? payload.de ?? null) :
    lang === 'cs' ? (payload.dcs ?? payload.de ?? null) :
    (payload.de ?? null)

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
      {available.length > 0 && (
        <div className="overflow-hidden rounded-t-2xl border-b border-white/10">
          <div className="flex overflow-x-scroll scrollbar-none">
            {/* Always show Greek first */}
            <button
              type="button"
              onClick={() => setLang('el')}
              className={[
                'flex-shrink-0 flex flex-col items-center gap-0.5 py-3 px-4 text-xs font-medium transition',
                currentLang === 'el'
                  ? 'bg-emerald-500/15 text-emerald-300 border-b-2 border-emerald-400'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5',
              ].join(' ')}
            >
              <span className="text-lg leading-none">{LANG_META.el.flag}</span>
              <span>{LANG_META.el.native}</span>
            </button>
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
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-white leading-tight">{name}</h1>
        {desc ? (
          <p className="text-white/70 text-base leading-relaxed">{desc}</p>
        ) : (
          <p className="text-white/25 text-sm italic">No description available.</p>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DishInfo() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const d  = params.get('d')

  // Live mode (?id=UUID) — fetch from database
  const [livePayload, setLivePayload] = useState<DishPayload | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [notFound,    setNotFound]    = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase
      .rpc('get_dish_public', { item_id: id })
      .then(({ data, error }) => {
        setLoading(false)
        const row = Array.isArray(data) ? data[0] : data
        if (error || !row) { setNotFound(true); return }
        setLivePayload(rowToPayload(row as DishRow))
      })
  }, [id])

  // Legacy mode (?d=BASE64) — decode from URL
  const legacyPayload = useMemo(() => d ? decode(d) : null, [d])

  const payload = id ? livePayload : legacyPayload

  const shell = (children: React.ReactNode) => (
    <div
      style={{ '--app-white': '255 255 255' } as React.CSSProperties}
      className="min-h-screen bg-[#0f1117] flex flex-col items-center px-4 py-10"
    >
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 text-white/30 text-xs tracking-widest uppercase">
          <span>🍽️</span><span>ChefSuite</span>
        </div>
      </div>
      {children}
      <p className="mt-8 text-white/15 text-xs">Powered by ChefSuite</p>
    </div>
  )

  if (loading) {
    return shell(
      <div className="flex flex-col items-center gap-3 text-white/40">
        <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        <p className="text-sm">Φόρτωση…</p>
      </div>
    )
  }

  if (notFound || (!payload && !loading)) {
    return shell(
      <div className="text-center space-y-3">
        <p className="text-4xl">🍽️</p>
        <p className="text-white text-base font-medium">Μη έγκυρο QR code</p>
        <p className="text-white/50 text-sm">Invalid or expired QR code.</p>
      </div>
    )
  }

  if (!payload) return null

  return shell(<DishCard payload={payload} />)
}
