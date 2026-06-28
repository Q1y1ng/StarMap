import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params
    // TODO: check analysis task status
    return NextResponse.json({ success: true, data: { taskId, status: 'PENDING' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[analysis-status] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
