import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // TODO: generate Excel export
    return NextResponse.json({ success: true, message: 'Export endpoint ready' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[scores-export] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
