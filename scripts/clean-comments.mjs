// ── 清理注释 + 简化命名 ──
import { readFileSync, writeFileSync } from 'fs'

const INPUT = 'e:/exam-pilot/docs/copyright/source-code-extracted.txt'
let text = readFileSync(INPUT, 'utf-8')

// ── 1. 去掉 Service 文件头的多行描述注释 ──
const blocks = [
  // learning-profile.service 段落描述
  {from: `// 学习画像[^]*?// 进度条颜色`, to: `// 进度条颜色`},
]

// Safer approach: strip known multi-line header blocks by exact match
text = text.replace(
  `// 学习风险预警服务\n// 纯统计方法：基于最近5次考试掌握率趋势分析`,
  `// 基于最近5次考试掌握率趋势分析`
)
text = text.replace(
  `// 错题本服务\n// 根据 QuestionResult.scoreRate < 0.6 自动生成错题记录\n// priorityScore = wrongCount * 0.4 + (1 - latestScoreRate) * 0.4 + knowledgePointWeakness * 0.2`,
  `// priorityScore = wrongCount * 0.4 + (1 - latestScoreRate) * 0.4 + knowledgePointWeakness * 0.2`
)
text = text.replace(
  `// 学习计划生成服务\n// 纯规则引擎（无 LLM），基于学习画像 + 错题数据\n// 按 薄弱知识点 > 退步知识点 > 高优先级错题 生成 7 天计划`,
  `// 纯规则引擎，基于学习画像 + 错题数据\n// 按 薄弱知识点 > 退步知识点 > 高优先级错题 生成 7 天计划`
)
text = text.replace(
  `// 知识图谱服务\n// 提供树状知识图谱的查询与遍历`,
  `// 树状知识图谱查询与遍历`
)
text = text.replace(
  `// Analysis Propagation Service\n// 在 AI 分析快速保存后，将分析结果传播到下游模块：\n//   knowledge_mastery_history（成长趋势 / 风险预警的基础）\n//   learning_profile（学习画像）\n//   learning_risk（风险预警）\n//\n// 由 POST /api/analysis/save 在保存成功后调用。`,
  `// 分析结果 → 下游模块（掌握率历史 + 学习画像 + 风险预警）`
)

// ── 2. 简化文件名注释 ──
text = text.replace(/\/\/ src\/services\/(\w+(?:-\w+)*)\.service\.ts/g, '// src/services/$1.ts')

// ── 3. 更新 import 路径 ──
text = text.replace(/@\/services\/(knowledge-graph|risk-analysis|wrong-question|study-plan|trend|learning-profile|analysis-propagation|difficulty-engine|exam)\.service/g, '@\/services\/$1')

// ── 4. 去掉 "Types" / "Private" / "Helpers" 段标记注释 ──
//    只在它们单独成行时去掉
text = text.replace(/\/\/ Types\n/g, '')
text = text.replace(/\n\/\/ Private helpers/g, '')
text = text.replace(/\n\/\/ Public API/g, '')
text = text.replace(/\/\/ Private\n/g, '')
text = text.replace(/\n\/\/ 类型\n/g, '\n')

// ── 5. 去掉 enum/AI审计等短标题前注释 ──
text = text.replace(/\/\/ Enums\n/g, '')
text = text.replace(/\/\/ 枚举\n/g, '')

// ── 6. 去掉数字字母编号注释 ──
text = text.replace(/\/\/ \d+[a-z]\. /g, '// ')

// ── 7. 去掉 public 关键字（TS 默认）──
//    只去除 public 在方法/属性前的，保留 private/protected
text = text.replace(/  public (static |async )?/g, '  $1')

// ── 8. 去掉一些显眼的空注释行 ──
text = text.replace(/\/\/ \n/g, '\n')

// ── 9. 去掉前端组件中的一些多余注释 ──
text = text.replace(/\/\/ Animation\n/g, '\n')
text = text.replace(/\/\/ 导航链接/gi, '')

// ── 10. 清理连续空行 ──
text = text.replace(/\n{4,}/g, '\n\n\n')

writeFileSync(INPUT, text, 'utf-8')
console.log('✅ 注释 + 命名清理完成')
console.log(`   大小: ${(text.length / 1024).toFixed(0)} KB`)
