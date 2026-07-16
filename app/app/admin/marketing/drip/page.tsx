'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type DripStep = {
  id: string
  sequence_id: string
  position: number
  delay_days: number
  subject: string
  headline: string
  body_text: string
  discount_type: 'percent' | 'fixed' | null
  discount_value: number | null
  expires_days: number
}

type DripSequence = {
  id: string
  name: string
  trigger_days: number
  enabled: boolean
  created_at: string
  drip_steps: DripStep[]
}

type StepForm = {
  position: number
  delay_days: string
  subject: string
  headline: string
  body_text: string
  discount_type: 'percent' | 'fixed' | ''
  discount_value: string
  expires_days: string
}

const EMPTY_STEP: StepForm = {
  position: 1, delay_days: '7', subject: '', headline: '', body_text: '',
  discount_type: '', discount_value: '', expires_days: '7',
}

export default function DripDashboard() {
  const router = useRouter()
  const [sequences, setSequences] = useState<DripSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)

  const [showNewSeq, setShowNewSeq] = useState(false)
  const [seqName, setSeqName] = useState('Win-Back Drip')
  const [seqTrigger, setSeqTrigger] = useState('14')
  const [savingSeq, setSavingSeq] = useState(false)

  const [editingStep, setEditingStep] = useState<{ sequenceId: string; step: DripStep | null } | null>(null)
  const [stepForm, setStepForm] = useState<StepForm>(EMPTY_STEP)
  const [savingStep, setSavingStep] = useState(false)

  const [showAi, setShowAi] = useState(false)
  const [aiDesc, setAiDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setToken(session.access_token)
    })
  }, [router])

  const load = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/admin/drip/sequences', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    setSequences(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function createSequence() {
    if (!token) return
    setSavingSeq(true)
    await fetch('/api/admin/drip/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: seqName, trigger_days: parseInt(seqTrigger) || 14 }),
    })
    setShowNewSeq(false)
    setSeqName('Win-Back Drip')
    setSeqTrigger('14')
    await load()
    setSavingSeq(false)
  }

  async function toggleSequence(seq: DripSequence) {
    if (!token) return
    await fetch('/api/admin/drip/sequences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: seq.id, enabled: !seq.enabled }),
    })
    await load()
  }

  async function deleteSequence(id: string) {
    if (!token || !confirm('Sequenz und alle Steps löschen?')) return
    await fetch('/api/admin/drip/sequences', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  function openNewStep(sequenceId: string) {
    const seq = sequences.find(s => s.id === sequenceId)
    const nextPos = (seq?.drip_steps?.length ?? 0) + 1
    setStepForm({ ...EMPTY_STEP, position: nextPos, delay_days: nextPos === 1 ? '0' : '7' })
    setEditingStep({ sequenceId, step: null })
  }

  function openEditStep(sequenceId: string, step: DripStep) {
    setStepForm({
      position: step.position,
      delay_days: String(step.delay_days),
      subject: step.subject,
      headline: step.headline,
      body_text: step.body_text,
      discount_type: step.discount_type ?? '',
      discount_value: step.discount_value != null ? String(step.discount_value) : '',
      expires_days: String(step.expires_days),
    })
    setEditingStep({ sequenceId, step })
  }

  async function saveStep() {
    if (!token || !editingStep) return
    setSavingStep(true)
    const body = {
      sequence_id: editingStep.sequenceId,
      position: stepForm.position,
      delay_days: parseInt(stepForm.delay_days) || 7,
      subject: stepForm.subject,
      headline: stepForm.headline,
      body_text: stepForm.body_text,
      discount_type: stepForm.discount_type || null,
      discount_value: stepForm.discount_value ? parseFloat(stepForm.discount_value) : null,
      expires_days: parseInt(stepForm.expires_days) || 7,
    }

    if (editingStep.step) {
      await fetch('/api/admin/drip/steps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editingStep.step.id, ...body }),
      })
    } else {
      await fetch('/api/admin/drip/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
    }
    setEditingStep(null)
    await load()
    setSavingStep(false)
  }

  async function deleteStep(stepId: string) {
    if (!token || !confirm('Step löschen?')) return
    await fetch('/api/admin/drip/steps', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: stepId }),
    })
    await load()
  }

  async function moveStep(step: DripStep, direction: 'up' | 'down', steps: DripStep[]) {
    if (!token) return
    const sorted = [...steps].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(s => s.id === step.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    await Promise.all([
      fetch('/api/admin/drip/steps', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: step.id, position: other.position }) }),
      fetch('/api/admin/drip/steps', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: other.id, position: step.position }) }),
    ])
    await load()
  }

  async function generateWithAi() {
    if (!token || !aiDesc.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/ai/create-drip-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: aiDesc }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'Fehler'); setAiLoading(false); return }

      await fetch('/api/admin/drip/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: data.sequence.name, trigger_days: data.sequence.trigger_days, steps: data.sequence.steps }),
      })
      setShowAi(false)
      setAiDesc('')
      await load()
    } catch {
      setAiError('Generierung fehlgeschlagen.')
    }
    setAiLoading(false)
  }

  if (loading && token) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Lade…</div>

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>Win-Back Drip</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
            Automatische Email-Serie für inaktive Gäste
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowAi(true)} style={btnSecondary}>Mit KI</button>
          <button onClick={() => setShowNewSeq(true)} style={btnPrimary}>+ Neue Sequenz</button>
        </div>
      </div>

      {sequences.length === 0 && !loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          Noch keine Sequenz. Erstelle deine erste Win-Back Serie!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sequences.map(seq => {
            const sortedSteps = [...(seq.drip_steps ?? [])].sort((a, b) => a.position - b.position)
            return (
              <div key={seq.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <p style={{ color: 'var(--text)', fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>{seq.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>
                      Startet nach {seq.trigger_days} Tagen Inaktivität · {sortedSteps.length} Step{sortedSteps.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => toggleSequence(seq)} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: seq.enabled ? '#16a34a20' : 'transparent', color: seq.enabled ? '#16a34a' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                      {seq.enabled ? 'Aktiv' : 'Inaktiv'}
                    </button>
                    <button onClick={() => deleteSequence(seq.id)} aria-label="Sequenz löschen" style={{ display: 'inline-flex', alignItems: 'center', padding: '6px', borderRadius: '8px', border: 'none', background: '#ef444415', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={15} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sortedSteps.map((step, idx) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--surface-2, #1a1a2a)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, minWidth: '50px' }}>
                        {idx === 0 ? 'Tag 0' : `+${step.delay_days}T`}
                      </span>
                      <span style={{ color: 'var(--text)', fontSize: '0.82rem', flex: 1 }}>{step.subject}</span>
                      {step.discount_value && (
                        <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>
                          {step.discount_value}{step.discount_type === 'percent' ? '%' : '€'}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => moveStep(step, 'up', sortedSteps)} disabled={idx === 0} style={iconBtn}>↑</button>
                        <button onClick={() => moveStep(step, 'down', sortedSteps)} disabled={idx === sortedSteps.length - 1} style={iconBtn}>↓</button>
                        <button onClick={() => openEditStep(seq.id, step)} aria-label="Schritt bearbeiten" style={iconBtn}><Pencil size={13} /></button>
                        <button onClick={() => deleteStep(step.id)} style={{ ...iconBtn, color: '#ef4444' }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => openNewStep(seq.id)} style={{ marginTop: '4px', padding: '6px', borderRadius: '8px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>
                    + Step hinzufügen
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNewSeq && (
        <Modal onClose={() => setShowNewSeq(false)} title="Neue Sequenz">
          <label style={labelStyle}>Name</label>
          <input value={seqName} onChange={e => setSeqName(e.target.value)} style={inputStyle} />
          <label style={labelStyle}>Starten nach (Tage Inaktivität)</label>
          <input type="number" min={1} value={seqTrigger} onChange={e => setSeqTrigger(e.target.value)} style={inputStyle} />
          <button onClick={createSequence} disabled={savingSeq || !seqName.trim()} style={{ ...btnPrimary, width: '100%', marginTop: '16px' }}>
            {savingSeq ? 'Speichert…' : 'Sequenz erstellen'}
          </button>
        </Modal>
      )}

      {editingStep && (
        <Modal onClose={() => setEditingStep(null)} title={editingStep.step ? 'Step bearbeiten' : 'Neuer Step'}>
          <label style={labelStyle}>Delay (Tage nach vorherigem Step)</label>
          <input type="number" min={0} value={stepForm.delay_days} onChange={e => setStepForm(f => ({ ...f, delay_days: e.target.value }))} style={inputStyle} />
          <label style={labelStyle}>Betreff</label>
          <input value={stepForm.subject} onChange={e => setStepForm(f => ({ ...f, subject: e.target.value }))} placeholder="Wir vermissen dich" style={inputStyle} />
          <label style={labelStyle}>Headline</label>
          <input value={stepForm.headline} onChange={e => setStepForm(f => ({ ...f, headline: e.target.value }))} placeholder="Schön, dich wiederzusehen" style={inputStyle} />
          <label style={labelStyle}>Text</label>
          <textarea value={stepForm.body_text} onChange={e => setStepForm(f => ({ ...f, body_text: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
          <label style={labelStyle}>Rabatt (optional)</label>
          <select value={stepForm.discount_type} onChange={e => setStepForm(f => ({ ...f, discount_type: e.target.value as StepForm['discount_type'] }))} style={inputStyle}>
            <option value="">Kein Rabatt</option>
            <option value="percent">Prozent (%)</option>
            <option value="fixed">Fixer Betrag (€)</option>
          </select>
          {stepForm.discount_type && (
            <>
              <label style={labelStyle}>Wert</label>
              <input type="number" min={0} value={stepForm.discount_value} onChange={e => setStepForm(f => ({ ...f, discount_value: e.target.value }))} style={inputStyle} />
              <label style={labelStyle}>Gültig (Tage)</label>
              <input type="number" min={1} value={stepForm.expires_days} onChange={e => setStepForm(f => ({ ...f, expires_days: e.target.value }))} style={inputStyle} />
            </>
          )}
          <button onClick={saveStep} disabled={savingStep || !stepForm.subject.trim() || !stepForm.headline.trim() || !stepForm.body_text.trim()} style={{ ...btnPrimary, width: '100%', marginTop: '16px' }}>
            {savingStep ? 'Speichert…' : 'Speichern'}
          </button>
        </Modal>
      )}

      {showAi && (
        <Modal onClose={() => { setShowAi(false); setAiDesc(''); setAiError('') }} title="Mit KI generieren">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
            Beschreibe dein Ziel — die KI erstellt alle Steps automatisch.
          </p>
          <textarea value={aiDesc} onChange={e => setAiDesc(e.target.value)} placeholder="z.B. 3-stufige Drip-Sequenz für Gäste die 2 Wochen nicht bestellt haben, mit kleinen Rabatten die größer werden" rows={4} style={{ ...inputStyle, resize: 'vertical' as const }} />
          {aiError && <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '8px' }}>{aiError}</p>}
          <button onClick={generateWithAi} disabled={aiLoading || !aiDesc.trim()} style={{ ...btnPrimary, width: '100%', marginTop: '14px' }}>
            {aiLoading ? 'Generiert…' : 'Sequenz generieren'}
          </button>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = { padding: '10px 18px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }
const iconBtn: React.CSSProperties = { padding: '3px 6px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }
const labelStyle: React.CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2, #1a1a2a)', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }
