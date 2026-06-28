// GET /api/knowledge-graph
// 知识图谱查询
// Query params:
//   — 无参数: 返回科目列表
//   — ?subject=数学: 返回该科目完整知识树
//   — ?nodeId=xxx: 返回单个节点
//   — ?search=二次&subject=数学: 搜索知识点
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { KnowledgeGraphService } from '@/services/knowledge-graph.service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject')
    const nodeId = searchParams.get('nodeId')
    const search = searchParams.get('search')

    // 搜索模式
    if (search) {
      const nodes = await KnowledgeGraphService.searchNodes(search, subject ?? undefined)
      return NextResponse.json({ success: true, data: nodes })
    }

    // 节点详情
    if (nodeId) {
      const detail = await KnowledgeGraphService.getNodeDetail(nodeId)
      if (!detail) {
        return NextResponse.json({ success: false, error: '节点不存在' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: detail })
    }

    // 科目知识树
    if (subject) {
      const tree = await KnowledgeGraphService.getTree(subject)
      return NextResponse.json({ success: true, data: tree })
    }

    // 默认：获取科目列表
    const subjects = await KnowledgeGraphService.getSubjects()
    return NextResponse.json({ success: true, data: subjects })
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询知识图谱失败'
    console.error('[api/knowledge-graph] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
