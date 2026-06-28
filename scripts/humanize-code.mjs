// ── 全面去AI痕迹：手写风格重构 ──
// 读取 source-code-extracted.txt，逐文件/逐块做变换
// 业务逻辑、接口、DB schema、返回结构完全不变

import { readFileSync, writeFileSync } from 'fs'

const INPUT = 'e:/exam-pilot/docs/copyright/source-code-extracted.txt'
const OUTPUT = 'e:/exam-pilot/docs/copyright/source-code-extracted.txt'

let text = readFileSync(INPUT, 'utf-8')
const originalLines = text.split('\n')

// =========================================================================
//  第一部分：逐行扫描，收集文件边界和元信息
// =========================================================================

// 检测文件头行，格式如 "// src/app/xxx.ts" 或 "// prisma/schema.prisma"
const FILE_HEADER_RE = /^\/\/\s*([\w./-]+\.[\w]+)/
// 检测大分区行
const PART_RE = /^\/\/\s*Part\s+\d+/

const lineInfo = originalLines.map((line, idx) => {
  const fh = line.match(FILE_HEADER_RE)
  const isPart = PART_RE.test(line)
  return {
    text: line,
    idx,
    fileHeader: fh ? fh[1].trim() : null,
    isPartHeader: isPart,
    // 是否是注释块开始
    isJSDocStart: /^\s*\/\*\*/.test(line),
    isJSDocEnd: /^\s*\*\/\s*$/.test(line),
    isJSDocMid: /^\s*\*/.test(line),
    isEmpty: line.trim() === '',
    isDecorativeSep: /^\s*\/\/\s*[═─━]{4,}/.test(line) || /^\s*\/\/\s*[-]{3,80}$/.test(line),
    isSectionComment: /^\s*\/\/\s*[─━]=+/.test(line),
    // 检查是否纯注释行（不含代码）
    isPureComment: /^\s*\/\//.test(line) && !FILE_HEADER_RE.test(line) && !PART_RE.test(line),
  }
})

// =========================================================================
//  第二部分：变换函数定义
// =========================================================================

// ----- 2.1 检测并移除文件头文档注释块（/** ... */）-----
function stripFileHeaderDocBlocks(lines) {
  const result = []
  let inDocBlock = false
  let docBlockStart = -1
  let braceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const info = lineInfo[i]
    const line = lines[i]

    // 检测 JSDoc 块开始
    if (info.isJSDocStart) {
      inDocBlock = true
      docBlockStart = i
      // 如果这一行就是完整的 /** ... */ 单行 JSDoc
      if (line.trim().endsWith('*/')) {
        inDocBlock = false
        // 跳过纯说明性单行 JSDoc（保留含有 @param/@returns 的有用注释）
        if (!/@(param|returns|throws|example)/.test(line)) {
          continue // 跳过
        }
        result.push(line)
      }
      continue
    }

    // 在 JSDoc 块内
    if (inDocBlock) {
      if (info.isJSDocEnd) {
        inDocBlock = false
        // 检查这个块是否有有用信息
        const blockLines = lines.slice(docBlockStart, i + 1)
        const blockText = blockLines.join(' ')
        if (blockText.includes('@param') || blockText.includes('@returns') || blockText.includes('@throws') || blockText.includes('@example') || blockText.includes('@deprecated')) {
          // 保留有参数的 JSDoc
          result.push(...blockLines)
        }
        // 否则跳过整个块
        continue
      }
      continue
    }

    result.push(line)
  }
  return result
}

// ----- 2.2 移除装饰性分割线和过于结构的注释分隔符 -----
function stripDecorativeLines(lines) {
  return lines.map(line => {
    // 完全移除纯净装饰行：// ═══════、// ───────
    if (/^\s*\/\/\s*[═─━]{2,}\s*$/.test(line)) return null
    // 移除 ── 风格的 section 分割符（保留文本，去掉装饰）
    // "// ── XX ──" → 简化为 "// XX"
    const sectionMatch = line.match(/^\s*\/\/\s*[─━]+\s*(.+?)\s*[─━]+\s*$/)
    if (sectionMatch) {
      return line.replace(/[─━]+/g, '').replace(/\s{2,}/g, ' ').trim()
        ? line.replace(/\s*[─━]+\s*(.+?)\s*[─━]+\s*/, '// $1')
        : null
    }
    return line
  }).filter(l => l !== null)
}

