// ── Hybrid OCR 服务 ────────────────────────────────────────
// ⚠️ 已弃用 — Phase 15-N 迁移至 VisionService
// 保留用于向后兼容（api/ocr, api/answer-sheet/ocr 仍依赖此服务）
// 新代码请使用 VisionService（@/services/vision）
//
// 统一入口，根据模式选择引擎：
//   LOCAL → PaddleOCR
//   SMART → PaddleOCR → 质量评估 → <75 → Doubao Vision
//   HIGH_ACCURACY → Doubao Vision

import { OcrMode, type OcrResultWithMeta } from './types'
import { PaddleOCRService } from './paddle-ocr.service'
import { DoubaoOCRService } from './doubao-ocr.service'

export class HybridOCRService {
  /**
   * 根据 OCR 模式选择引擎识别
   * @param file 上传的文件
   * @param mode OCR 模式
   * @param filename 文件名
   */
  static async recognize(
    file: File,
    mode: OcrMode = OcrMode.SMART,
    apiKeyOverride?: string,
  ): Promise<OcrResultWithMeta> {
    switch (mode) {
      case OcrMode.LOCAL:
        return PaddleOCRService.recognize(file, mode)

      case OcrMode.HIGH_ACCURACY:
        return DoubaoOCRService.recognize(file, mode, apiKeyOverride)

      case OcrMode.SMART: {
        // STEP 1: 先用 PaddleOCR 识别
        let paddleResult: OcrResultWithMeta
        try {
          paddleResult = await PaddleOCRService.recognize(file, mode)
        } catch (paddleErr) {
          // PaddleOCR 不可用时自动降级到 Doubao Vision
          const msg = paddleErr instanceof Error ? paddleErr.message : String(paddleErr)
          console.warn(`[HybridOCR] PaddleOCR 不可用 (${msg})，降级到 Doubao Vision`)
          const doubaoResult = await DoubaoOCRService.recognize(file, mode, apiKeyOverride)
          doubaoResult.elapsed = doubaoResult.elapsed // 仅 Doubao 耗时
          return doubaoResult
        }

        // STEP 2: 质量评估，>=75 分直接返回
        if (paddleResult.quality.score >= 75) {
          return paddleResult
        }

        // STEP 3: 质量不足，自动切换到 Doubao Vision
        // 注意：Paddle 已经消耗了 elapsed 时间
        const doubaoResult = await DoubaoOCRService.recognize(file, mode, apiKeyOverride)

        // 合并耗时（Paddle 耗时 + Doubao 耗时）
        doubaoResult.elapsed = paddleResult.elapsed + doubaoResult.elapsed

        return doubaoResult
      }

      default:
        throw new Error(`未知的 OCR 模式: ${mode}`)
    }
  }

  /**
   * 检查各引擎健康状态
   */
  static async healthCheck() {
    const [paddle, doubao] = await Promise.all([
      PaddleOCRService.healthCheck(),
      DoubaoOCRService.healthCheck(),
    ])

    return {
      paddle,
      doubao,
      allOk: paddle.ok && doubao.ok,
    }
  }

  /**
   * 批量识别：支持多页图片同时上传。
   * 大模型模式下所有图片合成一次 API 调用（模型同时看到所有页面）；
   * 本地模式下并行调用 PaddleOCR 后合并结果。
   * @param files 多页图片文件
   * @param mode OCR 模式
   * @param apiKeyOverride 可选的 API Key 覆盖
   */
  static async recognizeBatch(
    files: File[],
    mode: OcrMode = OcrMode.SMART,
    apiKeyOverride?: string,
  ): Promise<OcrResultWithMeta> {
    if (files.length === 0) throw new Error('没有文件')
    if (files.length === 1) {
      // 单张走原有流程
      return this.recognize(files[0], mode, apiKeyOverride)
    }

    switch (mode) {
      case OcrMode.LOCAL:
        return PaddleOCRService.recognizeBatch(files, mode)

      case OcrMode.HIGH_ACCURACY:
        // 所有图片一起发送给 Doubao，让模型同时看到所有页面
        return DoubaoOCRService.recognizeBatch(files, mode, apiKeyOverride)

      case OcrMode.SMART: {
        // STEP 1: 先用 PaddleOCR 批量识别
        let paddleResult: OcrResultWithMeta
        try {
          paddleResult = await PaddleOCRService.recognizeBatch(files, mode)
        } catch (paddleErr) {
          // PaddleOCR 不可用时自动降级到 Doubao Vision
          const msg = paddleErr instanceof Error ? paddleErr.message : String(paddleErr)
          console.warn(`[HybridOCR] PaddleOCR 不可用 (${msg})，降级到 Doubao Vision`)
          const doubaoResult = await DoubaoOCRService.recognizeBatch(files, mode, apiKeyOverride)
          return doubaoResult
        }

        // STEP 2: 质量评估，>=75 分直接返回
        if (paddleResult.quality.score >= 75) {
          return paddleResult
        }

        // STEP 3: 质量不足，自动切换到 Doubao Vision（所有图片一起发送）
        const doubaoResult = await DoubaoOCRService.recognizeBatch(files, mode, apiKeyOverride)

        // 合并耗时（Paddle 耗时 + Doubao 耗时）
        doubaoResult.elapsed = paddleResult.elapsed + doubaoResult.elapsed

        return doubaoResult
      }

      default:
        throw new Error(`未知的 OCR 模式: ${mode}`)
    }
  }
}
