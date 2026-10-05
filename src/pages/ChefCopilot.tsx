import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Loader2, ChefHat, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRecipes } from '../hooks/useRecipes'
import { useInventory } from '../contexts/InventoryContext'
import { useWasteLog } from '../hooks/useWasteLog'
import { chatWithCopilot, type CopilotMessage } from '../lib/gemini'

function buildContext(
  recipes: ReturnType<typeof useRecipes>['recipes'],
  inventoryItems: ReturnType<typeof useInventory>['items'],
  wasteSummary: string,
): string {
  const recipeList = recipes.slice(0, 30).map((r) =>
    `- ${r.title}${r.category ? ` (${r.category})` : ''}${r.cost_per_portion ? `, cost: €${r.cost_per_portion.toFixed(2)}/portion` : ''}${r.allergens.length ? `, allergens: ${r.allergens.join(', ')}` : ''}`
  ).join('\n')

  const lowStock = inventoryItems.filter((i) => i.quantity <= i.min_stock_level)
  const stockList = inventoryItems.slice(0, 20).map((i) =>
    `- ${i.name}: ${i.quantity} ${i.unit}${i.quantity <= i.min_stock_level ? ' ⚠️ LOW' : ''}`
  ).join('\n')

  return `RECIPES (${recipes.length} total, showing first 30):
${recipeList || '(none)'}

INVENTORY (${inventoryItems.length} items, ${lowStock.length} low stock, showing first 20):
${stockList || '(none)'}

WASTE SUMMARY (recent):
${wasteSummary || '(no data)'}`
}

const STARTER_PROMPTS = [
  'copilot.starter1',
  'copilot.starter2',
  'copilot.starter3',
  'copilot.starter4',
]

export default function ChefCopilot() {
  const { t } = useTranslation()
  const { recipes } = useRecipes()
  const { items: inventoryItems } = useInventory()
  const { entries: wasteEntries } = useWasteLog()

  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const wasteSummary = wasteEntries.slice(0, 10)
    .map((e) => `${e.item_name}: ${e.quantity} ${e.unit} (${e.reason}, €${e.cost ?? '?'})`)
    .join('\n')

  const context = buildContext(recipes, inventoryItems, wasteSummary)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const userMsg: CopilotMessage = { role: 'user', text: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setDraft('')
    setLoading(true)
    setError(null)
    try {
      const reply = await chatWithCopilot(newMessages, context)
      setMessages([...newMessages, { role: 'model', text: reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response.')
      setMessages(newMessages.slice(0, -1))
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(draft)
    }
  }

  return (
    <div className="mx-auto grid h-[calc(100vh-10rem)] w-full max-w-[1360px] min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ── Conversation ── */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-white/[0.03]">
        <header className="flex flex-none items-center gap-3 px-5 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/15 text-violet-500"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-medium">{t('copilot.title')}</h1>
            <p className="truncate text-xs text-white/50">{t('copilot.subtitle')}</p>
          </div>
          {messages.length > 0 && (
            <button type="button" onClick={() => { setMessages([]); setError(null) }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-bg-card px-4 text-sm font-medium shadow-card hover:bg-white/[0.04]">
              <RotateCcw className="h-4 w-4" />{t('copilot.newChat')}
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          {messages.length === 0 && (
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/15 text-violet-500"><Sparkles className="h-7 w-7" /></span>
              <p className="text-lg leading-relaxed text-white/75">{t('copilot.welcome')}</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${msg.role === 'user' ? 'bg-lime text-ink' : 'bg-violet-500/15 text-violet-500'}`}>
                {msg.role === 'user' ? 'U' : <ChefHat className="h-4 w-4" />}
              </span>
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-[15px] leading-relaxed ${msg.role === 'user' ? 'rounded-tr-md bg-brand-orange text-on-accent' : 'rounded-tl-md bg-bg-card shadow-card'}`}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-500"><ChefHat className="h-4 w-4" /></span>
              <div className="rounded-3xl rounded-tl-md bg-bg-card px-4 py-3 shadow-card"><Loader2 className="h-4 w-4 animate-spin text-white/50" /></div>
            </div>
          )}

          {error && <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <div className="flex-none p-3">
          <div className="flex items-end gap-2 rounded-[28px] bg-bg-card p-2 shadow-card">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t('copilot.placeholder')}
              rows={1}
              aria-label={t('copilot.placeholder')}
              className="max-h-32 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-white/40"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
              disabled={loading}
            />
            <button type="button" onClick={() => void send(draft)} disabled={!draft.trim() || loading} aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-orange text-on-accent transition hover:bg-brand-orange/85 disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-white/40">{t('copilot.disclaimer')}</p>
        </div>
      </section>

      {/* ── Context and prompts ── */}
      <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto lg:flex">
        <section className="rounded-3xl bg-ink p-5 text-white-fixed">
          <p className="text-sm text-[#C9CEC8]">{t('copilot.v2.knows')}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li className="flex items-center justify-between"><span>{t('nav.recipes')}</span><span className="font-medium tabular-nums text-lime">{recipes.length}</span></li>
            <li className="flex items-center justify-between"><span>{t('nav.inventory')}</span><span className="font-medium tabular-nums text-lime">{inventoryItems.length}</span></li>
            <li className="flex items-center justify-between"><span>{t('nav.wasteLog')}</span><span className="font-medium tabular-nums text-lime">{wasteEntries.length}</span></li>
          </ul>
        </section>
        <section className="flex flex-col gap-2 rounded-3xl bg-bg-card p-4 shadow-card">
          <p className="px-1 text-sm font-medium">{t('copilot.v2.try')}</p>
          {STARTER_PROMPTS.map((key) => (
            <button key={key} type="button" onClick={() => void send(t(key))} disabled={loading}
              className="rounded-2xl bg-white/[0.04] px-4 py-3 text-left text-sm text-white/75 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50">
              {t(key)}
            </button>
          ))}
        </section>
      </aside>
    </div>
  )
}
