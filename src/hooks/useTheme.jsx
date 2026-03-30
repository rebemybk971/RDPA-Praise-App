import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('rdpa-theme') || 'auto')

  useEffect(() => {
    localStorage.setItem('rdpa-theme', theme)
    const root = document.documentElement
    if (theme === 'night') {
      root.setAttribute('data-theme', 'night')
    } else if (theme === 'day') {
      root.setAttribute('data-theme', 'day')
    } else {
      root.removeAttribute('data-theme')
    }
  }, [theme])

  const cycleTheme = () => {
    setTheme(t => t === 'day' ? 'night' : t === 'night' ? 'auto' : 'day')
  }

  const icon = theme === 'day' ? '☀️' : theme === 'night' ? '🌙' : '⚙️'

  return (
    <ThemeContext.Provider value={{ theme, cycleTheme, icon }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
