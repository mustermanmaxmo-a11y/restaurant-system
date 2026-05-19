'use client'

import { useState, useEffect, useCallback } from 'react'

type Article = {
  id: string
  title: string
  content: string
  category: string
  tags: string[] | null
  language: string
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  'email-strategy': 'Email-Strategie',
  'seasonal': 'Saisonales',
  'psychology': 'Psychologie',
  'dsgvo': 'DSGVO',
  'trends': 'Branchentrends',
}

const CATEGORY_COLORS: Record<string, string> = {
  'email-strategy': '#3b82f6',
  'seasonal': '#22c55e',
  'psychology': '#a855f7',
  'dsgvo': '#ef4444',
  'trends': '#f97316',
}

const EMPTY_FORM = {
  title: '',
  content: '',
  category: 'email-strategy',
  tags: '',
  language: 'de',
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/platform/knowledge')
      const data = await res.json()
      setArticles(data.articles ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  function openNew() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(article: Article) {
    setForm({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags ? article.tags.join(', ') : '',
      language: article.language,
    })
    setEditingId(article.id)
    setError(null)
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const tagsArray = form.tags
      ? form.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      title: form.title,
      content: form.content,
      category: form.category,
      tags: tagsArray,
      language: form.language,
    }

    try {
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch('/api/platform/knowledge', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Fehler beim Speichern')
        return
      }
      await fetchArticles()
      cancel()
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Artikel "${title}" wirklich löschen?`)) return
    const res = await fetch(`/api/platform/knowledge?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchArticles()
    }
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
            Knowledge Base
          </h1>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>
            Marketing-Wissen für den KI-Berater — Artikel werden automatisch in Beratungsgesprächen genutzt.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openNew}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Neuen Artikel hinzufügen
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div style={{
          background: '#242438',
          border: '1px solid #2a2a3e',
          borderRadius: '14px',
          padding: '24px',
          marginBottom: '28px',
        }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginBottom: '20px' }}>
            {editingId ? 'Artikel bearbeiten' : 'Neuer Artikel'}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title */}
            <div>
              <label style={labelStyle}>Titel *</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="z.B. Betreffzeilen-Strategien für Restaurants"
                style={inputStyle}
              />
            </div>

            {/* Content */}
            <div>
              <label style={labelStyle}>Inhalt *</label>
              <textarea
                required
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Das Marketing-Wissen das der KI-Berater nutzen soll..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
            </div>

            {/* Category + Language row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Kategorie</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={inputStyle}
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Sprache</label>
                <select
                  value={form.language}
                  onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags (kommagetrennt)</label>
              <input
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="z.B. betreff, conversion, öffnungsrate"
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.82rem', background: '#3f1212', padding: '10px 14px', borderRadius: '8px' }}>
                {error}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: saving ? '#555' : '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 24px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                type="button"
                onClick={cancel}
                style={{
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid #2a2a3e',
                  borderRadius: '10px',
                  padding: '10px 24px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Articles list */}
      {loading ? (
        <p style={{ color: '#666', fontSize: '0.85rem' }}>Lade Artikel...</p>
      ) : articles.length === 0 ? (
        <div style={{
          background: '#242438',
          border: '1px solid #2a2a3e',
          borderRadius: '14px',
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Noch keine Wissensbasis-Artikel. Füge Marketing-Wissen hinzu das der KI-Berater nutzt.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {articles.map(article => (
            <div
              key={article.id}
              style={{
                background: '#242438',
                border: '1px solid #2a2a3e',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* Title + tags */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                    {article.title}
                  </span>
                  <span style={{
                    background: CATEGORY_COLORS[article.category] ?? '#666',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}>
                    {CATEGORY_LABELS[article.category] ?? article.category}
                  </span>
                </div>
                {article.tags && article.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {article.tags.map(tag => (
                      <span key={tag} style={{
                        background: '#1a1a2e',
                        color: '#888',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontSize: '0.7rem',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Language */}
              <span style={{ color: '#666', fontSize: '0.78rem', flexShrink: 0 }}>
                {article.language === 'de' ? 'DE' : 'EN'}
              </span>

              {/* Date */}
              <span style={{ color: '#666', fontSize: '0.78rem', flexShrink: 0 }}>
                {new Date(article.created_at).toLocaleDateString('de-DE')}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={() => openEdit(article)}
                  style={{
                    background: '#1a1a2e',
                    color: '#ccc',
                    border: '1px solid #2a2a3e',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => handleDelete(article.id, article.title)}
                  style={{
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1px solid #3f1212',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#aaa',
  fontSize: '0.78rem',
  fontWeight: 600,
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a1a2e',
  border: '1px solid #2a2a3e',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#e5e7eb',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
}
