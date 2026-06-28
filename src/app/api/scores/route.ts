import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[scores] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({ success: true, data: body }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败'
    console.error('[scores] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
