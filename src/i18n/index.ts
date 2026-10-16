import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import el from './locales/el.json'
import bg from './locales/bg.json'

const saved = localStorage.getItem('chefsuite_lang')
const nav = navigator.language
const browserLang = nav.startsWith('el') ? 'el' : nav.startsWith('bg') ? 'bg' : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, el: { translation: el }, bg: { translation: bg } },
    lng: saved ?? browserLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

// Keep <html lang> in sync: screen readers need it, and the browser only
// drops Greek accents in CSS-uppercased text (all our labels) when lang="el".
function syncLang(lng: string) {
  document.documentElement.lang = lng
}
syncLang(i18n.language)
i18n.on('languageChanged', syncLang)

export default i18n
