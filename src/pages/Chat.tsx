import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Send, MessageCircle, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useTeamChat, CHAT_CHANNELS, type ChatChannel } from '../hooks/useTeamChat'
import { useDirectMessages, useTeamMembers, type DirectMessage, type TeamMember } from '../hooks/useDirectMessages'
import type { TeamMessageWithSender } from '../types/database.types'
import { cn } from '../lib/cn'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initialsFor(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase()
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
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, own }: { name?: string | null; own: boolean }) {
  return (
    <div className={cn(
      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold select-none',
      own
        ? 'bg-brand-orange text-white-fixed shadow-[0_0_10px_rgba(196,149,106,0.4)]'
        : 'bg-white/60 border border-white/80 text-white/70 shadow-sm',
    )}>
      {initialsFor(name)}
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

type AnyMessage = (TeamMessageWithSender | DirectMessage) & { sender_name?: string | null }

function MessageBubble({
  msg, prevMsg, own, onDelete,
}: {
  msg: AnyMessage
  prevMsg?: AnyMessage
  own: boolean
  onDelete?: () => void
}) {
  const grouped =
    prevMsg &&
    prevMsg.sender_id === msg.sender_id &&
    new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60_000

  return (
    <div className={cn(
      'flex items-end gap-3 group',
      own ? 'flex-row-reverse' : 'flex-row',
      grouped ? 'mt-1' : 'mt-5',
    )}>
      <div className={cn('shrink-0', grouped && 'invisible')}>
        <Avatar name={msg.sender_name} own={own} />
      </div>

      <div className={cn('flex flex-col max-w-[65%]', own && 'items-end')}>
        {!grouped && (
          <div className={cn(
            'flex items-baseline gap-2 mb-1.5',
            own ? 'flex-row-reverse' : 'flex-row',
          )}>
            <span className="text-xs font-semibold text-white/80">
              {own ? 'Εγώ' : (msg.sender_name ?? '—')}
            </span>
            <span className="text-[10px] text-white/35">{formatTime(msg.created_at)}</span>
          </div>
        )}

        <div className="relative">
          <div className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            own
              ? 'bg-brand-orange text-white-fixed rounded-br-sm shadow-[0_2px_12px_rgba(196,149,106,0.35)]'
              : 'bg-white/70 border border-white/80 text-white/85 rounded-bl-sm shadow-sm',
          )}>
            {msg.content}
          </div>

          {grouped && (
            <span className={cn(
              'absolute top-1/2 -translate-y-1/2 text-[10px] text-white/30',
              'opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none',
              own ? '-left-16' : '-right-16',
            )}>
              {formatTime(msg.created_at)}
            </span>
          )}

          {own && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete message"
              className="absolute -left-9 top-1 hidden group-hover:flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-red-500 hover:bg-red-50 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────

function MessageInput({ onSend, sending, placeholder }: {
  onSend: (c: string) => Promise<void>
  sending: boolean
  placeholder: string
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim() || sending) return
    const content = draft
    setDraft('')
    await onSend(content)
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-none flex items-center gap-2.5 px-4 py-3 border-t border-white/40 bg-white/20"
    >
      <div className={cn(
        'flex flex-1 items-center gap-2 rounded-xl px-4 h-11 transition-all',
        'bg-white-fixed/55 border border-white/70',
        'focus-within:ring-2 focus-within:ring-brand-orange/50 focus-within:border-brand-orange/30',
      )}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) void handleSubmit(e as unknown as FormEvent) }}
          placeholder={placeholder}
          maxLength={2000}
          autoComplete="off"
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
        />
      </div>
      <button
        type="submit"
        disabled={sending || !draft.trim()}
        aria-label="Send"
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition',
          'bg-brand-orange text-white-fixed shadow-[0_2px_8px_rgba(196,149,106,0.40)]',
          'hover:bg-brand-orange/85 disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  )
}

// ── Channel view ──────────────────────────────────────────────────────────────

