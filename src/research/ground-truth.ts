// ── Exam Ground Truth 类型定义（Phase 16-C） ─────────────
// 科研评测标准答案的结构化表示

/** 题目条目 */
export interface GTQuestion {
  questionNo: number
  content: string
  fullScore: number
  knowledgePoint: string
}

/** 答案条目 */
export interface GTAnswer {
  questionNo: number
  content: string
}

/** 得分条目 */
export interface GTScore {
  questionNo: number
  score: number
  fullScore: number
}

/** 错题条目 */
export interface GTMistake {
  questionNo: number
  lostScore: number
  knowledgePoint?: string
}

/** 考试元数据 */
export interface GTMetaData {
  examName: string
  subject: string
  grade: string
  totalScore: number
  date?: string
}

/**
 * ExamGroundTruth — 考试标准答案
 *
 * 科研评测中的"标准答案"，用于与 Vision 输出进行对比。
 * 包含完整的题目、答案、得分和错题信息。
 */
export interface ExamGroundTruth {
  metadata: GTMetaData
  questions: GTQuestion[]
  answers: GTAnswer[]
  scores: GTScore[]
  mistakes: GTMistake[]
  /** 源文件路径 */
  sourcePath?: string
  /** 样本 ID */
  sampleId?: string
}

/**
 * 从 Markdown Ground Truth 解析为 ExamGroundTruth 结构体
 */
export function parseGroundTruth(
  markdown: string,
  sampleId?: string,
  sourcePath?: string,
): ExamGroundTruth {
  const lines = markdown.split('\n')
  const metadata: GTMetaData = { examName: '', subject: '', grade: '', totalScore: 0 }
  const questions: GTQuestion[] = []
  const answers: GTAnswer[] = []
  const scores: GTScore[] = []
  const mistakes: GTMistake[] = []

  let currentSection = ''
  const qMap = new Map<number, string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 检测章节
    const sectionMatch = trimmed.match(/^##\s+(.+)$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      continue
    }

    // 考试信息
    if (currentSection.includes('考试信息')) {
      const nameMatch = trimmed.match(/考试名称[：:]\s*(.+)/)
      if (nameMatch) { metadata.examName = nameMatch[1].trim(); continue }
      const subjMatch = trimmed.match(/科目[：:]\s*(.+)/)
      if (subjMatch) { metadata.subject = subjMatch[1].trim(); continue }
      const gradeMatch = trimmed.match(/年级[：:]\s*(.+)/)
      if (gradeMatch) { metadata.grade = gradeMatch[1].trim(); continue }
      const scoreMatch = trimmed.match(/总分[：:]\s*(\d+)/)
      if (scoreMatch) { metadata.totalScore = parseInt(scoreMatch[1], 10); continue }
    }

    // 试卷内容
    if (currentSection.includes('试卷内容')) {
      const qn = trimmed.match(/^(\d+)[．.)]\s*(.+)/)
      if (qn) {
        const no = parseInt(qn[1], 10)
        questions.push({ questionNo: no, content: qn[2].trim(), fullScore: 0, knowledgePoint: '' })
        qMap.set(no, qn[2].trim())
      }
    }

    // 学生作答
    if (currentSection.includes('学生作答')) {
      const an = trimmed.match(/^(\d+)[．.)]\s*(.+)/)
      if (an) {
        answers.push({ questionNo: parseInt(an[1], 10), content: an[2].trim() })
      }
      const tableRow = trimmed.match(/^\|\s*(\d+)\s*\|\s*([^|]+)\s*\|/)
      if (tableRow && !trimmed.includes('---') && !trimmed.includes('题号')) {
        answers.push({ questionNo: parseInt(tableRow[1], 10), content: tableRow[2].trim() })
      }
    }

    // 小分
    if (currentSection.includes('小分') || currentSection.includes('错题汇总')) {
      const entry = trimmed.match(/^\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|(?:\s*([^|]*)\s*\|)?/)
      if (entry && !trimmed.includes('---') && !trimmed.includes('题号')) {
        const no = parseInt(entry[1], 10)
        scores.push({ questionNo: no, score: parseFloat(entry[2]), fullScore: parseFloat(entry[3]) })
        const kp = (entry[4] || '').trim()
        if (kp) {
          mistakes.push({ questionNo: no, lostScore: parseFloat(entry[3]) - parseFloat(entry[2]), knowledgePoint: kp })
        }
        // 将知识点补回题目
        const q = questions.find(q => q.questionNo === no)
        if (q && kp) q.knowledgePoint = kp
      }
    }
  }

  return { metadata, questions, answers, scores, mistakes, sampleId, sourcePath }
}

/**
 * 将 ExamGroundTruth 序列化为 Markdown
 */
export function serializeGroundTruth(gt: ExamGroundTruth): string {
  const lines: string[] = []
  const p = (s: string) => lines.push(s)

  p('# Ground Truth — ' + (gt.sampleId || '')); p('')
  p('## 考试信息')
  p('- 考试名称：' + gt.metadata.examName)
  p('- 科目：' + gt.metadata.subject)
  p('- 年级：' + gt.metadata.grade)
  p('- 总分：' + gt.metadata.totalScore)
  if (gt.sampleId) p('- 样本编号：' + gt.sampleId); p('')

  p('## 试卷内容')
  for (const q of gt.questions) p(q.questionNo + '. ' + q.content); p('')

  p('## 学生作答')
  for (const a of gt.answers) p(a.questionNo + '. ' + a.content); p('')

  p('## 成绩信息')
  p('- 总分：' + gt.scores.reduce((sum, s) => sum + s.score, 0)); p('')

  p('## 小分 / 错题汇总')
  p('| 题号 | 得分 | 满分 | 知识点 |'); p('| --- | --- | --- | --- |')
  for (const s of gt.scores) {
    const kp = gt.questions.find(q => q.questionNo === s.questionNo)?.knowledgePoint || ''
    p('| ' + s.questionNo + ' | ' + s.score + ' | ' + s.fullScore + ' | ' + kp + ' |')
  }

  return lines.join('\n')
}
