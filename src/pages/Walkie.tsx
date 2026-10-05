import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Radio, Trash2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useWalkie } from '../hooks/useWalkie'
import { cn } from '../lib/cn'

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: ISpeechRecognitionEvent) => void) | null
  onerror: ((e: ISpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
interface ISpeechRecognitionEvent { resultIndex: number; results: SpeechRecognitionResultList }
interface ISpeechRecognitionErrorEvent { error: string }

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}

function initialsFor(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
    : null

export default function Walkie() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { messages, loading, sending, sendTranscript, deleteMessage } = useWalkie()
  const [recording, setRecording] = useState(false)
  const [liveText, setLiveText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const finalRef = useRef('')

  const supported = SpeechRecognitionAPI !== null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startRecording = useCallback(() => {
    if (!SpeechRecognitionAPI) return
    setError(null)
    finalRef.current = ''
    setLiveText('')

    const rec = new SpeechRecognitionAPI()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'el-GR,en-US'

    rec.onresult = (e: ISpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          finalRef.current += text + ' '
        } else {
          interim += text
        }
      }
      setLiveText(finalRef.current + interim)
    }

    rec.onerror = (e: ISpeechRecognitionErrorEvent) => {
      if (e.error !== 'aborted') setError(`Microphone error: ${e.error}`)
      setRecording(false)
    }

    rec.onend = () => {}

    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }, [])

  const stopRecording = useCallback(async () => {
    setRecording(false)
    recognitionRef.current?.stop()
    recognitionRef.current = null

    const transcript = finalRef.current.trim()
    setLiveText('')
    finalRef.current = ''

    if (transcript) {
      try {
        await sendTranscript(transcript)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Send failed')
      }
    }
  }, [sendTranscript])

  function handlePressStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!recording) startRecording()
  }

  function handlePressEnd(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (recording) void stopRecording()
  }

  return (
    <div className="mx-auto grid h-[calc(100vh-10rem)] w-full max-w-[1360px] min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ── Transcript feed ── */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-white/[0.03]">
        <header className="flex flex-none items-center gap-3 px-5 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-ink"><Radio className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-medium">{t('walkie.title')}</h1>
            <p className="text-xs text-white/50">{t('walkie.subtitle')}</p>
          </div>
        </header>

        {!supported && (
          <div className="mx-4 mb-3 flex items-start gap-3 rounded-2xl bg-amber-500/12 p-4 text-amber-600">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">{t('walkie.noSpeechSupport')}</p>
              <p className="mt-0.5 text-sm opacity-80">{t('walkie.noSpeechSupportHint')}</p>
            </div>
          </div>
        )}
        {error && <div className="mx-4 mb-3 rounded-2xl bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
          {loading ? (
            <p className="py-8 text-center text-white/55">{t('walkie.loading')}</p>
          ) : messages.length === 0 && !recording ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <Radio className="h-10 w-10 text-white/25" />
              <p className="text-white/55">{t('walkie.empty')}</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isOwn = msg.sender_id === profile?.id
                return (
                  <div key={msg.id} className={cn('group flex items-start gap-3', isOwn && 'flex-row-reverse')}>
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', isOwn ? 'bg-lime text-ink' : 'bg-white/[0.07]')}>
                      {initialsFor(msg.sender_name)}
                    </span>
                    <div className={cn('flex max-w-[75%] flex-col', isOwn && 'items-end')}>
                      <div className={cn('mb-1 flex items-baseline gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                        <span className="text-xs font-medium text-white/70">{isOwn ? t('common.you') : (msg.sender_name ?? t('common.unknown'))}</span>
                        <span className="text-xs tabular-nums text-white/45">{formatTime(msg.created_at)}</span>
                      </div>
                      <div className={cn('relative rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed', isOwn ? 'rounded-br-md bg-brand-orange text-on-accent' : 'rounded-bl-md bg-bg-card shadow-card')}>
                        <Mic className="mr-1.5 inline h-3.5 w-3.5 opacity-50" />
                        {msg.transcript}
                        {isOwn && (
                          <button type="button" onClick={() => deleteMessage(msg.id)} aria-label={t('walkie.deleteMessage')}
                            className="absolute -left-10 top-1 hidden h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-red-500/10 hover:text-red-500 group-hover:flex">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {recording && (
                <div className="flex flex-row-reverse items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-lime text-xs font-semibold text-ink">
                    {initialsFor(profile?.full_name ?? null)}
                  </span>
                  <div className="min-w-[90px] max-w-[75%] rounded-3xl rounded-br-md bg-lime/40 px-4 py-2.5 text-[15px]">
                    {liveText || (
                      <span className="flex items-center gap-1.5 text-white/60">
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="block h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                        {t('walkie.listening')}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </section>

      {/* ── Push to talk ── */}
      <section className="flex flex-col items-center justify-center gap-5 rounded-3xl bg-ink p-6 text-center text-white-fixed">
        <p className={cn('text-sm font-medium', recording ? 'animate-pulse text-lime' : 'text-[#C9CEC8]')}>
          {recording ? t('walkie.recording') : t('walkie.holdToTalk')}
        </p>
        <button
          type="button"
          disabled={!supported || sending}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={recording ? handlePressEnd : undefined}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          aria-label={recording ? t('walkie.releaseToSend') : t('walkie.holdToTalk')}
          className={cn(
            'flex select-none flex-col items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
            recording
              ? 'h-56 w-56 scale-105 bg-lime text-ink shadow-[0_0_0_16px_rgba(200,240,60,0.18)]'
              : 'h-52 w-52 bg-lime text-ink shadow-[0_0_0_10px_rgba(200,240,60,0.08)] hover:brightness-95',
          )}
        >
          {recording ? <Mic className="h-12 w-12" /> : <MicOff className="h-10 w-10" />}
          <span className="text-base uppercase tracking-wide">{recording ? t('walkie.live') : t('walkie.ptt')}</span>
        </button>
        <p className="max-w-[16rem] text-xs text-[#A7ADA6]">{supported ? t('walkie.holdHint') : t('walkie.chromeRequired')}</p>
      </section>
    </div>
  )
}
