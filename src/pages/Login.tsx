import { useState, type FormEvent, useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Ember {
  id: number
  left: string
  size: number
  opacity: number
  dx: number
  duration: number
  delay: number
}

export default function Login() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [introPhase, setIntroPhase] = useState<'showing' | 'fading' | 'done'>('showing')
  const [embers, setEmbers]     = useState<Ember[]>([])

  // Generate ember particles once
  useEffect(() => {
    setEmbers(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        size: 2 + Math.random() * 5,
        opacity: 0.2 + Math.random() * 0.3,
        dx: Math.random() * 120 - 60,
        duration: 12 + Math.random() * 12,
        delay: -Math.random() * 20,
      })),
    )
  }, [])

  // Intro → fade → login sequence
  useEffect(() => {
    const t1 = setTimeout(() => {
      setIntroPhase('fading')
      const t2 = setTimeout(() => setIntroPhase('done'), 800)
      return () => clearTimeout(t2)
    }, 2800)
    return () => clearTimeout(t1)
  }, [])

  if (!loading && session) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-6 text-neutral-800"
      style={{ background: 'linear-gradient(135deg, #f8f6f3 0%, #fdfcfb 50%, #f8f6f3 100%)' }}
    >
      {/* Aurora blobs */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 600, height: 600, top: '-10%', left: '20%',
          background: 'rgba(197,160,89,0.12)',
          filter: 'blur(90px)',
          animation: 'auroraMove 20s ease-in-out infinite',
        }}
      />
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 500, height: 500, bottom: '-15%', right: '15%',
          background: 'rgba(197,160,89,0.08)',
          filter: 'blur(90px)',
          animation: 'auroraMove 25s ease-in-out infinite reverse',
        }}
      />

      {/* Ember particles */}
      {embers.map((ember) => (
        <span
          key={ember.id}
          className="pointer-events-none absolute bottom-0 rounded-full"
          style={{
            left: ember.left,
            width: ember.size,
            height: ember.size,
            background:
              'radial-gradient(circle at 50% 40%, rgba(197,160,89,0.4), rgba(197,160,89,0.2) 55%, rgba(197,160,89,0) 72%)',
            boxShadow: `0 0 ${ember.size * 2}px rgba(197,160,89,0.4)`,
            '--ember-opacity': ember.opacity,
            '--ember-dx': `${ember.dx}px`,
            animation: `emberRise ${ember.duration}s linear ${ember.delay}s infinite`,
          } as React.CSSProperties}
        />
      ))}

      {/* ── INTRO SCREEN ── */}
      {introPhase !== 'done' && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{
            animation: introPhase === 'fading' ? 'introFadeOut 0.8s ease-out forwards' : undefined,
          }}
        >
          <div className="text-center select-none">
            {/* Logo mark */}
            <div style={{ animation: 'logoReveal 1.6s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
              <div
                className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-[2rem] text-white font-black text-4xl tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #d8b08c 0%, #C5A059 100%)',
                  boxShadow: '0 16px 56px rgba(197,160,89,0.45), 0 4px 16px rgba(0,0,0,0.08)',
                }}
              >
                CS
              </div>
              <h1 className="text-4xl font-black tracking-tight text-neutral-800">
                Chef<span style={{ color: '#C5A059' }}>Suite</span>
              </h1>
            </div>

            {/* Tagline */}
            <p
              className="mt-4 text-xs tracking-[0.3em] text-neutral-500 uppercase font-semibold"
              style={{ animation: 'taglineReveal 1s ease-out 1.2s forwards', opacity: 0 }}
            >
              Your Kitchen, Your Command
            </p>

            {/* Loading dots */}
            <div
              className="mt-10 flex items-center justify-center gap-2"
              style={{ animation: 'taglineReveal 1s ease-out 1.6s forwards', opacity: 0 }}
            >
              {[0, 200, 400].map((delay) => (
                <div
                  key={delay}
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: '#C5A059', animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LOGIN FORM ── */}
      <div
        className="relative z-10 w-full max-w-md"
        style={{
          opacity: introPhase === 'done' ? undefined : 0,
          animation: introPhase === 'done' ? 'loginFadeIn 0.8s ease-out forwards' : undefined,
          pointerEvents: introPhase === 'done' ? 'auto' : 'none',
        }}
      >
        {/* Logo above card */}
        <div className="mb-10 flex flex-col items-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] text-white font-black text-2xl tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #d8b08c 0%, #C5A059 100%)',
              boxShadow: '0 8px 32px rgba(197,160,89,0.35)',
            }}
          >
            CS
          </div>
        </div>

        {/* Glass card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(197,160,89,0.22)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(197,160,89,0.15), 0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          <div className="flex items-center gap-3 mb-7">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-black text-base"
              style={{ background: 'linear-gradient(135deg, #d8b08c, #C5A059)' }}
            >
              CS
            </div>
            <div>
              <div className="text-base font-bold text-neutral-800 leading-tight">Sign in</div>
              <div className="text-xs text-neutral-500">to your ChefSuite kitchen</div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2">Email</label>
              <input
                type="email"
                placeholder="chef@kitchen.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input w-full rounded-xl px-4 py-3.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid #d1d5db' }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input w-full rounded-xl px-4 py-3.5 text-sm text-neutral-800 placeholder:text-neutral-400"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid #d1d5db' }}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="copper-btn w-full rounded-xl text-white-fixed text-sm font-bold py-3.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#C5A059' }}
            >
              <span>{submitting ? 'Entering…' : 'Enter Kitchen'}</span>
              {!submitting && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-xs text-neutral-500 text-center">
          Protected kitchen access · ChefSuite
        </p>
      </div>
    </div>
  )
}