function ChannelView({ channel, myId }: { channel: ChatChannel; myId: string }) {
  const { t } = useTranslation()
  const { messages, loading, sending, sendMessage, deleteMessage } = useTeamChat(channel)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  const chDef = CHAT_CHANNELS.find((c) => c.slug === channel)

  return (
    <>
      <div className="flex-none flex items-center gap-3 px-5 py-3.5 border-b border-white/40 bg-white/20">
        <span className="text-2xl leading-none">{chDef?.emoji}</span>
        <div>
          <h2 className="font-semibold text-white/85 leading-none text-base">#{channel}</h2>
          <p className="text-[11px] text-white/40 mt-0.5">{t(`chat.channelDesc.${channel}`)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
        {loading ? (
          <p className="text-white/40 text-sm text-center py-16">{t('chat.loading')}</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <span className="text-5xl opacity-60">{chDef?.emoji}</span>
            <p className="text-sm text-white/45 max-w-xs">{t('chat.channelEmpty', { channel: `#${channel}` })}</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              prevMsg={messages[i - 1]}
              own={msg.sender_id === myId}
              onDelete={msg.sender_id === myId ? () => void deleteMessage(msg.id) : undefined}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={sendMessage} sending={sending} placeholder={t('chat.messagePlaceholder')} />
    </>
  )
}

// ── DM view ───────────────────────────────────────────────────────────────────

function DmView({ recipient, myId }: { recipient: TeamMember; myId: string }) {
  const { t } = useTranslation()
  const { messages, loading, sending, sendMessage } = useDirectMessages(recipient.id)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <>
      <div className="flex-none flex items-center gap-3 px-5 py-3.5 border-b border-white/40 bg-white/20">
        <Avatar name={recipient.full_name} own={false} />
        <div>
          <h2 className="font-semibold text-white/85 text-base leading-none">{recipient.full_name ?? '—'}</h2>
          <p className="text-[11px] text-white/40 mt-0.5 capitalize">{recipient.role?.replace(/_/g, ' ')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
        {loading ? (
          <p className="text-white/40 text-sm text-center py-16">{t('chat.loading')}</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Avatar name={recipient.full_name} own={false} />
            <p className="text-sm text-white/45">{t('chat.dmEmpty', { name: recipient.full_name ?? '—' })}</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              prevMsg={messages[i - 1]}
              own={msg.sender_id === myId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSend={sendMessage}
        sending={sending}
        placeholder={t('chat.dmPlaceholder', { name: recipient.full_name ?? '…' })}
      />
    </>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

type View = { type: 'channel'; channel: ChatChannel } | { type: 'dm'; member: TeamMember }

function ChatSidebar({ current, members, onSelect }: {
  current: View
  members: TeamMember[]
  onSelect: (v: View) => void
}) {
  const { t } = useTranslation()
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [dmsOpen, setDmsOpen] = useState(true)

  return (
    <div className="flex flex-col h-full py-3 gap-1 overflow-y-auto">
      {/* Channels section */}
      <button
        type="button"
        onClick={() => setChannelsOpen((v) => !v)}
        className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40 hover:text-white/65 transition select-none w-full"
      >
        {channelsOpen
          ? <ChevronDown className="h-3 w-3" />
          : <ChevronRight className="h-3 w-3" />}
        {t('chat.channels')}
      </button>

      {channelsOpen && (
        <div className="flex flex-col gap-0.5 px-2">
          {CHAT_CHANNELS.map((ch) => {
            const active = current.type === 'channel' && current.channel === ch.slug
            return (
              <button
                key={ch.slug}
                type="button"
                onClick={() => onSelect({ type: 'channel', channel: ch.slug as ChatChannel })}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition w-full text-left',
                  active
                    ? 'bg-brand-orange/15 text-brand-orange shadow-[inset_2px_0_0_#C4956A]'
                    : 'text-white/60 hover:bg-white/40 hover:text-white/85',
                )}
              >
                <span className="text-base w-5 text-center leading-none">{ch.emoji}</span>
                <span className="truncate">#{ch.slug}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* DMs section — always visible */}
      <>
          <button
            type="button"
            onClick={() => setDmsOpen((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-1.5 mt-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 hover:text-white/65 transition select-none w-full"
          >
            {dmsOpen
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
            {t('chat.directMessages')}
          </button>

          {dmsOpen && (
            <div className="flex flex-col gap-0.5 px-2">
              {members.length === 0 ? (
                <p className="px-3 py-2 text-xs text-white/30 italic">
                  {t('chat.noTeamMembers')}
                </p>
              ) : (
                members.map((m) => {
                  const active = current.type === 'dm' && current.member.id === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelect({ type: 'dm', member: m })}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition w-full text-left',
                        active
                          ? 'bg-brand-orange/15 text-brand-orange shadow-[inset_2px_0_0_#C4956A]'
                          : 'text-white/60 hover:bg-white/40 hover:text-white/85',
                      )}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/60 border border-white/80 text-[10px] font-bold text-white/70 shadow-sm">
                        {initialsFor(m.full_name)}
                      </div>
                      <span className="truncate">{m.full_name ?? '—'}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Chat() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const members = useTeamMembers()
  const [view, setView] = useState<View>({ type: 'channel', channel: 'general' })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const myId = profile?.id ?? ''

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-2rem)] gap-4 min-h-0">

      {/* ── Left panel (desktop) ── */}
      <div className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col glass-strong rounded-2xl gradient-border overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-white/40">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
            <MessageCircle className="h-4 w-4" />
          </div>
          <h1 className="font-semibold text-white/85 text-base">{t('chat.title')}</h1>
        </div>
        <ChatSidebar current={view} members={members} onSelect={setView} />
      </div>

      {/* ── Main panel ── */}
      <div className="flex-1 flex flex-col glass rounded-2xl gradient-border overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-white/40 bg-white/20">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white/90 transition"
          >
            <span className="text-base">
              {view.type === 'channel'
                ? CHAT_CHANNELS.find((c) => c.slug === view.channel)?.emoji
                : '👤'}
            </span>
            <span>{view.type === 'channel' ? `#${view.channel}` : view.member.full_name}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mobile sidebar dropdown */}
        {mobileSidebarOpen && (
          <div className="md:hidden border-b border-white/40 bg-white/30 max-h-64 overflow-y-auto">
            <ChatSidebar
              current={view}
              members={members}
              onSelect={(v) => { setView(v); setMobileSidebarOpen(false) }}
            />
          </div>
        )}

        {view.type === 'channel'
          ? <ChannelView channel={view.channel} myId={myId} />
          : <DmView recipient={view.member} myId={myId} />}
      </div>
    </div>
  )
}
