// ── POST /api/upload-exam — 统一上传 API（Phase 15-R / Vision-Native） ──
//
// 架构（Phase 15-R）：
//   上传文件 → VisionService.analyze → VisionDocument（rawText 唯一数据源）
//   移除 ExamDocumentParser / ExamMarkdownRenderer / DocumentAssembler 等旧链路
//   Vision 模型直接输出 Markdown，系统直接使用原始输出
//
// 链路：接收文件 → VisionService（ImageBatch + Vision + Fallback）→ 返回 rawText

import { NextRequest, NextResponse } from 'next/server'
import { VisionService } from '@/services/vision'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const overallStart = performance.now()

  try {
    const formData = await request.formData()

    // ── 1. 解析参数 ──
    const files = formData.getAll('file').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ success: false, error: '请上传文件' }, { status: 400 })
    }

    const doubaoApiKey = formData.get('doubaoApiKey') as string | null
    const examId = formData.get('examId') as string | null

    // ── 2. 文件校验 ──
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) {
        return NextResponse.json(
          { success: false, error: `文件 "${file.name}" 格式不支持，仅支持 JPG / PNG / WebP / PDF` },
          { status: 400 },
        )
      }
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: `文件 "${file.name}" 超过 50MB 限制` },
          { status: 413 },
        )
      }
    }

    // ── 3. 读取文件到内存 ──
    const fileBuffers = await Promise.all(
      files.map(async (f) => ({
        buffer: Buffer.from(await f.arrayBuffer()),
        filename: f.name,
        size: f.size,
        mimeType: f.type || 'application/octet-stream',
      })),
    )

    // ── 4. VisionService 主编排 ──
    const result = await VisionService.analyze(fileBuffers, {
      apiKey: doubaoApiKey ?? undefined,
      useCache: true,
      useFallback: true,
    })

    const { document: visionDoc, batch, timeline, cacheHit, retried } = result

    console.log('[upload-exam] Vision 分析完成:', {
      totalImages: batch.totalPages,
      rawLength: visionDoc.rawText?.length ?? 0,
      cacheHit,
      retried,
      durationMs: visionDoc.durationMs,
    })

    // ── Phase 15-R: rawText 是唯一数据源 ──
    const markdown = visionDoc.rawText ?? ''

    // ── 5. 保存 DocumentArtifact（向后兼容） ──
    if (examId) {
      try {
        await prisma.documentArtifact.deleteMany({ where: { examId } })
        await prisma.documentArtifact.create({
          data: {
            examId,
            type: 'unified',
            sourceFile: files.map(f => f.name).join(', '),
            rawOcrText: markdown,
            formattedMarkdown: markdown,
            ocrEngine: 'DOUBAO',
            ocrMode: 'VISION',
            ocrQuality: 100,
            ocrDurationMs: visionDoc.durationMs,
          },
        })
      } catch (dbErr) {
        console.warn('[upload-exam] DocumentArtifact 保存失败:', dbErr)
      }
    }

    // ── 6. 总用时 ──
    const totalTime = Math.round(performance.now() - overallStart)

    // ── 7. 返回（Vision-Native 格式） ──
    return NextResponse.json({
      success: true,
      data: {
        // VisionDocument（核心数据源）
        visionDocument: visionDoc,
        // 原始 Markdown（唯一预览/分析来源）
        markdown,
        // 图片批次信息
        pageCount: batch.totalPages,
        sourceFiles: batch.sourceFiles,
        // Vision 元信息
        vision: {
          model: visionDoc.model,
          durationMs: visionDoc.durationMs,
          cacheHit,
          retried,
          sourceImages: visionDoc.sourceImages,
        },
        // 时线统计
        timeline: {
          imageBatch: timeline.imageBatch,
          vision: timeline.vision,
          total: totalTime,
        },
        warnings: [],
        overallQuality: 100,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传处理失败'
    console.error('[api/upload-exam] Error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
