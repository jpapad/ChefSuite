import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translateText } from '../lib/translate'

type Lang = 'el' | 'en' | 'bg'

function uiLang(code: string): Lang {
  if (code.startsWith('el')) return 'el'
  if (code.startsWith('bg')) return 'bg'
  return 'en'
}

export function useAutoTranslate(text: string | null | undefined): string | null | undefined {
  const { i18n } = useTranslation()
  const lang = uiLang(i18n.language)
  const [result, setResult] = useState<string | null | undefined>(text)

  useEffect(() => {
    setResult(text)
    if (!text) return
    let cancelled = false
    translateText(text, lang).then((r) => { if (!cancelled) setResult(r) })
    return () => { cancelled = true }
  }, [text, lang])

  return result
}

export function useAutoTranslateMany(
  texts: (string | null | undefined)[],
): (string | null | undefined)[] {
  const { i18n } = useTranslation()
  const lang = uiLang(i18n.language)
  const [results, setResults] = useState<(string | null | undefined)[]>(texts)

  // stable dep: join with rare separator + lang
  const dep = texts.join('\x00') + '\x01' + lang

  useEffect(() => {
    setResults(texts)
    let cancelled = false
    Promise.all(
      texts.map((t) => (t ? translateText(t, lang) : Promise.resolve(t))),
    ).then((translated) => { if (!cancelled) setResults(translated) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])

  return results
}
