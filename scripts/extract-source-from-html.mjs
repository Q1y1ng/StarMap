// ── 从 source-code.html 提取纯净 TS/TSX 源码 ──
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const INPUT = resolve('e:/exam-pilot/docs/copyright/source-code.html')
const OUTPUT = resolve('e:/exam-pilot/docs/copyright/source-code-extracted.txt')

const html = readFileSync(INPUT, 'utf-8')

// 1. 按 .code-line div 切分
// 正则匹配整个 <div class="code-line ...">...</div>
const linePattern = /<div\s+class="code-line[^"]*">(.*?)<\/div>/gs
const matches = [...html.matchAll(linePattern)]

const lines = []
for (const m of matches) {
  const divContent = m[1]

  // 判断是否为 header-line（文件路径标注）
  const isHeader = divContent.includes('header-line') || divContent.includes('header-text')

  // 提取 .line-content 内的文本
  const contentMatch = divContent.match(/<span\s+class="line-content[^"]*">(.*?)<\/span>/)
  if (!contentMatch) continue

  let text = contentMatch[1]

  // HTML entity 解码
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  if (isHeader) {
    // header 行：保留为注释形式 // file/path.ts
    lines.push(text)
  } else {
    // 普通代码行
    lines.push(text)
  }
}

// 2. 合并为文本
let code = lines.join('\n')

// 3. 再次统一脱敏（覆盖原文可能遗漏的）
const DESENSITIZE_RULES = [
  { from: 'REPLACE_WITH_YOUR_API_KEY', to: 'xxxx-xxxx-xxxx-xxxx' },
  { from: 'YOUR_MODEL_DEPLOYMENT_ID', to: 'ep-demo-00000000' },
  { from: 'https://your-api-endpoint.example.com/v3/chat/completions', to: 'https://demo-api.example.com/v3/chat/completions' },
  { from: 'https://your-deepseek-endpoint.example.com', to: 'https://demo-api.example.com' },
]
for (const { from, to } of DESENSITIZE_RULES) {
  code = code.replaceAll(from, to)
}

// 4. 压缩多余空行（≥3 行连续空行 → 2 行）
code = code.replace(/\n{3,}/g, '\n\n\n')

// 5. 去掉文件末尾多余空白
code = code.trimEnd() + '\n'

// 6. 写出
writeFileSync(OUTPUT, code, 'utf-8')

// 统计
const totalLines = code.split('\n').length
const nonEmpty = code.split('\n').filter(l => l.trim()).length
const sizeKb = (code.length / 1024).toFixed(1)
console.log(`✅ 已提取: ${OUTPUT}`)
console.log(`   总行数: ${totalLines}`)
console.log(`   非空行: ${nonEmpty}`)
console.log(`   大小:   ${sizeKb} KB`)
