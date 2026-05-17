import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en'
import ur from '../locales/ur'

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      ur: { translation: ur },
    },
    interpolation: {
      escapeValue: false,
    },
  })

export const isRTL = () => i18n.language === 'ur'

export default i18n