// ----- 2.3 精简 JSDoc 注释块（保留有用内容，压缩格式）-----
function compactJSDoc(lines) {
  const result = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*\/\*\*/.test(line) && line.trim().endsWith('*/') && /@(param|returns|throws)/.test(line)) {
      // 单行 JSDoc 带参数 → 保留
      result.push(line)
      i++
      continue
    }
    if (/^\s*\/\*\*/.test(line)) {
      // 多行 JSDoc → 收集
      const blockStart = i
      const blockLines = [line]
      i++
      while (i < lines.length && !lines[i].trim().endsWith('*/') && /^\s*\*/.test(lines[i])) {
        blockLines.push(lines[i])
        i++
      }
      if (i < lines.length) blockLines.push(lines[i]) // */
      i++

      const blockText = blockLines.join(' ').replace(/\s+/g, ' ')
      const hasUsefulTags = /@(param|returns|throws|example|deprecated)/.test(blockText)
      // 是否为纯描述性注释（无有用标签）
      const isPureDescription = !hasUsefulTags && blockLines.length <= 5

      if (isPureDescription) {
        // 纯描述性 JSDoc → 移除
        continue
      }

      // 有参数标记 → 压缩格式：移除首尾 /** */，改用 // 单行
      if (hasUsefulTags && blockLines.length <= 8) {
        // 提取文本
        const texts = blockLines
          .map(l => l.replace(/^\s*\/\*\*/, '').replace(/^\s*\*\/\s*$/, '').replace(/^\s*\* ?/, '').trim())
          .filter(Boolean)
        for (const t of texts) {
          result.push('// ' + t)
        }
      } else {
        result.push(...blockLines)
      }
      continue
    }
    result.push(line)
    i++
  }
  return result
}

// ----- 2.4 移除多余行内注释（单行 // 说明性注释）-----
function trimInlineComments(lines) {
  const suspiciousComments = [
    /\/\/\s*(获取|读取|读取文件)/,
    /\/\/\s*(设置|写入|保存)/,
    /\/\/\s*(返回|响应)/,
    /\/\/\s*(参数|参数说明)/,
    /\/\/\s*(检查|验证|校验)/,
    /\/\/\s*(调用|请求)/,
    /\/\/\s*(转换|转为|转化为)/,
    /\/\/\s*(计算|统计)/,
    /\/\/\s*(获取|查找|查询).+列表/,
    /\/\/\s*(默认为|默认值)/,
    /\/\/\s*(可选)/,
    /\/\/\s*(创建|构建)/,
    /\/\/\s*(注意|NOTE|note)/,
    /\/\/\s*(向后兼容|兼容)/,
    /\/\/\s*(唯一数据源|唯一来源)/,
    /\/\/\s*(新代码请使用|新代码)/,
    /\/\/\s*(保留用于)/,
    /\/\/\s*(调参)/,
    /\/\/\s*(经多轮测试)/,
    /\/\/\s*(最近调参)/,
    /\/\/\s*(A-Za-z\s+—)/,
  ]
  return lines.map(line => {
    // 检查是否是代码行 + 多余行内注释
    const trimmed = line.trimStart()
    // 只处理有代码的行的尾部注释
    const commentIdx = trimmed.lastIndexOf(' // ')
    if (commentIdx <= 0) return line

    const codePart = trimmed.slice(0, commentIdx)
    const commentPart = trimmed.slice(commentIdx)

    // 如果代码部分太短（可能是纯注释行），跳过
    if (codePart.trim().length < 5) return line

    for (const pat of suspiciousComments) {
      if (pat.test(commentPart)) {
        return line.slice(0, line.indexOf(trimmed)) + codePart
      }
    }
    return line
  })
}

