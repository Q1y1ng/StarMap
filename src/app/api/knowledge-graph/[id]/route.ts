// GET /api/knowledge-graph/[id]
// 获取知识点完整详情
// ────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { KnowledgeGraphService } from '@/services/knowledge-graph.service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const detail = await KnowledgeGraphService.getNodeDetail(id)

    if (!detail) {
      return NextResponse.json({ success: false, error: '知识点不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: detail })
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取知识点详情失败'
    console.error('[api/knowledge-graph/[id]] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
