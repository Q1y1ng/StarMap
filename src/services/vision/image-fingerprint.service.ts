// ── ImageFingerprintService — 图片指纹缓存（Phase 15-N） ───
// SHA256 指纹 + LRU 缓存，避免相同图片重复分析。

import { createHash } from 'crypto'

/** 缓存条目 */
type CacheEntry = {
  fingerprint: string
  result: unknown  // VisionDocument serialized
  timestamp: number
}

export class ImageFingerprintService {
  private static cache = new Map<string, CacheEntry>()
  private static readonly MAX_SIZE = 50
  private static readonly TTL_MS = 30 * 60 * 1000 // 30 分钟

  /**
   * 计算单个 Buffer 的 SHA256 指纹
   */
  static fingerprint(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  /**
   * 计算多图片的组合指纹（按文件顺序）
   */
  static compositeFingerprint(buffers: { buffer: Buffer; filename: string }[]): string {
    const hash = createHash('sha256')
    for (const { buffer, filename } of buffers) {
      hash.update(filename)
      hash.update(buffer)
    }
    return hash.digest('hex')
  }

  /**
   * 检查缓存命中
   */
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

  /**
   * 写入缓存
   */
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

  /**
   * 清空缓存
   */
  static clear(): void {
    this.cache.clear()
  }

  /**
   * 缓存统计
   */
  static stats(): { size: number; maxSize: number; ttlMinutes: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      ttlMinutes: this.TTL_MS / 60_000,
    }
  }
}
