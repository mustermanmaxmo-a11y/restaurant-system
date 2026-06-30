'use client'

import { useEditorDraft } from './useEditorDraft'
import { PreviewPane, type PreviewPage, type PreviewDevice } from './PreviewPane'

export function EditorCanvas({ slug, page, device }: { slug: string; page: PreviewPage; device: PreviewDevice }) {
  const { reloadToken } = useEditorDraft()
  return <PreviewPane slug={slug} reloadToken={reloadToken} page={page} device={device} />
}
