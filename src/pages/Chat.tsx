import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Send, Trash2, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { useAuth } from '../contexts/AuthContext'
import { useTeamChat } from '../hooks/useTeamChat'
import { cn } from '../lib/cn'

function initialsFor(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { messages, loading, sending, error, sendMessage, deleteMessage } = useTeamChat()
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim() || sending) return
    const content = draft
    setDraft('')
    await sendMessage(content)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      void handleSubmit(e as unknown as FormEvent)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-2rem)]">
      <header className="flex-none mb-4">
        <h1 className="text-3xl font-semibold">{t('chat.title')}</h1>
        <p className="text-white/60 mt-1">{t('chat.subtitle')}</p>
      </header>

      {error && (
        <GlassCard className="flex-none border border-red-500/40 text-red-300 mb-4">{error}</GlassCard>
      )}

      <GlassCard className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
        {loading ? (
          <p className="text-white/60 text-center py-8">{t('chat.loading')}</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
              <MessageSquare className="h-7 w-7" />
            </div>
            <p className="text-white/60">{t('chat.empty')}</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isOwn = msg.sender_id === profile?.id
              const prevMsg = messages[i - 1]
              const grouped = prevMsg?.sender_id === msg.sender_id &&
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60_000

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex items-end gap-2 group',
                    isOwn ? 'flex-row-reverse' : 'flex-row',
                    grouped ? 'mt-0.5' : 'mt-3',
                  )}
                >
                  {!isOwn && (
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      'bg-brand-orange/20 text-brand-orange',
                      grouped && 'invisible',
                    )}>
                      {initialsFor(msg.sender_name)}
                    </div>
                  )}

                  <div className={cn('flex flex-col max-w-[72%]', isOwn && 'items-end')}>
                    {!grouped && (
                      <div className={cn(
                        'flex items-baseline gap-2 mb-1',
                        isOwn ? 'flex-row-reverse' : 'flex-row',
                      )}>
                        <span className="text-xs font-semibold text-white/80">
                          {isOwn ? t('common.you') : (msg.sender_name ?? t('common.unknown'))}
                        </span>
                        <span className="text-xs text-white/40">{formatTime(msg.created_at)}</span>
                      </div>
                    )}

                    <div className={cn(
                      'relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                      isOwn
                        ? 'bg-brand-orange text-white-fixed rounded-br-sm'
                        : 'bg-white/10 text-white rounded-bl-sm',
                    )}>
                      {msg.content}

                      {isOwn && (
                        <button
                          type="button"
                          onClick={() => deleteMessage(msg.id)}
                          aria-label={t('chat.deleteMessage')}
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
            <div ref={bottomRef} />
          </>
        )}
      </GlassCard>

      <form
        onSubmit={handleSubmit}
        className="flex-none flex items-center gap-2 mt-3"
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.messagePlaceholder')}
          maxLength={2000}
          autoComplete="off"
          className={cn(
            'flex-1 h-12 rounded-xl px-4 text-sm',
            'bg-white/5 border border-glass-border text-white placeholder:text-white/30',
            'focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/50',
          )}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label={t('chat.send')}
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition',
            'bg-brand-orange text-white-fixed',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'hover:bg-brand-orange/80',
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  )
}
