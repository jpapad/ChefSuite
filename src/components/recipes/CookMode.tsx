import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, CheckCheck, Mic, MicOff, Volume2, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { mmss } from '../../lib/useNow'
import { play } from '../../lib/sounds'

interface SRResult { readonly [i: number]: { transcript: string }; readonly length: number }
interface SRResultList { readonly [i: number]: SRResult; readonly length: number }
interface SREvent { readonly results: SRResultList }
interface SRInstance {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: SREvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void; stop(): void
}
type SRCtor = new () => SRInstance

const SPEECH_LANG: Record<string, string> = { en: 'en-US', el: 'el-GR', bg: 'bg-BG' }

/** Temperatures, sizes, weights and times inside a step get highlighted. */
const VALUE_RE = /(\d+(?:[.,]\d+)?\s*(?:°\s?[CF]?|cm|mm|kg|gr?|ml|lt?|L|′|'|λεπτ[άό]?|min(?:utes?)?|ώρ[αες]+|h|hours?)(?![\p{L}]))/giu
/** First "N minutes" in a step becomes its timer. */
const MINUTES_RE = /(\d+(?:[.,]\d+)?)\s*(?:′|'|λεπτ|min)/i
const HOURS_RE = /(\d+(?:[.,]\d+)?)\s*(?:ώρ|hour|h\b)/i

function minutesIn(step: string): number | null {
  const m = step.match(MINUTES_RE)
  if (m) return Math.round(parseFloat(m[1].replace(',', '.')))
  const h = step.match(HOURS_RE)
  if (h) return Math.round(parseFloat(h[1].replace(',', '.')) * 60)
  return null
}

function Highlighted({ text }: { text: string }) {
  const parts = text.split(VALUE_RE)
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1
        ? <span key={i} className="whitespace-nowrap rounded-sm bg-signal px-2 text-ink">{p}</span>
        : <Fragment key={i}>{p}</Fragment>))}
    </>
  )
}

/**
 * Cook mode: one step per screen in very large type, a built-in timer for
 * steps that mention a duration, voice read-out and voice commands.
 */
