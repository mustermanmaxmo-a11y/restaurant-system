'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Sparkles, LogOut, X } from 'lucide-react'

interface Props {
  restaurantId: string
  staffId: string
  staffName: string
  onConfirm: () => void
  onCancel: () => void
}

type Step = 'input' | 'loading' | 'done'

export default function ShiftHandoverModal({ restaurantId, staffId, staffName, onConfirm, onCancel }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [notes, setNotes] = useState('')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [hasSpeechApi, setHasSpeechApi] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    setHasSpeechApi('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  function toggleMic() {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'de-DE'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        }
      }
      if (final) setNotes(prev => prev + final)
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.start()
    setIsListening(true)
  }

  async function handleGenerate() {
    if (!notes.trim()) { setError('Bitte zuerst Notizen eingeben.'); return }
    setError('')
    setStep('loading')

    try {
      const res = await fetch('/api/ai/shift-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, staffId, staffName, notes }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler')
        setStep('input')
        return
      }
      setSummary(json.summary)
      setStep('done')
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.')
      setStep('input')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: '480px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(108,99,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Sparkles size={18} color="#6c63ff" />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', margin: 0 }}>Schichtübergabe</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: 0 }}>{staffName}</p>
            </div>
          </div>
          {step !== 'loading' && (
            <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '4px' }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Step: Input */}
        {step === 'input' && (
          <>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginBottom: '12px' }}>
              Was soll die nächste Schicht wissen?
            </p>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <textarea
                value={notes}
                onChange={e => { setNotes(e.target.value); setError('') }}
                placeholder="z.B. Tisch 4 hat noch offene Bestellung, Kühlschrank aufgefüllt, Stammgast an Tisch 7 ..."
                rows={5}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px', paddingRight: hasSpeechApi ? '48px' : '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff', fontSize: '0.875rem',
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />
              {hasSpeechApi && (
                <button
                  onClick={toggleMic}
                  title={isListening ? 'Mikrofon stoppen' : 'Sprechen (Chrome/Edge)'}
                  style={{
                    position: 'absolute', right: '10px', top: '10px',
                    width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                    background: isListening ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                    color: isListening ? '#ef4444' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}
            </div>

            {isListening && (
              <p style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                Mikrofon aktiv — tippe zum Stoppen
              </p>
            )}

            {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '10px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onCancel}
                style={{
                  flex: 1, padding: '11px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleGenerate}
                disabled={!notes.trim()}
                style={{
                  flex: 2, padding: '11px', borderRadius: '10px',
                  border: 'none', background: '#6c63ff', color: '#fff',
                  fontSize: '0.875rem', fontWeight: 700,
                  cursor: notes.trim() ? 'pointer' : 'not-allowed',
                  opacity: notes.trim() ? 1 : 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <Sparkles size={15} />
                KI-Zusammenfassung erstellen
              </button>
            </div>
          </>
        )}

        {/* Step: Loading */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              border: '3px solid rgba(108,99,255,0.2)',
              borderTopColor: '#6c63ff',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>KI erstellt Zusammenfassung...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <>
            <div style={{
              background: 'rgba(108,99,255,0.08)',
              border: '1px solid rgba(108,99,255,0.2)',
              borderRadius: '10px', padding: '16px', marginBottom: '16px',
            }}>
              <p style={{ color: '#6c63ff', fontWeight: 600, fontSize: '0.78rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sparkles size={13} /> KI-Zusammenfassung
              </p>
              <p style={{ color: '#fff', fontSize: '0.875rem', whiteSpace: 'pre-line', lineHeight: 1.6, margin: 0 }}>
                {summary}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep('input')}
                style={{
                  flex: 1, padding: '11px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Bearbeiten
              </button>
              <button
                onClick={onConfirm}
                style={{
                  flex: 2, padding: '11px', borderRadius: '10px',
                  border: 'none', background: '#ef4444', color: '#fff',
                  fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <LogOut size={15} />
                Schicht beenden
              </button>
            </div>
          </>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}
