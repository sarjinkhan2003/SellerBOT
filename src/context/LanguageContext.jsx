import { createContext, useContext, useState } from 'react'
import i18n from '../i18n'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(localStorage.getItem('sellerbot-language') || 'en')

  const toggleLanguage = () => {
    const next = language === 'en' ? 'bn' : 'en'
    setLanguage(next)
    i18n.changeLanguage(next)
    localStorage.setItem('sellerbot-language', next)
    document.documentElement.lang = next
  }

  return <LanguageContext.Provider value={{ language, toggleLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
