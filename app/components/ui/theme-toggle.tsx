'use client'

import { useTheme } from '@/components/providers/theme-provider'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'var(--border)',
        color: 'var(--text-muted)',
      }}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
      <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  )
}
