import { z } from 'zod'

// ── 单个知识点 ──
export const KnowledgePointSchema = z.object({
  name: z.string().describe('知识点名称，如"导数单调性"'),
  score: z.union([z.string(), z.number()]).transform(String).describe('得分，如"2"'),
  total: z.union([z.string(), z.number()]).transform(String).describe('满分，如"12"'),
  mastery: z.union([z.string(), z.number()]).transform(String).describe('掌握率标签，如"16.7%"'),
})

// ── 薄弱点 ──
export const WeaknessSchema = z.object({
  name: z.string().describe('知识点名称'),
  scoreRate: z.number().min(0).max(100).describe('得分率 0-100'),
  diagnosis: z.string().describe('AI 诊断文本'),
})

// ── 优势点 ──
export const StrengthSchema = z.object({
  name: z.string().describe('知识点名称'),
  scoreRate: z.number().min(0).max(100).describe('得分率 0-100'),
  comment: z.string().describe('正面评价'),
})

// ── 学习建议 ──
export const StudySuggestionSchema = z.object({
  priority: z.number().int().min(1).describe('优先级，1 最高'),
  content: z.string().describe('具体建议内容'),
  type: z.enum(['PRACTICE', 'REVIEW', 'VIDEO', 'READING']).describe('建议类型'),
})

// ── 题目信息（来自 AI 试卷解析） ──
export const AiQuestionSchema = z.object({
  questionNo: z.number().describe('题号'),
  questionType: z.string().describe('题型：选择题/填空题/解答题/判断题/计算题/简答题/综合题/阅读理解/完形填空/其他'),
  fullScore: z.number().describe('该题满分分值'),
  isSubjective: z.boolean().describe('是否主观题'),
})

// ── 完整分析结果 ──
export const AnalysisTestResultSchema = z.object({
  subject: z.string().describe('科目名称，如"地理"'),
  summary: z.string().describe('总体评价一句话'),
  totalScore: z.number().optional().describe('全卷总分（满分，如 100）'),
  difficulty: z.string().optional().describe('难度评价：简单/中等/困难/极难'),
  averageScoreRate: z.number().min(0).max(100).optional().describe('全卷平均得分率 0-100'),
  knowledgeCoverage: z.number().optional().describe('涉及的不同知识点数量'),
  questionCount: z.number().optional().describe('题目总数（含子题按独立题计）'),
  subjectiveRatio: z.number().min(0).max(100).optional().describe('主观题（解答题/简答题/综合题等）占比 0-100'),
  knowledgePoints: z.array(KnowledgePointSchema).describe('知识点清单（每个知识点对应一个条目）'),
  weaknesses: z.array(WeaknessSchema).describe('薄弱点（按严重程度排序）'),
  strengths: z.array(StrengthSchema).describe('优势点'),
  studySuggestions: z.array(StudySuggestionSchema).describe('学习建议（按优先级排序）'),
  questions: z.array(AiQuestionSchema).optional().describe('逐题信息（用于难度引擎计算）'),
})

export type AnalysisTestResult = z.infer<typeof AnalysisTestResultSchema>

// ── API 请求体 ──
export const AnalysisTestRequestSchema = z.object({
  content: z.string().min(1, '考试内容不能为空').max(50000, '内容过长，请限制在 50000 字符以内'),
})

export type AnalysisTestRequest = z.infer<typeof AnalysisTestRequestSchema>

// ── API 响应 ──
export const AnalysisTestResponseSchema = z.object({
  success: z.boolean(),
  data: AnalysisTestResultSchema.optional(),
  error: z.string().optional(),
})

export type AnalysisTestResponse = z.infer<typeof AnalysisTestResponseSchema>
