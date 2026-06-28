// ── 重构 #1: 合并 Vision层 / 修复编译错误 / 简化过度抽象 ──
import { readFileSync, writeFileSync } from 'fs'

const INPUT = 'e:/exam-pilot/docs/copyright/source-code-extracted.txt'
let text = readFileSync(INPUT, 'utf-8')

// ══════════════════════════════════════
// 1. 修复编译错误: stray 花括号
//    analyzeImages 中 const durationMs = ... 后面多了个 } 导致方法提前结束
// ══════════════════════════════════════
text = text.replace(
  'const durationMs = Math.round(performance.now() - start)\n    }\n\n    // : 直接返回原始模型输出',
  'const durationMs = Math.round(performance.now() - start)\n\n    // : 直接返回原始模型输出'
)

// ══════════════════════════════════════
// 2. 合并 VisionProvider 接口 → 类型内联
//    只有一个实现 DefaultVisionProvider，接口不必单独存在
// ══════════════════════════════════════

// 2a. 移除 vision-provider.ts 整个文件块
const providerStart = text.indexOf('// src/services/vision/vision-provider.ts')
if (providerStart >= 0) {
  const providerEnd = text.indexOf('export type VisionProviderConstructor = new () => VisionProvider', providerStart)
  if (providerEnd >= 0) {
    const blockEnd = text.indexOf('\n\n', providerEnd) // 空行结尾
    const endPos = blockEnd > providerEnd ? blockEnd : providerEnd + 80
    // 去掉从 // src/services/vision/vision-provider.ts 到空行后的部分
    const before = text.slice(0, providerStart).replace(/\n+$/, '\n')
    const after = text.slice(endPos)
    text = before + '\n' + after
  }
}

// 2b. clean up 残留的空文件注释
text = text.replace(/\/\/ src\/services\/vision\/\n/g, '')

// ══════════════════════════════════════
// 3. ImageFingerprintService class → 模块级函数
//   习惯是 module-level cache，不是 class
// ══════════════════════════════════════
text = text.replace(
  '// src/services/vision/image-fingerprint.service.ts\n// ImageFingerprintService — 图片指纹缓存\n// SHA256 指纹 + LRU 缓存，避免相同图片重复分析。',
  '// src/services/vision/cache.ts'
)

// 把 class 定义替换
text = text.replace(
  'export class ImageFingerprintService {\n  private static cache = new Map<string, CacheEntry>()\n  private static readonly MAX_SIZE = 50\n  private static readonly TTL_MS = 30 * 60 * 1000 // 30 分钟',
  'const cache = new Map<string, CacheEntry>()\nconst MAX_SIZE = 50\nconst TTL_MS = 30 * 60 * 1000'
)

// static 方法 → 命名导出
text = text.replace('static fingerprint(buffer: Buffer): string {', 'export function fingerprintBuffer(buffer: Buffer): string {')
text = text.replace('static compositeFingerprint(buffers: { buffer: Buffer; filename: string }[]): string {', 'export function compositeFingerprint(buffers: { buffer: Buffer; filename: string }[]): string {')
text = text.replace('static get<T>(fingerprint: string): T | null {', 'export function cacheGet<T>(fingerprint: string): T | null {')
text = text.replace('static set<T>(fingerprint: string, result: T): void {', 'export function cacheSet<T>(fingerprint: string, result: T): void {')
text = text.replace('static clear(): void {', 'export function cacheClear(): void {')
text = text.replace('static stats(): { size: number; maxSize: number; ttlMinutes: number } {', 'export function cacheStats(): { size: number; maxSize: number; ttlMinutes: number } {')

// this.cache → cache, this.MAX_SIZE → MAX_SIZE
text = text.replace(/this\.cache/g, 'cache')
text = text.replace(/this\.MAX_SIZE/g, 'MAX_SIZE')
text = text.replace(/this\.TTL_MS/g, 'TTL_MS')

// 关闭 ImageFingerprintService class 的最后一个括号
// 找到最后一个 export function ... } 后的单独 }
const classEnd = text.lastIndexOf('}\n\n// src/services/vision/vision-fallback')
if (classEnd >= 0) {
  text = text.slice(0, classEnd) + text.slice(classEnd + 1)
}

// ══════════════════════════════════════
// 4. VisionFallbackService class → 模块级函数
// ══════════════════════════════════════
text = text.replace(
  '// src/services/vision/vision-fallback.service.ts\n// VisionFallbackService — 错误恢复机制\n  // 当 Vision 返回空结果或关键字段缺失时自动重试。',
  '// src/services/vision/retry.ts'
)

text = text.replace('export type FallbackResult = {', 'type FallbackResult = {')
text = text.replace('export class VisionFallbackService {', '')
text = text.replace('  static isValid(doc: VisionDocument): boolean {', 'function isValid(doc: VisionDocument): boolean {')
text = text.replace('  static async withRetry(', 'export async function withRetry(')
text = text.replace(/this\.isValid/g, 'isValid')
// 移除 class 最后的 }
const fbEnd = text.lastIndexOf('}\n\n// src/services/vision/vision.service.ts')
if (fbEnd >= 0) {
  text = text.slice(0, fbEnd) + text.slice(fbEnd + 1)
}

// ══════════════════════════════════════
// 5. VisionService class → 模块级函数 + 合并到 vision.ts
// ══════════════════════════════════════
text = text.replace('// src/services/vision/vision.service.ts\n// VisionService — Vision-Native 主编排器', '// src/services/vision.ts')

// 替换类内部的 static 方法
text = text.replace(
  'import { ImageBatchBuilder } from \'@/services/image-batch-builder/image-batch-builder.service\'',
  'import { ImageBatchBuilder } from \'@/services/vision/pdf-handler\''
)
text = text.replace(
  "import type { ImageBatchResult } from '@/services/image-batch-builder/types'",
  ''
)
text = text.replace(
  "import { DefaultVisionProvider } from './default-vision-provider'\nimport { ImageFingerprintService } from './image-fingerprint.service'\nimport { VisionFallbackService } from './vision-fallback.service'\nimport type { VisionProvider } from './vision-provider'\nimport type { VisionDocument } from '@/types/vision-document'",
  "import { DefaultVisionProvider } from './vision/default-vision-provider'\nimport { compositeFingerprint, cacheGet, cacheSet } from './vision/cache'\nimport { withRetry } from './vision/retry'\nimport type { VisionDocument } from '@/types/vision-document'"
)

// VisionServiceResult 类型保持
// VisionServiceOptions 类型保持
// VisionService 类 → 模块级

text = text.replace(
  'export type VisionServiceOptions = {',
  'export type VisionOptions = {'
)

text = text.replace(
  'export class VisionService {\n  private static visionProvider: VisionProvider = new DefaultVisionProvider()  // FIXME: 可配置化\n\n  static setProvider(provider: VisionProvider): void {\n    VisionService.visionProvider = provider\n  }\n\n  // 分析上传文件，返回结构化 VisionDocument\n  // @param fileBuffers 上传文件列表（图片 / PDF）\n\n  // @param provider     自定义 VisionProvider（默认 Doubao）\n  static async analyze(',
  'const activeProvider = new DefaultVisionProvider()\n\n// FIXME: 多 provider 时提取接口\nexport function setVisionProvider(p: DefaultVisionProvider) {\n  Object.assign(activeProvider, p)\n}\n\nexport async function analyzeVision('
)

// 内部 this.visionProvider → activeProvider
text = text.replace(/VisionService\.visionProvider/g, 'activeProvider')
text = text.replace(/provider \?\? VisionService\.visionProvider/g, 'activeProvider')
text = text.replace(/activeProvider = provider \?\? VisionService\.visionProvider/g, '')
// 移除 provider 参数
text = text.replace(',\n    provider?: VisionProvider,\n  ): Promise<VisionServiceResult> {', '\n  ): Promise<VisionServiceResult> {')

// ImageFingerprintService → 新函数名
text = text.replace(/ImageFingerprintService\.compositeFingerprint\(/g, 'compositeFingerprint(')
text = text.replace(/ImageFingerprintService\.get<VisionDocument>\(fingerprint\)/g, 'cacheGet<VisionDocument>(fingerprint)')
text = text.replace(/ImageFingerprintService\.set\(fingerprint, finalDoc\)/g, 'cacheSet(fingerprint, finalDoc)')
text = text.replace(/VisionFallbackService\.withRetry\(/g, 'withRetry(')

// VisionService.healthCheck
text = text.replace(/  static async healthCheck.*?VisionService\.visionProvider\.healthCheck/,
  '  export async function healthCheck')

// 去掉 class 结尾
const vsEnd = text.lastIndexOf('}\n\n// src/services/vision/retry.ts')
if (vsEnd >= 0) {
  text = text.slice(0, vsEnd) + text.slice(vsEnd + 1)
}

// ══════════════════════════════════════
// 6. 修复 VisionService 返回类型引用
// ══════════════════════════════════════
text = text.replace('VisionServiceResult', 'VisionResult')

// ══════════════════════════════════════
// 7. ImageBatchBuilder types + service 路径更新
// ══════════════════════════════════════
text = text.replace('// src/services/image-batch-builder/types.ts\n// Image Batch Builder 类型定义\n  // 多图片文档智能识别架构：图片直接进入视觉模型，无 PDF 中间层', '')
// 移除 types 内容块
const ibbTypesStart = text.indexOf('export type ImageBatchSource')
if (ibbTypesStart >= 0) {
  const ibbTypesEnd = text.indexOf('}\n\n// src/services/image-batch-builder/', ibbTypesStart)
  if (ibbTypesEnd >= 0) {
    text = text.slice(0, ibbTypesStart) + text.slice(ibbTypesEnd + 2)
  }
}
// ImageBatchBuilder 文件路径更新
text = text.replace('// src/services/image-batch-builder/image-batch-builder.service.ts\n// ImageBatchBuilder — 多图片批次构建器', '// src/services/vision/pdf-handler.ts')

// 移除 ImageBatchBuilder 中多余的 import
text = text.replace(
  "import { PdfToImagesService } from '@/services/ocr/pdf-to-images.service'\nimport type { ImageBatchResult } from './types'",
  "import { PdfToImagesService } from '@/services/ocr/pdf-to-images.service'"
)

// 内联 ImageBatchResult 类型
text = text.replace(
  'export class ImageBatchBuilder {',
  'export type ImageBatchResult = {\n  files: File[]\n  sourceFiles: { filename: string; size: number; type: string }[]\n  totalPages: number\n}\n\nexport class ImageBatchBuilder {'
)

// ══════════════════════════════════════
// 8. DefaultVisionProvider 文件头更新
// ══════════════════════════════════════
text = text.replace(
  '// src/services/vision/doubao-vision-provider.ts\n// DoubaoVisionProvider — Doubao-Seed-1.8-Vision 适配器\n  // 实现 VisionProvider 接口，调用火山引擎 ARK OpenAI 兼容 API。',
  '// src/services/vision/default-vision-provider.ts'
)

// 移除 VisionProvider import — 因为接口不存在了
text = text.replace(
  "import type { VisionProvider, ImageContext, VisionOptions } from './vision-provider'",
  ''
)

// DefaultVisionProvider 不再 implements VisionProvider
text = text.replace('export class DefaultVisionProvider implements VisionProvider {', 'export class DefaultVisionProvider {')

// ══════════════════════════════════════
// 9. 上传 route 更新 VisionService.analyze → analyzeVision
// ══════════════════════════════════════
text = text.replace("import { VisionService } from '@/services/vision'", "import { analyzeVision } from '@/services/vision'")
text = text.replace('const result = await VisionService.analyze(fileBuffers, {', 'const result = await analyzeVision(fileBuffers, {')

// ══════════════════════════════════════
// 10. 清理空行、多余注释
// ══════════════════════════════════════

// 清理 "// " 文件头中的空格号
text = text.replace(/\/\/ \n/g, '\n')

// 清理连续空行
text = text.replace(/\n{4,}/g, '\n\n\n')

writeFileSync(INPUT, text, 'utf-8')
console.log('✅ Vision 层重构完成')
console.log(`   大小: ${(text.length / 1024).toFixed(0)} KB`)