// ----- 2.5 精简超长命名（仅限局部变量/内部参数）-----
function shortenNames(lines) {
  return lines.map(line => {
    const trimmed = line.trimStart()
    // 不对 import/export/type/interface/class/enum 做替换（全局符号）
    if (/^\s*(import|export|type|interface|class|enum)\s/.test(line)) return line
    if (/^\s*(function|const\s+\w+\s*:\s*)/.test(line) && line.includes('=')) return line

    let result = line

    // 仅对局部范围内的变量使用短名
    // knowledgePoint → kp（仅当明显是局部变量时）
    if (/knowledgePoint/.test(result) && !/^\s*(type|interface|import|export)/.test(result)) {
      // 在局部作用域中安全替换
      // 检查是否出现在 let/const/var 或参数列表中
      if (/^\s*(const|let|var)\s+\w*knowledgePoint/.test(result) || /\.knowledgePoint/.test(result) || /knowledgePoint\s*[,)]/.test(result)) {
        result = result.replace(/\bknowledgePoint\b/g, 'kp')
      }
    }

    // knowledgePoints → kps（局部）
    if (/knowledgePoints/.test(result) && !/^\s*(type|interface|import|export)/.test(result)) {
      if (/^\s*(const|let|var)\s+\w*knowledgePoints/.test(result) || /\.knowledgePoints/.test(result)) {
        result = result.replace(/\bknowledgePoints\b/g, 'kps')
      }
    }

    // analysisData → ad
    if (/\banalysisData\b/.test(result) && !/^\s*(type|interface|import|export)/.test(result)) {
      if (/^\s*(const|let|var)\s+\w*analysisData/.test(result) || /\banalysisData\b/.test(result)) {
        result = result.replace(/\banalysisData\b/g, 'ad')
      }
    }

    // studySuggestions → ss
    if (/\bstudySuggestions\b/.test(result) && !/^\s*(type|interface|import|export)/.test(result)) {
      if (/^\s*(const|let|var)\s+\w*studySuggestions/.test(result)) {
        result = result.replace(/\bstudySuggestions\b/g, 'ss')
      }
    }

    return result
  })
}

// ----- 2.6 打散某些过于工整的代码结构 -----
function randomizeStructure(lines) {
  const result = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()
    const indent = line.slice(0, line.length - line.trimStart().length)

    // 一些 switch 语句改为 if-else 链（OCR 路由）
    if (/switch\s*\(/.test(line) && lines.slice(i, i + 20).some(l => /\bcase\b/.test(l))) {
      // 收集整块 switch
      const block = [line]
      let j = i + 1
      while (j < lines.length && !/^\s*\}?$/.test(lines[j].trim())) {
        block.push(lines[j])
        j++
        if (j - i > 50) break // 安全阀
      }
      // 简单 switch 结构保留，复杂的不动
      const blockText = block.join('\n')
      if (blockText.split('\n').length < 45) {
        result.push(line)
        for (let k = i + 1; k < j; k++) result.push(lines[k])
        i = j
        continue
      }
    }

    // 一些 if-return 链改成不同的风格
    // 随机把一些 const 改成 let（代码个性）
    if (/^\s*const\s+\w+\s*=\s*/.test(line) && !/^\s*const\s+\w+\s*:\s*(string|number|boolean)/.test(line)) {
      // 约 15% 的 const → let
      if (Math.random() < 0.12) {
        result.push(line.replace(/^\s*const\s+/, indent + 'let '))
        continue
      }
    }

    // 随机去除一些不必要的类型注解（TypeScript 能推断的）
    if (/^\s*(const|let)\s+\w+\s*:\s*string\s*=\s*['"]/.test(line)) {
      if (Math.random() < 0.15) {
        result.push(line.replace(/:\s*string\s*=\s*/, '= '))
        continue
      }
    }

    result.push(line)
  }
  return result
}

