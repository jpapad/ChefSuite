import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Send, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
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
        ? 'bg-lime text-ink'
        : 'bg-white/[0.07] text-white/75',
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
            'rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed',
            own
              ? 'bg-brand-orange text-on-accent rounded-br-md'
              : 'bg-bg-card text-white shadow-card rounded-bl-md',
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
              className="absolute -left-10 top-1 hidden group-hover:flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:text-red-500 hover:bg-red-500/10 transition"
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
      className="flex-none flex items-center gap-2.5 p-3"
    >
      <div className={cn(
        'flex flex-1 items-center gap-2 rounded-full px-5 h-12 transition-all',
        'bg-bg-card shadow-card',
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
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition',
          'bg-brand-orange text-on-accent',
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

  return (
    <>
      <div className="flex-none flex items-center gap-3 px-5 py-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-lg font-semibold text-ink">#</span>
        <div>
          <h2 className="text-lg font-medium leading-none">#{channel}</h2>
          <p className="mt-1 text-xs text-white/50">{t(`chat.channelDesc.${channel}`)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
        {loading ? (
          <p className="text-white/40 text-sm text-center py-16">{t('chat.loading')}</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] text-2xl text-white/50">#</span>
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
      <div className="flex-none flex items-center gap-3 px-5 py-4">
        <Avatar name={recipient.full_name} own={false} />
        <div>
          <h2 className="text-lg font-medium leading-none">{recipient.full_name ?? '—'}</h2>
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
        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white/50 hover:text-white transition select-none w-full"
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
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium transition w-full text-left',
                  active
                    ? 'bg-brand-orange text-on-accent'
                    : 'text-white/65 hover:bg-white/[0.05] hover:text-white',
                )}
              >
                <span className="w-5 text-center text-base leading-none text-current opacity-60">#</span>
                <span className="truncate">{ch.slug}</span>
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
            className="flex items-center gap-1.5 px-4 py-1.5 mt-3 text-xs font-medium text-white/50 hover:text-white transition select-none w-full"
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
                        'flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium transition w-full text-left',
                        active
                          ? 'bg-brand-orange text-on-accent'
                          : 'text-white/65 hover:bg-white/[0.05] hover:text-white',
                      )}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[10px] font-bold text-white/75">
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
    <div className="mx-auto flex h-[calc(100vh-10rem)] w-full max-w-[1360px] min-h-0 gap-4">
      {/* ── Conversations ── */}
      <div className="hidden md:flex md:w-64 shrink-0 flex-col overflow-hidden rounded-3xl bg-bg-card shadow-card">
        <div className="px-5 pb-1 pt-5">
          <h1 className="text-2xl font-medium tracking-[-0.02em]">{t('chat.title')}</h1>
        </div>
        <ChatSidebar current={view} members={members} onSelect={setView} />
      </div>

      {/* ── Conversation ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-white/[0.03]">
        {/* Mobile picker */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((v) => !v)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-bg-card px-4 text-sm font-medium shadow-card"
          >
            {view.type === 'channel' ? `#${view.channel}` : view.member.full_name}
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        {mobileSidebarOpen && (
          <div className="md:hidden mx-3 mb-2 max-h-64 overflow-y-auto rounded-3xl bg-bg-card shadow-card">
            <ChatSidebar current={view} members={members} onSelect={(v) => { setView(v); setMobileSidebarOpen(false) }} />
          </div>
        )}

        {view.type === 'channel'
          ? <ChannelView channel={view.channel} myId={myId} />
          : <DmView recipient={view.member} myId={myId} />}
      </div>
    </div>
  )
}
