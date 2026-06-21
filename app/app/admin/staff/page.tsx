'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Staff, Restaurant, RestaurantPlan } from '@/types/database'
import { getPlanLimits } from '@/lib/plan-limits'
import { useLanguage } from '@/components/providers/language-provider'
import { ChefHat, Car, BellRing, Trash2, Lightbulb, Users, Plus } from 'lucide-react'
import ShiftPlanning from './_components/ShiftPlanning'

const ROLE_META = {
  kitchen:  { label: 'Küche',     icon: ChefHat,   color: '#FF6B2C', bg: '#FF6B2C18' },
  delivery: { label: 'Lieferant', icon: Car,        color: '#f59e0b', bg: '#f59e0b18' },
  waiter:   { label: 'Service',   icon: BellRing,   color: '#8b5cf6', bg: '#8b5cf618' },
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

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
        alert(`Dein Plan erlaubt maximal ${limits.maxStaff} Mitarbeiter.`)
        setSaving(false); return
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
      {/* Page header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
        flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#34d39918', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={18} color="#34d399" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>Team</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>{staffList.length} Mitarbeiter</p>
          </div>
        </div>
        <button onClick={openAdd} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'var(--accent)', border: 'none', borderRadius: '9px',
          padding: '8px 14px', color: 'var(--accent-text)',
          fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
        }}>
          <Plus size={14} /> Mitarbeiter
        </button>
      </div>

      {/* Tab navigation */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', padding: '0 20px', overflowX: 'auto',
      }}>
        {(['staff', 'planning'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', borderRadius: '0', border: 'none',
            whiteSpace: 'nowrap', flexShrink: 0,
            background: 'transparent',
            color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: activeTab === tab ? 700 : 400,
            cursor: 'pointer', fontSize: '0.85rem',
            borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
          }}>
            {tab === 'staff' ? 'Mitarbeiter' : 'Schichtplanung'}
          </button>
        ))}
      </div>

      {activeTab === 'staff' && (
        <div style={{ padding: '16px 20px 40px', maxWidth: '720px', margin: '0 auto' }}>
          {staffList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#34d39918', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Users size={28} color="#34d399" />
              </div>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '6px' }}>Noch kein Team angelegt</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Füge Mitarbeiter hinzu damit sie sich einloggen können.</p>
              <button onClick={openAdd} style={{ background: 'var(--accent)', border: 'none', borderRadius: '9px', padding: '10px 24px', color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer' }}>
                Ersten Mitarbeiter anlegen
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {staffList.map(staff => {
                const meta = ROLE_META[staff.role] ?? ROLE_META.waiter
                const Icon = meta.icon
                return (
                  <div key={staff.id} style={{
                    background: 'var(--surface)', borderRadius: '12px',
                    padding: '14px 16px',
                    border: '1px solid var(--border)',
                    opacity: staff.active ? 1 : 0.55,
                    display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                      background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.82rem', fontWeight: 800, color: meta.color,
                    }}>
                      {getInitials(staff.name) || <Icon size={18} color={meta.color} />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '3px', fontSize: '0.9rem' }}>{staff.name}</p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{
                          background: meta.bg, color: meta.color,
                          fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                        }}>
                          {meta.label}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace' }}>PIN: {staff.code}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={() => toggleActive(staff)} style={{
                        background: staff.active ? '#10b98118' : '#ef444418',
                        border: 'none', borderRadius: '20px', padding: '4px 10px',
                        color: staff.active ? '#10b981' : '#ef4444',
                        fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                      }}>
                        {staff.active ? 'Aktiv' : 'Inaktiv'}
                      </button>
                      <button onClick={() => openEdit(staff)} style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: '7px',
                        padding: '5px 10px', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer',
                      }}>{t('common.edit')}</button>
                      <button onClick={() => deleteStaff(staff.id)} style={{
                        background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                        padding: '4px', display: 'flex', alignItems: 'center',
                      }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Login info */}
          {staffList.length > 0 && (
            <div style={{ marginTop: '24px', background: 'var(--surface)', borderRadius: '12px', padding: '16px 18px', border: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lightbulb size={15} color="var(--accent)" /> Login für dein Team
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                URL: <strong style={{ color: 'var(--accent)' }}>/staff</strong><br />
                Restaurant-ID: <strong style={{ color: 'var(--text)' }}>{restaurant?.slug}</strong><br />
                PIN: individuell pro Mitarbeiter
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
              borderRadius: '14px', padding: '40px', textAlign: 'center',
              maxWidth: '600px', margin: '24px auto',
            }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>KI-Schichtplanung ist ab dem Pro-Plan verfügbar.</p>
            </div>
          )
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px', border: '1px solid var(--border)' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 800, marginBottom: '20px', fontSize: '1rem' }}>
              {editingStaff ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Maria Schmidt" autoFocus
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PIN-Code *</label>
                <input value={code} onChange={e => setCode(e.target.value)} placeholder="z.B. 4821"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.15em' }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rolle</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px' }}>
                  {(['kitchen', 'waiter', 'delivery'] as const).map(r => {
                    const m = ROLE_META[r]
                    const Icon = m.icon
                    return (
                      <button key={r} onClick={() => setRole(r)} style={{
                        padding: '10px 8px', borderRadius: '9px', border: '2px solid',
                        borderColor: role === r ? m.color : 'var(--border)',
                        background: role === r ? m.bg : 'transparent',
                        color: role === r ? m.color : 'var(--text-muted)',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      }}>
                        <Icon size={16} />
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>{t('common.cancel')}</button>
              <button onClick={save} disabled={saving || !name.trim() || !code.trim()} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: (!name.trim() || !code.trim()) ? 0.5 : 1 }}>
                {saving ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
