// ── 题目类型 ────────────────────────────────────

/** 题目类型枚举（中文，匹配 AI 输出） */
export type QuestionType =
  | '选择题' | '填空题' | '解答题' | '判断题'
  | '计算题' | '简答题' | '综合题' | '阅读理解'
  | '完形填空' | '其他'

/** 子题（复合题/完形填空/阅读理解的小题） */
export type SubQuestion = {
  label: string
  text: string
  score?: number
}

/** 单题 */
export type Question = {
  questionNo: number
  questionType: string
  fullScore: number
  questionText: string
  hasSubQuestions: boolean
  subQuestions?: SubQuestion[]
  pageNumber?: number
  /** Vision-Native: 对应源图片索引（用于定位原始图片） */
  sourceImageIndex?: number
  /** Vision-Native: 在源图片中的页码 */
  pageIndex?: number
}

/** 整卷解析结果 */
export type QuestionParseResult = {
  questions: Question[]
  totalScore: number
  questionCount: number
}
