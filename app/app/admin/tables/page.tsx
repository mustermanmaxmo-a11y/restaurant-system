'use client'

import { useState, useEffect, useCallback } from 'react'
import { generateQrPdf } from '@/lib/qr-pdf'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Table, Restaurant, RestaurantPlan } from '@/types/database'
import { getPlanLimits } from '@/lib/plan-limits'
import FloorPlanEditor from '@/components/FloorPlanEditor'
import { useLanguage } from '@/components/providers/language-provider'

export default function TablesPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [tableNum, setTableNum] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [tableLabel, setTableLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrModal, setQrModal] = useState<Table | null>(null)
  const [adminTab, setAdminTab] = useState<'tables' | 'floorplan'>('tables')
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      await loadTables(resto.id)
      setLoading(false)
    }
    load()
  }, [router])

  async function loadTables(restaurantId: string) {
    const { data } = await supabase.from('tables').select('*').eq('restaurant_id', restaurantId).order('table_num')
    setTables((data as Table[]) || [])
  }

  async function addTable() {
    if (!restaurant || !tableNum) return
    setSaving(true)
    const limits = getPlanLimits((restaurant.plan ?? 'starter') as RestaurantPlan)
    if (tables.length >= limits.maxTables) {
      alert(`Dein Plan erlaubt maximal ${limits.maxTables} Tische. Upgrade auf Professional für unbegrenzte Tische.`)
      setSaving(false)
      return
    }
    const num = parseInt(tableNum)
    await supabase.from('tables').insert({
      restaurant_id: restaurant.id,
      table_num: num,
      label: tableLabel.trim() || `Tisch ${num}`,
      active: true,
    })
    await loadTables(restaurant.id)
    setTableNum('')
    setTableLabel('')
    setShowModal(false)
    setSaving(false)
  }

  async function toggleTable(table: Table) {
    await supabase.from('tables').update({ active: !table.active }).eq('id', table.id)
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, active: !t.active } : t))
  }

  async function deleteTable(tableId: string) {
    if (!confirm('Tisch löschen?')) return
    await supabase.from('tables').delete().eq('id', tableId)
    setTables(prev => prev.filter(t => t.id !== tableId))
  }

  async function downloadAllQrCodes() {
    if (!restaurant || tables.length === 0) return
    setGeneratingPdf(true)
    try {
      await generateQrPdf({
        restaurantName: restaurant.name,
        logoUrl: restaurant.logo_url,
        tables: tables.filter(t => t.active),
        baseUrl: window.location.origin,
      })
    } catch (err) {
      console.error('PDF generation failed:', err)
    }
    setGeneratingPdf(false)
  }

  function getQrUrl(table: Table) {
    return `${window.location.origin}/order/${table.qr_token}`
  }

  const copyUrl = useCallback((table: Table) => {
    navigator.clipboard.writeText(getQrUrl(table))
    setCopiedId(table.id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Tische & QR-Codes</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tables.length > 0 && adminTab === 'tables' && (
            <button
              onClick={downloadAllQrCodes}
              disabled={generatingPdf}
              style={{
                background: 'transparent',
                border: '1.5px solid var(--accent)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: 'var(--accent)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: generatingPdf ? 'wait' : 'pointer',
                opacity: generatingPdf ? 0.6 : 1,
              }}
            >
              {generatingPdf ? 'Generiere PDF...' : 'QR-Codes PDF'}
            </button>
          )}
          {adminTab === 'tables' && (
            <button
              onClick={() => setShowModal(true)}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              + Tisch anlegen
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', padding: '0 24px' }}>
        {([['tables', '🪑 Tische'], ['floorplan', '🗺️ Grundriss']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setAdminTab(tab)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              color: adminTab === tab ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: adminTab === tab ? 700 : 400,
              cursor: 'pointer', fontSize: '0.875rem',
              borderBottom: adminTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >{label}</button>
        ))}
      </div>

      {adminTab === 'floorplan' && restaurant && (
        <FloorPlanEditor
          restaurant={restaurant}
          tables={tables}
          onTablesUpdate={() => loadTables(restaurant.id)}
        />
      )}

      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', display: adminTab === 'floorplan' ? 'none' : undefined }}>
        {tables.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🪑</div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Noch keine Tische angelegt</p>
            <button onClick={() => setShowModal(true)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px 24px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              Ersten Tisch anlegen
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
            {tables.map(table => (
              <div key={table.id} style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', opacity: table.active ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>{table.label}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>#{table.table_num}</p>
                  </div>
                  <button
                    onClick={() => toggleTable(table)}
                    style={{ background: table.active ? '#10b98122' : '#ef444422', border: 'none', borderRadius: '6px', padding: '4px 10px', color: table.active ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {table.active ? 'Aktiv' : 'Aus'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => setQrModal(table)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    QR-Code anzeigen
                  </button>
                  <button
                    onClick={() => copyUrl(table)}
                    style={{
                      width: '100%', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer',
                      border: `1px solid ${copiedId === table.id ? '#10b98144' : 'var(--border)'}`,
                      background: copiedId === table.id ? '#10b98112' : 'transparent',
                      color: copiedId === table.id ? '#10b981' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {copiedId === table.id ? '✓ Kopiert!' : 'Link kopieren'}
                  </button>
                  <button
                    onClick={() => deleteTable(table.id)}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Table Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '360px', border: '1px solid var(--border)' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>Tisch anlegen</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Tischnummer *</label>
                <input
                  value={tableNum}
                  onChange={e => setTableNum(e.target.value)}
                  placeholder="z.B. 5"
                  type="number"
                  autoFocus
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Label (optional)</label>
                <input
                  value={tableLabel}
                  onChange={e => setTableLabel(e.target.value)}
                  placeholder="z.B. Terrasse Tisch 5"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={addTable} disabled={saving || !tableNum} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? '...' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>{qrModal.label}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '24px' }}>Scanne diesen QR-Code am Tisch</p>

            {/* QR Code via API */}
            <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', display: 'inline-block', marginBottom: '20px' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getQrUrl(qrModal))}`}
                alt="QR Code"
                width={200}
                height={200}
              />
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', wordBreak: 'break-all' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{getQrUrl(qrModal)}</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => copyUrl(qrModal)} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', border: `1px solid ${copiedId === qrModal.id ? '#10b98144' : 'var(--border)'}`, background: copiedId === qrModal.id ? '#10b98112' : 'transparent', color: copiedId === qrModal.id ? '#10b981' : 'var(--text)' }}>{copiedId === qrModal.id ? '✓ Kopiert!' : 'Link kopieren'}</button>
              <button onClick={() => setQrModal(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
