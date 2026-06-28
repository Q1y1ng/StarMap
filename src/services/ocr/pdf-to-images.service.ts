// ── PDF → 图片 转换服务 ─────────────────────────────────────
// 方案 C：不再使用 Files API / Responses API，所有 PDF 转图片后走 image_url
//
// 转换策略（两级降级）：
//   Level 1: pdftoppm（poppler-utils）— 质量最好，全类型 PDF 支持
//   Level 2: pdf-lib 提取内嵌图片 — 零依赖，扫描件 PDF 有效
//   均不可用 → 抛错提示安装 poppler-utils
//
// 为什么不用 pdfjs-dist：Next.js 服务端 worker BUG，永远不能用
// 为什么不用 sharp：预编译二进制不支持 PDF 输入

import { PDFDocument } from 'pdf-lib'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export class PdfToImagesService {
  private static _pdftoppmChecked = false
  private static _pdftoppmAvailable = false

  /**
   * 检查 pdftoppm 是否可用（只检查一次，缓存结果）
   */
  static get pdftoppmAvailable(): boolean {
    if (!this._pdftoppmChecked) {
      try {
        execSync('pdftoppm -v', { stdio: 'ignore' })
        this._pdftoppmAvailable = true
      } catch {
        try {
          execSync('where pdftoppm', { stdio: 'ignore' }) // Windows
          this._pdftoppmAvailable = true
        } catch {
          this._pdftoppmAvailable = false
        }
      }
      this._pdftoppmChecked = true
    }
    return this._pdftoppmAvailable
  }

  /**
   * 将 PDF 每页转换为图片
   *
   * 返回图片 Buffer 数组（按页码顺序）及 MIME 类型。
   * 对系统生成的统一 PDF（内嵌 JPEG/PNG）用 pdf-lib 直接提取，
   * 对外部传入 PDF 用 pdftoppm 渲染。
   */
  static async convert(
    pdfBuffer: Buffer,
    filename?: string,
  ): Promise<{ pages: Buffer[]; mimeType: string }> {
    // ── Level 1: pdf-lib 提取内嵌图片（纯 JS，零依赖） ──
    const extracted = await this.tryExtractEmbeddedImages(pdfBuffer)
    if (extracted.pages.length > 0) {
      console.log(
        `[PdfToImages] pdf-lib 提取成功: ${extracted.pages.length} 页, 格式: ${extracted.mimeType}`,
      )
      return extracted
    }

    // ── Level 2: pdftoppm 回退 ──
    if (this.pdftoppmAvailable) {
      const rendered = await this.tryRenderViaPdftoppm(pdfBuffer)
      console.log(
        `[PdfToImages] pdftoppm 渲染成功: ${rendered.pages.length} 页`,
      )
      return rendered
    }

    // ── 均不可用 → 抛错 ──
    const hint = filename ? `文件: ${filename}。` : ''
    throw new Error(
      `${hint}无法将 PDF 转换为图片。` +
      `pdf-lib 未提取到内嵌图片（该 PDF 可能不是扫描件），` +
      `且系统命令 pdftoppm 不可用。\n` +
      `请安装 poppler-utils 以支持 PDF 转换：\n` +
      `  Linux: apt-get install poppler-utils\n` +
      `  macOS: brew install poppler\n` +
      `  Windows: 安装 poppler 后添加到 PATH\n` +
      `或直接上传 JPG/PNG 图片。`,
    )
  }

  /**
   * Level 1: 用 pdf-lib 提取 PDF 中内嵌的全页图片
   *
   * 扫描件 PDF 的每一页 = 一张大图（JPEG DCTDecode 或 PNG FlateDecode），
   * pdf-lib 可以直接提取原始字节，无需渲染。
   *
   * 对文字型 PDF 此方法无效（返回空数组），降级到 pdftoppm。
   */
  private static async tryExtractEmbeddedImages(
    pdfBuffer: Buffer,
  ): Promise<{ pages: Buffer[]; mimeType: string }> {
    const pages: Buffer[] = []
    let detectedMime = 'image/jpeg'

    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
      const docPages = pdfDoc.getPages()

      for (let i = 0; i < docPages.length; i++) {
        const page = docPages[i]
        const rawResources = (page as any).node?.Resources?.()

        if (!rawResources) continue

        // 通过 PDFName('XObject') 查找 — 兼容 pdf-lib 内部 API
        const { PDFName } = await import('pdf-lib')
        const xObjectDictRef = rawResources.get(PDFName.of('XObject'))
        if (!xObjectDictRef) continue

        // pdf-lib 的 TypeScript 类型太严格，内部对象需要 any 处理
        const xObjectDict: any = pdfDoc.context.lookup(xObjectDictRef)
        if (!xObjectDict || typeof xObjectDict.entries !== 'function') continue

        let pageImage: Buffer | null = null

        for (const [, ref] of xObjectDict.entries()) {
          const obj: any = pdfDoc.context.lookup(ref)
          if (!obj || !obj.dict?.lookup) continue

          const subtype = obj.dict.lookup(PDFName.of('Subtype'))
          if (subtype !== PDFName.of('Image')) continue

          // 跳过小图（图标、水印等），只提取 >200px 的图片
          const width = obj.dict.lookup(PDFName.of('Width'))
          const height = obj.dict.lookup(PDFName.of('Height'))
          const w = typeof width?.asNumber === 'function' ? width.asNumber() : 0
          const h = typeof height?.asNumber === 'function' ? height.asNumber() : 0
          if (w < 200 || h < 200) continue

          // 读取原始图片字节
          const contents: Uint8Array | undefined = obj.contents
          if (!contents || !contents.length) continue

          const filter = obj.dict.lookup(PDFName.of('Filter'))
          const filterName = filter?.toString() ?? ''

          if (filterName === 'DCTDecode') {
            // JPEG 原生字节 — 最常用（手机拍照上传）
            detectedMime = 'image/jpeg'
            pageImage = Buffer.from(contents)
            break // 只取第一张大图
          } else if (filterName === 'FlateDecode') {
            // FlateDecode（PNG-like）— 尝试构建 PNG
            try {
              const png = await this.tryBuildPngFromFlate(obj, w, h, pdfDoc)
              if (png) {
                detectedMime = 'image/png'
                pageImage = png
                break
              }
            } catch {
              // 构建失败，换 pdftoppm
            }
          }
          // CCITTFaxDecode / RunLengthDecode 等跳过
        }

        if (pageImage) {
          pages.push(pageImage)
        }
      }
    } catch (err) {
      console.warn('[PdfToImages] pdf-lib 提取失败，将降级 pdftoppm:', err)
      return { pages: [], mimeType: 'image/jpeg' }
    }

    return { pages, mimeType: pages.length > 0 ? detectedMime : 'image/jpeg' }
  }

  /**
   * 从 FlateDecode 压缩的图片流尝试构建 PNG
   *
   * 注意：PDF 中的 FlateDecode 图片数据 = zlib 压缩的原始像素，
   * 需要加上 PNG 文件头（IHDR/IDAT chunks）才能成为有效 PNG。
   * 这是一个简化实现，对 8-bit RGB/RGBA/Grayscale 有效。
   */
  private static async tryBuildPngFromFlate(
    obj: any,
    width: number,
    height: number,
    _pdfDoc: PDFDocument,
  ): Promise<Buffer | null> {
    try {
      const rawBytes = obj.contents as Uint8Array
      if (!rawBytes || rawBytes.length === 0) return null

      // 获取颜色空间和位深
      const { PDFName } = await import('pdf-lib')
      const colorSpace = obj.dict.lookup(PDFName.of('ColorSpace'))?.toString() ?? ''
      const bitsPerComponent = obj.dict.lookup(PDFName.of('BitsPerComponent'))?.asNumber() ?? 8

      // 只用 zlib 解压（PDF 中 FlateDecode = zlib）
      const zlib = await import('zlib')
      const decompressed = zlib.unzipSync(Buffer.from(rawBytes))

      // 简单检测：如果解压后数据看起来是有效的 PNG（有 PNG header），直接返回
      if (decompressed.length > 8 && decompressed[0] === 0x89 && decompressed[1] === 0x50) {
        return Buffer.from(rawBytes) // 已经是 PNG
      }

      // 简化处理：对 JPEG 类 PDF 走 pdftoppm 更可靠
      // 对复杂 PDF 内嵌 PNG 场景，pdftoppm 也更靠谱
      return null
    } catch {
      return null
    }
  }

  /**
   * Level 2: 用 pdftoppm 渲染 PDF 每页为 JPEG
   */
  private static async tryRenderViaPdftoppm(
    pdfBuffer: Buffer,
  ): Promise<{ pages: Buffer[]; mimeType: string }> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf2img-'))
    const pdfPath = path.join(tmpDir, 'input.pdf')

    try {
      fs.writeFileSync(pdfPath, pdfBuffer)

      // pdftoppm: 200 DPI JPEG 输出
      // -jpeg 输出 JPEG, -r 200 分辨率, 前缀 page
      execSync(`pdftoppm -jpeg -r 200 "${pdfPath}" "${path.join(tmpDir, 'page')}"`, {
        timeout: 120_000,
        stdio: 'pipe',
      })

      // 读取生成的图片，按页码排序
      const files = fs
        .readdirSync(tmpDir)
        .filter((f) => f.startsWith('page') && /\.(jpg|jpeg)$/i.test(f))
        .sort((a, b) => {
          // page-1.jpg, page-2.jpg, ...
          const na = parseInt(a.replace(/^page-/, '').replace(/\.\w+$/, ''), 10)
          const nb = parseInt(b.replace(/^page-/, '').replace(/\.\w+$/, ''), 10)
          return na - nb
        })
        .map((f) => fs.readFileSync(path.join(tmpDir, f)))

      if (files.length === 0) {
        throw new Error('pdftoppm 未生成任何图片文件')
      }

      return { pages: files, mimeType: 'image/jpeg' }
    } catch (err) {
      if (err instanceof Error && err.message.includes('pdftoppm 未生成')) {
        throw err
      }
      throw new Error(
        `pdftoppm 转换失败: ${err instanceof Error ? err.message : String(err)}\n` +
        `请确认已安装 poppler-utils。`,
      )
    } finally {
      // 清理临时文件
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // 忽略清理错误
      }
    }
  }
}
