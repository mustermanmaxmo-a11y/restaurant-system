'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { isLightColor } from '@/lib/color-utils'
import type { MenuItem } from '@/types/database'
import { MessageSquare, X, ShoppingCart, Check, Send, Sun, Moon, Maximize2, Minimize2, ChevronLeft } from 'lucide-react'

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
  ts: number
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

type ChatMode = 'closed' | 'sheet' | 'fullscreen'

const STARTERS = [
  'Was empfiehlst du heute?',
  'Ich bin allergisch gegen Nüsse',
  'Was ist vegetarisch?',
  'Was passt als Dessert?',
]

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatWidget({ restaurantSlug, restaurantName, items, cart, accentColor, onAddToCart, tableId, restaurantId }: ChatWidgetProps) {
  const accent = accentColor || '#6c63ff'
  const accentText = isLightColor(accent) ? '#111111' : '#ffffff'

  const [chatMode, setChatMode] = useState<ChatMode>('closed')
  const [chatTheme, setChatTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('chat-theme') as 'dark' | 'light') || 'dark'
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set())
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  // Theme-Farben
  const C = {
    bg:         chatTheme === 'dark' ? '#161616' : '#ffffff',
    surface:    chatTheme === 'dark' ? '#1f1f1f' : '#f5f5f7',
    inputBg:    chatTheme === 'dark' ? '#111111' : '#ffffff',
    inputField: chatTheme === 'dark' ? '#2a2a2a' : '#f2f2f7',
    text:       chatTheme === 'dark' ? '#f2f2f2' : '#111111',
    textMuted:  chatTheme === 'dark' ? '#666666' : '#999999',
    border:     chatTheme === 'dark' ? '#242424' : '#eeeeee',
    botBubble:  chatTheme === 'dark' ? '#2a2a2a' : '#ffffff',
    botText:    chatTheme === 'dark' ? '#e5e5e5' : '#111111',
    handle:     chatTheme === 'dark' ? '#3a3a3a' : '#dddddd',
    chipBorder: chatTheme === 'dark' ? '#333333' : '#e0e0e0',
    chipText:   chatTheme === 'dark' ? '#aaaaaa' : '#666666',
  }

  function toggleTheme() {
    const next = chatTheme === 'dark' ? 'light' : 'dark'
    setChatTheme(next)
    localStorage.setItem('chat-theme', next)
  }

  // Keyboard-aware positioning
  const handleViewportResize = useCallback(() => {
    if (!window.visualViewport) return
    const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop)
    setKeyboardOffset(offset)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  useEffect(() => {
    if (chatMode === 'closed') { setKeyboardOffset(0); return }
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
  }, [chatMode, handleViewportResize])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when opening
  useEffect(() => {
    if (chatMode !== 'closed') {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [chatMode])

  // ── Drag handlers ──────────────────────────────────────────────
  function getSnapHeight() {
    return Math.min(window.innerHeight * 0.58, window.innerHeight - 80)
  }

  function onDragStart(clientY: number) {
    if (!sheetRef.current) return
    dragStartY.current = clientY
    dragStartH.current = sheetRef.current.getBoundingClientRect().height
    setIsDragging(true)
  }

  function onDragMove(clientY: number) {
    if (!isDragging) return
    const delta = dragStartY.current - clientY
    const newH = Math.max(60, Math.min(window.innerHeight, dragStartH.current + delta))
    setDragHeight(newH)
  }

  function onDragEnd() {
    if (!isDragging) return
    setIsDragging(false)
    const h = dragHeight ?? getSnapHeight()
    const vh = window.innerHeight
    if (h > vh * 0.78) {
      setChatMode('fullscreen')
    } else if (h < vh * 0.15) {
      setChatMode('closed')
    } else {
      setChatMode('sheet')
    }
    setDragHeight(null)
  }

  // Touch
  const handleTouchStart = (e: React.TouchEvent) => onDragStart(e.touches[0].clientY)
  const handleTouchMove  = (e: React.TouchEvent) => { e.preventDefault(); onDragMove(e.touches[0].clientY) }
  const handleTouchEnd   = () => onDragEnd()

  // Mouse (desktop)
  const handleMouseDown  = (e: React.MouseEvent) => { e.preventDefault(); onDragStart(e.clientY) }
  useEffect(() => {
    if (!isDragging) return
    const move = (e: MouseEvent) => onDragMove(e.clientY)
    const up   = () => onDragEnd()
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragHeight])

  // ── Sheet height/style ─────────────────────────────────────────
  function getSheetStyle(): React.CSSProperties {
    const base: React.CSSProperties = {
      position: 'fixed',
      bottom: keyboardOffset,
      left: 0,
      right: 0,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      overflow: 'hidden',
      transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.32,0.72,0,1), border-radius 0.3s ease',
    }

    if (chatMode === 'fullscreen') {
      return {
        ...base,
        height: `calc(100dvh - ${keyboardOffset}px)`,
        borderRadius: 0,
      }
    }

    // sheet mode
    const h = dragHeight !== null ? dragHeight : getSnapHeight()
    return {
      ...base,
      height: h,
      borderRadius: '20px 20px 0 0',
      boxShadow: '0 -4px 40px rgba(0,0,0,0.25)',
    }
  }

  // ── API call ────────────────────────────────────────────────────
  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', text: trimmed, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = messages.map(m => ({ role: m.role, content: m.text }))
    const cartContext = cart.map(c => ({ name: c.name, qty: c.qty }))

    try {
      const res = await fetch('/api/chat/menu-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantSlug, message: trimmed, history, cart: cartContext }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply,
        cartSuggestion: data.cartSuggestion,
        ts: Date.now(),
      }])

      if (data.serviceCall && tableId && restaurantId) {
        await supabase.from('service_calls').insert({
          restaurant_id: restaurantId,
          table_id: tableId,
          type: data.serviceCall,
        })
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Verbindungsfehler. Bitte versuche es erneut.', ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <>
      {/* ── Floating Button ── */}
      {chatMode === 'closed' && (
        <button
          onClick={() => setChatMode('sheet')}
          aria-label="Menü-Assistent öffnen"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: accent,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 20px ${accent}66`,
            zIndex: 90,
            transition: 'transform 0.2s, box-shadow 0.2s',
            color: accentText,
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
          <MessageSquare size={22} color={accentText} />
        </button>
      )}

      {/* ── Bottom Sheet / Fullscreen ── */}
      {chatMode !== 'closed' && (
        <div ref={sheetRef} style={getSheetStyle()}>

          {/* Drag Handle (nur im Sheet-Modus) */}
          {chatMode === 'sheet' && (
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              style={{
                padding: '10px 0 6px',
                display: 'flex',
                justifyContent: 'center',
                cursor: 'grab',
                flexShrink: 0,
                touchAction: 'none',
                background: C.bg,
              }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: C.handle }} />
            </div>
          )}

          {/* Header */}
          <div style={{
            padding: chatMode === 'fullscreen' ? '14px 16px 10px' : '6px 14px 10px',
            paddingTop: chatMode === 'fullscreen' ? 'max(14px, env(safe-area-inset-top))' : '6px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: C.inputBg,
            flexShrink: 0,
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {/* Back button in fullscreen */}
              {chatMode === 'fullscreen' && (
                <button
                  onClick={() => setChatMode('sheet')}
                  aria-label="Verkleinern"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px 2px 0', color: accent, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 15,
              }}>
                <MessageSquare size={16} color={accentText} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>Menü-Assistent</div>
                <div style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'chatOnlinePulse 2s infinite' }} />
                  {restaurantName}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                aria-label="Theme wechseln"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                {chatTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {/* Expand / Shrink */}
              <button
                onClick={() => setChatMode(chatMode === 'fullscreen' ? 'sheet' : 'fullscreen')}
                aria-label={chatMode === 'fullscreen' ? 'Verkleinern' : 'Vollbild'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                {chatMode === 'fullscreen' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              {/* Close */}
              <button
                onClick={() => setChatMode('closed')}
                aria-label="Chat schließen"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: C.surface,
          }}>
            {/* Welcome + Starters */}
            {!hasMessages && (
              <div>
                <div style={{
                  background: C.botBubble,
                  borderRadius: '16px 16px 16px 4px',
                  padding: '11px 14px',
                  marginBottom: 4,
                  maxWidth: '85%',
                  boxShadow: chatTheme === 'light' ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
                }}>
                  <p style={{ color: C.botText, fontSize: 14, margin: 0, lineHeight: 1.55 }}>
                    Hallo! 👋 Ich helfe dir bei Fragen zum Menü — Empfehlungen, Allergene, Zutaten.
                  </p>
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 10, paddingLeft: 2 }}>
                  {formatTime(Date.now())}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STARTERS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.chipBorder}`,
                        borderRadius: 20,
                        padding: '5px 12px',
                        color: C.chipText,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = accent
                        e.currentTarget.style.color = accent
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = C.chipBorder
                        e.currentTarget.style.color = C.chipText
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
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  animation: 'chatMsgIn 0.18s ease-out',
                }}
              >
                <div style={{
                  background: msg.role === 'user' ? accent : C.botBubble,
                  color: msg.role === 'user' ? accentText : C.botText,
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '9px 14px',
                  maxWidth: '82%',
                  fontSize: 14,
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  boxShadow: chatTheme === 'light' && msg.role === 'assistant' ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
                }}>
                  {msg.text}
                </div>

                {/* Cart suggestion button */}
                {msg.role === 'assistant' && msg.cartSuggestion && onAddToCart && (
                  <button
                    onClick={() => {
                      if (addedIndices.has(i)) return
                      onAddToCart(msg.cartSuggestion!.itemId, msg.cartSuggestion!.name, msg.cartSuggestion!.qty)
                      setAddedIndices(prev => new Set(prev).add(i))
                    }}
                    style={{
                      marginTop: 5,
                      padding: '5px 14px',
                      borderRadius: 20,
                      border: addedIndices.has(i) ? '1px solid #22c55e' : `1px solid ${accent}`,
                      background: 'transparent',
                      color: addedIndices.has(i) ? '#22c55e' : accent,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: addedIndices.has(i) ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {addedIndices.has(i)
                      ? <><Check size={12} /> Hinzugefügt</>
                      : <><ShoppingCart size={12} /> {msg.cartSuggestion.name}{msg.cartSuggestion.qty > 1 ? ` (${msg.cartSuggestion.qty}x)` : ''} hinzufügen</>
                    }
                  </button>
                )}

                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, paddingLeft: msg.role === 'user' ? 0 : 2, paddingRight: msg.role === 'user' ? 2 : 0 }}>
                  {formatTime(msg.ts)}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div>
                <div style={{
                  background: C.botBubble,
                  borderRadius: '16px 16px 16px 4px',
                  padding: '11px 16px',
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                  width: 'fit-content',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: C.textMuted,
                      animation: `chatDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
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
              paddingBottom: chatMode === 'fullscreen' ? 'max(10px, env(safe-area-inset-bottom))' : '10px',
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              gap: 8,
              flexShrink: 0,
              background: C.inputBg,
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
                padding: '10px 14px',
                borderRadius: 22,
                border: `1px solid ${C.border}`,
                background: C.inputField,
                color: C.text,
                fontSize: 16,
                outline: 'none',
                touchAction: 'manipulation',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Senden"
              style={{
                background: accent,
                border: 'none',
                borderRadius: '50%',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.4 : 1,
                flexShrink: 0,
                transition: 'opacity 0.15s',
                touchAction: 'manipulation',
              }}
            >
              <Send size={16} color={accentText} />
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes chatMsgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatDotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.35; }
          40%           { transform: scale(1);   opacity: 1; }
        }
        @keyframes chatOnlinePulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}