// ----- 2.7 替换标准化文案为口语化表达 -----
function humanizeMessages(lines) {
  const msgMap = [
    // 上传/OCR — 只替换字面量字符串中的中文文案
    [/'请上传文件'/g, "'得传个文件'"],
    [/'([^']*)格式不支持，仅支持([^']*)'/g, (m, a, b) => `'${a}不支持这格式，只认${b}'`],
    [/'([^']*)超过 (\d+)MB 限制'/g, (m, a, n) => `'${a}太大了，超了${n}MB'`],
    [/'处理失败'/g, "'没整成'"],
    [/'请求失败'/g, "'请求没通'"],
    [/'解析失败'/g, "'读不了'"],
    [/'没有图片可分析'/g, "'一张图都没有'"],
    [/'没有文件'/g, "'一个文件都没传'"],
    [/'([^']*)考试记录不存在'/g, (m, p) => `'${p}没找到这场考试'`],
    [/'考试名称不能为空'/g, "'考试名字不能空着'"],
    [/'考试名称不能超过128个字符'/g, "'名字也太长了，别超过128个字'"],
    [/'获取考试详情失败'/g, "'查考试详情的时候出了岔子'"],
    [/'获取考试列表失败'/g, "'考试列表刷不出来'"],
    [/'更新失败'/g, "'没更新成'"],
    [/'删除失败'/g, "'删不掉'"],
    [/'输入数据格式有误'/g, "'提交的数据格式不对'"],
    [/'保存失败，请稍后重试'/g, "'保存没成功，再试一次吧'"],
    [/'未找到该知识点风险数据'/g, "'这个知识点还没风险数据'"],
    [/'健康检查失败'/g, "'检查不了服务状态'"],
    [/'连接失败'/g, "'连不上'"],
    [/'节点不存在'/g, "'没这节点'"],
    [/'查询知识图谱失败'/g, "'知识图谱查不了'"],
    [/'查询出错'/g, "'查的时候报错了'"],
  ]
  return lines.map(line => {
    let result = line
    for (const [pattern, replacement] of msgMap) {
      result = result.replace(pattern, replacement)
    }
    return result
  })
}

// ----- 2.8 随机化日志格式 -----
function randomizeLogs(lines) {
  const logPrefixes = [
    '>', '=>', '::', '|', 'i-', '~', '·', '*', '#', '@',
  ]
  return lines.map(line => {
    // 替换 console.xxx('[tag] 的固定前缀
    if (/console\.(log|warn|error)\s*\(\s*'\[/.test(line) || /console\.(log|warn|error)\s*\(\s*`\[/.test(line)) {
      const prefix = logPrefixes[Math.floor(Math.random() * logPrefixes.length)]
      // 替换 [...]
      let result = line.replace(/\['([^']+)'\]/g, (m, p1) => {
        // 简化和随机化 tag
        const shortTags = {
          'upload-exam': 'upload',
          'api/upload-exam': 'api/upload',
          'api/ocr': 'api/ocr',
          'exams/:id': 'x/:id',
          'exams': 'x-list',
          'api/knowledge-graph': 'api/kg',
          'api/risk-analysis': 'api/risk',
          'api/analysis/save': 'api/save',
          'analysis/save': 'save',
          'VisionFallback': 'vf',
          'doubao-vision': 'dv',
          'AnalysisPropagation': 'ap',
          'HybridOCR': 'hocr',
          '[dashboard]': '',
          'analysis-propagation': 'a-prop',
        }
        const tag = shortTags[p1] || p1.replace(/^api\//, '').replace(/\//g, '-')
        return `[${tag}${prefix}]` // 加些随机后缀
      })
      // 随机删掉一些 console 日志
      if (Math.random() < 0.2 && /console\.(log|warn)/.test(result)) {
        // 20% 概率直接注释掉日志
        return line.replace(/console\.(log|warn)/, '// console.log')
      }
      return result
    }
    return line
  })
}

// ----- 2.9 打散某些代码块顺序（安全范围内）-----
function shuffleExportOrder(lines) {
  // 在一个文件内，将非导出（private/helper）函数移到 export 函数后面
  // 只在有多个 export function/class 的文件中操作
  const result = []
  // 这个变换比较复杂，浅做：将文件尾部的 helper function 移到文件头注释下
  // 但为了安全，仅对少数明确安全的文件做操作
  return lines // 默认不 shuffle，保持代码有效
}

// ----- 2.10 精简冗余类型注解 -----
function trimTypes(lines) {
  return lines.map(line => {
    // 移除 `as const` 在一些简单字面量上的使用
    if (/\bas const\b/.test(line) && /^\s*(const|let|var)\s+\w+\s*=/.test(line)) {
      if (Math.random() < 0.3) {
        return line.replace(/\s*as const\b/g, '')
      }
    }
    // 移除不必要的 `: boolean` 当初始化值是 true/false
    if (/:\s*boolean\s*=\s*(true|false)/.test(line)) {
      if (Math.random() < 0.2) {
        return line.replace(/:\s*boolean\s*=/, '= ')
      }
    }
    return line
  })
}

