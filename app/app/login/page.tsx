'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/components/providers/language-provider'
import { LanguageSelector } from '@/components/ui/language-selector'

const PINS = ['', '', '', '']

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [pin, setPin] = useState<string[]>(PINS)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const pinStr = pin.join('')

  function handleDigit(digit: string) {
    const next = [...pin]
    const idx = next.findIndex(d => d === '')
    if (idx === -1) return
    next[idx] = digit
    setPin(next)
    setError('')
    if (idx === 3) attemptLogin(next.join(''))
  }

  function handleDelete() {
    const next = [...pin]
    for (let i = 3; i >= 0; i--) {
      if (next[i] !== '') { next[i] = ''; break }
    }
    setPin(next)
    setError('')
  }

  async function attemptLogin(code: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff')
      .select('id, name, role, restaurant_id')
      .eq('code', code)
      .eq('active', true)
      .limit(1)

    if (error || !data || data.length === 0) {
      setError(t('auth.invalidPin'))
      setPin(['', '', '', ''])
      setLoading(false)
      return
    }

    localStorage.setItem('staff', JSON.stringify(data[0]))
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
        <LanguageSelector />
      </div>
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-white text-2xl font-bold">{t('auth.staffLogin')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('auth.pin')}</p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center gap-4 mb-8">
          {pin.map((d, i) => (
            <div
              key={i}
              className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                d ? 'border-green-500 bg-green-500/10 text-white' : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              {d ? '●' : ''}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-center text-sm mb-4">{error}</p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              disabled={loading || pinStr.length === 4}
              className="bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-2xl font-semibold h-16 rounded-2xl transition-colors disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <div /> {/* empty */}
          <button
            onClick={() => handleDigit('0')}
            disabled={loading || pinStr.length === 4}
            className="bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-2xl font-semibold h-16 rounded-2xl transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-300 text-xl font-semibold h-16 rounded-2xl transition-colors disabled:opacity-50"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}
