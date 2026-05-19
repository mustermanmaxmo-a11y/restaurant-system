'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface CampaignDraft {
  subject: string
  previewText: string
  bodyHtml: string
  ctaText: string
  ctaUrl: string
  discountCode: string | null
  templateType: string
}

interface EmailTemplate {
  name: string
  triggerType: string
  subjectTemplate: string
  heroText: string
  bodyText: string
  ctaText: string
  discountCode?: string
  discountPercent?: string
  baseTemplate: string
}

interface InitialStats {
  campaignCount: number
  avgOpenRate: number
  conversionRevenue: number
  activeAutomations: number
}

interface Props {
  restaurantId: string
  initialStats: InitialStats
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_CHIPS = [
  { label: '💡 Nächste Aktionsidee', text: 'Was wäre die nächste gute Aktionsidee für mein Restaurant?' },
  { label: '📊 Was funktioniert am besten?', text: 'Was funktioniert bei meinem Marketing am besten?' },
  { label: '⚡ Automation erstellen', text: 'Hilf mir eine Marketing-Automation zu erstellen.' },
  { label: '📧 Geburtstags-Template', text: 'Erstelle mir ein Geburtstags-Email-Template mit 15% Rabatt für meine Stammkunden.' },
  { label: '💌 Comeback-Template', text: 'Erstelle mir ein Email-Template für inaktive Kunden die länger als 14 Tage nicht bestellt haben.' },
]

export function MarketingAdvisor({ restaurantId, initialStats }: Props) {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hallo! Ich bin Ihr persönlicher Marketing-Berater. Ich kenne Ihr Menü, Ihre Öffnungszeiten und Ihre Kundendaten — ich helfe Ihnen dabei, gezielte Kampagnen zu erstellen, die wirklich funktionieren. Was möchten Sie heute erreichen?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft | null>(null)
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate | null>(null)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat/marketing-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-10),
          restaurantId,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Fehler: ${err || 'Unbekannter Fehler'}` },
        ])
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: fullText }
          return updated
        })
      }

      // Check for campaign draft
      const draftMatch = fullText.match(/<campaign-draft>([\s\S]*?)<\/campaign-draft>/)
      if (draftMatch) {
        try {
          const draft = JSON.parse(draftMatch[1].trim())
          setCampaignDraft(draft)
        } catch { /* silently ignore */ }
      }

      // Check for email template
      const templateMatch = fullText.match(/<email-template>([\s\S]*?)<\/email-template>/)
      if (templateMatch) {
        try {
          const tpl = JSON.parse(templateMatch[1].trim())
          setEmailTemplate(tpl)
          setTemplateSaved(false)
        } catch { /* silently ignore */ }
      }
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function loadDraftToEditor() {
    if (!campaignDraft) return
    localStorage.setItem('marketing_campaign_draft', JSON.stringify(campaignDraft))
    router.push('/admin/marketing/campaigns')
  }

  async function saveEmailTemplate() {
    if (!emailTemplate) return
    setTemplateSaving(true)
    try {
      const res = await fetch('/api/marketing/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: emailTemplate.name,
          trigger_type: emailTemplate.triggerType,
          subject_template: emailTemplate.subjectTemplate,
          body_html: buildTemplateHtml(emailTemplate),
          created_by_ai: true,
        }),
      })
      if (res.ok) setTemplateSaved(true)
    } catch { /* ignore */ }
    setTemplateSaving(false)
  }

  function buildTemplateHtml(tpl: EmailTemplate): string {
    // Build simple placeholder HTML — base template rendering happens server-side at send time
    return `<!-- base:${tpl.baseTemplate} -->
<div data-hero="${encodeURIComponent(tpl.heroText)}" data-body="${encodeURIComponent(tpl.bodyText)}" data-cta="${encodeURIComponent(tpl.ctaText)}"${tpl.discountCode ? ` data-code="${tpl.discountCode}" data-pct="${tpl.discountPercent ?? '10'}"` : ''}>
{{restaurant_name}} · ${tpl.name}
</div>`
  }

  const stats = [
    { label: 'Kampagnen (30T)', value: String(initialStats.campaignCount), unit: '' },
    { label: 'Öffnungsrate', value: String(initialStats.avgOpenRate), unit: '%' },
    { label: 'Umsatz generiert', value: `€${initialStats.conversionRevenue.toLocaleString('de-DE')}`, unit: '' },
    { label: 'Automationen aktiv', value: String(initialStats.activeAutomations), unit: '' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '100vh',
        background: 'var(--bg, #0a0a0f)',
        padding: '20px',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Stats Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        {stats.map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'var(--surface, #111117)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px',
              padding: '14px 16px',
            }}
          >
            <p
              style={{
                color: 'var(--text-muted, #6b7280)',
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: 0,
                marginBottom: '6px',
              }}
            >
              {stat.label}
            </p>
            <p
              style={{
                color: '#ffffff',
                fontSize: '1.5rem',
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {stat.value}
              {stat.unit && (
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e85d26' }}>
                  {stat.unit}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Chat Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface, #111117)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Chat Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #e85d26 0%, #ff8c4a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0,
            }}
          >
            🤖
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Marketing-Berater
            </p>
            <p
              style={{
                color: 'var(--text-muted, #6b7280)',
                fontSize: '0.72rem',
                margin: 0,
                marginTop: '1px',
              }}
            >
              Powered by Claude · Kennt Ihr Menü &amp; Ihre Kunden
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 6px rgba(34,197,94,0.6)',
              }}
            />
            <span style={{ color: '#22c55e', fontSize: '0.72rem', fontWeight: 600 }}>
              Online
            </span>
          </div>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: 0,
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background:
                    msg.role === 'user'
                      ? 'linear-gradient(135deg, #e85d26 0%, #ff8c4a 100%)'
                      : 'rgba(255,255,255,0.06)',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content || (msg.role === 'assistant' && loading && i === messages.length - 1 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    {[0, 1, 2].map(dot => (
                      <span
                        key={dot}
                        style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.5)',
                          animation: `pulse 1.2s ease-in-out ${dot * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </span>
                ) : null)}
              </div>
            </div>
          ))}

          {/* Loading indicator when no empty message yet */}
          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(dot => (
                    <span
                      key={dot}
                      style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.5)',
                      }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Campaign Draft Card */}
        {campaignDraft && (
          <div
            style={{
              margin: '0 20px 12px',
              background: 'rgba(232,93,38,0.08)',
              border: '1px solid rgba(232,93,38,0.3)',
              borderRadius: '12px',
              padding: '14px 16px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <p
                style={{
                  color: '#e85d26',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  margin: 0,
                }}
              >
                ✨ Kampagnen-Entwurf bereit
              </p>
              <button
                onClick={() => setCampaignDraft(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #6b7280)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: '2px',
                }}
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <p
              style={{
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 600,
                margin: '0 0 4px',
              }}
            >
              {campaignDraft.subject}
            </p>
            {campaignDraft.discountCode && (
              <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.78rem', margin: '0 0 10px' }}>
                Rabattcode:{' '}
                <span style={{ color: '#22c55e', fontWeight: 700 }}>
                  {campaignDraft.discountCode}
                </span>
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={loadDraftToEditor}
                style={{
                  background: '#e85d26',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                📧 In Kampagnen-Editor laden
              </button>
              <button
                onClick={() => {
                  setCampaignDraft(null)
                  setInput('Generiere einen neuen Kampagnen-Entwurf')
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  color: 'var(--text-muted, #9ca3af)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                🔄 Neu generieren
              </button>
            </div>
          </div>
        )}

        {/* Email Template Card */}
        {emailTemplate && (
          <div style={{ margin: '0 20px 12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '14px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ color: '#8b5cf6', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                📧 Email-Template bereit
              </p>
              <button onClick={() => setEmailTemplate(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #6b7280)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '2px' }}>✕</button>
            </div>
            <p style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 2px' }}>{emailTemplate.name}</p>
            <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.78rem', margin: '0 0 10px' }}>
              Betreff: {emailTemplate.subjectTemplate}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={saveEmailTemplate}
                disabled={templateSaving || templateSaved}
                style={{ background: templateSaved ? '#22c55e' : '#8b5cf6', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: templateSaving || templateSaved ? 'default' : 'pointer', opacity: templateSaving ? 0.7 : 1 }}
              >
                {templateSaved ? '✓ Gespeichert' : templateSaving ? 'Speichern...' : '💾 Als Template speichern'}
              </button>
              {templateSaved && (
                <button onClick={() => router.push('/admin/marketing/templates')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 14px', color: 'var(--text-muted, #9ca3af)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                  📚 Zur Template-Bibliothek
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick Chips */}
        <div
          style={{
            padding: '0 20px 10px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          {QUICK_CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => setInput(chip.text)}
              disabled={loading}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '999px',
                padding: '5px 12px',
                color: 'var(--text-muted, #9ca3af)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div
          style={{
            padding: '0 20px 20px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-end',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '10px 12px',
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Fragen Sie mich alles über Ihr Marketing…"
              rows={1}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'none',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: 0,
                opacity: loading ? 0.6 : 1,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background:
                  loading || !input.trim()
                    ? 'rgba(255,255,255,0.07)'
                    : 'linear-gradient(135deg, #e85d26 0%, #ff8c4a 100%)',
                border: 'none',
                color: loading || !input.trim() ? 'rgba(255,255,255,0.3)' : '#ffffff',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
              aria-label="Senden"
            >
              ↑
            </button>
          </div>
          <p
            style={{
              color: 'rgba(255,255,255,0.2)',
              fontSize: '0.68rem',
              textAlign: 'center',
              margin: '6px 0 0',
            }}
          >
            Enter zum Senden · Shift+Enter für Zeilenumbruch
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
