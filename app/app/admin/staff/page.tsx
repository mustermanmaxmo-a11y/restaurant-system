'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Staff, Restaurant, RestaurantPlan } from '@/types/database'
import { getPlanLimits } from '@/lib/plan-limits'
import { useLanguage } from '@/components/providers/language-provider'
import { ChefHat, Car, BellRing, Trash2, Lightbulb } from 'lucide-react'
import ShiftPlanning from './_components/ShiftPlanning'

export default function StaffPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [role, setRole] = useState<'kitchen' | 'waiter' | 'delivery'>('kitchen')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'staff' | 'planning'>('staff')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      await loadStaff(resto.id)
      setLoading(false)
    }
    load()
  }, [router])

  async function loadStaff(restaurantId: string) {
    const { data } = await supabase.from('staff').select('*').eq('restaurant_id', restaurantId).order('created_at')
    setStaffList((data as Staff[]) || [])
  }

  function openAdd() {
    setName(''); setCode(''); setRole('kitchen'); setEditingStaff(null)
    setShowModal(true)
  }

  function openEdit(staff: Staff) {
    setName(staff.name); setCode(staff.code); setRole(staff.role); setEditingStaff(staff)
    setShowModal(true)
  }

  async function save() {
    if (!restaurant || !name.trim() || !code.trim()) return
    setSaving(true)
    if (editingStaff) {
      await supabase.from('staff').update({ name: name.trim(), code: code.trim(), role }).eq('id', editingStaff.id)
    } else {
      const limits = getPlanLimits((restaurant.plan ?? 'starter') as RestaurantPlan)
      if (staffList.length >= limits.maxStaff) {
        alert(`Dein Plan erlaubt maximal ${limits.maxStaff} Mitarbeiter. Upgrade auf Professional für unbegrenzte Mitarbeiter.`)
        setSaving(false)
        return
      }
      await supabase.from('staff').insert({ restaurant_id: restaurant.id, name: name.trim(), code: code.trim(), role, active: true })
    }
    await loadStaff(restaurant.id)
    setShowModal(false)
    setSaving(false)
  }

  async function toggleActive(staff: Staff) {
    await supabase.from('staff').update({ active: !staff.active }).eq('id', staff.id)
    setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, active: !s.active } : s))
  }

  async function deleteStaff(staffId: string) {
    if (!confirm('Mitarbeiter löschen?')) return
    await supabase.from('staff').delete().eq('id', staffId)
    setStaffList(prev => prev.filter(s => s.id !== staffId))
  }

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
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Staff verwalten</h1>
        </div>
        <button
          onClick={openAdd}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 16px', color: 'var(--accent-text)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
        >
          + Mitarbeiter
        </button>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '0', borderBottom: '1px solid var(--border)', padding: '0 24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as never, scrollbarWidth: 'none' as never, msOverflowStyle: 'none' as never }}>
        {(['staff', 'planning'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px', borderRadius: '8px 8px 0 0', border: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              background: activeTab === tab ? 'var(--accent)' : 'transparent',
              color: activeTab === tab ? 'var(--accent-text)' : 'var(--text-muted)',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              marginBottom: '-1px',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {tab === 'staff' ? 'Mitarbeiter' : 'Schichtplanung'}
          </button>
        ))}
      </div>

      {activeTab === 'staff' && (
      <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
        {staffList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><ChefHat size={48} color="var(--text-muted)" /></div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Noch kein Staff angelegt</p>
            <button onClick={openAdd} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px 24px', color: 'var(--accent-text)', fontWeight: 600, cursor: 'pointer' }}>
              Ersten Mitarbeiter anlegen
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {staffList.map(staff => (
              <div key={staff.id} style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', opacity: staff.active ? 1 : 0.5, flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: staff.role === 'kitchen' ? '#ff6b3522' : staff.role === 'delivery' ? '#f59e0b22' : '#6c63ff22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {staff.role === 'kitchen' ? <ChefHat size={20} color="#ff6b35" /> : staff.role === 'delivery' ? <Car size={20} color="#f59e0b" /> : <BellRing size={20} color="#6c63ff" />}
                  </div>
                  <div>
                    <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '2px' }}>{staff.name}</p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {staff.role === 'kitchen' ? 'Küche' : staff.role === 'delivery' ? 'Lieferant' : 'Service'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>·</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>PIN: {staff.code}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={() => toggleActive(staff)}
                    style={{ background: staff.active ? '#10b98122' : '#ef444422', border: 'none', borderRadius: '6px', padding: '5px 10px', color: staff.active ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {staff.active ? 'Aktiv' : 'Inaktiv'}
                  </button>
                  <button onClick={() => openEdit(staff)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>{t('common.edit')}</button>
                  <button onClick={() => deleteStaff(staff.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        {staffList.length > 0 && (
          <div style={{ marginTop: '24px', background: 'var(--surface)', borderRadius: '10px', padding: '16px 18px', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Lightbulb size={15} color="var(--accent)" /> So loggt sich dein Team ein</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
              Gerät öffnet: <strong style={{ color: 'var(--accent)' }}>/staff</strong><br />
              Restaurant-ID: <strong style={{ color: 'var(--text)' }}>{restaurant?.slug}</strong><br />
              PIN: individuell pro Mitarbeiter (oben sichtbar)
            </p>
          </div>
        )}
      </div>
      )}

      {activeTab === 'planning' && restaurant && (
        (restaurant.plan === 'pro' || restaurant.plan === 'enterprise' || restaurant.plan === 'trial')
          ? <ShiftPlanning restaurantId={restaurant.id} />
          : (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '16px', padding: '40px', textAlign: 'center',
              maxWidth: '700px', margin: '24px auto',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                KI-Schichtplanung ist ab dem Pro-Plan verfügbar.
              </p>
            </div>
          )
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px', border: '1px solid var(--border)' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>
              {editingStaff ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Maria Schmidt" autoFocus style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>PIN-Code *</label>
                <input value={code} onChange={e => setCode(e.target.value)} placeholder="z.B. 4821" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.1em' }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Rolle</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {(['kitchen', 'waiter', 'delivery'] as const).map(r => (
                    <button key={r} onClick={() => setRole(r)} style={{ padding: '12px', borderRadius: '8px', border: '2px solid', borderColor: role === r ? 'var(--accent)' : 'var(--border)', background: role === r ? 'var(--accent-subtle)' : 'transparent', color: role === r ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                      {r === 'kitchen' ? <><ChefHat size={13} /> Küche</> : r === 'delivery' ? <><Car size={13} /> Lieferant</> : <><BellRing size={13} /> Service</>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={save} disabled={saving || !name.trim() || !code.trim()} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? '...' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
