'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { MenuCategory, MenuItem, Restaurant, ExtractedMenuItem } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { Pencil, FolderOpen, Trash2, Globe, AlertTriangle, UtensilsCrossed, Camera, Loader2, Sparkles, Upload, FileText, BarChart2 } from 'lucide-react'
import ProfitabilityPanel from './_components/ProfitabilityPanel'
import SocialPostGenerator from '@/components/admin/SocialPostGenerator'

type ModalType = 'add-category' | 'edit-category' | 'add-item' | 'edit-item' | 'ai-import' | null
type AiPhase = 'upload' | 'extracting' | 'review'

const DIETARY_LABELS = [
  { key: 'vegetarisch', label: 'Vegetarisch' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'glutenfrei', label: 'Glutenfrei' },
  { key: 'laktosefrei', label: 'Laktosefrei' },
  { key: 'scharf', label: 'Scharf' },
  { key: 'neu', label: 'Neu' },
]

const ALLERGEN_LIST = [
  'Gluten', 'Nüsse', 'Milch', 'Eier', 'Fisch', 'Meeresfrüchte',
  'Soja', 'Sellerie', 'Senf', 'Sesam', 'Lupinen', 'Weichtiere',
]

export default function MenuPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalType>(null)
  const [showProfitability, setShowProfitability] = useState(false)
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
  const [itemPrepTime, setItemPrepTime] = useState<string>('')
  const [itemStockCount, setItemStockCount] = useState<string>('')
  const [showSocialPost, setShowSocialPost] = useState(false)
  const [itemImageUrl, setItemImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)

  // Recipe state
  const [recipeIngredients, setRecipeIngredients] = useState<{ name: string; quantity: string; unit: string; uncertain: boolean }[]>([])
  const [recipePreparation, setRecipePreparation] = useState('')
  const [recipeExtracting, setRecipeExtracting] = useState(false)
  const [recipeSaving, setRecipeSaving] = useState(false)
  const [showRecipe, setShowRecipe] = useState(false)
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [retranslating, setRetranslating] = useState(false)
  const [retranslateProgress, setRetranslateProgress] = useState<{ done: number; total: number } | null>(null)

  // AI Import
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiPhase, setAiPhase] = useState<AiPhase>('upload')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiItems, setAiItems] = useState<ExtractedMenuItem[]>([])
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set())
  const [aiImporting, setAiImporting] = useState(false)

  async function triggerTranslation(itemId: string, name: string, description: string | null) {
    setTranslatingId(itemId)
    try {
      await supabase.functions.invoke('translate-menu-item', {
        body: { item_id: itemId, name, description: description || '' },
      })
    } catch (e) {
      console.error('Translation failed:', e)
    } finally {
      setTranslatingId(null)
    }
  }

  async function retranslateAll() {
    if (!restaurant || retranslating) return
    setRetranslating(true)
    setRetranslateProgress({ done: 0, total: items.length })
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      setTranslatingId(item.id)
      try {
        await supabase.functions.invoke('translate-menu-item', {
          body: { item_id: item.id, name: item.name, description: item.description || '' },
        })
      } catch (e) {
        console.error(`Translation failed for ${item.name}:`, e)
      }
      setTranslatingId(null)
      setRetranslateProgress({ done: i + 1, total: items.length })
    }
    setRetranslating(false)
    setRetranslateProgress(null)
  }

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
    setItemPrepTime('')
    setItemStockCount('')
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
    setItemPrepTime(item.prep_time?.toString() ?? '')
    setItemStockCount(item.stock_count !== null && item.stock_count !== undefined ? String(item.stock_count) : '')
    setEditingItem(item)
    setModal('edit-item')
    setRecipeIngredients([])
    setRecipePreparation('')
    setShowRecipe(false)
    // Load existing recipe
    supabase.from('recipe_ingredients').select('*').eq('menu_item_id', item.id)
      .then(({ data }) => {
        if (data?.length) setRecipeIngredients(data.map(r => ({ name: r.ingredient_name, quantity: String(r.quantity ?? ''), unit: r.unit ?? '', uncertain: r.ai_uncertain ?? false })))
      })
    supabase.from('recipe_notes').select('preparation_text').eq('menu_item_id', item.id).single()
      .then(({ data }) => { if (data) setRecipePreparation(data.preparation_text ?? '') })
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
    if (!confirm(t('admin.deleteConfirmCategory'))) return
    await supabase.from('menu_items').delete().eq('category_id', catId)
    await supabase.from('menu_categories').delete().eq('id', catId)
    await loadData(restaurant.id)
    if (activeCategory === catId) setActiveCategory(categories[0]?.id || null)
  }

  async function saveItem() {
    if (!restaurant || !itemName.trim() || !itemPrice || !itemCategoryId) return
    setSaving(true)
    const price = parseFloat(itemPrice.replace(',', '.'))

    const stockCountVal = itemStockCount !== '' ? parseInt(itemStockCount, 10) : null
    if (editingItem) {
      await supabase.from('menu_items').update({
        name: itemName.trim(), description: itemDesc.trim() || null,
        price, category_id: itemCategoryId, tags: itemTags, allergens: itemAllergens,
        available: itemAvailable, image_url: itemImageUrl,
        prep_time: itemPrepTime ? parseInt(itemPrepTime, 10) : null,
        stock_count: stockCountVal,
      }).eq('id', editingItem.id)
    } else {
      const catItems = items.filter(i => i.category_id === itemCategoryId)
      const maxOrder = Math.max(0, ...catItems.map(i => i.sort_order))
      await supabase.from('menu_items').insert({
        restaurant_id: restaurant.id, category_id: itemCategoryId,
        name: itemName.trim(), description: itemDesc.trim() || null,
        price, tags: itemTags, allergens: itemAllergens, available: itemAvailable,
        sort_order: maxOrder + 1, image_url: itemImageUrl,
        prep_time: itemPrepTime ? parseInt(itemPrepTime, 10) : null,
        stock_count: stockCountVal,
      })
    }
    await loadData(restaurant.id)
    // Trigger auto-translation in background
    if (editingItem) {
      if (restaurant?.auto_translate_enabled !== false) triggerTranslation(editingItem.id, itemName.trim(), itemDesc.trim() || null)
    } else {
      // For new items, find the just-inserted item by name
      const { data: newItems } = await supabase
        .from('menu_items')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('name', itemName.trim())
        .order('created_at', { ascending: false })
        .limit(1)
      if (newItems && newItems[0]) {
        if (restaurant?.auto_translate_enabled !== false) triggerTranslation(newItems[0].id, itemName.trim(), itemDesc.trim() || null)
      }
    }
    setModal(null)
    setSaving(false)
  }

  async function toggleItemAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
  }

  async function deleteItem(itemId: string) {
    if (!restaurant) return
    if (!confirm(t('admin.deleteConfirmItem'))) return
    await supabase.from('menu_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  // ─── AI Import ─────────────────────────────────────────────────────────────
  const aiEnabled = restaurant && (restaurant.plan === 'pro' || restaurant.plan === 'enterprise')

  function openAiImport() {
    setAiFile(null); setAiPhase('upload'); setAiError(null); setAiItems([]); setAiSelected(new Set())
    setModal('ai-import')
  }

  function selectAiFile(file: File) {
    const ok = file.type === 'application/pdf' || file.type.startsWith('image/')
    if (!ok) { setAiError('Nur PDF- oder Bilddateien erlaubt'); return }
    if (file.size > 15 * 1024 * 1024) { setAiError('Datei zu groß (max. 15 MB)'); return }
    setAiError(null); setAiFile(file)
  }

  async function analyzeAiFile() {
    if (!restaurant || !aiFile) return
    setAiPhase('extracting'); setAiError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht eingeloggt')

      const fd = new FormData()
      fd.append('file', aiFile)
      fd.append('restaurantId', restaurant.id)
      fd.append('existingCategories', JSON.stringify(categories.map(c => c.name)))

      const res = await fetch('/api/ai/menu-extract', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Fehler beim Hochladen' }))
        throw new Error(j.error || 'Analyse fehlgeschlagen')
      }
      const data = await res.json() as { items: ExtractedMenuItem[] }
      if (!data.items || data.items.length === 0) {
        setAiError('Keine Gerichte in der Datei erkannt. Bitte anderes Foto/PDF versuchen.')
        setAiPhase('upload')
        return
      }
      setAiItems(data.items)
      setAiSelected(new Set(data.items.map((_, i) => i)))
      setAiPhase('review')
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Analyse fehlgeschlagen')
      setAiPhase('upload')
    }
  }

  function updateAiItem(idx: number, patch: Partial<ExtractedMenuItem>) {
    setAiItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function toggleAiItemTag(idx: number, key: string) {
    setAiItems(prev => prev.map((it, i) => i === idx
      ? { ...it, tags: it.tags.includes(key) ? it.tags.filter(t => t !== key) : [...it.tags, key] }
      : it
    ))
  }

  function toggleAiItemAllergen(idx: number, key: string) {
    setAiItems(prev => prev.map((it, i) => i === idx
      ? { ...it, allergens: it.allergens.includes(key) ? it.allergens.filter(a => a !== key) : [...it.allergens, key] }
      : it
    ))
  }

  function toggleAiSelected(idx: number) {
    setAiSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  function toggleAllAiSelected() {
    setAiSelected(prev => prev.size === aiItems.length ? new Set() : new Set(aiItems.map((_, i) => i)))
  }

  async function confirmAiImport() {
    if (!restaurant) return
    const selected = aiItems.filter((_, i) => aiSelected.has(i)).filter(it => it.name.trim() && it.category.trim() && it.price > 0)
    if (selected.length === 0) { setAiError('Bitte mindestens ein Gericht auswählen'); return }

    setAiImporting(true)
    try {
      // 1. Fehlende Kategorien anlegen
      const needed = Array.from(new Set(selected.map(i => i.category.trim())))
      const existingNames = new Set(categories.map(c => c.name))
      const missing = needed.filter(n => !existingNames.has(n))
      let maxOrder = Math.max(0, ...categories.map(c => c.sort_order))
      let insertedCats: MenuCategory[] = []
      if (missing.length > 0) {
        const newCats = missing.map(name => ({
          restaurant_id: restaurant.id, name, sort_order: ++maxOrder, active: true,
        }))
        const { data } = await supabase.from('menu_categories').insert(newCats).select()
        insertedCats = data || []
      }

      // 2. Category-Map
      const catMap = new Map<string, string>()
      categories.forEach(c => catMap.set(c.name, c.id))
      insertedCats.forEach(c => catMap.set(c.name, c.id))

      // 3. Items vorbereiten + bulk insert
      const rows = selected.map((item, idx) => ({
        restaurant_id: restaurant.id,
        category_id: catMap.get(item.category.trim())!,
        name: item.name.trim(),
        description: item.description?.trim() || null,
        price: item.price,
        tags: item.tags,
        allergens: item.allergens,
        available: true,
        sort_order: idx,
        image_url: null,
      })).filter(r => r.category_id)

      const { data: inserted, error: insertErr } = await supabase.from('menu_items').insert(rows).select('id, name, description')
      if (insertErr) throw insertErr

      // 4. Übersetzungen anstoßen (parallel, nicht blockieren)
      if (restaurant.auto_translate_enabled !== false) {
        inserted?.forEach(i => {
          supabase.functions.invoke('translate-menu-item', {
            body: { item_id: i.id, name: i.name, description: i.description || '' },
          }).catch(() => { /* ignore */ })
        })
      }

      await loadData(restaurant.id)
      setModal(null)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Import fehlgeschlagen')
    } finally {
      setAiImporting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )

  const activeCatItems = items.filter(i => i.category_id === activeCategory)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#8b5cf618', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UtensilsCrossed size={18} color="#8b5cf6" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>Menü verwalten</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>
              {categories.length} {categories.length === 1 ? 'Kategorie' : 'Kategorien'} · {items.length} Gerichte
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {(restaurant?.plan === 'pro' || restaurant?.plan === 'enterprise' || restaurant?.plan === 'trial') && (
            <button
              onClick={() => setShowProfitability(true)}
              title="Profitabilität"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '7px 10px', borderRadius: '10px',
                border: '1.5px solid var(--accent)', background: 'var(--accent-subtle)',
                color: 'var(--accent)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <BarChart2 size={13} />
              <span className="btn-label-hide">Profitabilität</span>
            </button>
          )}
          <button
            onClick={retranslateAll}
            disabled={retranslating || items.length === 0}
            title="Alle Gerichte neu übersetzen (8 Sprachen)"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px', padding: '7px 10px',
              color: retranslating ? 'var(--text-muted)' : 'var(--accent)',
              fontWeight: 600, fontSize: '0.78rem',
              cursor: retranslating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
              whiteSpace: 'nowrap',
              opacity: retranslating ? 0.7 : 1,
            }}
          >
            <Globe size={13} className={retranslating ? 'spin-slow' : ''} />
            <span className="btn-label-hide">
              {retranslateProgress
                ? `${retranslateProgress.done}/${retranslateProgress.total}`
                : 'Übersetzen'}
            </span>
          </button>
          <button
            onClick={() => setShowSocialPost(true)}
            title="Social-Media-Post per KI generieren"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px', padding: '7px 10px',
              color: 'var(--accent)',
              fontWeight: 600, fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={13} />
            <span className="btn-label-hide">Social Post</span>
          </button>
          <button
            onClick={openAiImport}
            disabled={!aiEnabled}
            title={aiEnabled ? 'Speisekarte per KI aus PDF/Foto einlesen' : 'Pro- oder Enterprise-Plan erforderlich'}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px', padding: '7px 10px',
              color: aiEnabled ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: 600, fontSize: '0.78rem',
              cursor: aiEnabled ? 'pointer' : 'not-allowed',
              opacity: aiEnabled ? 1 : 0.5,
              display: 'flex', alignItems: 'center', gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={13} />
            <span className="btn-label-hide">KI-Import</span>
          </button>
          <button
            onClick={openAddCategory}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '7px 12px', color: 'var(--accent-text)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
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
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <Pencil size={13} />
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
                  <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><UtensilsCrossed size={40} color="var(--text-muted)" /></div>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Noch keine Items in dieser Kategorie</p>
                  <button onClick={() => openAddItem(activeCategory)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'var(--accent-text)', fontWeight: 600, cursor: 'pointer' }}>
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
                          {translatingId === item.id && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Globe size={10} /> {t('admin.translating')}
                            </span>
                          )}
                          {item.tags.map(tag => {
                            const dl = DIETARY_LABELS.find(d => d.key === tag)
                            return <span key={tag} style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', fontWeight: 700 }}>{dl ? dl.label : tag}</span>
                          })}
                          {item.allergens?.length > 0 && (
                            <span style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AlertTriangle size={10} /> {item.allergens.join(', ')}</span>
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
                          {item.available ? t('admin.available') : 'Aus'}
                        </button>
                        <button onClick={() => openEditItem(item)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>{t('common.edit')}</button>
                        <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><FolderOpen size={40} color="var(--text-muted)" /></div>
              <p style={{ color: 'var(--text-muted)' }}>Erstelle zuerst eine Kategorie</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg) } }
        .spin-slow { animation: spin-slow 1.5s linear infinite; }
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
          .ai-review-grid { grid-template-columns: 1fr !important; }
          .btn-label-hide { display: none; }
        }
        @media (min-width: 769px) {
          .btn-label-hide { display: inline; }
        }
      `}</style>

      {/* Modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}
          onWheel={e => e.stopPropagation()}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: modal === 'ai-import' ? 'min(calc(100vw - 24px), 960px)' : 'min(calc(100vw - 24px), 480px)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
            {(modal === 'add-category' || modal === 'edit-category') && (
              <>
                <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>
                  {modal === 'add-category' ? t('admin.newCategory') : t('admin.editCategory')}
                </h3>
                <input
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="z.B. Vorspeisen"
                  autoFocus
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
                />
                {modal === 'edit-category' && editingCat && (
                  <button onClick={() => deleteCategory(editingCat.id)} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Trash2 size={14} /> Kategorie löschen
                  </button>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('common.cancel')}</button>
                  <button onClick={saveCategory} disabled={saving || !catName.trim()} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? '...' : t('common.save')}
                  </button>
                </div>
              </>
            )}

            {modal === 'ai-import' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <Sparkles size={18} color="var(--accent)" />
                  <h3 style={{ color: 'var(--text)', fontWeight: 700, margin: 0 }}>KI-Import aus PDF/Foto</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>
                  Lade deine bestehende Speisekarte hoch — Claude liest alle Gerichte mit Preisen und Kategorien aus.
                </p>

                {aiPhase === 'upload' && (
                  <>
                    <label
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '10px', border: `2px dashed ${aiFile ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '12px', padding: '40px 20px', cursor: 'pointer',
                        background: aiFile ? 'var(--accent-subtle)' : 'var(--bg)',
                      }}
                      onDragOver={e => { e.preventDefault() }}
                      onDrop={e => {
                        e.preventDefault()
                        const f = e.dataTransfer.files?.[0]
                        if (f) selectAiFile(f)
                      }}
                    >
                      {aiFile ? <FileText size={32} color="var(--accent)" /> : <Upload size={32} color="var(--text-muted)" />}
                      <div style={{ textAlign: 'center' }}>
                        {aiFile ? (
                          <>
                            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>{aiFile.name}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{(aiFile.size / 1024 / 1024).toFixed(2)} MB — klicken zum Ändern</p>
                          </>
                        ) : (
                          <>
                            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Datei auswählen oder hierher ziehen</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>PDF, JPG, PNG — max. 15 MB</p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept=".pdf,application/pdf,image/*"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) selectAiFile(f) }}
                      />
                    </label>

                    {aiError && (
                      <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> {aiError}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                      <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('common.cancel')}</button>
                      <button
                        onClick={analyzeAiFile}
                        disabled={!aiFile}
                        style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: aiFile ? 'var(--accent)' : 'var(--border)', color: 'var(--accent-text)', fontWeight: 600, cursor: aiFile ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Sparkles size={14} /> Analysieren
                      </button>
                    </div>
                  </>
                )}

                {aiPhase === 'extracting' && (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <Loader2 size={32} color="var(--accent)" className="ai-spin" style={{ marginBottom: '16px' }} />
                    <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '6px' }}>Speisekarte wird gelesen…</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Das kann 20–40 Sekunden dauern</p>
                    <style>{`@keyframes ai-spin { to { transform: rotate(360deg) } } .ai-spin { animation: ai-spin 1s linear infinite; }`}</style>
                  </div>
                )}

                {aiPhase === 'review' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem' }}>
                          {aiItems.length} {aiItems.length === 1 ? 'Gericht' : 'Gerichte'} gefunden
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginLeft: '8px' }}>
                            • {aiSelected.size} ausgewählt
                          </span>
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                          Prüfe & korrigiere jeden Eintrag, bevor du importierst.
                        </p>
                      </div>
                      <button
                        onClick={toggleAllAiSelected}
                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {aiSelected.size === aiItems.length ? 'Alle abwählen' : 'Alle auswählen'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
                      {aiItems.map((item, idx) => {
                        const isSel = aiSelected.has(idx)
                        return (
                          <div key={idx} style={{
                            background: 'var(--bg)', borderRadius: '10px', padding: '12px',
                            border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                            opacity: isSel ? 1 : 0.55,
                          }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => toggleAiSelected(idx)}
                                style={{ width: '16px', height: '16px', marginTop: '10px', flexShrink: 0, cursor: 'pointer' }}
                              />
                              <div className="ai-review-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr', gap: '8px' }}>
                                <input
                                  value={item.name}
                                  onChange={e => updateAiItem(idx, { name: e.target.value })}
                                  placeholder="Name"
                                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }}
                                />
                                <select
                                  value={item.category}
                                  onChange={e => updateAiItem(idx, { category: e.target.value })}
                                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }}
                                >
                                  {Array.from(new Set([...categories.map(c => c.name), ...aiItems.map(i => i.category)])).filter(Boolean).map(cat => (
                                    <option key={cat} value={cat}>{cat}{!categories.find(c => c.name === cat) ? ' (neu)' : ''}</option>
                                  ))}
                                </select>
                                <input
                                  value={item.price.toString().replace('.', ',')}
                                  onChange={e => updateAiItem(idx, { price: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                                  placeholder="Preis"
                                  inputMode="decimal"
                                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', fontWeight: 700, outline: 'none', textAlign: 'right' }}
                                />
                              </div>
                            </div>

                            <div style={{ marginLeft: '26px', marginTop: '8px' }}>
                              <textarea
                                value={item.description || ''}
                                onChange={e => updateAiItem(idx, { description: e.target.value || null })}
                                placeholder="Beschreibung (optional)"
                                rows={1}
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                              />
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {DIETARY_LABELS.map(({ key, label }) => {
                                  const active = item.tags.includes(key)
                                  return (
                                    <button key={key} type="button" onClick={() => toggleAiItemTag(idx, key)} style={{
                                      padding: '3px 8px', borderRadius: '12px',
                                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                                      background: active ? 'var(--accent-subtle)' : 'transparent',
                                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                                      fontWeight: active ? 700 : 500, fontSize: '0.7rem', cursor: 'pointer',
                                    }}>{label}</button>
                                  )
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                                {ALLERGEN_LIST.map(a => {
                                  const active = item.allergens.includes(a)
                                  return (
                                    <button key={a} type="button" onClick={() => toggleAiItemAllergen(idx, a)} style={{
                                      padding: '3px 8px', borderRadius: '12px',
                                      border: `1px solid ${active ? '#ef4444' : 'var(--border)'}`,
                                      background: active ? 'rgba(239,68,68,0.08)' : 'transparent',
                                      color: active ? '#ef4444' : 'var(--text-muted)',
                                      fontWeight: active ? 700 : 500, fontSize: '0.7rem', cursor: 'pointer',
                                    }}>{a}</button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {aiError && (
                      <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={14} /> {aiError}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={() => { setAiPhase('upload'); setAiItems([]); setAiSelected(new Set()); setAiError(null) }}
                        disabled={aiImporting}
                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: aiImporting ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                      >
                        Neue Datei
                      </button>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setModal(null)} disabled={aiImporting} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: aiImporting ? 'not-allowed' : 'pointer' }}>{t('common.cancel')}</button>
                        <button
                          onClick={confirmAiImport}
                          disabled={aiImporting || aiSelected.size === 0}
                          style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, cursor: aiImporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          {aiImporting ? <><Loader2 size={14} className="ai-spin" /> Importiere…</> : <>{aiSelected.size} {aiSelected.size === 1 ? 'Gericht' : 'Gerichte'} importieren</>}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {(modal === 'add-item' || modal === 'edit-item') && (
              <>
                <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>
                  {modal === 'add-item' ? t('admin.newItem') : t('admin.editItem')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>{t('common.category')}</label>
                    <select value={itemCategoryId} onChange={e => setItemCategoryId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none' }}>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>Name *</label>
                    <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="z.B. Currywurst" autoFocus style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>{t('common.description')}</label>
                    <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Kurze Beschreibung..." rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>{t('common.price')} (€) *</label>
                    <input value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="4.90" type="text" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                      Portionen verfügbar (Bestand)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={itemStockCount}
                      onChange={e => setItemStockCount(e.target.value)}
                      placeholder="Leer = unbegrenzt"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', fontSize: '0.875rem',
                      }}
                    />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                      Für Engpass-Alerts. 0 = ausverkauft. Leer = kein Limit.
                    </p>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                      Zubereitungszeit (Minuten)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={itemPrepTime}
                      onChange={e => setItemPrepTime(e.target.value)}
                      placeholder="z.B. 12"
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '8px',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', fontSize: '0.875rem',
                      }}
                    />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                      Für die Wartezeit-Schätzung der Gäste. Leer lassen = 15 Min. Standard.
                    </p>
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
                        {imageUploading ? <Loader2 size={24} color="var(--text-muted)" /> : <Camera size={24} color="var(--text-muted)" />}
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
                        <AlertTriangle size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Enthält: {itemAllergens.join(', ')}
                      </p>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={itemAvailable} onChange={e => setItemAvailable(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    <span style={{ color: 'var(--text)', fontSize: '0.875rem' }}>{t('admin.available')} (im Menü sichtbar)</span>
                  </label>

                  {/* Recipe Section (edit-item only) */}
                  {modal === 'edit-item' && editingItem && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setShowRecipe(v => !v)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: 0, marginBottom: showRecipe ? '12px' : 0 }}
                      >
                        Rezept {showRecipe ? '▲' : '▼'}
                      </button>
                      {showRecipe && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* Photo upload for extraction */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '2px dashed var(--border)', borderRadius: '8px', cursor: recipeExtracting ? 'wait' : 'pointer', background: 'var(--bg)' }}>
                            <Camera size={16} color="var(--text-muted)" />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{recipeExtracting ? 'KI analysiert…' : 'Rezeptfoto hochladen → KI extrahiert Zutaten'}</span>
                            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={recipeExtracting} onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file || !restaurant) return
                              setRecipeExtracting(true)
                              const reader = new FileReader()
                              reader.onload = async () => {
                                const base64 = (reader.result as string).split(',')[1]
                                const { data: { session } } = await supabase.auth.getSession()
                                const res = await fetch('/api/ai/recipe-extract', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                                  body: JSON.stringify({ restaurantId: restaurant.id, menuItemId: editingItem.id, imageBase64: base64, mimeType: file.type }),
                                })
                                const json = await res.json()
                                if (json.ingredients) setRecipeIngredients(json.ingredients.map((i: { name: string; quantity: number; unit: string; uncertain: boolean }) => ({ name: i.name, quantity: String(i.quantity ?? ''), unit: i.unit ?? '', uncertain: i.uncertain })))
                                if (json.preparation_text) setRecipePreparation(json.preparation_text)
                                setRecipeExtracting(false)
                              }
                              reader.readAsDataURL(file)
                            }} />
                          </label>

                          {/* Ingredient list */}
                          {recipeIngredients.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {recipeIngredients.map((ing, i) => (
                                <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', background: ing.uncertain ? 'rgba(245,158,11,0.06)' : 'var(--bg)', padding: '6px 8px', borderRadius: '8px', border: `1px solid ${ing.uncertain ? '#f59e0b44' : 'var(--border)'}` }}>
                                  <input value={ing.name} onChange={e => setRecipeIngredients(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} placeholder="Zutat" style={{ flex: 2, padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none' }} />
                                  <input value={ing.quantity} onChange={e => setRecipeIngredients(prev => prev.map((r, j) => j === i ? { ...r, quantity: e.target.value, uncertain: false } : r))} placeholder="Menge" style={{ width: '56px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none' }} />
                                  <input value={ing.unit} onChange={e => setRecipeIngredients(prev => prev.map((r, j) => j === i ? { ...r, unit: e.target.value } : r))} placeholder="g/ml" style={{ width: '48px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem', outline: 'none' }} />
                                  <button type="button" onClick={() => setRecipeIngredients(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '2px', flexShrink: 0 }}>×</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <button type="button" onClick={() => setRecipeIngredients(prev => [...prev, { name: '', quantity: '', unit: '', uncertain: false }])} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>+ Zutat manuell hinzufügen</button>
                          <div>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>Zubereitung</label>
                            <textarea value={recipePreparation} onChange={e => setRecipePreparation(e.target.value)} rows={3} placeholder="Kurze Zubereitungshinweise…" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.825rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                          </div>
                          <button
                            type="button"
                            disabled={recipeSaving}
                            onClick={async () => {
                              if (!editingItem) return
                              setRecipeSaving(true)
                              await supabase.from('recipe_ingredients').delete().eq('menu_item_id', editingItem.id)
                              if (recipeIngredients.length > 0) {
                                await supabase.from('recipe_ingredients').insert(recipeIngredients.filter(r => r.name.trim()).map(r => ({ menu_item_id: editingItem.id, ingredient_name: r.name.trim(), quantity: r.quantity ? parseFloat(r.quantity) : null, unit: r.unit || null, ai_uncertain: r.uncertain })))
                              }
                              await supabase.from('recipe_notes').upsert({ menu_item_id: editingItem.id, preparation_text: recipePreparation || null, updated_at: new Date().toISOString() }, { onConflict: 'menu_item_id' })
                              setRecipeSaving(false)
                            }}
                            style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: '0.825rem', cursor: recipeSaving ? 'wait' : 'pointer', alignSelf: 'flex-start' }}
                          >
                            {recipeSaving ? 'Speichert…' : 'Rezept speichern'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('common.cancel')}</button>
                  <button onClick={saveItem} disabled={saving || !itemName.trim() || !itemPrice} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? '...' : t('common.save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showProfitability && restaurant && (
        <ProfitabilityPanel
          restaurantId={restaurant.id}
          items={items}
          onClose={() => setShowProfitability(false)}
        />
      )}

      {showSocialPost && restaurant && (
        <SocialPostGenerator
          restaurantId={restaurant.id}
          items={items}
          onClose={() => setShowSocialPost(false)}
        />
      )}
    </div>
  )
}
