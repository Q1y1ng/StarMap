import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // TODO: trigger AI analysis workflow
    return NextResponse.json({ success: true, data: { taskId: 'task-id' } }, { status: 202 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[analysis-knowledge-points] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
