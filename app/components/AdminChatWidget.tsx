'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send, Sun, Moon, Maximize2, Minimize2, ChevronLeft } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  text: string
  ts: number
}

interface AdminChatWidgetProps {
  restaurantId: string
  plan: string
}

type ChatMode = 'closed' | 'sheet' | 'fullscreen'

const STARTERS = [
  'Wie lief heute das Geschäft?',
  'Was sind meine meistverkauften Gerichte?',
  'Gibt es Inventar-Warnungen?',
  'Wann bin ich am stärksten ausgelastet?',
]

const AI_PLANS = ['pro', 'enterprise', 'trial']

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function AdminChatWidget({ plan }: AdminChatWidgetProps) {
  const [chatMode, setChatMode] = useState<ChatMode>('closed')
  const [chatTheme, setChatTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('chat-theme') as 'dark' | 'light') || 'dark'
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  const hasAI = AI_PLANS.includes(plan)
  const hasMessages = messages.length > 0

  // Theme-Farben (nutzt CSS var(--accent) für Akzentfarbe)
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

  const handleTouchStart = (e: React.TouchEvent) => onDragStart(e.touches[0].clientY)
  const handleTouchMove  = (e: React.TouchEvent) => { e.preventDefault(); onDragMove(e.touches[0].clientY) }
  const handleTouchEnd   = () => onDragEnd()
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
      return { ...base, height: `calc(100dvh - ${keyboardOffset}px)`, borderRadius: 0 }
    }

    const h = dragHeight !== null ? dragHeight : getSnapHeight()
    return { ...base, height: h, borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 40px rgba(0,0,0,0.25)' }
  }

  // ── API call ────────────────────────────────────────────────────
  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading || !hasAI) return

    setMessages(prev => [...prev, { role: 'user', text: trimmed, ts: Date.now() }])
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
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.reply || 'Keine Antwort erhalten.',
        ts: Date.now(),
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Verbindungsfehler. Bitte versuche es erneut.', ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Floating Button ── */}
      {chatMode === 'closed' && (
        <button
          onClick={() => setChatMode('sheet')}
          aria-label="KI-Assistent öffnen"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 52,
            height: 52,
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

      {/* ── Bottom Sheet / Fullscreen ── */}
      {chatMode !== 'closed' && (
        <div ref={sheetRef} style={getSheetStyle()}>

          {/* Drag Handle */}
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
              {chatMode === 'fullscreen' && (
                <button
                  onClick={() => setChatMode('sheet')}
                  aria-label="Verkleinern"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px 2px 0', color: 'var(--accent)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <ChevronLeft size={22} />
                </button>
              )}
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Sparkles size={15} color="#fff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>KI-Assistent</div>
                <div style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'adminOnlinePulse 2s infinite' }} />
                  Frag mich zu deinem Restaurant
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                onClick={toggleTheme}
                aria-label="Theme wechseln"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                {chatTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={() => setChatMode(chatMode === 'fullscreen' ? 'sheet' : 'fullscreen')}
                aria-label={chatMode === 'fullscreen' ? 'Verkleinern' : 'Vollbild'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                {chatMode === 'fullscreen' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
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
            flex: 1, overflowY: 'auto', padding: 14,
            display: 'flex', flexDirection: 'column', gap: 10,
            background: C.surface,
          }}>
            {!hasAI ? (
              <div style={{ background: C.botBubble, borderRadius: 14, padding: 18, textAlign: 'center' }}>
                <Sparkles size={28} color="var(--accent)" style={{ marginBottom: 10 }} />
                <p style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  KI-Assistent nicht verfügbar
                </p>
                <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>
                  Upgrade auf Pro oder Enterprise, um den KI-Assistenten zu nutzen.
                </p>
              </div>
            ) : (
              <>
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
                        Hallo! ✨ Ich kenne deine Bestellungen, Umsätze, Inventar und Reservierungen. Was möchtest du wissen?
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
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.color = 'var(--accent)'
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

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      animation: 'adminMsgIn 0.18s ease-out',
                    }}
                  >
                    <div style={{
                      background: msg.role === 'user' ? 'var(--accent)' : C.botBubble,
                      color: msg.role === 'user' ? '#fff' : C.botText,
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
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, paddingLeft: msg.role === 'user' ? 0 : 2, paddingRight: msg.role === 'user' ? 2 : 0 }}>
                      {formatTime(msg.ts)}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div>
                    <div style={{
                      background: C.botBubble,
                      borderRadius: '16px 16px 16px 4px',
                      padding: '11px 16px',
                      display: 'flex', gap: 5, alignItems: 'center', width: 'fit-content',
                    }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: C.textMuted,
                          animation: `adminDotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
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
                placeholder={hasMessages ? 'Weitere Frage...' : 'Frag nach Umsatz, Inventar...'}
                disabled={loading}
                autoComplete="off"
                autoCorrect="off"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 22,
                  border: `1px solid ${C.border}`,
                  background: C.inputField,
                  color: C.text,
                  fontSize: 16,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Senden"
                style={{
                  background: 'var(--accent)',
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
                }}
              >
                <Send size={16} color="#fff" />
              </button>
            </form>
          )}
        </div>
      )}

      <style>{`
        @keyframes adminMsgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes adminDotPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.35; }
          40%           { transform: scale(1);   opacity: 1; }
        }
        @keyframes adminOnlinePulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}
