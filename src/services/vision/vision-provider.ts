// ── VisionProvider — 统一模型适配层接口（Phase 15-N） ──────
// 业务层不得直接调用模型 SDK，必须通过此接口。

import type { VisionDocument } from '@/types/vision-document'

/** 图片上下文 */
export type ImageContext = {
  buffer: Buffer
  filename: string
  mimeType: string
}

/** Vision 调用选项 */
export type VisionOptions = {
  /** 自定义 API Key */
  apiKey?: string
  /** 自定义系统提示词（覆盖默认） */
  systemPrompt?: string
  /** AbortSignal */
  signal?: AbortSignal
}

/**
 * VisionProvider 接口
 *
 * 所有视觉模型适配器必须实现此接口。
 * 当前实现：DoubaoVisionProvider
 * 预留：GeminiVisionProvider, QwenVisionProvider, GPT4oVisionProvider
 */
export interface VisionProvider {
  /**
   * 分析多张图片，返回结构化 VisionDocument
   *
   * 约束：
   * - 一次请求传全部图片（单次上下文调用）
   * - 禁止逐张图片单独调用
   */
  analyzeImages(
    images: ImageContext[],
    options?: VisionOptions,
  ): Promise<VisionDocument>

  /** 健康检查 */
  healthCheck(): Promise<{ ok: boolean; detail?: string }>

  /** 提供者名称标识 */
  readonly name: string
}

/** 可实例化的 Provider 构造函数类型 */
export type VisionProviderConstructor = new () => VisionProvider
