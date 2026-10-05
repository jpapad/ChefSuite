import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QrCode } from 'lucide-react'
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

const LANG_META: Record<Lang, { label: string; native: string }> = {
  el:  { label: 'Greek',      native: 'Ελληνικά'   },
  bg:  { label: 'Bulgarian',  native: 'Български'  },
  uk:  { label: 'Ukrainian',  native: 'Українська' },
  ro:  { label: 'Romanian',   native: 'Română'     },
  sr:  { label: 'Serbian',    native: 'Српски'     },
  sk:  { label: 'Slovak',     native: 'Slovenčina' },
  pl:  { label: 'Polish',     native: 'Polski'     },
  cs:  { label: 'Czech',      native: 'Čeština'    },
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

  const langs: Lang[] = available.length > 0 ? ['el', ...available] : []

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="rounded-[2rem] bg-ink px-6 pb-8 pt-6 text-white-fixed">
        <span className="inline-flex rounded-full bg-lime px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink">
          {LANG_META[currentLang].native}
        </span>
        <h1 className="mt-6 text-4xl font-medium leading-[1.05] tracking-[-0.03em]">{name}</h1>
      </div>

      <div className="rounded-3xl bg-white-fixed p-6 shadow-[0_1px_2px_rgba(15,18,16,0.05),0_10px_30px_-18px_rgba(15,18,16,0.25)]">
        {desc ? (
          <p className="text-[17px] leading-relaxed text-ink/80">{desc}</p>
        ) : (
          <p className="text-sm text-ink/40">No description available.</p>
        )}
      </div>

      {langs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-3xl bg-white-fixed p-2 shadow-[0_10px_30px_-18px_rgba(15,18,16,0.25)]">
          {langs.map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)}
              className={`flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition ${currentLang === l ? 'bg-ink text-white-fixed' : 'text-ink/60 hover:bg-[#EAEBE6] hover:text-ink'}`}>
              <span className={`text-[11px] font-semibold uppercase ${currentLang === l ? 'text-lime' : 'text-ink/40'}`}>{l}</span>
              {LANG_META[l].native}
            </button>
          ))}
        </div>
      )}
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
    <div className="flex min-h-screen flex-col items-center bg-[#F1F2EE] px-3 py-6 text-ink">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-[10px] font-bold">CS</span>
        <span className="text-sm font-medium">ChefSuite</span>
      </div>
      {children}
      <p className="mt-8 text-xs text-ink/35">Powered by ChefSuite</p>
    </div>
  )

  if (loading) {
    return shell(
      <div className="flex flex-col items-center gap-3 text-ink/50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60" />
        <p className="text-sm">Φόρτωση…</p>
      </div>
    )
  }

  if (notFound || (!payload && !loading)) {
    return shell(
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-[2rem] bg-white-fixed p-8 text-center shadow-[0_10px_30px_-18px_rgba(15,18,16,0.25)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime">
          <QrCode className="h-6 w-6" />
        </span>
        <p className="text-xl font-medium">Μη έγκυρο QR code</p>
        <p className="text-sm text-ink/50">Invalid or expired QR code.</p>
      </div>
    )
  }

  if (!payload) return null

  return shell(<DishCard payload={payload} />)
}
