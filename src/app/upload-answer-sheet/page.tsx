import { Suspense } from 'react'
import UploadAnswerSheetClient from './client'

export default function UploadAnswerSheetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-zinc-400">加载中...</div>}>
      <UploadAnswerSheetClient />
    </Suspense>
  )
}
