'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  available: boolean
}

interface CartItem {
  id: string
  name: string
  price: number
  qty: number
}

interface SessionInfo {
  restaurant_id: string
  tisch: number
}

export default function OrderPage() {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready' | 'ordering' | 'success'>('loading')
  const [note, setNote] = useState('')
  const [calling, setCalling] = useState(false)
  const [callSent, setCallSent] = useState(false)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) { setStatus('invalid'); return }
    validateToken(token)
  }, [])

  async function validateToken(token: string) {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('session_tokens')
      .select('restaurant_id, tisch')
      .eq('token', token)
      .gte('valid_date', today)
      .single()

    if (error || !data) {
      // Fallback: check tables table
      const { data: tableData } = await supabase
        .from('tables')
        .select('restaurant_id, table_num')
        .eq('qr_token', token)
        .single()

      if (!tableData) { setStatus('invalid'); return }
      setSession({ restaurant_id: tableData.restaurant_id, tisch: tableData.table_num })
      loadMenu(tableData.restaurant_id)
      return
    }

    setSession({ restaurant_id: data.restaurant_id, tisch: data.tisch })
    loadMenu(data.restaurant_id)
  }

  async function loadMenu(restaurantId: string) {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('available', true)
      .order('category')

    setMenuItems(data || [])
    setStatus('ready')
  }

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }]
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const existing = prev.find(c => c.id === id)
      if (!existing) return prev
      if (existing.qty === 1) return prev.filter(c => c.id !== id)
      return prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c)
    })
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0)
  const cartQty = cart.reduce((sum, c) => sum + c.qty, 0)

  async function callWaiter() {
    if (!session || calling) return
    setCalling(true)
    await supabase.from('service_calls').insert({
      id: crypto.randomUUID(),
      restaurant_id: session.restaurant_id,
      table_num: session.tisch,
      type: 'waiter',
      label: 'Kellner gerufen',
      icon: '🙋',
      urgent: false,
    })
    setCalling(false)
    setCallSent(true)
    setTimeout(() => setCallSent(false), 4000)
  }

  async function placeOrder() {
    if (!session || cart.length === 0) return
    setStatus('ordering')

    const { error } = await supabase.from('orders').insert({
      restaurant_id: session.restaurant_id,
      table_num: session.tisch,
      items: cart.map(c => ({ menu_item_id: c.id, name: c.name, qty: c.qty, price: c.price })),
      note: note || null,
      total,
      status: 'new'
    })

    if (error) { setStatus('ready'); alert('Fehler beim Bestellen'); return }
    setStatus('success')
    setCart([])
  }

  const categories = [...new Set(menuItems.map(i => i.category))]

  if (status === 'loading') return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-white text-lg">Laden...</div>
    </div>
  )

  if (status === 'invalid') return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-white text-2xl font-bold mb-2">Ungültiger QR-Code</h1>
        <p className="text-zinc-400">Bitte scanne den QR-Code am Tisch neu.</p>
      </div>
    </div>
  )

  if (status === 'success') return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-white text-2xl font-bold mb-2">Bestellung aufgegeben!</h1>
        <p className="text-zinc-400 mb-6">Tisch {session?.tisch} · Wir bereiten deine Bestellung vor.</p>
        <button
          onClick={() => setStatus('ready')}
          className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold"
        >
          Weitere Bestellung
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-40">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-zinc-400 text-sm">Tisch {session?.tisch}</p>
            <h1 className="text-xl font-bold">Speisekarte</h1>
          </div>
          {cartQty > 0 && (
            <div className="bg-green-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {cartQty} im Warenkorb
            </div>
          )}
        </div>
      </div>

      {/* Kellner rufen */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <button
          onClick={callWaiter}
          disabled={calling || callSent}
          className={`w-full py-3 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
            callSent
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
          }`}
        >
          {callSent ? '✅ Kellner kommt!' : calling ? 'Wird gesendet...' : '🙋 Kellner rufen'}
        </button>
      </div>

      {/* Menu */}
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-8">
        {categories.map(category => (
          <div key={category}>
            <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3">{category}</h2>
            <div className="space-y-3">
              {menuItems.filter(i => i.category === category).map(item => {
                const inCart = cart.find(c => c.id === item.id)
                return (
                  <div key={item.id} className="bg-zinc-900 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{item.name}</p>
                      {item.description && <p className="text-zinc-400 text-sm mt-0.5 truncate">{item.description}</p>}
                      <p className="text-green-400 font-bold mt-1">{item.price.toFixed(2)} €</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {inCart ? (
                        <>
                          <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-lg font-bold hover:bg-zinc-600">−</button>
                          <span className="w-5 text-center font-bold">{inCart.qty}</span>
                          <button onClick={() => addToCart(item)} className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-lg font-bold hover:bg-green-400">+</button>
                        </>
                      ) : (
                        <button onClick={() => addToCart(item)} className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-lg font-bold hover:bg-green-400">+</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-4 py-4">
          <div className="max-w-lg mx-auto space-y-3">
            <input
              type="text"
              placeholder="Anmerkung (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-xl px-4 py-2 text-sm outline-none"
            />
            <button
              onClick={placeOrder}
              disabled={status === 'ordering'}
              className="w-full bg-green-500 hover:bg-green-400 disabled:bg-zinc-600 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-colors"
            >
              <span>{status === 'ordering' ? 'Wird bestellt...' : 'Jetzt bestellen'}</span>
              <span>{total.toFixed(2)} €</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
