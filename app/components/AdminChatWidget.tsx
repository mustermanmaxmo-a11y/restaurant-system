'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

interface AdminChatWidgetProps {
  restaurantId: string
  plan: string
}

const STARTERS = [
  'Wie lief heute das Geschäft?',
  'Was sind meine meistverkauften Gerichte?',
  'Gibt es Inventar-Warnungen?',
  'Wann bin ich am stärksten ausgelastet?',
]

const AI_PLANS = ['pro', 'enterprise', 'trial']

export default function AdminChatWidget({ plan }: AdminChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasAI = AI_PLANS.includes(plan)
  const hasMessages = messages.length > 0

  const handleViewportResize = useCallback(() => {
    if (!window.visualViewport) return
    const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop)
    setKeyboardOffset(offset)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  useEffect(() => {
    if (!open) { setKeyboardOffset(0); return }
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
    if (!trimmed || loading || !hasAI) return

    setMessages(prev => [...prev, { role: 'user', text: trimmed }])
    setInput('')
    setLoading(true)

    const history = messages.map(m => ({ role: m.role, content: m.text }))

    try {
      const res = await fetch('/api/chat/admin-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply || 'Keine Antwort erhalten.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Verbindungsfehler. Bitte versuche es erneut.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true)
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          aria-label="KI-Assistent öffnen"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'var(--accent)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 80,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08)'
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'
          }}
        >
          <Sparkles size={20} color="#fff" />
        </button>
      )}

      {/* Chat Popup */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: `${24 + keyboardOffset}px`,
            right: '24px',
            width: 'min(360px, calc(100vw - 32px))',
            height: `min(500px, calc(100dvh - ${48 + keyboardOffset}px))`,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 80,
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            animation: 'adminChatIn 0.2s ease-out',
            overflow: 'hidden',
            transition: 'bottom 0.15s ease-out, height 0.15s ease-out',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--accent)12',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px',
                background: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Sparkles size={14} color="#fff" />
              </div>
              <div>
                <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.88rem', display: 'block', lineHeight: 1.2 }}>
                  KI-Assistent
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  Frag mich zu deinem Restaurant
                </span>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Chat schließen"
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '4px 6px', borderRadius: '6px',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            {!hasAI ? (
              <div style={{
                background: 'var(--accent)18',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <Sparkles size={28} color="var(--accent)" style={{ marginBottom: '10px' }} />
                <p style={{ color: 'var(--text)', fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>
                  KI-Assistent nicht verfügbar
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                  Upgrade auf Pro oder Enterprise, um den KI-Assistenten zu nutzen.
                </p>
              </div>
            ) : (
              <>
                {/* Welcome + Starters */}
                {!hasMessages && (
                  <div>
                    <div style={{
                      background: 'var(--accent)15',
                      borderRadius: '12px 12px 12px 4px',
                      padding: '11px 14px',
                      marginBottom: '12px',
                    }}>
                      <p style={{ color: 'var(--text)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                        Hallo! ✨ Ich kenne deine Bestellungen, Umsätze, Inventar und Reservierungen. Was möchtest du wissen?
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {STARTERS.map(s => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: '20px',
                            padding: '5px 12px',
                            color: 'var(--accent)',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontWeight: 500,
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--accent)15'
                            e.currentTarget.style.borderColor = 'var(--accent)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg)'
                            e.currentTarget.style.borderColor = 'var(--border)'
                          }}
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
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      animation: 'msgFadeIn 0.15s ease-out',
                    }}
                  >
                    <div style={{
                      background: msg.role === 'user' ? 'var(--accent)' : 'var(--accent)18',
                      color: msg.role === 'user' ? '#fff' : 'var(--text)',
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      padding: '9px 13px',
                      maxWidth: '85%',
                      fontSize: '0.85rem',
                      lineHeight: 1.55,
                      wordBreak: 'break-word',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Loading dots */}
                {loading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      background: 'var(--accent)18',
                      borderRadius: '12px 12px 12px 4px',
                      padding: '10px 16px',
                      display: 'flex', gap: '4px', alignItems: 'center',
                    }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: 'var(--accent)',
                          animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          {hasAI && (
            <form
              onSubmit={e => { e.preventDefault(); send(input) }}
              style={{
                padding: '10px 12px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: '8px',
                flexShrink: 0,
                background: 'var(--surface)',
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={hasMessages ? 'Weitere Frage...' : 'Frag nach Umsatz, Inventar...'}
                disabled={loading}
                autoComplete="off"
                autoCorrect="off"
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '10px',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !input.trim() ? 0.4 : 1,
                  flexShrink: 0,
                  transition: 'opacity 0.15s',
                }}
                aria-label="Senden"
              >
                <Send size={16} color="#fff" />
              </button>
            </form>
          )}
        </div>
      )}

      <style>{`
        @keyframes adminChatIn {
          from { opacity: 0; transform: scale(0.93) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes msgFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </>
  )
}
