import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Radio, Trash2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
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
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-2rem)]">
      <header className="flex-none mb-4">
        <h1 className="text-3xl font-semibold flex items-center gap-2">
          <Radio className="h-7 w-7 text-brand-orange" />
          {t('walkie.title')}
        </h1>
        <p className="text-white/60 mt-1">{t('walkie.subtitle')}</p>
      </header>

      {!supported && (
        <GlassCard className="flex-none border border-amber-500/40 text-amber-300 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t('walkie.noSpeechSupport')}</p>
            <p className="text-sm mt-0.5 text-amber-300/70">{t('walkie.noSpeechSupportHint')}</p>
          </div>
        </GlassCard>
      )}

      {error && (
        <GlassCard className="flex-none border border-red-500/40 text-red-300 mb-4">{error}</GlassCard>
      )}

      <GlassCard className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading ? (
          <p className="text-white/60 text-center py-8">{t('walkie.loading')}</p>
        ) : messages.length === 0 && !recording ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
              <Radio className="h-7 w-7" />
            </div>
            <p className="text-white/60">{t('walkie.empty')}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isOwn = msg.sender_id === profile?.id
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex items-start gap-3 group',
                    isOwn && 'flex-row-reverse',
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/20 text-brand-orange text-xs font-semibold">
                    {initialsFor(msg.sender_name)}
                  </div>

                  <div className={cn('flex flex-col max-w-[72%]', isOwn && 'items-end')}>
                    <div className={cn(
                      'flex items-baseline gap-2 mb-1',
                      isOwn ? 'flex-row-reverse' : 'flex-row',
                    )}>
                      <span className="text-xs font-semibold text-white/80">
                        {isOwn ? t('common.you') : (msg.sender_name ?? t('common.unknown'))}
                      </span>
                      <span className="text-xs text-white/40">{formatTime(msg.created_at)}</span>
                    </div>

                    <div className={cn(
                      'relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      isOwn
                        ? 'bg-brand-orange text-white-fixed rounded-br-sm'
                        : 'bg-white/10 text-white rounded-bl-sm',
                    )}>
                      <span className="inline-flex items-center gap-1 text-xs opacity-60 mr-2">
                        <Mic className="h-3 w-3" />
                      </span>
                      {msg.transcript}

                      {isOwn && (
                        <button
                          type="button"
                          onClick={() => deleteMessage(msg.id)}
                          aria-label={t('walkie.deleteMessage')}
                          className="absolute -left-8 top-1 hidden group-hover:flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {recording && (
              <div className="flex items-start gap-3 flex-row-reverse">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white-fixed text-xs font-semibold animate-pulse">
                  {initialsFor(profile?.full_name ?? null)}
                </div>
                <div className="flex flex-col items-end max-w-[72%]">
                  <div className="rounded-2xl rounded-br-sm bg-brand-orange/40 border border-brand-orange/60 px-3.5 py-2.5 text-sm text-white/80 min-w-[80px]">
                    {liveText || (
                      <span className="flex items-center gap-1.5 text-white/50">
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="block w-1 h-1 rounded-full bg-white/60 animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </span>
                        {t('walkie.listening')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </GlassCard>

      <div className="flex-none flex flex-col items-center gap-3 mt-4">
        {recording && (
          <p className="text-sm text-brand-orange animate-pulse font-medium">
            {t('walkie.recording')}
          </p>
        )}

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
            'select-none flex flex-col items-center justify-center gap-1.5 rounded-full transition-all duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            recording
              ? 'h-24 w-24 bg-brand-orange text-white-fixed shadow-[0_0_0_12px_rgba(249,115,22,0.25)] scale-110'
              : 'h-20 w-20 bg-brand-orange/20 border-2 border-brand-orange text-brand-orange hover:bg-brand-orange/30',
          )}
        >
          {recording ? (
            <Mic className="h-8 w-8" />
          ) : (
            <MicOff className="h-7 w-7" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            {recording ? t('walkie.live') : t('walkie.ptt')}
          </span>
        </button>

        <p className="text-xs text-white/30">
          {supported ? t('walkie.holdHint') : t('walkie.chromeRequired')}
        </p>
      </div>
    </div>
  )
}
