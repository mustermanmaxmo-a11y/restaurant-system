'use client'

import { useEffect, useRef, useState } from 'react'

type PushConfig = {
  appContext: 'dashboard' | 'admin' | 'platform'
  restaurantId?: string
  userId?: string
  staffRole?: string
}

export function usePushNotifications(config: PushConfig) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    setPermission(Notification.permission)
    if (Notification.permission !== 'granted') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (sub) setSubscribed(true) })
      .catch(() => {})
  }, [])

  async function subscribe() {
    if (inFlight.current) return
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.error('[usePushNotifications] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
      return
    }

    inFlight.current = true
    setLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const key = sub.getKey('p256dh')
      const auth = sub.getKey('auth')

      // p256dh is always 65 bytes, auth is always 16 bytes — spread is safe at these sizes
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
          auth: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
          app_context: config.appContext,
          restaurant_id: config.restaurantId,
          user_id: config.userId,
          staff_role: config.staffRole,
        }),
      })
      if (!res.ok) throw new Error('Subscribe API failed')

      setSubscribed(true)
    } catch (err) {
      console.error('[usePushNotifications] subscribe failed:', err)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  async function unsubscribe() {
    if (!('serviceWorker' in navigator)) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
      setSubscribed(false)
    } catch (err) {
      console.error('[usePushNotifications] unsubscribe failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return { permission, subscribed, loading, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
