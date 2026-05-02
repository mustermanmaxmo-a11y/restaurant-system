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
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPermission(Notification.permission)
    if (Notification.permission === 'granted') checkSubscription()
  }, [])

  async function checkSubscription() {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      setSubscribed(true)
      subscribedRef.current = true
    }
  }

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const result = await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    })

    const key = sub.getKey('p256dh')
    const auth = sub.getKey('auth')

    await fetch('/api/push/subscribe', {
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

    setSubscribed(true)
    subscribedRef.current = true
  }

  async function unsubscribe() {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      await sub.unsubscribe()
    }
    setSubscribed(false)
    subscribedRef.current = false
  }

  return { permission, subscribed, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
