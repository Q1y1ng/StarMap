// ── 深度清理：分割线 / 遗留标记 / 空行 ──
import { readFileSync, writeFileSync } from 'fs'

const INPUT = 'e:/exam-pilot/docs/copyright/source-code-extracted.txt'
const OUTPUT = 'e:/exam-pilot/docs/copyright/source-code-extracted.txt'

let text = readFileSync(INPUT, 'utf-8')
const lines = text.split('\n')

const result = []

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const trimmed = line.trimEnd()
  const trimmedStart = line.trimStart()
  const prev = result.length > 0 ? result[result.length - 1] : ''

  // ── 1. 装饰性分割线 ──
  //     // ═══════、// ─────、// ═══════ Page、// ══...══ 等
  if (/^\s*\/\/\s*[═─━]{4,}\s*$/.test(trimmed)) continue
  // 行主体（// 之后）的 60%+ 是 ═/─ 字符 → 装饰线
  const body = trimmed.replace(/^\s*\/\//, '')
  const decoChars = (body.match(/[═─━]/g) || []).length
  const nonSpace = body.replace(/\s/g, '').length
  if (nonSpace > 0 && decoChars / nonSpace >= 0.6 && decoChars >= 4) continue

  // ── 2. 开发遗留标记 ──
  // 2a. // xxx omitted
  if (/omitted/i.test(trimmed) && /^\s*\/\//.test(trimmed)) continue
  // 2b. // 已弃用 / // deprecated（含 ⚠️️ 变体）
  if (/(已弃用|deprecated)/i.test(trimmed) && /^\s*\/\//.test(trimmed)) continue

  // ── 3. 空行处理 ──
  if (!trimmed) {
    // 连续空行只保留一个
    if (prev === '' || prev === undefined) {
      continue
    }
    result.push('')
    continue
  }

  result.push(trimmed)
}

// 末尾不要多余空行
while (result.length > 0 && result[result.length - 1] === '') {
  result.pop()
}
result.push('')

const output = result.join('\n')
writeFileSync(OUTPUT, output, 'utf-8')

// 统计
const totalLines = result.length
const nonEmpty = result.filter(l => l.trim()).length

console.log(`✅ 清理完成: ${OUTPUT}`)
console.log(`   总行数: ${lines.length} → ${totalLines}（-${lines.length - totalLines}）`)
console.log(`   非空行: ${nonEmpty}`)
console.log(`   操作: 分割线删除 / omitted注释删除 / 已弃用标记删除 / 空行压缩`)
