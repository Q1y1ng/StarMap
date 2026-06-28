'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

type ThemeContextType = {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolved: 'light',
  setTheme: () => {},
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  // Initialize from localStorage (one-time init, not a side-effect cascade)
  useEffect(() => {
    const stored = localStorage.getItem('starmap-theme') as Theme | null
    if (stored) setThemeState(stored) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  // Resolve system preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    const resolve = () => {
      const t = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme
      setResolved(t)
      document.documentElement.setAttribute('data-theme', t)
    }

    resolve()
    mq.addEventListener('change', resolve)
    return () => mq.removeEventListener('change', resolve)
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('starmap-theme', t)
  }

  const toggle = () => {
    setTheme(resolved === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
