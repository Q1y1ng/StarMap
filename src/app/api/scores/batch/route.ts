import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // TODO: parse Excel file and batch insert scores
    return NextResponse.json({ success: true, data: { imported: 0 } })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[scores-batch] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
