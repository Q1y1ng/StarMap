import { Suspense } from 'react'
import UploadScoreBreakdownClient from './client'

export default function UploadScoreBreakdownPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-zinc-400">加载中...</div>}>
      <UploadScoreBreakdownClient />
    </Suspense>
  )
}
