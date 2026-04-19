'use client'

import { useDesignVersion } from '@/components/providers/design-version-provider'
import ClassicOverview from './_v1/ClassicOverview'
import BentoOverview from './_v2/BentoOverview'

export default function AdminPage() {
  const version = useDesignVersion()
  return version === 'v2' ? <BentoOverview /> : <ClassicOverview />
}