export function CookMode({ steps, title, onClose }: { steps: string[]; title: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const [idx, setIdx] = useState(0)
  const [listening, setListening] = useState(false)
  const recogRef = useRef<SRInstance | null>(null)

  const current = steps[idx]
  const stepMinutes = minutesIn(current)
  const [left, setLeft] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)

  // New step → reset its timer.
  useEffect(() => {
    const m = minutesIn(steps[idx])
    setLeft(m != null ? m * 60 : null)
    setRunning(false)
    setFinished(false)
  }, [idx, steps])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setLeft((s) => (s == null ? s : Math.max(0, s - 1))), 1000)
    return () => clearInterval(id)
  }, [running])

  // Time's up: stop, flash and ring the pass bell twice.
  useEffect(() => {
    if (!running || left !== 0) return
    setRunning(false)
    setFinished(true)
    play('ding')
    const id = setTimeout(() => play('ding'), 450)
    return () => clearTimeout(id)
  }, [left, running])

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = SPEECH_LANG[i18n.language] ?? 'en-US'
    window.speechSynthesis.speak(utt)
  }

  function goNext() { if (idx < steps.length - 1) { play('click'); setIdx(idx + 1); speak(steps[idx + 1]) } }
  function goPrev() { if (idx > 0) { play('click'); setIdx(idx - 1); speak(steps[idx - 1]) } }
  function reread() { speak(current) }

  function toggleVoice() {
    const w = window as unknown as Record<string, SRCtor | undefined>
    const SR: SRCtor | undefined = w['SpeechRecognition'] ?? w['webkitSpeechRecognition']
    if (!SR) { alert('Speech recognition not supported in this browser'); return }
    if (listening) {
      recogRef.current?.stop(); setListening(false); return
    }
    const r = new SR()
    r.lang = 'en-US'; r.continuous = true; r.interimResults = false
    r.onresult = (e) => {
      const cmd = e.results[e.results.length - 1][0].transcript.toLowerCase().trim()
      if (cmd.includes('next')) goNext()
      else if (cmd.includes('back') || cmd.includes('previous')) goPrev()
      else if (cmd.includes('repeat') || cmd.includes('again')) reread()
      else if (cmd.includes('stop') || cmd.includes('exit') || cmd.includes('close')) onClose()
    }
    r.onerror = () => setListening(false)
    r.onend = () => { if (listening) r.start() }
    r.start()
    recogRef.current = r
    setListening(true)
  }

  useEffect(() => { speak(current) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { recogRef.current?.stop(); window.speechSynthesis.cancel() }, [])

  const next = steps[idx + 1]
  const last = idx === steps.length - 1
  const total = stepMinutes != null ? stepMinutes * 60 : 0
  const ctl = 'flex h-14 items-center justify-center gap-2 rounded border-2 border-[#3A3A3A] px-4 font-display text-[17px] font-bold uppercase tracking-[0.04em] text-white hover:border-white'

  return (
    <div className="theme-dark fixed inset-0 z-[60] flex flex-col bg-bg-surface text-white" style={{ touchAction: 'manipulation' }}>
      {/* Header */}
      <div className="flex flex-none items-center gap-4 border-b border-[#222] bg-black px-5 py-3 sm:px-6">
        <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')} className={cn(ctl, 'w-14 px-0')}>
          <X className="h-6 w-6" strokeWidth={2.4} />
        </button>
        <div className="min-w-0">
          <p className="sb-label text-white/60">{t('station.cookMode')}</p>
          <p className="truncate font-display text-[30px] font-extrabold uppercase leading-none">{title}</p>
        </div>
        <span className="flex-1" />
        <button type="button" onClick={toggleVoice} aria-pressed={listening} className={cn(ctl, listening && 'border-signal bg-signal text-ink')}>
          {listening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          <span className="hidden sm:inline">{listening ? t('recipes.detail.listening') : t('recipes.detail.voiceControl')}</span>
        </button>
        <span className="sb-label hidden text-white/60 sm:inline">{t('station.step')}</span>
        <span className="font-mono text-[40px] font-bold tracking-[-0.04em] tabular-nums">
          {idx + 1}<span className="text-white/40">/{steps.length}</span>
        </span>
      </div>

      <div className="flex flex-none gap-[3px] px-5 pt-3.5 sm:px-6" aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} className={cn('h-2 flex-1', i < idx ? 'bg-white' : i === idx ? 'bg-signal' : 'bg-white/15')} />
        ))}
      </div>

      {/* Step + timer */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section key={idx} className="sb-in relative flex min-h-0 flex-[1.6] flex-col gap-6 overflow-hidden px-6 py-8 sm:px-10 lg:border-r-2 lg:border-[#2E2E2E]">
          <span aria-hidden="true" className="sb-ghost -bottom-28 -right-4 text-[460px]">{idx + 1}</span>
          <p className="relative max-w-4xl font-display text-[clamp(34px,4.6vw,58px)] font-bold leading-[1.15]">
            <Highlighted text={current} />
          </p>
          {next && (
            <p className="relative mt-auto max-w-3xl border-l-[6px] border-[#FFD60A] bg-bg-card px-4 py-3 text-[18px] text-white/70">
              <span className="sb-label mr-2 text-white">{t('recipes.v3.upNext')}</span>{next}
            </p>
          )}
        </section>

        {left != null && (
          <aside className="flex flex-none flex-col gap-4 border-t-2 border-[#2E2E2E] px-6 py-6 lg:w-[400px] lg:border-t-0">
            <div className={cn('flex flex-col gap-3 rounded border-2 border-white p-5', finished && 'animate-pulse bg-signal text-ink')}>
              <div className="flex items-center justify-between">
                <span className="sb-label">{t('station.timer')}</span>
                <span className="sb-label opacity-70">{finished ? t('station.timerDone') : t('station.minutes', { count: stepMinutes ?? 0 })}</span>
              </div>
              <span className="font-mono text-[96px] font-bold leading-[0.9] tracking-[-0.05em] tabular-nums">{mmss(left)}</span>
              <div className="h-2 bg-white/15">
                <div className="h-full bg-signal transition-[width] duration-1000" style={{ width: `${total ? (1 - left / total) * 100 : 0}%` }} />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (finished) { setLeft(total); setFinished(false); setRunning(true); return }
                    play('click'); setRunning((r) => !r)
                  }}
                  className={cn('h-14 flex-1 rounded font-display text-[19px] font-extrabold uppercase tracking-[0.05em]', running ? 'bg-white text-ink' : 'bg-signal text-ink')}
                >
                  {running ? t('station.timerPause') : finished ? t('station.timerAgain') : t('station.timerStart')}
                </button>
                <button
                  type="button"
                  onClick={() => { setRunning(false); setFinished(false); setLeft(total) }}
                  className="h-14 rounded border-2 border-current px-4 font-display text-[19px] font-extrabold uppercase tracking-[0.05em]"
                >
                  {t('station.timerReset')}
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Navigation */}
      <div className="flex flex-none items-center gap-3 border-t-2 border-[#2E2E2E] px-5 py-4 sm:px-6">
        <button type="button" onClick={goPrev} disabled={idx === 0}
          className="flex h-20 w-[240px] items-center justify-center gap-2 rounded bg-bg-card font-display text-[24px] font-extrabold uppercase tracking-[0.05em] transition disabled:opacity-30">
          <ChevronLeft className="h-7 w-7" strokeWidth={2.4} /> {t('station.back')}
        </button>
        <button type="button" onClick={reread} aria-label={t('recipes.detail.repeatStep')}
          className="flex h-20 w-20 items-center justify-center rounded border-2 border-[#3A3A3A] text-white hover:border-white">
          <Volume2 className="h-7 w-7" />
        </button>
        {last ? (
          <button type="button" onClick={() => { play('ding'); onClose() }}
            className="flex h-20 flex-1 items-center justify-center gap-2 rounded bg-emerald-500 font-display text-[24px] font-extrabold uppercase tracking-[0.05em] text-ink">
            <CheckCheck className="h-7 w-7" /> {t('common.done')}
          </button>
        ) : (
          <button type="button" onClick={goNext}
            className="flex h-20 flex-1 items-center justify-center gap-2 rounded bg-signal font-display text-[24px] font-extrabold uppercase tracking-[0.05em] text-ink">
            {t('station.next')} <ChevronRight className="h-7 w-7" strokeWidth={2.4} />
          </button>
        )}
      </div>
      {listening && (
        <p className="sb-label absolute bottom-28 left-1/2 -translate-x-1/2 text-white/60">{t('recipes.v3.sayCommands')}</p>
      )}
    </div>
  )
}
