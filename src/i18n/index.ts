import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Lang } from '@/domain/types'
import en from './en.json'
import pl from './pl.json'

export const resources = {
  pl: { translation: pl },
  en: { translation: en },
} as const

function syncDocumentLang(lang: string) {
  document.documentElement.lang = lang
}

export async function initI18n(lang: Lang): Promise<typeof i18n> {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: lang,
      fallbackLng: 'en',
      supportedLngs: ['pl', 'en'],
      interpolation: { escapeValue: false }, // React already escapes
    })
    i18n.on('languageChanged', syncDocumentLang)
  } else {
    await i18n.changeLanguage(lang)
  }
  syncDocumentLang(lang)
  return i18n
}

export { i18n }
