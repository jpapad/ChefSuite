import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import el from './locales/el.json'

const saved = localStorage.getItem('chefsuite_lang')
const browserLang = navigator.language.startsWith('el') ? 'el' : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, el: { translation: el } },
    lng: saved ?? browserLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
