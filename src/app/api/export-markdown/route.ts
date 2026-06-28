// ── POST /api/export-markdown ──
// 将 OCR 结果 Markdown 导出到项目根目录 docx/ 文件夹
// 请求: { markdown: string, filename?: string }
// 返回: { success: true, path: string }

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { markdown, filename } = body as { markdown: string; filename?: string }

    if (!markdown || typeof markdown !== 'string') {
      return NextResponse.json(
        { success: false, error: 'markdown 内容不能为空' },
        { status: 400 },
      )
    }

    // 确保 docx/ 目录存在
    const rootDir = process.cwd()
    const docxDir = path.join(rootDir, 'docx')
    fs.mkdirSync(docxDir, { recursive: true })

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const safeName = filename
      ? filename.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80)
      : `OCR-结果-${timestamp}`
    const filePath = path.join(docxDir, `${safeName}.md`)

    // 写入文件
    fs.writeFileSync(filePath, markdown, 'utf-8')

    return NextResponse.json({
      success: true,
      path: filePath,
      message: `已导出至 docx/${safeName}.md`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '导出失败'
    console.error('[api/export-markdown] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
