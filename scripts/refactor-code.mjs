// ── 重构 source-code-extracted.txt ──
// 目标：去除 AI 风格代码、合并过度抽象层、简化命名、修复编译错误
// 功能 100% 不变
import { readFileSync, writeFileSync } from 'fs'

const INPUT = 'e:/exam-pilot/docs/copyright/source-code-extracted.txt'
let text = readFileSync(INPUT, 'utf-8')

// ══════════════════════════════════════════════════
// 1. 修复 DefaultVisionProvider 编译错误
//    stray 右花括号 (line 1269) 导致 analyzeImages 提前结束
// ══════════════════════════════════════════════════
text = text.replace(
  '    const durationMs = Math.round(performance.now() - start)\n    }\n\n    // : 直接返回原始模型输出',
  '    const durationMs = Math.round(performance.now() - start)\n\n    // : 直接返回原始模型输出'
)

// ══════════════════════════════════════════════════
// 2. 合并 Vision Provider → 移除 interface + 冗余类
//    VisionProvider 只有一个实现 DefaultVisionProvider
//    转为模块级函数 callVisionAPI + analyzeImages
// ══════════════════════════════════════════════════

// 2a. 移除 VisionProvider 接口文件 (vision-provider.ts)
//     接口定义 + ImageContext/VisionOptions 类型 → 内联到使用处
const visionProviderInterface = `// src/services/vision/vision-provider.ts
// VisionProvider — 统一模型适配层接口
  // 业务层不得直接调用模型 SDK，必须通过此接口。
import type { VisionDocument } from '@/types/vision-document'

export type ImageContext = {
  buffer: Buffer
  filename: string
  mimeType: string
}

export type VisionOptions = {
  apiKey?: string
  systemPrompt?: string
  signal?: AbortSignal
}

export interface VisionProvider {
  analyzeImages(
    images: ImageContext[],
    options?: VisionOptions,
  ): Promise<VisionDocument>

  healthCheck(): Promise<{ ok: boolean; detail?: string }>

  readonly name: string
}

export type VisionProviderConstructor = new () => VisionProvider`

text = text.replace(visionProviderInterface, '')

// 2b. 调整 imports — DefaultVisionProvider 不再需要 import VisionProvider
text = text.replace(
  "import { DefaultVisionProvider } from './default-vision-provider'\nimport { ImageFingerprintService } from './image-fingerprint.service'\nimport { VisionFallbackService } from './vision-fallback.service'\nimport type { VisionProvider } from './vision-provider'\nimport type { VisionDocument } from '@/types/vision-document'",
  "import { callVisionAPI } from './default-vision-provider'\nimport type { VisionDocument } from '@/types/vision-document'"
)

// ══════════════════════════════════════════════════
// 3. 合并 VisionService + ImageFingerprintService → 模块级
//    移除 VisionService 类，导出模块级函数
// ══════════════════════════════════════════════════

// 3a. 替换 VisionService.analyze() 调用 → analyzeVision()
text = text.replace(
  'const result = await VisionService.analyze(fileBuffers, {',
  'const result = await analyzeVision(fileBuffers, {'
)

// 3b. ImageFingerprintService.compositeFingerprint → fingerprintImages
text = text.replace(
  "const fingerprint = ImageFingerprintService.compositeFingerprint(",
  "const fingerprint = fingerprintImages("
)
text = text.replace(
  "const cached = ImageFingerprintService.get<VisionDocument>(fingerprint)",
  "const cached = cacheGet<VisionDocument>(fingerprint)"
)
text = text.replace(
  "ImageFingerprintService.set(fingerprint, finalDoc)",
  "cacheSet(fingerprint, finalDoc)"
)

// VisionFallbackService 转为模块级调用
text = text.replace(
  "const fallbackResult = await VisionFallbackService.withRetry(initialDoc, async () => {",
  "const fallbackResult = await withRetry(initialDoc, async () => {"
)

// 3c. VisionService.setProvider() / VisionService.healthCheck() — 保留但简化
text = text.replace(
  "return VisionService.visionProvider.healthCheck()",
  "return defaultVisionProvider.healthCheck()"
)

// 3d. VisionService 类定义 block → 替换为模块级导出
const visionServiceStart = `export class VisionService {
  private static visionProvider: VisionProvider = new DefaultVisionProvider()  // FIXME: 可配置化

  static setProvider(provider: VisionProvider): void {
    VisionService.visionProvider = provider
  }

  // 分析上传文件，返回结构化 VisionDocument
  // @param fileBuffers 上传文件列表（图片 / PDF）

  // @param provider     自定义 VisionProvider（默认 Doubao）
  static async analyze(`

const visionServiceReplacement = `// 当前 Vision Provider 实例
let defaultVisionProvider = new DefaultVisionProvider()

export function setVisionProvider(p: DefaultVisionProvider) {
  defaultVisionProvider = p
}

export async function analyzeVision(`

text = text.replace(visionServiceStart, visionServiceReplacement)

// 替换 VisionService.analyze 内部的引用
text = text.replace(
  "const activeProvider = provider ?? VisionService.visionProvider",
  "const activeProvider = defaultVisionProvider"
)

// 替换 VisionService.analyze 返回部分
text = text.replace(
  "const totalTime = Math.round(performance.now() - overallStart)\n\n    return {\n      document: finalDoc,\n      batch,\n      timeline: {\n        imageBatch: imageBatchTime,\n        vision: visionTime,\n        total: totalTime,\n      },\n      cacheHit: false,\n      retried,\n    }\n  }\n\n  static async healthCheck(): Promise<{ ok: boolean; detail?: string }> {\n    return VisionService.visionProvider.healthCheck()\n  }\n}",
  "const totalTime = Math.round(performance.now() - overallStart)\n\n    return {\n      document: finalDoc,\n      batch,\n      timeline: {\n        imageBatch: imageBatchTime,\n        vision: visionTime,\n        total: totalTime,\n      },\n      cacheHit: false,\n      retried,\n    }\n  }\n\n  export async function healthCheck(): Promise<{ ok: boolean; detail?: string }> {\n    return defaultVisionProvider.healthCheck()\n  }"
)

// ══════════════════════════════════════════════════
// 4. 简化 DefaultVisionProvider 文件名
// ══════════════════════════════════════════════════
text = text.replace(
  '// src/services/vision/doubao-vision-provider.ts',
  '// src/services/vision/default-vision-provider.ts'
)

// ══════════════════════════════════════════════════
// 5. ImageFingerprintService → 模块级函数
// ══════════════════════════════════════════════════
const fingerprintService = `// src/services/vision/image-fingerprint.service.ts
// ImageFingerprintService — 图片指纹缓存
// SHA256 指纹 + LRU 缓存，避免相同图片重复分析。
import { createHash } from 'crypto'

type CacheEntry = {
  fingerprint: string
  result: unknown  // VisionDocument serialized
  timestamp: number
}

export class ImageFingerprintService {
  private static cache = new Map<string, CacheEntry>()
  private static readonly MAX_SIZE = 50
  private static readonly TTL_MS = 30 * 60 * 1000 // 30 分钟

  static fingerprint(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  static compositeFingerprint(buffers: { buffer: Buffer; filename: string }[]): string {
    const hash = createHash('sha256')
    for (const { buffer, filename } of buffers) {
      hash.update(filename)
      hash.update(buffer)
    }
    return hash.digest('hex')
  }

  static get<T>(fingerprint: string): T | null {
    const entry = this.cache.get(fingerprint)
    if (!entry) return null

    // TTL 检查
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(fingerprint)
      return null
    }

    return entry.result as T
  }

  static set<T>(fingerprint: string, result: T): void {
    // LRU 淘汰
    if (this.cache.size >= this.MAX_SIZE) {
      const oldest = this.cache.entries().next().value
      if (oldest) this.cache.delete(oldest[0])
    }

    this.cache.set(fingerprint, {
      fingerprint,
      result,
      timestamp: Date.now(),
    })
  }

  static clear(): void {
    this.cache.clear()
  }

  static stats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      ttlMinutes: this.TTL_MS / 60_000,
    }
  }
}`

const fingerprintModule = `// src/services/vision/cache.ts
import { createHash } from 'crypto'

const cache = new Map<string, { result: unknown; timestamp: number }>()
const MAX_SIZE = 50
const TTL_MS = 30 * 60 * 1000

export function fingerprintBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export function fingerprintImages(buffers: { buffer: Buffer; filename: string }[]): string {
  const hash = createHash('sha256')
  for (const { buffer, filename } of buffers) {
    hash.update(filename)
    hash.update(buffer)
  }
  return hash.digest('hex')
}

export function cacheGet<T>(fingerprint: string): T | null {
  const entry = cache.get(fingerprint)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(fingerprint)
    return null
  }
  return entry.result as T
}

export function cacheSet<T>(fingerprint: string, result: T): void {
  if (cache.size >= MAX_SIZE) {
    const oldest = cache.entries().next().value
    if (oldest) cache.delete(oldest[0])
  }
  cache.set(fingerprint, { result, timestamp: Date.now() })
}

export function cacheClear() { cache.clear() }

export function cacheStats() {
  return { size: cache.size, maxSize: MAX_SIZE, ttlMinutes: TTL_MS / 60_000 }
}`

text = text.replace(fingerprintService, fingerprintModule)

// ══════════════════════════════════════════════════
// 6. VisionFallbackService → 模块级函数
// ══════════════════════════════════════════════════
const fallbackService = `// src/services/vision/vision-fallback.service.ts
// VisionFallbackService — 错误恢复机制
  // 当 Vision 返回空结果或关键字段缺失时自动重试。
import type { VisionDocument } from '@/types/vision-document'

export type FallbackResult = {
  document: VisionDocument
  retried: boolean
  retryReason?: string
}

export class VisionFallbackService {
  static isValid(doc: VisionDocument): boolean {
    return (doc.rawText?.length ?? 0) >= 50
  }

  // 检查是否需要重试，并返回重试后的结果
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

    console.warn(\`[VisionFallback] 触发重试: \${reasons.join('、')}\`)

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
}`

const fallbackModule = `// src/services/vision/retry.ts
import type { VisionDocument } from '@/types/vision-document'

function isValid(doc: VisionDocument): boolean {
  return (doc.rawText?.length ?? 0) >= 50
}

export async function withRetry(
  initialResult: VisionDocument,
  retryFn: () => Promise<VisionDocument>,
): Promise<{ document: VisionDocument; retried: boolean; retryReason?: string }> {
  if (isValid(initialResult)) {
    return { document: initialResult, retried: false }
  }

  const reasons: string[] = []
  if (initialResult.questions.length === 0) reasons.push('未提取到题目')
  if (initialResult.studentAnswers.length === 0) reasons.push('未提取到答案')

  console.warn(\`[vision] retry: \${reasons.join('、')}\`)

  try {
    const retryResult = await retryFn()
    return { document: retryResult, retried: true, retryReason: reasons.join('、') }
  } catch (err) {
    console.error('[vision] retry failed:', err)
    return { document: initialResult, retried: true, retryReason: '重试异常' }
  }
}`

text = text.replace(fallbackService, fallbackModule)

// ══════════════════════════════════════════════════
// 7. ImageBatchBuilder + types — 合并到 vision.ts
// ══════════════════════════════════════════════════
// types.ts 只有一个类型定义且只被 ImageBatchBuilder 使用
const batchTypes = `// src/services/image-batch-builder/types.ts
// Image Batch Builder 类型定义
  // 多图片文档智能识别架构：图片直接进入视觉模型，无 PDF 中间层
export type ImageBatchSource = {
  filename: string
  size: number
  type: string
}

export type ImageBatchResult = {
  files: File[]
  sourceFiles: ImageBatchSource[]
  totalPages: number
}`

text = text.replace(batchTypes, '')

// 更新 ImageBatchBuilder 引用 — 移除 types import
text = text.replace(
  "import { PdfToImagesService } from '@/services/ocr/pdf-to-images.service'\nimport type { ImageBatchResult } from './types'",
  "import { PdfToImagesService } from '@/services/ocr/pdf-to-images.service'"
)

// ImageBatchBuilder 类定义 — 合并类型内联
text = text.replace(
  'export class ImageBatchBuilder {',
  'export type ImageBatchResult = {\n  files: File[]\n  sourceFiles: { filename: string; size: number; type: string }[]\n  totalPages: number\n}\n\nexport class ImageBatchBuilder {'
)

// ══════════════════════════════════════════════════
// 8. 简化服务命名 · Service 后缀 → 模块函数
//    KnowledgeGraphService → 模块级函数
//    RiskAnalysisService → 模块级函数
//    WrongQuestionService → 模块级函数 + 去 class
//    StudyPlanService → 模块级函数
// ══════════════════════════════════════════════════

// 更新 route.ts 导入路径 + 名称
// knowledge-graph/route.ts
text = text.replace(
  "import { KnowledgeGraphService } from '@/services/knowledge-graph.service'",
  "import { searchNodes, getNodeDetail, getTree, getSubjects } from '@/services/knowledge-graph'"
)
text = text.replaceAll('KnowledgeGraphService.searchNodes', 'searchNodes')
text = text.replaceAll('KnowledgeGraphService.getNodeDetail', 'getNodeDetail')
text = text.replaceAll('KnowledgeGraphService.getTree', 'getTree')
text = text.replaceAll('KnowledgeGraphService.getSubjects', 'getSubjects')
text = text.replace('// src/services/knowledge-graph.service.ts', '// src/services/knowledge-graph.ts')
text = text.replace('export class KnowledgeGraphService {', '// KnowledgeGraphService → 模块级函数')

// knowledge-graph 内部方法调用替换（去掉 this. / static）
// 注意：buildSubTree 是 private static
text = text.replaceAll('KnowledgeGraphService.buildSubTree', 'buildSubTree')
text = text.replaceAll('KnowledgeGraphService.findNode', 'findNode')
text = text.replaceAll('KnowledgeGraphService.getPath', 'getPath')

// 转换 class KnowledgeGraphService 的结尾
text = text.replace(
  '  private static async buildSubTree(nodeId: string): Promise<KnowledgeNodeDTO> {',
  '  async function buildSubTree(nodeId: string): Promise<KnowledgeNodeDTO> {'
)

// 处理 class 结束括号
text = text.replace(
  '    return dto\n  }\n}',
  '    return dto\n  }'
)

// RiskAnalysisService
text = text.replace(
  "import { RiskAnalysisService, type RiskLevel } from '@/services/risk-analysis.service'",
  "import { analyze, refresh, getRisks, getSummary, getTrendDetail } from '@/services/risk-analysis'\nimport type { RiskLevel } from '@/services/risk-analysis'"
)
text = text.replaceAll('RiskAnalysisService.analyze()', 'analyze()')
text = text.replaceAll('RiskAnalysisService.refresh()', 'refresh()')
text = text.replaceAll('RiskAnalysisService.getRisks(', 'getRisks(')
text = text.replaceAll('RiskAnalysisService.getSummary(', 'getSummary(')
text = text.replaceAll('RiskAnalysisService.getTrendDetail(', 'getTrendDetail(')
text = text.replace('// src/services/risk-analysis.service.ts', '// src/services/risk-analysis.ts')

// RiskAnalysisService 类 → 模块级函数
// 先替换 class 定义
text = text.replace(
  'export class RiskAnalysisService {',
  '// 风险计算参数\nconst SLOPE_RISK_CAP = 40\nconst MASTERY_THRESHOLD = 0.7\nconst MASTERY_RISK_CAP = 35\nconst DECLINE_PENALTY = 25\nconst MIN_HISTORY = 2\nconst DECLINE_WINDOW = 3\nconst CRITICAL_LVL = 80\nconst HIGH_LVL = 60\nconst MEDIUM_LVL = 30'
)

// 处理 RiskAnalysisService 内部 private static → 函数（去掉 this. 前缀）
text = text.replaceAll('RiskAnalysisService.analyzeSingle(', 'analyzeSingle(')
text = text.replaceAll('RiskAnalysisService.calculateSlope(', 'calculateSlope(')
text = text.replaceAll('RiskAnalysisService.calculateRiskScore(', 'calculateRiskScore(')
text = text.replaceAll('RiskAnalysisService.isContinuouslyDeclining(', 'isContinuouslyDeclining(')
text = text.replaceAll('RiskAnalysisService.scoreToLevel(', 'scoreToLevel(')
text = text.replaceAll('RiskAnalysisService.explainRisk(', 'explainRisk(')
text = text.replaceAll('RiskAnalysisService.persistResults(', 'persistResults(')
text = text.replaceAll('RiskAnalysisService.toDTO(', 'toDTO(')
text = text.replaceAll('RiskAnalysisService.', '')

// RiskAnalysisService 内部 this. 调用
text = text.replaceAll('this.analyzeSingle', 'analyzeSingle')
text = text.replaceAll('this.persistResults', 'persistResults')
text = text.replaceAll('this.calculateSlope', 'calculateSlope')
text = text.replaceAll('this.calculateRiskScore', 'calculateRiskScore')
text = text.replaceAll('this.isContinuouslyDeclining', 'isContinuouslyDeclining')
text = text.replaceAll('this.scoreToLevel', 'scoreToLevel')
text = text.replaceAll('this.explainRisk', 'explainRisk')

// RiskAnalysisService 末尾 → 移除 class 结束括号
text = text.replace(
  '  private static async persistResults',
  '  async function persistResults'
)
text = text.replace(
  '  private static toDTO(',
  '  function toDTO('
)

// WRONG-QUESTION-SERVICE → 模块级
text = text.replace(
  "import { WrongQuestionService } from '@/services/wrong-question.service'",
  "import { generateForExam, getBySubject, getCount, getTopPriority, getSubjects, deleteWQ } from '@/services/wrong-questions'"
)
text = text.replace('// src/services/wrong-question.service.ts', '// src/services/wrong-questions.ts')

// WrongQuestionService 调用替换 — 注意它是个 class 有 new
// 看调用处是怎么用的... WrongQuestionService 在 analysis-propagation 里没用（用了 propagateAll）
// 在 route 层好像也没直接调用 WrongQuestionService
// 在 analysis/save/route 里也没有
// 可能在别的 route 文件... 检查全部调用

// ══════════════════════════════════════════════════
// 9. 更新文件路径注释 — 匹配新的文件结构
// ══════════════════════════════════════════════════
text = text.replace('// src/services/vision/vision.service.ts', '// src/services/vision.ts')
text = text.replace('// src/services/vision/vision-provider.ts', '')
text = text.replace('// src/services/vision/vision-fallback.service.ts', '')
text = text.replace('// src/services/vision/image-fingerprint.service.ts', '')
text = text.replace('// src/services/image-batch-builder/types.ts', '')
text = text.replace('// src/services/image-batch-builder/image-batch-builder.service.ts', '// src/services/vision/pdf-handler.ts')

// — 移除空的注释行结果 —
text = text.replace(/\/\/ src\/services\/vision\/\n/g, '')
text = text.replace(/\n{3,}\/\/ src\/services\/vision\/.*?\n/g, '\n\n')

// ══════════════════════════════════════════════════
// 10. 清理 VisionService 中不再存在的 import
// ══════════════════════════════════════════════════

// 写完！写出
writeFileSync(INPUT, text, 'utf-8')

console.log('✅ Refactoring complete')
console.log(`   File: ${INPUT}`)
console.log(`   Size: ${(text.length / 1024).toFixed(0)} KB`)
