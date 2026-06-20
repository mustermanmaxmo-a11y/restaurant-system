'use client'

import { useState, useCallback } from 'react'
import { Pin, Trash2, PinOff, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Note = {
  id: string
  author_email: string
  content: string
  pinned: boolean
  created_at: string
}

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Authorization': `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
}

export function Notes({
  restaurantId,
  initialNotes,
  currentUserEmail,
  canDeleteAll,
}: {
  restaurantId: string
  initialNotes: Note[]
  currentUserEmail: string
  canDeleteAll: boolean
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const apiBase = `/api/platform/restaurants/${restaurantId}/notes`

  const submit = useCallback(async () => {
    if (!text.trim()) return
    setSubmitting(true)
    setError('')
    const res = await fetch(apiBase, { method: 'POST', headers: await authHeader(), body: JSON.stringify({ content: text.trim() }) })
    if (res.ok) {
      const note: Note = await res.json()
      setNotes(prev => [note, ...prev])
      setText('')
    } else {
      const j = await res.json()
      setError(j.error ?? 'Fehler')
    }
    setSubmitting(false)
  }, [text, apiBase])

  const togglePin = useCallback(async (note: Note) => {
    const optimistic = notes.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n)
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setNotes(optimistic)
    await fetch(apiBase, { method: 'PATCH', headers: await authHeader(), body: JSON.stringify({ noteId: note.id, pinned: !note.pinned }) })
  }, [notes, apiBase])

  const deleteNote = useCallback(async (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId))
    await fetch(apiBase, { method: 'DELETE', headers: await authHeader(), body: JSON.stringify({ noteId }) })
  }, [apiBase])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
          placeholder="Interne Notiz… (⌘+Enter zum Speichern)"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            border: '1px solid #2a2a3e', background: '#1a1a2e', color: '#ccc',
            fontSize: '0.82rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#444', fontSize: '0.7rem' }}>{text.length}/2000</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {error && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{error}</span>}
            <button
              onClick={submit}
              disabled={submitting || !text.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: 'none',
                background: text.trim() && !submitting ? '#ef4444' : '#2a2a3e',
                color: text.trim() && !submitting ? '#fff' : '#555',
                fontSize: '0.8rem', fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={12} />
              {submitting ? 'Speichert…' : 'Notiz speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div style={{ color: '#555', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
          Noch keine Notizen für dieses Restaurant.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notes.map(note => {
            const isOwn = note.author_email === currentUserEmail
            const canDelete = canDeleteAll || isOwn
            return (
              <div
                key={note.id}
                style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: note.pinned ? 'rgba(245,158,11,0.07)' : '#1a1a2e',
                  border: `1px solid ${note.pinned ? 'rgba(245,158,11,0.25)' : '#2a2a3e'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {note.pinned && <Pin size={11} color="#f59e0b" />}
                    <span style={{ color: '#888', fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}>
                      {note.author_email}
                    </span>
                    <span style={{ color: '#444', fontSize: '0.68rem' }}>
                      {new Date(note.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => togglePin(note)}
                      title={note.pinned ? 'Entpinnen' : 'Pinnen'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: note.pinned ? '#f59e0b' : '#444' }}
                    >
                      {note.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => deleteNote(note.id)}
                        title="Löschen"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#444' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ color: '#ccc', fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {note.content}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
