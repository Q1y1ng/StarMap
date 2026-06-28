import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    return NextResponse.json({ success: true, data: { id } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[scores] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
