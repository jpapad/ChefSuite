const CACHE_KEY = 'chefsuite_tx_v1'

function loadCache(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') } catch { return {} }
}

function saveCache(cache: Record<string, string>): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

export function detectLang(text: string): 'el' | 'en' {
  return /[Ͱ-Ͽἀ-῿]/.test(text) ? 'el' : 'en'
}

export async function translateText(text: string, to: 'el' | 'en'): Promise<string> {
  if (!text?.trim()) return text ?? ''
  const from = detectLang(text)
  if (from === to) return text

  const key = `${to}:${text}`
  const cache = loadCache()
  if (cache[key] !== undefined) return cache[key]

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`,
      { signal: controller.signal },
    )
    clearTimeout(timer)
    if (!res.ok) return text
    const json = await res.json() as { responseData?: { translatedText?: string } }
    const translated = json.responseData?.translatedText ?? text
    cache[key] = translated
    saveCache(cache)
    return translated
  } catch {
    return text
  }
}
