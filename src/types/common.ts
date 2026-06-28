// ── 通用 API 响应封装 ──

export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type PaginatedResponse<T> = ApiResponse<{
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}>

export type PaginationParams = {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ── 学情相关枚举 ──

export type Grade = '高一' | '高二' | '高三'

export type Subject = '语文' | '数学' | '英语' | '物理' | '化学' | '生物' | '历史' | '地理' | '政治'

export type AiAnalysisType = 'KNOWLEDGE_POINT' | 'WEAKNESS' | 'SUGGESTION' | 'TREND'

export type SuggestionType = 'PRACTICE' | 'REVIEW' | 'VIDEO' | 'READING'

export type AiStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

// ── 考试 ──

export type ExamListItem = {
  id: string
  title: string
  subject: string
  grade: string
  examDate: string
  totalScore: number
  aiStatus: AiStatus
  studentCount?: number
  avgScore?: number
  createdAt: string
}

export type ExamDetail = ExamListItem & {
  fileUrl: string | null
  fileType: string | null
  knowledgePoints: ExamKnowledgePoint[]
  scores: ScoreSummary[]
}

export type ExamKnowledgePoint = {
  id: string
  name: string
  questionNumbers: string[]
  totalPoints: number
  weight: number
  category: string | null
}

// ── 成绩 ──

export type ScoreSummary = {
  id: string
  studentId: string
  studentName: string
  studentNumber: string
  score: number
  maxScore: number
  classRank: number | null
  gradeRank: number | null
}

export type ScoreDetail = ScoreSummary & {
  details: QuestionDetail[] | null
  examTitle: string
  subject: string
  examDate: string
}

export type QuestionDetail = {
  questionNumber: string
  score: number
  maxScore: number
  knowledgePoint?: string
}

// ── AI 分析 ──

export type KnowledgePointResult = {
  subject: string
  knowledgePoints: {
    name: string
    questionNumbers: string[]
    totalPoints: number
    difficulty: '基础' | '中档' | '综合'
    category: string
  }[]
}

export type WeaknessResult = {
  weaknesses: {
    knowledgePoint: string
    scoreRate: number
    classAvgRate: number
    diagnosis: string
    priority: number
  }[]
}

export type SuggestionResult = {
  suggestions: {
    knowledgePoint: string
    actions: string[]
    type: SuggestionType
    estimatedMinutes: number
    priority: number
  }[]
}

export type TrendResult = {
  overall: {
    trend: '上升' | '平稳' | '下降'
    changePercent: number
    assessment: string
  }
  knowledgePoints: {
    name: string
    trend: 'improving' | 'stable' | 'declining'
    changePercent: number
    alert: boolean
  }[]
  summary: string
}

// ── 学生 ──

export type StudentProfile = {
  id: string
  studentNumber: string
  name: string
  grade: string
  class: string
  recentScores: { examId: string; examTitle: string; score: number; maxScore: number; date: string }[]
  weakKnowledgePoints: { name: string; masteryLevel: number; diagnosis: string }[]
  pendingSuggestions: number
}

// ── 趋势 ──

export type TrendPoint = {
  examId: string
  examDate: string
  examTitle: string
  score: number
  maxScore: number
  classAvg?: number
  gradeAvg?: number
}

export type MasteryHeatmapItem = {
  knowledgePoint: string
  category: string
  data: { examDate: string; mastery: number }[]
}
