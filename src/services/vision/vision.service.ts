// ── VisionService — Vision-Native 主编排器（Phase 15-N） ───
// 职责：
// 1. ImageBatchBuilder 构建图片批次
// 2. ImageFingerprintService 缓存检查
// 3. VisionProvider 调用
// 4. VisionFallbackService 错误恢复
// 5. 返回结构化 VisionDocument

import { ImageBatchBuilder } from '@/services/image-batch-builder/image-batch-builder.service'
import type { ImageBatchResult } from '@/services/image-batch-builder/types'
import { DoubaoVisionProvider } from './doubao-vision-provider'
import { ImageFingerprintService } from './image-fingerprint.service'
import { VisionFallbackService } from './vision-fallback.service'
import type { VisionProvider } from './vision-provider'
import type { VisionDocument } from '@/types/vision-document'

/** VisionService 分析结果 */
export type VisionServiceResult = {
  /** 结构化文档 */
  document: VisionDocument
  /** 构建好的图片文件（用于外部审计） */
  batch: ImageBatchResult
  /** 时线统计 */
  timeline: {
    imageBatch: number   // 图片批次构建用时 (ms)
    vision: number       // Vision API 调用用时 (ms)
    total: number        // 总用时 (ms)
  }
  /** 缓存命中 */
  cacheHit: boolean
  /** 是否触发重试 */
  retried: boolean
}

/** VisionService 选项 */
export type VisionServiceOptions = {
  apiKey?: string
  /** 是否启用缓存（默认 true） */
  useCache?: boolean
  /** 是否启用重试（默认 true） */
  useFallback?: boolean
}

export class VisionService {
  private static defaultProvider: VisionProvider = new DoubaoVisionProvider()

  /**
   * 设置默认 Provider（用于测试或切换模型）
   */
  static setProvider(provider: VisionProvider): void {
    VisionService.defaultProvider = provider
  }

  /**
   * 分析上传文件，返回结构化 VisionDocument
   *
   * @param fileBuffers 上传文件列表（图片 / PDF）
   * @param options      可选项
   * @param provider     自定义 VisionProvider（默认 Doubao）
   */
  static async analyze(
    fileBuffers: { buffer: Buffer; filename: string; size: number; mimeType: string }[],
    options?: VisionServiceOptions,
    provider?: VisionProvider,
  ): Promise<VisionServiceResult> {
    const overallStart = performance.now()
    const activeProvider = provider ?? VisionService.defaultProvider

    // ── Step 1: 构建图片批次 ──
    const t0 = performance.now()
    const batch = await ImageBatchBuilder.build(fileBuffers)
    const imageBatchTime = Math.round(performance.now() - t0)

    // ── Step 2: 计算指纹，检查缓存 ──
    const useCache = options?.useCache ?? true
    const fingerprint = ImageFingerprintService.compositeFingerprint(
      fileBuffers.map(f => ({ buffer: f.buffer, filename: f.filename })),
    )

    if (useCache) {
      const cached = ImageFingerprintService.get<VisionDocument>(fingerprint)
      if (cached) {
        const totalTime = Math.round(performance.now() - overallStart)
        return {
          document: cached,
          batch,
          timeline: { imageBatch: imageBatchTime, vision: 0, total: totalTime },
          cacheHit: true,
          retried: false,
        }
      }
    }

    // ── Step 3: Vision 调用 ──
    const t1 = performance.now()
    const imageContexts = fileBuffers.map(f => ({
      buffer: f.buffer,
      filename: f.filename,
      mimeType: f.mimeType || 'image/jpeg',
    }))

    // 首次调用
    const initialDoc = await activeProvider.analyzeImages(imageContexts, {
      apiKey: options?.apiKey,
    })
    const visionTime = Math.round(performance.now() - t1)

    // ── Step 4: 错误恢复 ──
    let retried = false
    let finalDoc = initialDoc

    if (options?.useFallback ?? true) {
      const fallbackResult = await VisionFallbackService.withRetry(initialDoc, async () => {
        // 低温度重试
        return activeProvider.analyzeImages(imageContexts, {
          apiKey: options?.apiKey,
        })
      })
      retried = fallbackResult.retried
      finalDoc = fallbackResult.document
    }

    // ── Step 5: 更新缓存 ──
    if (useCache) {
      ImageFingerprintService.set(fingerprint, finalDoc)
    }

    const totalTime = Math.round(performance.now() - overallStart)

    return {
      document: finalDoc,
      batch,
      timeline: {
        imageBatch: imageBatchTime,
        vision: visionTime,
        total: totalTime,
      },
      cacheHit: false,
      retried,
    }
  }

  /**
   * 健康检查
   */
  static async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return VisionService.defaultProvider.healthCheck()
  }
}
