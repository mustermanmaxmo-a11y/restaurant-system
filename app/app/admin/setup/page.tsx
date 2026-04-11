'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { generateQrPdf } from '@/lib/qr-pdf'

type Step = 'info' | 'menu' | 'tables' | 'qr' | 'golive'

const STEPS: Step[] = ['info', 'menu', 'tables', 'qr', 'golive']
const STEP_ICONS: Record<Step, string> = {
  info: '🏪',
  menu: '📋',
  tables: '🪑',
  qr: '📱',
  golive: '🚀',
}

interface Category {
  id?: string
  name: string
  items: { id?: string; name: string; price: string }[]
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('info')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  // Menu state
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')

  // Tables state
  const [tableCount, setTableCount] = useState<number>(8)
  const [tablesCreated, setTablesCreated] = useState<number>(0)

  // Go-live summary
  const [summary, setSummary] = useState({ categories: 0, items: 0, tables: 0 })
  const [showConfetti, setShowConfetti] = useState(false)

  // Resume logic
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setUserId(session.user.id)

      const { data: existing } = await supabase
        .from('restaurants')
        .select('id, name, slug, active')
        .eq('owner_id', session.user.id)
        .limit(1)
        .maybeSingle()

      if (existing) {
        setRestaurantId(existing.id)
        setName(existing.name)
        setSlug(existing.slug)

        if (existing.active) { router.push('/admin'); return }

        const { count: menuCount } = await supabase
          .from('menu_items')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', existing.id)
        const { count: tableCountVal } = await supabase
          .from('tables')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', existing.id)

        if ((tableCountVal ?? 0) > 0) setStep('qr')
        else if ((menuCount ?? 0) > 0) setStep('tables')
        else setStep('menu')
      }

