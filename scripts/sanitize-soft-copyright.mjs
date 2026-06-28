// ── 去除软著说明书中的 AI 品牌名/大模型/OCR 品牌 ──
// 替换为: 智能识别技术、图像分析技术、自动解析技术
import { readFileSync, writeFileSync } from 'fs'

const INPUT = 'e:/exam-pilot/docs/software-copyright/StarMap智能学情分析平台_V1.2.0_软件说明书完整版.md'

let text = readFileSync(INPUT, 'utf-8')

const replacements = [
  // ── 品牌/模型名 → 通用技术术语 ──

  // DeepSeek / Doubao / 火山引擎 / OpenAI
  [/Doubao(?!VisionProvider|VisionDocument)/g, '图像分析'],
  [/DeepSeek(?!\w)/g, '自动解析'],
  [/火山引擎/g, ''],
  [/OpenAI(?:\s*SDK)?/g, '标准API'],

  // ── "大模型" 不同语境 ──
  [/Doubao Vision 大模型/g, '图像分析技术'],
  [/Vision 大模型/g, '图像分析技术'],
  [/大模型精准/g, '高精度'],
  [/大模型精准（HIGH_ACCURACY）/g, '高精度（HIGH_ACCURACY）'],
  [/大模型/g, '智能技术'],

  // ── "Vision" 在不同语境中的替换 ──
  // Vision 识别 → 图像识别
  [/Vision 识别/g, '图像识别'],
  // Vision 大模型 → already handled above
  // Vision 接口 → 图像识别接口
  [/Vision 接口/g, '图像识别接口'],
  // Vision 元信息 → 识别元信息
  [/Vision 元信息/g, '识别元信息'],
  // Vision 分析 → 图像分析
  [/Vision 分析/g, '图像分析'],
  // 多模态 Vision → 多模态图像识别
  [/多模态 Vision/g, '多模态图像识别'],
  // Vision（单独出现作为技术名） → 图像识别
  // 但保留 VisionDocument、VisionProvider 作为代码名不替换
  // (这些在代码块或反引号中，安全)
  // 一般语境下的 Vision:
  [/^Vision$/gm, '图像识别'],
  [/ Vision /g, ' 图像识别 '],
  [/Vision、/g, '图像识别、'],
  [/Vision。$/gm, '图像识别。'],

  // ── "AI" → 自动/智能 ──
  [/AI 分析模块/g, '自动分析模块'],
  [/AI 分析/g, '自动解析'],
  [/AI 审计/g, '分析审计'],
  [/AI 服务/g, '智能分析服务'],
  [/AI(?!\w)/g, '智能'],

  // ── "OCR" 品牌名 → 通用术语 ──
  // PaddleOCR → 标准识别
  [/PADDLE\/DOUBAO/g, 'LOCAL\/CLOUD'],
  [/PADDLE/g, 'LOCAL'],
  // OCR 模式 → 识别模式（非品牌，但统一风格）
  [/OCR 模式/g, '识别模式'],

  // ── 具体句子重写 ──

  // 第1章: "OCR 走的 Doubao Vision 大模型，学情分析用 DeepSeek V4 Flash"
  // → 已由上述规则覆盖，但可能残留需要手动处理

  // 第2章: 环境配置表
  [/\| DEEPSEEK_API_KEY \| DeepSeek API 密钥/g, '| NLP_API_KEY | 智能分析 API 密钥'],
  [/\| DOUBAO_API_KEY \| 火山引擎 Doubao Vision 密钥/g, '| VISION_API_KEY | 图像识别 API 密钥'],
  [/\| DOUBAO_API_KEY \| 火山引擎/g, '| VISION_API_KEY |'],

  // 第4章: DefaultVisionProvider 描述
  [/DefaultVisionProvider（V1\.2\.0 重命名，之前叫 DoubaoVisionProvider）：对接火山引擎多模态 Vision 接口/g,
    'DefaultVisionProvider：对接多模态图像识别接口'],

  // 第6章: 核心流程
  [/查 SHA256 指纹缓存（命中跳过 API）→ Doubao Vision 识别/g,
    '查 SHA256 指纹缓存（命中跳过 API）→ 图像识别'],

  // 第8章: 关键技术
  [/(?:## )8\.2 Doubao Vision 大模型/g, '## 8.2 图像分析识别技术'],
  [/Doubao-Seed-1\.8-Vision（火山引擎 ARK 平台）。API 兼容 OpenAI 格式，所以接入的时候直接用 OpenAI SDK 改 base_url 就行，不用单独封装。/g,
    '基于多模态图像分析技术，API 兼容标准格式，接入时直接用标准 SDK 改 base_url 就行，不用单独封装。'],
  [/Vision-Native 架构/g, '端到端架构'],
  [/图片直接送大模型识别为结构化 Markdown/g, '图片直接送图像分析引擎识别为结构化 Markdown'],
  [/大模型一步到位/g, '引擎一步到位'],

  [/(?:## )8\.3 DeepSeek V4 Flash/g, '## 8.3 自动解析技术'],
  [/学情分析主力模型/g, '学情分析主力引擎'],
  [/以 token 用量和耗时 做审计/g, '以处理量和耗时做审计'],
  [/选 V4 Flash 而不是标准版/g, '选高响应版本而不是标准版'],
  [/(因为分析任务的响应速度比精度更重要——老师上传完试卷等着看结果，等太久体验不好)/g, '因为分析任务的响应速度比精度更重要——老师上传完试卷等着看结果，等太久体验不好'],

  // Token 相关
  [/token 用量/g, '处理量'],
  [/Token 审计/g, '审计日志'],
  [/Token 消耗/g, '处理消耗'],

  // 第9章: 设置页面
  [/- DeepSeek API Key \+ 模型选择\r?\n- Doubao Vision API Key（可覆盖环境变量）/g,
    '- 智能分析 API Key + 模型选择\n- 图像识别 API Key（可覆盖环境变量）'],

  // 第10章: 页面展示说明
  [/\*\*图10-14 系统设置\*\*：DeepSeek API Key、Doubao Vision API Key、深色\/浅色主题切换。/g,
    '**图10-14 系统设置**：API Key 配置、模型选择、深色/浅色主题切换。'],

  // 第11章: 软件特点
  [/\*\*Vision 大模型驱动的文档识别/g, '**图像分析技术驱动的文档识别'],
  [/\*\*DeepSeek 学情分析/g, '**自动解析学情分析'],
  [/Token 审计方便跟踪消耗/g, '审计日志方便跟踪消耗'],

  // 待优化方向
  [/大模型依赖外网/g, '智能分析依赖外网'],
  [/OCR 和 AI 分析都需要云 API/g, '图像识别和自动解析都需要云 API'],

  // ── 小写/非精确匹配的补充 ──
  [/\bdeepseek\b/gi, '自动解析'],
  [/\bdoubao\b/gi, '图像分析'],
]

// Apply all replacements
for (const [pattern, replacement] of replacements) {
  text = text.replace(pattern, replacement)
}

// ── 后处理：清理多余空格 ──
// 火山引擎被替换为空后留下的双空格
text = text.replace(/ {2,}/g, ' ')
// "图像分析VisionDocument" → "图像分析VisionDocument" 这种是误伤，需要检查
// 但 VisionDocument 前面可能被替换为 图像分析VisionDocument → 需要修复
// 实际上 VisionDocument 是类名，在代码块中，不会被上面的规则匹配
// 因为上面的规则匹配的是"Vision "（带空格或标点）的上下文

// 清理 "、的图像分析" → "、图像分析"
text = text.replace(/、的/g, '、')
// 清理 "（引擎）" → "（引擎）" 中的多余
text = text.replace(/（\s+/g, '（')
text = text.replace(/\s+）/g, '）')

// ── 写回 ──
writeFileSync(INPUT, text, 'utf-8')

// 统计变化
const lines = text.split('\n')
console.log(`✅ 品牌名称清理完成: ${INPUT}`)
console.log(`   总行数: ${lines.length}`)
console.log(`   非空行: ${lines.filter(l => l.trim()).length}`)

// 检查是否还有残留的品牌词
const checkPatterns = [
  /Doubao/g,
  /DeepSeek/g,
  /火山引擎/g,
  /OpenAI(?!.*标准API)/g,
  /GPT/g,
  /Claude/g,
]
let found = false
for (const cp of checkPatterns) {
  const matches = text.match(cp)
  if (matches) {
    console.warn(`   ⚠️ 残留 "${cp.source}": ${matches.length} 处`)
    found = true
  }
}
if (!found) console.log('   ✅ 无品牌词残留')
