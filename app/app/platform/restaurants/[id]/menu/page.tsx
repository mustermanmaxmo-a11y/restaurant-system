import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function RestaurantMenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const [{ data: restaurant }, { data: rawItems }, { data: rawCats }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan').eq('id', id).single(),
    admin.from('menu_items')
      .select('id, name, description, price, category_id, available, created_at')
      .eq('restaurant_id', id)
      .order('category_id')
      .order('name'),
    (admin as any).from('menu_categories')
      .select('id, name, sort_order')
      .eq('restaurant_id', id)
      .order('sort_order'),
  ])

  if (!restaurant) notFound()

  const items: { id: string; name: string; description: string | null; price: number; category_id: string | null; available: boolean; created_at: string }[] = rawItems ?? []
  const cats: { id: string; name: string; sort_order: number }[] = rawCats ?? []

  // Group items by category
  const catMap = new Map(cats.map(c => [c.id, c.name]))
  const grouped: Record<string, typeof items> = {}
  const uncatKey = '__none__'

  for (const item of items) {
    const key = item.category_id ?? uncatKey
    grouped[key] = grouped[key] ?? []
    grouped[key].push(item)
  }

  // Stats
  const available = items.filter(i => i.available)
  const unavailable = items.filter(i => !i.available)
  const avgPrice = items.length > 0 ? items.reduce((s, i) => s + (i.price ?? 0), 0) / items.length : 0
  const minPrice = items.length > 0 ? Math.min(...items.map(i => i.price ?? 0)) : 0
  const maxPrice = items.length > 0 ? Math.max(...items.map(i => i.price ?? 0)) : 0

  // Price distribution (buckets)
  const priceBuckets = [
    { label: '<€5', min: 0, max: 5 },
    { label: '€5–10', min: 5, max: 10 },
    { label: '€10–20', min: 10, max: 20 },
    { label: '€20–35', min: 20, max: 35 },
    { label: '>€35', min: 35, max: Infinity },
  ].map(b => ({ ...b, count: items.filter(i => (i.price ?? 0) >= b.min && (i.price ?? 0) < b.max).length }))
  const maxBucketCount = Math.max(...priceBuckets.map(b => b.count), 1)

  // Category sizes
  const catOrder = cats.map(c => c.id)
  if (grouped[uncatKey]) catOrder.push(uncatKey)

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
        {[
          { label: 'Übersicht', href: `/platform/restaurants/${id}` },
          { label: 'Analytics',  href: `/platform/restaurants/${id}/analytics` },
          { label: 'Orders',     href: `/platform/restaurants/${id}/orders` },
          { label: 'Speisekarte', href: `/platform/restaurants/${id}/menu`, active: true },
          { label: 'Tische',     href: `/platform/restaurants/${id}/tables` },
        ].map(n => (
          <Link key={n.href} href={n.href} style={{
            padding: '5px 14px', borderRadius: '20px', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600,
            background: n.active ? 'rgba(124,58,237,0.2)' : 'transparent',
            border: `1px solid ${n.active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: n.active ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
          }}>{n.label}</Link>
        ))}
      </div>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Speisekarte — {restaurant.name}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem' }}>
          {items.length} Artikel · {cats.length} Kategorien · /{restaurant.slug}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Artikel gesamt', value: String(items.length), color: '#c4b5fd' },
          { label: 'Verfügbar', value: String(available.length), color: '#34d399' },
          { label: 'Deaktiviert', value: String(unavailable.length), color: '#f87171' },
          { label: 'Kategorien', value: String(cats.length), color: '#60a5fa' },
          { label: 'Ø Preis', value: `€${avgPrice.toFixed(2)}`, color: '#fbbf24' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{k.label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Category sizes */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '14px' }}>Artikel pro Kategorie</div>
          {cats.length === 0 && <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8rem' }}>Keine Kategorien</div>}
          {cats.map(c => {
            const cnt = grouped[c.id]?.length ?? 0
            const maxCnt = Math.max(...cats.map(cat => grouped[cat.id]?.length ?? 0), 1)
            return (
              <div key={c.id} style={{ marginBottom: '9px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>{c.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>{cnt} Artikel</span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(cnt / maxCnt) * 100}%`, background: 'rgba(124,58,237,0.6)', borderRadius: '3px' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Price distribution */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>Preisverteilung</div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem', marginBottom: '14px' }}>€{minPrice.toFixed(2)} – €{maxPrice.toFixed(2)}</div>
          {priceBuckets.map(b => (
            <div key={b.label} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>{b.label}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem' }}>{b.count}</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(b.count / maxBucketCount) * 100}%`, background: 'rgba(251,191,36,0.6)', borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full menu */}
      {catOrder.map(catId => {
        const catItems = grouped[catId]
        if (!catItems || catItems.length === 0) return null
        const catName = catId === uncatKey ? 'Ohne Kategorie' : (catMap.get(catId) ?? catId)
        return (
          <div key={catId} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <h2 style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{catName}</h2>
              <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>{catItems.length}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
              {catItems.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '11px 16px',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                    background: item.available ? '#34d399' : '#f87171',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: item.available ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '0.82rem' }}>{item.name}</div>
                    {item.description && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>{item.description}</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.9rem' }}>€{Number(item.price ?? 0).toFixed(2)}</div>
                    {!item.available && <div style={{ color: '#f87171', fontSize: '0.62rem', fontWeight: 600 }}>Nicht verfügbar</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {items.length === 0 && (
        <div style={{ padding: '64px', textAlign: 'center', color: 'rgba(255,255,255,0.12)', fontSize: '0.9rem' }}>
          Noch keine Artikel in der Speisekarte.
        </div>
      )}
    </div>
  )
}
