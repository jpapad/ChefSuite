import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Volume2, VolumeX } from 'lucide-react'
import { useClock, shiftKey } from '../../lib/useClock'
import { play, playIntro, setSoundEnabled, soundEnabled, stopAll, unlock } from '../../lib/sounds'

const DURATION_MS = 5800
const REDUCED_MS = 1800

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** Last kitchen this device signed in to (written by AppShell). */
export function rememberKitchen(name: string | null | undefined) {
  try { if (name) localStorage.setItem('chefsuite_last_team', name) } catch { /* private mode */ }
}

function lastKitchen() {
  try { return localStorage.getItem('chefsuite_last_team') } catch { return null }
}

/**
 * Full-screen intro that plays before every sign-in. It removes itself when
 * the animation ends; `onDone` lets the page know (e.g. to focus the form).
 * `runKey` restarts it (used by the "replay" link).
 */
export function IntroSplash({ runKey = 0, onDone }: { runKey?: number; onDone?: () => void }) {
  const { t, i18n } = useTranslation()
  const clock = useClock()
  const [visible, setVisible] = useState(true)
  const [sound, setSound] = useState(soundEnabled())
  const [blocked, setBlocked] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const kitchen = lastKitchen() ?? t('station.introKitchen')
  const date = new Date().toLocaleDateString(i18n.language, { weekday: 'short', day: '2-digit', month: '2-digit' })

  const finish = useCallback(() => {
    clearTimeout(timer.current)
    setVisible(false)
    onDoneRef.current?.()
  }, [])

  const start = useCallback(async () => {
    clearTimeout(timer.current)
    setVisible(true)
    timer.current = setTimeout(finish, reducedMotion() ? REDUCED_MS : DURATION_MS)
    if (!soundEnabled()) return
    const ok = await unlock()
    setBlocked(!ok)
    if (ok) playIntro()
  }, [finish])

  useEffect(() => {
    void start()
    return () => clearTimeout(timer.current)
  }, [runKey, start])

  function onSoundClick() {
    if (blocked) {
      // A click is a user gesture: audio can start now, so replay with sound.
      setSoundEnabled(true)
      setSound(true)
      setVisible(false)
      setTimeout(() => void start(), 40)
      return
    }
    const next = !sound
    setSound(next)
    setSoundEnabled(next)
    if (next) play('click')
  }

  function skip() {
    stopAll()
    finish()
  }

  if (!visible) return null

  const soundLabel = blocked ? t('station.introTapSound') : sound ? t('station.introSound') : t('station.introMuted')

  return (
    <>
      <div className="in-under" aria-hidden="true" />
      <div className="in-root font-sans" role="presentation" key={runKey}>
        <span className="in-gv" style={{ left: 64, animationDelay: '0s' }} />
        <span className="in-gv" style={{ left: '33%', animationDelay: '.08s' }} />
        <span className="in-gv" style={{ left: '66%', animationDelay: '.16s' }} />
        <span className="in-gv" style={{ right: 64, animationDelay: '.24s' }} />
        <span className="in-gh" style={{ top: 96, animationDelay: '.1s' }} />
        <span className="in-gh" style={{ bottom: 96, animationDelay: '.2s' }} />

        <div className="absolute inset-x-6 top-6 z-10 flex items-center justify-between gap-3 sm:inset-x-16 sm:top-8">
          <span className="in-fade sb-label flex items-center gap-2 text-[#A3A3A3]" style={{ animationDelay: '.3s' }}>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />{t('station.introConnected')}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={onSoundClick}
              aria-pressed={sound && !blocked}
              className="in-fade sb-label flex h-11 items-center gap-2 rounded-sm border-2 border-[#3A3A3A] px-3.5 text-white-fixed"
              style={{ animationDelay: '.45s' }}
            >
              {sound && !blocked ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}{soundLabel}
            </button>
            <button
              type="button"
              onClick={skip}
              className="in-fade sb-label h-11 rounded-sm border-2 border-[#3A3A3A] px-4 text-white-fixed"
              style={{ animationDelay: '.5s' }}
            >
              {t('station.introSkip')}
            </button>
          </span>
        </div>

        <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col gap-5 sm:left-16 lg:right-[360px]">
          <div className="mb-1 flex items-center gap-5">
            <span className="in-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.84.73-1.04a4 4 0 0 0-2.14-7.59 5 5 0 0 0-9.18 0 4 4 0 0 0-2.14 7.59c.41.2.73.58.73 1.04V20a1 1 0 0 0 1 1Z" />
                <path d="M6 17h12" style={{ animationDelay: '1.15s' }} />
              </svg>
            </span>
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate font-display text-[clamp(30px,4vw,52px)] font-extrabold uppercase leading-[0.9]">
                <span className="in-type">{kitchen}</span><span className="in-caret" aria-hidden="true" />
              </span>
              <span className="in-fade sb-label text-[17px] text-[#A3A3A3]" style={{ animationDelay: '1.35s' }}>
                {t(`station.${shiftKey()}`)} · {date} · <span className="font-mono">{clock}</span>
              </span>
            </span>
          </div>

          <div className="whitespace-nowrap font-display text-[clamp(84px,15vw,216px)] font-extrabold" aria-label="ChefSuite">
            {['C', 'H', 'E', 'F'].map((l, i) => (
              <span key={l} className="in-ltr"><span style={{ animationDelay: `${0.85 + i * 0.07}s` }}>{l}</span></span>
            ))}
            <span className="in-ltr"><span className="in-sweep" data-t="SUITE" style={{ animationDelay: '1.18s' }}>SUITE</span></span>
          </div>
          <div className="in-rule max-w-[1000px]" />

          <div className="in-fade whitespace-nowrap font-display text-[clamp(30px,4.2vw,60px)] font-bold uppercase leading-[1.25] text-[#8A8A8A]" style={{ animationDelay: '1.8s' }}>
            {t('station.introOnePlace')}{' '}
            <span className="in-cyc">
              <span>
                <b>{t('station.introW1')}</b><b>{t('station.introW2')}</b><b>{t('station.introW3')}</b><b style={{ color: '#FF4F00' }}>{t('station.introW4')}</b>
              </span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {['KDS', 'PREP', 'HACCP'].map((label, i) => (
              <div key={label} className="in-flap" style={{ animationDelay: `${2.3 + i * 0.15}s` }}>
                <span className="font-mono text-[14px] font-bold text-signal">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-[44px] font-extrabold leading-none">{label}</span>
              </div>
            ))}
            <div className="in-flap" style={{ animationDelay: '2.75s', background: '#FF4F00', color: '#0A0A0A', borderTopColor: '#FF8A4D' }}>
              <span className="font-mono text-[14px] font-bold">{date}</span>
              <span className="font-mono text-[44px] font-bold leading-none tracking-[-0.04em]">{clock}</span>
            </div>
          </div>
        </div>

        <div className="in-printer hidden lg:block" aria-hidden="true">
        <span className="in-rail" />
        <div className="in-tkt">
          <div className="flex justify-between border-b-2 border-dashed border-ink pb-2">
            <span className="sb-label">{t('station.introTicketNew')}</span>
            <span className="font-mono text-[17px] font-bold">{clock}</span>
          </div>
          <div className="pt-2.5 font-display text-[40px] font-extrabold uppercase leading-none">{t('station.introTicketTitle')}</div>
          <div className="pt-2 text-[15px] leading-relaxed">
            <b>1×</b> {t('station.introTicketItem1')}<br /><b>1×</b> {t('station.introTicketItem2')}
          </div>
          <span className="in-stamp">{t('station.introReady')}</span>
        </div>
        </div>

        <div className="absolute inset-x-6 bottom-10 flex items-center gap-4 sm:inset-x-16">
          <span className="in-fade sb-label whitespace-nowrap text-[#A3A3A3]" style={{ animationDelay: '.6s' }}>{t('station.introLoading')}</span>
          <div className="h-[3px] flex-1 bg-[#262626]"><div className="in-load" /></div>
        </div>
      </div>
    </>
  )
}
