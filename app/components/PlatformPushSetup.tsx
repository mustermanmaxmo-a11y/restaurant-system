'use client'

import { PushNotificationBanner } from '@/components/PushNotificationBanner'

type Props = { userId?: string }

export function PlatformPushSetup({ userId }: Props) {
  return <PushNotificationBanner appContext="platform" userId={userId} />
}