      setPageLoading(false)
    })
  }, [router])

  function handleNameChange(val: string) {
    setName(val)
    const autoSlug = val
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(autoSlug)
  }

  // Step 1 — Restaurant Info
  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!userId) return

    // Check for existing restaurant for this user
    const { data: ownExisting } = await supabase
      .from('restaurants')
      .select('id, slug')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle()

    if (ownExisting) {
      // Update existing
      if (ownExisting.slug !== slug) {
        // Check slug uniqueness
        const { data: slugTaken } = await supabase
          .from('restaurants')
          .select('id')
          .eq('slug', slug)
          .neq('id', ownExisting.id)
          .limit(1)

        if (slugTaken && slugTaken.length > 0) {
          setError('Dieser URL-Name ist bereits vergeben. Bitte wähle einen anderen.')
          setLoading(false)
          return
        }
      }

      const { error: updateError } = await supabase
        .from('restaurants')
        .update({ name, slug })
        .eq('id', ownExisting.id)

      if (updateError) {
        setError('Fehler beim Speichern. Bitte versuche es erneut.')
        setLoading(false)
        return
      }
      setRestaurantId(ownExisting.id)
    } else {
      // Check slug uniqueness
      const { data: slugTaken } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .limit(1)

      if (slugTaken && slugTaken.length > 0) {
        setError('Dieser URL-Name ist bereits vergeben. Bitte wähle einen anderen.')
        setLoading(false)
        return
      }

      const { data: inserted, error: insertError } = await supabase
        .from('restaurants')
        .insert({
          owner_id: userId,
          name,
          slug,
          plan: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          active: false,
        })
        .select('id')
        .single()

      if (insertError) {
        setError('Fehler beim Speichern. Bitte versuche es erneut.')
        setLoading(false)
        return
      }
      setRestaurantId(inserted.id)
    }

    setStep('menu')
    setLoading(false)
  }

  // Step 2 — Menu
  function addCategory() {
    if (!newCategoryName.trim()) return
    setCategories(prev => [...prev, { name: newCategoryName.trim(), items: [] }])
    setNewCategoryName('')
  }

  function addItem(catIndex: number) {
    setCategories(prev => {
      const copy = [...prev]
      copy[catIndex] = {
        ...copy[catIndex],
        items: [...copy[catIndex].items, { name: '', price: '' }],
      }
      return copy
    })
  }

  function updateItem(catIndex: number, itemIndex: number, field: 'name' | 'price', value: string) {
    setCategories(prev => {
      const copy = [...prev]
      const items = [...copy[catIndex].items]
      items[itemIndex] = { ...items[itemIndex], [field]: value }
      copy[catIndex] = { ...copy[catIndex], items }
      return copy
    })
  }

  function removeItem(catIndex: number, itemIndex: number) {
    setCategories(prev => {
      const copy = [...prev]
      copy[catIndex] = {
        ...copy[catIndex],
        items: copy[catIndex].items.filter((_, i) => i !== itemIndex),
      }
      return copy
    })
  }

  function removeCategory(catIndex: number) {
    setCategories(prev => prev.filter((_, i) => i !== catIndex))
  }

  const hasMinMenu = categories.length >= 1 && categories.some(c => c.items.some(i => i.name.trim() && i.price.trim()))

  async function handleMenuSubmit() {
    if (!restaurantId || !hasMinMenu) return
    setLoading(true)
    setError('')

    try {
      for (let ci = 0; ci < categories.length; ci++) {
        const cat = categories[ci]
        if (!cat.name.trim()) continue

        const { data: catData, error: catError } = await supabase
          .from('menu_categories')
          .insert({
            restaurant_id: restaurantId,
            name: cat.name,
            sort_order: ci,
          })
          .select('id')
          .single()

        if (catError) throw catError

        const validItems = cat.items.filter(i => i.name.trim() && i.price.trim())
        if (validItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('menu_items')
            .insert(
              validItems.map((item, ii) => ({
                restaurant_id: restaurantId,
                category_id: catData.id,
                name: item.name.trim(),
                price: parseFloat(item.price),
                sort_order: ii,
              }))
            )
          if (itemsError) throw itemsError
        }
      }

      setStep('tables')
    } catch {
      setError('Fehler beim Speichern der Speisekarte.')
    }
    setLoading(false)
  }

  // Step 3 — Tables
  async function handleTablesSubmit() {
    if (!restaurantId || tableCount < 1) return
    setLoading(true)
    setError('')

    try {
      const tables = Array.from({ length: tableCount }, (_, i) => ({
        restaurant_id: restaurantId,
        table_num: i + 1,
        label: `Tisch ${i + 1}`,
      }))

      const { error: insertError } = await supabase
        .from('tables')
        .insert(tables)

      if (insertError) throw insertError

      setTablesCreated(tableCount)
      setStep('qr')
    } catch {
      setError('Fehler beim Erstellen der Tische.')
    }
    setLoading(false)
  }

  // Step 4 — QR Codes
  async function handleDownloadQr() {
    if (!restaurantId) return
    setLoading(true)
    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single()
      const { data: tables } = await supabase
        .from('tables')
        .select('table_num, label, qr_token')
        .eq('restaurant_id', restaurantId)
        .order('table_num')
      if (restaurant && tables) {
        await generateQrPdf({
          restaurantName: restaurant.name,
          logoUrl: restaurant.logo_url,
          tables,
          baseUrl: window.location.origin,
        })
      }
    } catch {
      setError('QR-PDF konnte nicht erstellt werden.')
    }
    setLoading(false)
  }

  // Step 5 — Go-Live
  const loadSummary = useCallback(async () => {
    if (!restaurantId) return
    const { count: catCount } = await supabase
      .from('menu_categories')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
    const { count: itemCount } = await supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
    const { count: tblCount } = await supabase
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
    setSummary({
      categories: catCount ?? 0,
      items: itemCount ?? 0,
      tables: tblCount ?? 0,
    })
  }, [restaurantId])

  useEffect(() => {
    if (step === 'golive') loadSummary()
  }, [step, loadSummary])

  async function handleGoLive() {
    if (!restaurantId) return
    setLoading(true)
    setError('')

    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ active: true })
      .eq('id', restaurantId)

    if (updateError) {
      setError('Fehler beim Aktivieren.')
      setLoading(false)
      return
    }

    setShowConfetti(true)
    setTimeout(() => {
      router.push('/admin')
    }, 2000)
  }

  // Shared styles
  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    borderRadius: '10px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
  }

  const btnDisabled: React.CSSProperties = {
    ...btnPrimary,
    background: 'var(--border)',
    cursor: 'not-allowed',
  }

  const btnSecondary: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  }

  function goBack() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  if (pageLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Laden...</div>
      </div>
    )
  }

  const currentIdx = STEPS.indexOf(step)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg)' }}
    >
      {/* Confetti CSS */}
      {showConfetti && (
        <style>{`
          @keyframes confetti-fall {
            0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          .confetti-piece {
            position: fixed;
            top: 0;
            width: 10px;
            height: 10px;
            animation: confetti-fall 2.5s ease-in forwards;
          }
        `}</style>
      )}
      {showConfetti && Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            background: ['#f44336', '#e91e63', '#9c27b0', '#2196f3', '#4caf50', '#ff9800', '#ffeb3b'][i % 7],
            animationDelay: `${Math.random() * 1}s`,
            borderRadius: i % 3 === 0 ? '50%' : '0',
            width: `${6 + Math.random() * 8}px`,
            height: `${6 + Math.random() * 8}px`,
          }}
        />
      ))}

      <div className="w-full" style={{ maxWidth: '500px' }}>
        {/* Progress Bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                height: '4px',
                flex: 1,
                borderRadius: '2px',
                background: i <= currentIdx ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Step Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{STEP_ICONS[step]}</div>

          {step === 'info' && (
            <>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                Dein Restaurant einrichten
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Diese Infos erscheinen später für deine Gäste.
              </p>
            </>
          )}
          {step === 'menu' && (
            <>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                Speisekarte anlegen
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Erstelle Kategorien und füge Gerichte hinzu.
              </p>
            </>
          )}
          {step === 'tables' && (
            <>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                Tische einrichten
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Wie viele Tische hat dein Restaurant?
              </p>
            </>
          )}
          {step === 'qr' && (
            <>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                QR-Codes
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Lade die QR-Codes als PDF herunter und drucke sie für jeden Tisch aus.
              </p>
            </>
          )}
          {step === 'golive' && (
            <>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                Bereit zum Start!
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Dein Restaurant ist fertig eingerichtet. Aktiviere es jetzt.
              </p>
            </>
          )}
        </div>

        {/* Step Content */}

        {/* Step 1 — Info */}
        {step === 'info' && (
          <form onSubmit={handleInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label htmlFor="name" style={labelStyle}>Restaurant-Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                required
                placeholder="z.B. Trattoria Roma"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="slug" style={labelStyle}>URL-Name</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden' }}>
                <span style={{ padding: '12px 12px 12px 16px', color: 'var(--text-muted)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                  /bestellen/
                </span>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  required
                  placeholder="trattoria-roma"
                  style={{ ...inputStyle, border: 'none', borderRadius: 0, paddingLeft: 0 }}
                />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '6px' }}>
                Dein Bestelllink: restaurantos.de/bestellen/{slug || 'dein-name'}
              </p>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !name || !slug}
              style={loading || !name || !slug ? btnDisabled : btnPrimary}
            >
              {loading ? 'Wird gespeichert...' : 'Weiter'}
            </button>
          </form>
        )}

        {/* Step 2 — Menu */}
        {step === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Add category */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Kategorie-Name (z.B. Vorspeisen)"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={addCategory}
                disabled={!newCategoryName.trim()}
                style={{
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: newCategoryName.trim() ? 'var(--accent)' : 'var(--border)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: newCategoryName.trim() ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                  fontSize: '0.9rem',
                }}
              >
                + Kategorie
              </button>
            </div>

            {/* Categories list */}
            {categories.map((cat, ci) => (
              <div
                key={ci}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>{cat.name}</span>
                  <button
                    onClick={() => removeCategory(ci)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Entfernen
                  </button>
                </div>

                {cat.items.map((item, ii) => (
                  <div key={ii} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Gericht-Name"
                      value={item.name}
                      onChange={e => updateItem(ci, ii, 'name', e.target.value)}
                      style={{ ...inputStyle, flex: 2 }}
                    />
                    <input
                      type="number"
                      placeholder="Preis"
                      value={item.price}
                      onChange={e => updateItem(ci, ii, 'price', e.target.value)}
                      step="0.01"
                      min="0"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => removeItem(ci, ii)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addItem(ci)}
                  style={{
                    background: 'none',
                    border: '1px dashed var(--border)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    width: '100%',
                  }}
                >
                  + Gericht hinzufügen
                </button>
              </div>
            ))}

            {categories.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                Füge mindestens eine Kategorie mit einem Gericht hinzu.
              </p>
            )}

            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
              Du kannst die Speisekarte später jederzeit vervollständigen.
            </p>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={goBack} style={btnSecondary}>
                Zurück
              </button>
              <button
                onClick={handleMenuSubmit}
                disabled={loading || !hasMinMenu}
                style={loading || !hasMinMenu ? { ...btnDisabled, flex: 2 } : { ...btnPrimary, flex: 2 }}
              >
                {loading ? 'Wird gespeichert...' : 'Weiter'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Tables */}
        {step === 'tables' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label htmlFor="tableCount" style={labelStyle}>Anzahl der Tische</label>
              <input
                id="tableCount"
                type="number"
                min={1}
                max={200}
                value={tableCount}
                onChange={e => setTableCount(parseInt(e.target.value) || 1)}
                style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '6px', textAlign: 'center' }}>
                Es werden Tisch 1 bis Tisch {tableCount} erstellt.
              </p>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={goBack} style={btnSecondary}>
                Zurück
              </button>
              <button
                onClick={handleTablesSubmit}
                disabled={loading || tableCount < 1}
                style={loading || tableCount < 1 ? { ...btnDisabled, flex: 2 } : { ...btnPrimary, flex: 2 }}
              >
                {loading ? 'Wird erstellt...' : `${tableCount} Tische erstellen`}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — QR Codes */}
        {step === 'qr' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              background: 'var(--surface)',
              textAlign: 'center',
            }}>
              <p style={{ color: 'var(--text)', fontSize: '0.9rem', marginBottom: '16px' }}>
                Lade ein PDF mit allen QR-Codes herunter. Jeder Tisch bekommt seinen eigenen Code, den du ausdrucken und aufstellen kannst.
              </p>
              <button
                onClick={handleDownloadQr}
                disabled={loading}
                style={loading ? btnDisabled : btnPrimary}
              >
                {loading ? 'Wird generiert...' : 'QR-Codes herunterladen'}
              </button>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={goBack} style={btnSecondary}>
                Zurück
              </button>
              <button
                onClick={() => setStep('golive')}
                style={{ ...btnPrimary, flex: 2 }}
              >
                Weiter
              </button>
            </div>

            <button
              onClick={() => setStep('golive')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                textAlign: 'center',
              }}
            >
              Überspringen
            </button>
          </div>
        )}

        {/* Step 5 — Go-Live */}
        {step === 'golive' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              background: 'var(--surface)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Kategorien</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>{summary.categories}</span>
                </div>
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Gerichte</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>{summary.items}</span>
                </div>
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tische</span>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>{summary.tables}</span>
                </div>
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
              14 Tage kostenlos testen. Keine Kreditkarte nötig.
            </p>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={goBack} style={btnSecondary}>
                Zurück
              </button>
              <button
                onClick={handleGoLive}
                disabled={loading || showConfetti}
                style={loading || showConfetti
                  ? { ...btnDisabled, flex: 2 }
                  : {
                      ...btnPrimary,
                      flex: 2,
                      fontSize: '1.1rem',
                      padding: '16px',
                      background: 'linear-gradient(135deg, var(--accent), #e67e22)',
                    }
                }
              >
                {showConfetti ? 'Aktiviert!' : loading ? 'Wird aktiviert...' : 'Restaurant aktivieren'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
