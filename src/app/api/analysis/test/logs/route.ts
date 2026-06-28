import { NextResponse } from 'next/server'
import { getQualityLogs, getQualityStats } from '@/lib/ai-logger'

export async function GET() {
  try {
    const logs = getQualityLogs(50)
    const stats = getQualityStats()

    return NextResponse.json({ success: true, logs, stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[analysis-test-logs] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
