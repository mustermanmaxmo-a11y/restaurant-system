'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Brain } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { MenuCategory, MenuItem, Restaurant } from '@/types/database'

type ModalType = 'add-category' | 'edit-category' | 'add-item' | 'edit-item' | null

const DIETARY_LABELS = [
  { key: 'vegetarisch', label: '🌱 Vegetarisch' },
  { key: 'vegan', label: '🌿 Vegan' },
  { key: 'glutenfrei', label: '🌾 Glutenfrei' },
  { key: 'laktosefrei', label: '🥛 Laktosefrei' },
  { key: 'scharf', label: '🌶️ Scharf' },
  { key: 'neu', label: '🆕 Neu' },
]

const ALLERGEN_LIST = [
  'Gluten', 'Nüsse', 'Milch', 'Eier', 'Fisch', 'Meeresfrüchte',
  'Soja', 'Sellerie', 'Senf', 'Sesam', 'Lupinen', 'Weichtiere',
]

export default function MenuPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.body.style.overflow = modal ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modal])

  // Category form
  const [catName, setCatName] = useState('')
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null)

  // Item form
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemCategoryId, setItemCategoryId] = useState('')
  const [itemTags, setItemTags] = useState<string[]>([])
  const [itemAllergens, setItemAllergens] = useState<string[]>([])
  const [itemAvailable, setItemAvailable] = useState(true)
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }

      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)

      await loadData(resto.id)
      setLoading(false)
    }
    load()
  }, [router])

  async function loadData(restaurantId: string) {
    const [{ data: cats }, { data: menuItems }] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    ])
    setCategories(cats || [])
    setItems(menuItems || [])
    if (!activeCategory && cats && cats.length > 0) setActiveCategory(cats[0].id)
  }

  function openAddCategory() {
    setCatName('')
    setEditingCat(null)
    setModal('add-category')
  }

  function openEditCategory(cat: MenuCategory) {
    setCatName(cat.name)
    setEditingCat(cat)
    setModal('edit-category')
  }

  function openAddItem(categoryId?: string) {
    setItemName(''); setItemDesc(''); setItemPrice(''); setItemTags([]); setItemAllergens([]); setItemAvailable(true); setItemImageUrl(null)
    setItemCategoryId(categoryId || activeCategory || categories[0]?.id || '')
    setEditingItem(null)
    setModal('add-item')
  }

  function openEditItem(item: MenuItem) {
    setItemName(item.name)
    setItemDesc(item.description || '')
    setItemPrice(item.price.toFixed(2))
    setItemCategoryId(item.category_id)
    setItemTags(item.tags || [])
    setItemAllergens(item.allergens || [])
    setItemAvailable(item.available)
    setItemImageUrl(item.image_url)
    setEditingItem(item)
    setModal('edit-item')
  }

  function toggleTag(key: string) {
    setItemTags(prev => prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key])
  }

  function toggleAllergen(key: string) {
    setItemAllergens(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key])
  }

  async function uploadImage(file: File) {
    if (!restaurant) return
    setImageUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${restaurant.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
      setItemImageUrl(data.publicUrl)
    }
    setImageUploading(false)
  }

  async function saveCategory() {
    if (!restaurant || !catName.trim()) return
    setSaving(true)
    if (editingCat) {
      await supabase.from('menu_categories').update({ name: catName.trim() }).eq('id', editingCat.id)
    } else {
      const maxOrder = Math.max(0, ...categories.map(c => c.sort_order))
      await supabase.from('menu_categories').insert({ restaurant_id: restaurant.id, name: catName.trim(), sort_order: maxOrder + 1, active: true })
    }
    await loadData(restaurant.id)
    setModal(null)
    setSaving(false)
  }

  async function deleteCategory(catId: string) {
    if (!restaurant) return
    if (!confirm('Kategorie und alle darin enthaltenen Items löschen?')) return
    await supabase.from('menu_items').delete().eq('category_id', catId)
    await supabase.from('menu_categories').delete().eq('id', catId)
    await loadData(restaurant.id)
    if (activeCategory === catId) setActiveCategory(categories[0]?.id || null)
  }

  async function saveItem() {
    if (!restaurant || !itemName.trim() || !itemPrice || !itemCategoryId) return
    setSaving(true)
    const price = parseFloat(itemPrice.replace(',', '.'))

    if (editingItem) {
      await supabase.from('menu_items').update({
        name: itemName.trim(), description: itemDesc.trim() || null,
        price, category_id: itemCategoryId, tags: itemTags, allergens: itemAllergens,
        available: itemAvailable, image_url: itemImageUrl,
      }).eq('id', editingItem.id)
    } else {
      const catItems = items.filter(i => i.category_id === itemCategoryId)
      const maxOrder = Math.max(0, ...catItems.map(i => i.sort_order))
      await supabase.from('menu_items').insert({
        restaurant_id: restaurant.id, category_id: itemCategoryId,
        name: itemName.trim(), description: itemDesc.trim() || null,
        price, tags: itemTags, allergens: itemAllergens, available: itemAvailable,
        sort_order: maxOrder + 1, image_url: itemImageUrl,
      })
    }
    await loadData(restaurant.id)
    setModal(null)
    setSaving(false)
  }

  async function toggleItemAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  async function deleteItem(itemId: string) {
    if (!restaurant) return
    if (!confirm('Item löschen?')) return
    await supabase.from('menu_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
    </div>
  )

  const activeCatItems = items.filter(i => i.category_id === activeCategory)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Menü verwalten</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => router.push('/admin/ki-tools?tab=vorbereitung')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--text-muted)', borderRadius: '8px', padding: '7px 14px',
              fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
            }}
          >
            <Brain size={14} />
            Vorbereitungsliste
          </button>
          <button
            onClick={openAddCategory}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            + Kategorie
          </button>
        </div>
      </div>

      <div className="menu-layout" style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>
        {/* Sidebar — Categories */}
        <div className="menu-sidebar" style={{ width: '220px', borderRight: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', flexShrink: 0 }}>
          {categories.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Noch keine Kategorien</p>
            </div>
          ) : (
            categories.map(cat => (
              <div
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`menu-cat-item${activeCategory === cat.id ? ' menu-cat-item-active' : ''}`}
                style={{
                  padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: activeCategory === cat.id ? 'var(--accent-subtle)' : 'transparent',
                  borderLeft: activeCategory === cat.id ? '3px solid var(--accent)' : '3px solid transparent',
                }}
              >
                <span style={{ color: activeCategory === cat.id ? 'var(--accent)' : 'var(--text)', fontWeight: activeCategory === cat.id ? 700 : 400, fontSize: '0.875rem' }}>
                  {cat.name}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>
                    {items.filter(i => i.category_id === cat.id).length}
                  </span>
                </span>
                <button
                  onClick={e => { e.stopPropagation(); openEditCategory(cat) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '2px' }}
                >
                  ✏️
                </button>
              </div>
            ))
          )}
        </div>

        {/* Main — Items */}
        <div className="menu-main" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeCategory ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: 'var(--text)', fontWeight: 700 }}>
                  {categories.find(c => c.id === activeCategory)?.name}
                </h2>
                <button
                  onClick={() => openAddItem(activeCategory)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 16px', color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  + Item hinzufügen
                </button>
              </div>

              {activeCatItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🍽️</div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Noch keine Items in dieser Kategorie</p>
                  <button onClick={() => openAddItem(activeCategory)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                    Erstes Item anlegen
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeCatItems.map(item => (
                    <div key={item.id} className="menu-item-card" style={{ background: 'var(--surface)', borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', opacity: item.available ? 1 : 0.5, gap: '12px' }}>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</span>
                          {item.tags.map(tag => {
                            const dl = DIETARY_LABELS.find(d => d.key === tag)
                            return <span key={tag} style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', fontWeight: 700 }}>{dl ? dl.label : tag}</span>
                          })}
                          {item.allergens?.length > 0 && (
                            <span style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', fontWeight: 600 }}>⚠️ {item.allergens.join(', ')}</span>
                          )}
                        </div>
                        {item.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '2px' }}>{item.description}</p>}
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{item.price.toFixed(2)}€</span>
                      </div>
                      <div className="menu-item-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '16px' }}>
                        <button
                          onClick={() => toggleItemAvailable(item)}
                          style={{ background: item.available ? '#10b98122' : '#ef444422', border: 'none', borderRadius: '6px', padding: '5px 10px', color: item.available ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {item.available ? 'Verfügbar' : 'Aus'}
                        </button>
                        <button onClick={() => openEditItem(item)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>Bearbeiten</button>
                        <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem', cursor: 'pointer', padding: '4px' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📂</div>
              <p style={{ color: 'var(--text-muted)' }}>Erstelle zuerst eine Kategorie</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .menu-layout { flex-direction: column; height: auto; }
          .menu-sidebar {
            width: 100% !important; height: auto !important;
            border-right: none !important; border-bottom: 1px solid var(--border);
            display: flex !important; flex-direction: row;
            overflow-x: auto; overflow-y: hidden;
            scrollbar-width: none; -webkit-overflow-scrolling: touch;
          }
          .menu-sidebar::-webkit-scrollbar { display: none; }
          .menu-cat-item {
            flex-shrink: 0; border-left: none !important;
            border-bottom: 3px solid transparent; white-space: nowrap;
          }
          .menu-cat-item-active { border-bottom: 3px solid var(--accent) !important; }
          .menu-main { padding: 16px !important; }
          .menu-item-card { flex-wrap: wrap; }
          .menu-item-actions { margin-left: 0 !important; flex-wrap: wrap; }
        }
      `}</style>

      {/* Modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}
          onWheel={e => e.stopPropagation()}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            {(modal === 'add-category' || modal === 'edit-category') && (
              <>
                <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>
                  {modal === 'add-category' ? 'Kategorie anlegen' : 'Kategorie bearbeiten'}
                </h3>
                <input
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="z.B. Vorspeisen"
                  autoFocus
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
                />
                {modal === 'edit-category' && editingCat && (
                  <button onClick={() => deleteCategory(editingCat.id)} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '16px', display: 'block' }}>
                    🗑 Kategorie löschen
                  </button>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Abbrechen</button>
                  <button onClick={saveCategory} disabled={saving || !catName.trim()} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? '...' : 'Speichern'}
                  </button>
                </div>
              </>
            )}

            {(modal === 'add-item' || modal === 'edit-item') && (
              <>
                <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>
                  {modal === 'add-item' ? 'Item hinzufügen' : 'Item bearbeiten'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Kategorie</label>
                    <select value={itemCategoryId} onChange={e => setItemCategoryId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none' }}>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Name *</label>
                    <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="z.B. Currywurst" autoFocus style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Beschreibung</label>
                    <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Kurze Beschreibung..." rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Preis (€) *</label>
                    <input value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="4.90" type="text" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Foto</label>
                    {itemImageUrl ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={itemImageUrl} alt="Vorschau" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                        <button
                          onClick={() => setItemImageUrl(null)}
                          style={{ position: 'absolute', top: '6px', right: '6px', background: '#000000aa', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >×</button>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '2px dashed var(--border)', borderRadius: '8px', padding: '20px', cursor: imageUploading ? 'not-allowed' : 'pointer', background: 'var(--bg)' }}>
                        <span style={{ fontSize: '1.5rem' }}>{imageUploading ? '⏳' : '📷'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{imageUploading ? 'Wird hochgeladen...' : 'Foto auswählen'}</span>
                        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={imageUploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }} />
                      </label>
                    )}
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Diät & Merkmale</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {DIETARY_LABELS.map(({ key, label }) => {
                        const active = itemTags.includes(key)
                        return (
                          <button key={key} type="button" onClick={() => toggleTag(key)} style={{
                            padding: '6px 12px', borderRadius: '20px', border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            background: active ? 'var(--accent-subtle)' : 'transparent',
                            color: active ? 'var(--accent)' : 'var(--text-muted)',
                            fontWeight: active ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer',
                          }}>{label}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Allergene</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {ALLERGEN_LIST.map(a => {
                        const active = itemAllergens.includes(a)
                        return (
                          <button key={a} type="button" onClick={() => toggleAllergen(a)} style={{
                            padding: '6px 12px', borderRadius: '20px', border: `1.5px solid ${active ? '#ef4444' : 'var(--border)'}`,
                            background: active ? 'rgba(239,68,68,0.08)' : 'transparent',
                            color: active ? '#ef4444' : 'var(--text-muted)',
                            fontWeight: active ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer',
                          }}>{a}</button>
                        )
                      })}
                    </div>
                    {itemAllergens.length > 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '6px' }}>
                        ⚠️ Enthält: {itemAllergens.join(', ')}
                      </p>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={itemAvailable} onChange={e => setItemAvailable(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    <span style={{ color: 'var(--text)', fontSize: '0.875rem' }}>Verfügbar (im Menü sichtbar)</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Abbrechen</button>
                  <button onClick={saveItem} disabled={saving || !itemName.trim() || !itemPrice} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? '...' : 'Speichern'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
