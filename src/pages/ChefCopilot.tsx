import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Loader2, ChefHat, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
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
    <div className="flex h-full flex-col max-h-[calc(100vh-80px)]">
      <header className="shrink-0 px-4 pt-6 pb-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{t('copilot.title')}</h1>
            <p className="text-sm text-white/50">{t('copilot.subtitle')}</p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => { setMessages([]); setError(null) }}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-glass-border px-3 py-1.5 text-xs text-white/40 hover:text-white hover:bg-white/5 transition"
            >
              <RotateCcw className="h-3 w-3" />
              {t('copilot.newChat')}
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-6 space-y-4">
        {messages.length === 0 && (
          <div className="mt-4 space-y-4">
            <GlassCard className="border border-brand-orange/20 bg-brand-orange/5">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-brand-orange mt-0.5 shrink-0" />
                <p className="text-sm text-white/80 leading-relaxed">{t('copilot.welcome')}</p>
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STARTER_PROMPTS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void send(t(key))}
                  className="text-left rounded-xl border border-glass-border px-4 py-3 text-sm text-white/60 hover:text-white hover:bg-white/5 hover:border-white/20 transition"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${msg.role === 'user' ? 'bg-brand-orange/20 text-brand-orange' : 'bg-white/10 text-white/60'}`}>
              {msg.role === 'user' ? 'U' : <ChefHat className="h-4 w-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-brand-orange/15 text-white rounded-tr-sm' : 'glass text-white/90 rounded-tl-sm'}`}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60">
              <ChefHat className="h-4 w-4" />
            </div>
            <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-glass-border bg-chef-dark px-4 py-3 md:px-6">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('copilot.placeholder')}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-glass-border bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-brand-orange max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => void send(draft)}
            disabled={!draft.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white-fixed hover:bg-brand-orange/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-white/25 text-center">{t('copilot.disclaimer')}</p>
      </div>
    </div>
  )
}
