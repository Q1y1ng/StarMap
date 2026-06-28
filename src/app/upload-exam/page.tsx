import { Suspense } from 'react'
import UploadExamClient from './client'

export default async function UploadExamPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>
}) {
  const resolvedSearchParams = await searchParams

  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-zinc-400">加载中...</div>}>
      <UploadExamClient examId={resolvedSearchParams.examId ?? null} />
    </Suspense>
  )
}
