'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem } from '@/types/database'
import { MessageSquare, X, ShoppingCart, Check, Send } from 'lucide-react'

interface CartItem {
  name: string
  qty: number
}

interface CartSuggestion {
  itemId: string
  name: string
  qty: number
}

interface Message {
  role: 'user' | 'assistant'
  text: string
  cartSuggestion?: CartSuggestion
}

interface ChatWidgetProps {
  restaurantSlug: string
  restaurantName: string
  items: MenuItem[]
  cart: CartItem[]
  accentColor?: string
  onAddToCart?: (itemId: string, name: string, qty: number) => void
  tableId?: string
  restaurantId?: string
}

const STARTERS = [
  'Was empfiehlst du heute?',
  'Ich bin allergisch gegen Nüsse',
  'Was ist vegetarisch?',
  'Was passt als Dessert?',
]

export default function ChatWidget({ restaurantSlug, restaurantName, items, cart, accentColor, onAddToCart, tableId, restaurantId }: ChatWidgetProps) {
  const accent = accentColor || '#6c63ff'
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set())
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keyboard-aware positioning via visualViewport API
  const handleViewportResize = useCallback(() => {
    if (!window.visualViewport) return
    const viewportHeight = window.visualViewport.height
    const windowHeight = window.innerHeight
    const offset = Math.max(0, windowHeight - viewportHeight - window.visualViewport.offsetTop)
    setKeyboardOffset(offset)
    // Scroll to bottom when keyboard opens
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  useEffect(() => {
    if (!open) {
      setKeyboardOffset(0)
      return
    }

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', handleViewportResize)
      vv.addEventListener('scroll', handleViewportResize)
    }
    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleViewportResize)
        vv.removeEventListener('scroll', handleViewportResize)
      }
      setKeyboardOffset(0)
    }
  }, [open, handleViewportResize])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = messages.map(m => ({ role: m.role, content: m.text }))
    const cartContext = cart.map(c => ({ name: c.name, qty: c.qty }))

    try {
      const res = await fetch('/api/chat/menu-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug,
          message: trimmed,
          history,
          cart: cartContext,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply,
        cartSuggestion: data.cartSuggestion,
      }])

      // Service-Call: nur wenn Tisch bekannt
      if (data.serviceCall && tableId && restaurantId) {
        await supabase.from('service_calls').insert({
          restaurant_id: restaurantId,
          table_id: tableId,
          type: data.serviceCall,
        })
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Verbindungsfehler. Bitte versuche es erneut.' }])
    } finally {
      setLoading(false)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true)
            // Must be synchronous in click handler for mobile keyboard to appear
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          aria-label="Menü-Assistent öffnen"
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: accent,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: `0 4px 20px ${accent}66`,
            zIndex: 90,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = `0 6px 28px ${accent}88`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = `0 4px 20px ${accent}66`
          }}
        >
          <MessageSquare size={22} />
        </button>
      )}

      {/* Chat Popup */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: `${20 + keyboardOffset}px`,
            right: '20px',
            width: 'min(340px, calc(100vw - 32px))',
            height: `min(480px, calc(100dvh - ${40 + keyboardOffset}px))`,
            background: 'var(--surface, #1a1a2e)',
            border: '1px solid var(--border, #2a2a4a)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 90,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            animation: 'chatPopIn 0.2s ease-out',
            overflow: 'hidden',
            transition: 'bottom 0.15s ease-out, height 0.15s ease-out',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border, #2a2a4a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: accent + '15',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
              <span style={{ color: 'var(--text, #f1f5f9)', fontWeight: 700, fontSize: '0.9rem' }}>
                Menü-Assistent
              </span>
              <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.75rem' }}>{restaurantName}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Chat schließen"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Welcome + Starters */}
            {!hasMessages && (
              <div>
                <div style={{
                  background: accent + '18',
                  borderRadius: '12px 12px 12px 4px',
                  padding: '10px 14px',
                  marginBottom: '12px',
                  maxWidth: '85%',
                }}>
                  <p style={{ color: 'var(--text, #f1f5f9)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                    Hallo! 👋 Ich helfe dir bei Fragen zum Menü — Empfehlungen, Allergene, Zutaten. Was kann ich für dich tun?
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {STARTERS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        background: 'var(--bg, #0f0f1a)',
                        border: `1px solid ${accent}44`,
                        borderRadius: '20px',
                        padding: '5px 12px',
                        color: accent,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = accent + '18'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg, #0f0f1a)'}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  animation: 'msgSlideIn 0.15s ease-out',
                }}
              >
                <div style={{
                  background: msg.role === 'user' ? accent : accent + '18',
                  color: msg.role === 'user' ? '#fff' : 'var(--text, #f1f5f9)',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  padding: '9px 13px',
                  maxWidth: '82%',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {msg.text}
                </div>
                {msg.role === 'assistant' && msg.cartSuggestion && onAddToCart && (
                  <button
                    onClick={() => {
                      if (addedIndices.has(i)) return
                      onAddToCart(msg.cartSuggestion!.itemId, msg.cartSuggestion!.name, msg.cartSuggestion!.qty)
                      setAddedIndices(prev => new Set(prev).add(i))
                    }}
                    style={{
                      marginTop: '6px',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: addedIndices.has(i) ? `1px solid #4ade80` : `1px solid ${accent}`,
                      background: addedIndices.has(i) ? '#4ade8018' : accent + '18',
                      color: addedIndices.has(i) ? '#4ade80' : accent,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: addedIndices.has(i) ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {addedIndices.has(i)
                      ? <><Check size={12} /> Hinzugefügt</>
                      : <><ShoppingCart size={12} /> {msg.cartSuggestion.name}{msg.cartSuggestion.qty > 1 ? ` (${msg.cartSuggestion.qty}x)` : ''} hinzufügen</>
                    }
                  </button>
                )}
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  background: accent + '18',
                  borderRadius: '12px 12px 12px 4px',
                  padding: '10px 16px',
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: accent,
                      animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); send(input) }}
            style={{
              padding: '10px 12px',
              borderTop: '1px solid var(--border, #2a2a4a)',
              display: 'flex',
              gap: '8px',
              flexShrink: 0,
              background: 'var(--surface, #1a1a2e)',
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={hasMessages ? 'Weitere Frage...' : 'Frag nach Allergenen...'}
              disabled={loading}
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border, #2a2a4a)',
                background: 'var(--bg, #0f0f1a)',
                color: 'var(--text, #f1f5f9)',
                fontSize: '16px',
                outline: 'none',
                touchAction: 'manipulation',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: accent,
                border: 'none',
                borderRadius: '10px',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.4 : 1,
                fontSize: '1rem',
                flexShrink: 0,
                transition: 'opacity 0.15s',
                touchAction: 'manipulation',
              }}
              aria-label="Senden"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes chatPopIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}
