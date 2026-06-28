// ── VisionFallbackService — 错误恢复机制（Phase 15-N） ─────
// 当 Vision 返回空结果或关键字段缺失时自动重试。

import type { VisionDocument } from '@/types/vision-document'

export type FallbackResult = {
  document: VisionDocument
  retried: boolean
  retryReason?: string
}

export class VisionFallbackService {
  /**
   * 检查 VisionDocument 是否有效（Phase 15-R）
   * rawText 是唯一数据源，只需检查原始文本非空
   */
  static isValid(doc: VisionDocument): boolean {
    return (doc.rawText?.length ?? 0) >= 50
  }

  /**
   * 检查是否需要重试，并返回重试后的结果
   * @param initialResult 首次 Vision 调用结果
   * @param retryFn       重试函数（temperature=0）
   */
  static async withRetry(
    initialResult: VisionDocument,
    retryFn: () => Promise<VisionDocument>,
  ): Promise<FallbackResult> {
    // 结果有效，无需重试
    if (this.isValid(initialResult)) {
      return { document: initialResult, retried: false }
    }

    // 确定重试原因
    const reasons: string[] = []
    if (initialResult.questions.length === 0) reasons.push('未提取到题目')
    if (initialResult.studentAnswers.length === 0) reasons.push('未提取到答案')

    console.warn(`[VisionFallback] 触发重试: ${reasons.join('、')}`)

    // 低温度重试 (temperature=0)
    try {
      const retryResult = await retryFn()

      return {
        document: retryResult,
        retried: true,
        retryReason: reasons.join('、'),
      }
    } catch (err) {
      // 重试也失败，返回原始结果
      console.error('[VisionFallback] 重试失败:', err)
      return { document: initialResult, retried: true, retryReason: '重试异常' }
    }
  }
}