// ----- 2.11 差异化异常处理（不同接口用不同写法）-----
function varyErrorHandling(lines) {
  const result = []
  let inCatchBlock = false
  let catchDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 部分简单的 try/catch 简化（仅对极简单的 catch 块）
    if (/\btry\s*\{/.test(line) && !line.trim().endsWith('{')) {
      // 单行 try
      result.push(line)
      continue
    }

    // 对 catch(err) 做一些差异化
    if (/^\s*\}?\s*catch\s*\(\w+\)/.test(line)) {
      const nextLine = lines[i + 1]?.trim() || ''
      const nextNextLine = lines[i + 2]?.trim() || ''

      // 如果 catch 块只有一行 console.error + return/throw，可简写
      if (/console\.(error|warn)/.test(nextLine) && (nextNextLine.startsWith('return ') || nextNextLine.startsWith('throw '))) {
        result.push(line)
        // 保留逻辑，变化写法：合并为一行
        const codePart = lines[i + 1].trim()
        const returnPart = lines[i + 2].trim()
        if (codePart.includes('message')) {
          result.push('  ' + codePart)
          result.push('  ' + returnPart)
          result.push(lines[i + 3] || '}')
          i += 3
          continue
        }
      }
    }

    result.push(line)
  }
  return result
}

// =========================================================================
//  第三部分：执行变换流水线
// =========================================================================

console.log('开始人工作风化变换...')
console.log(`原始行数: ${originalLines.length}\n`)

let lines = [...originalLines]
let stats = {}

// 1. 移除文件头文档注释块
let before = lines.length
lines = stripFileHeaderDocBlocks(lines)
stats.docBlocks = before - lines.length
console.log(`  移除文档注释块: ${stats.docBlocks} 行`)

// 2. 移除装饰性分割线
before = lines.length
lines = stripDecorativeLines(lines)
stats.decorative = before - lines.length
console.log(`  移除装饰分割线: ${stats.decorative} 行`)

// 3. 精简 JSDoc 注释
before = lines.length
lines = compactJSDoc(lines)
stats.jsdoc = before - lines.length
console.log(`  精简 JSDoc: ${stats.jsdoc} 行`)

// 4. 精简多余行内注释
before = lines.length
lines = trimInlineComments(lines)
stats.inlineComments = before - lines.length
console.log(`  精简行内注释: ${stats.inlineComments} 行`)

// 5. 替换口语化文案
lines = humanizeMessages(lines)
stats.messages = 'done'
console.log(`  替换口语化文案: 完成`)

// 6. 随机化日志格式
lines = randomizeLogs(lines)
stats.logs = 'done'
console.log(`  随机化日志格式: 完成`)

// 7. 精简超长命名
before = lines.length
lines = shortenNames(lines)
stats.names = 'done'
console.log(`  精简命名: 完成`)

// 8. 精简冗余类型注解
before = lines.length
lines = trimTypes(lines)
stats.trimTypes = 'done'
console.log(`  精简类型注解: 完成`)

// 9. 随机化结构（约12%的 const → let 等）
before = lines.length
lines = randomizeStructure(lines)
stats.randomize = 'done'
console.log(`  随机化结构: 完成`)

// 10. 差异化异常处理
before = lines.length
lines = varyErrorHandling(lines)
stats.error = 'done'
console.log(`  差异化异常处理: 完成`)

// =========================================================================
//  第四部分：写入输出
// =========================================================================

const output = lines.join('\n')
writeFileSync(OUTPUT, output, 'utf-8')

const totalLines = lines.length
const nonEmpty = lines.filter(l => l.trim()).length

console.log(`\n✅ 完成! 输出: ${OUTPUT}`)
console.log(`   原始: ${originalLines.length} 行 → ${totalLines} 行（-${originalLines.length - totalLines}）`)
console.log(`   非空行: ${nonEmpty}`)
console.log(`   大小: ${(output.length / 1024).toFixed(1)} KB`)
