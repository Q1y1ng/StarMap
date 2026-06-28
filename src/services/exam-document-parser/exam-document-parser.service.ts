// ── ExamDocumentParser — 从 OCR/Vision Markdown 解析为结构化考试文档（Phase 15-P） ──
// 纯 TypeScript 规则解析，无 AI 参与
// Section-Aware Parsing: 先按 ## 标题分段，再逐段解析
// 替代旧 split(/\n\n+/) paragraph-based 解析（Phase 15-O 根因修复）

import type {
  ExamDocument,
  ExamMetadata,
  Question,
  QuestionType,
  StudentAnswer,
  QuestionScore,
  MistakeEntry,
  ExamTrace,
  OcrQualityEvaluation,
  ParseOptions,
  ParsedSections,
} from './types'

// ── 常量 ──────────────────────────────────────────────────

/** 科目关键词 */
const SUBJECT_LIST = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

/** 题号正则 — 匹配 "1." "1、" "1）" 等 */
const QUESTION_NO_RE = /^\s*(\d+)\s*[.、）)]/

/** 题号正则（Q 前缀） — 匹配 "Q1." "Q1、" */
const QUESTION_NO_Q_RE = /^\s*[Qq]\s*(\d+)\s*[.、）):：]/

/** 选择题选项正则 */
const CHOICE_OPTION_RE = /[A-D]\s*[.、）)]/

/** 日期正则 */
const DATE_RE = /(\d{4})\s*[年/-]\s*(\d{1,2})\s*[月/-]?/

/** 满分/总分正则 */
const TOTAL_SCORE_RE = /(?:满分|总分)[：:]\s*(\d+)/

/** 已知的 ## 段落标题 — 用于标题过滤 */
const SECTION_HEADING_SET = new Set([
  '考试信息', '试卷内容', '学生作答', '成绩信息',
  '小分 / 错题汇总', '小分/错题汇总', '错题汇总', '小分',
  '数据来源', '题目统计',
])

/** OCR 质量各维度权重 */
const QUALITY_WEIGHTS = {
  title: 0.20,
  questionNo: 0.25,
  table: 0.15,
  score: 0.20,
  answer: 0.20,
}

/** PARSER_DEBUG 环境变量控制 */
const PARSER_DEBUG = typeof process !== 'undefined' && process.env?.PARSER_DEBUG === 'true'

function debugLog(...args: unknown[]) {
  if (PARSER_DEBUG) console.log('[ExamDocumentParser]', ...args)
}

// ── Parser ────────────────────────────────────────────────

export class ExamDocumentParser {
  /**
   * 从 Markdown 文本解析为结构化考试文档
   * Phase 15-P: Section-Aware Parsing 作为主路径
   */
  parse(ocrText: string, options: ParseOptions = {}): ExamDocument {
    const startTime = Date.now()

    // 1. Section-Aware 分段（Phase 15-P 核心）
    const sections = this.parseSections(ocrText)

    debugLog('Section detected:', {
      metadata: !!sections.metadataSection,
      questions: !!sections.questionSection,
      answers: !!sections.answerSection,
      scores: !!sections.scoreSection,
      mistakes: !!sections.mistakeSection,
    })

    // 2. OCR 质量评估（仍用全文评估）
    const ocrQuality = this.evaluateOcrQuality(ocrText)

    // 3. 提取元数据 — 优先从 metadataSection
    const metadata = this.extractMetadata(sections, ocrText)

    // 4. 提取题目 — 从 questionSection（行级扫描，Phase 15-P 重写）
    const questions = this.extractQuestions(sections.questionSection ?? '')
    debugLog(`Questions: ${questions.length}`)

    // 5. 提取答案 — 从 answerSection
    const answers = this.extractAnswers(sections.answerSection ?? '')
    debugLog(`Answers: ${answers.length}`)

    // 6. 提取分数 — 从 scoreSection（含 Markdown 表格支持）
    const scores = this.extractScores(sections.scoreSection ?? '')
    debugLog(`Scores: ${scores.length}`)

    // 7. 提取错题 — 从 mistakeSection（有则用，无则推导）
    const mistakes = sections.mistakeSection
      ? this.extractMistakes(sections.mistakeSection)
      : this.deriveMistakes(questions, scores)
    debugLog(`Mistakes: ${mistakes.length}`)

    // 8. 完整性检查 → 生成 warnings
    const warnings = this.checkIntegrity({
      questions: questions.length,
      answers: answers.length,
      scores: scores.length,
      metadata,
      ocrQuality: ocrQuality.overall,
    })

    // 9. 总体质量评分
    const overallQuality = this.calculateOverallQuality({
      ocrQuality: ocrQuality.overall,
      questionCount: questions.length,
      answerCount: answers.length,
      scoreCount: scores.length,
      warnings,
    })

    // 10. 溯源信息
    const trace: ExamTrace = {
      sourceFiles: [],
      ocrMode: options.ocrMode ?? 'SMART',
      ocrQuality: options.ocrQuality ?? ocrQuality.overall,
      processingTime: (options.totalOcrDuration ?? (Date.now() - startTime) / 1000),
    }

    return {
      metadata,
      questions,
      answers,
      scores,
      mistakes,
      trace,
      warnings,
      overallQuality,
    }
  }

  // ════════════════════════════════════════════════════════════
  //  Section Parser — Phase 15-P 核心
  // ════════════════════════════════════════════════════════════

  /**
   * 将全文按 ## 标题分割为独立段落
   *
   * 模型输出格式:
   *   ## 考试信息
   *   ...
   *   ## 试卷内容
   *   1. xxx
   *      A. xxx
   *   ## 学生作答
   *   ...
   *
   * 旧问题（Phase 15-O 根因）:
   *   split(/\n\n+/) 将 "## 试卷内容\n1. xxx\nA. xxx" 视为一个段落
   *   以 # 开头不匹配 QUESTION_NO_RE → 全部题目丢失
   *
   * Phase 15-P 修复:
   *   先按 ## 切分，识别标题，再逐段解析
   */
  private parseSections(text: string): ParsedSections {
    const sections: ParsedSections = {}

    // ── Path 1: 按 ## 标题分割（原模型格式，向后兼容） ──
    const parts = text.split(/\n(?=##\s)/)
    if (parts.length > 1) {
      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) continue

        const headingMatch = trimmed.match(/^##\s+(.+?)(?:\n|$)/)
        if (!headingMatch) continue

        const heading = headingMatch[1].trim()
        const body = trimmed.slice(headingMatch[0].length).trim()
        debugLog(`Section heading: "${heading}" (${body.length} chars)`)

        if (/^考试信息/.test(heading)) {
          sections.metadataSection = body
        } else if (/^试卷内容/.test(heading)) {
          sections.questionSection = body
        } else if (/^学生作答/.test(heading)) {
          sections.answerSection = body
        } else if (/^成绩信息/.test(heading)) {
          sections.scoreSection = body
        } else if (/^(小分|错题)/.test(heading)) {
          sections.mistakeSection = body
        }
        // 忽略 数据来源 / 题目统计 等段落
      }

      // ## 解析有结果则直接返回
      if (sections.metadataSection || sections.questionSection || sections.answerSection) {
        return sections
      }
    }

    // ── Path 2: 按中文编号分割（Phase 15-Q 新提示词格式） ──
    // 格式：一、试卷内容 ／ 二、答题卡与作答内容 ／ 三、成绩信息 ／ 四、错题 / 小分汇总
    const cnAnchors = [
      { start: '一、试卷内容', name: 'questions' as const },
      { start: '二、答题卡', name: 'answers' as const },
      { start: '三、成绩信息', name: 'scores' as const },
      { start: '四、错题', name: 'mistakes' as const },
    ]

    // 找各锚点在全文中的位置
    const positions: { name: string; idx: number }[] = []
    for (const anchor of cnAnchors) {
      const idx = text.indexOf(anchor.start)
      if (idx >= 0) positions.push({ name: anchor.name, idx })
    }
    positions.sort((a, b) => a.idx - b.idx)

    if (positions.length === 0) return sections // 两种格式都不匹配 → 返回空

    // 第一个锚点之前的文本 → metadata（试卷标题、科目等信息）
    sections.metadataSection = text.slice(0, positions[0].idx).trim()

    // 各锚点之间的文本
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].idx
      const end = i + 1 < positions.length ? positions[i + 1].idx : text.length
      const body = text.slice(start, end).trim()

      switch (positions[i].name) {
        case 'questions':
          sections.questionSection = body
          break
        case 'answers':
          sections.answerSection = body
          break
        case 'scores':
          sections.scoreSection = body
          break
        case 'mistakes':
          sections.mistakeSection = body
          break
      }
    }

    return sections
  }

  // ════════════════════════════════════════════════════════════
  //  OCR 质量评估
  // ════════════════════════════════════════════════════════════

  private evaluateOcrQuality(text: string): OcrQualityEvaluation {
    const lines = text.split('\n')
    const first20Lines = lines.slice(0, 20).join('\n')

    const titleScore = this.evaluateTitleScore(first20Lines)
    const questionNoScore = this.evaluateQuestionNoScore(lines)
    const tableScore = this.evaluateTableScore(lines)
    const scoreScore = this.evaluateScoreScore(lines)
    const answerScore = this.evaluateAnswerScore(lines)

    const overall = Math.round(
      titleScore * QUALITY_WEIGHTS.title +
      questionNoScore * QUALITY_WEIGHTS.questionNo +
      tableScore * QUALITY_WEIGHTS.table +
      scoreScore * QUALITY_WEIGHTS.score +
      answerScore * QUALITY_WEIGHTS.answer,
    )

    return { title: titleScore, questionNo: questionNoScore, table: tableScore, score: scoreScore, answer: answerScore, overall }
  }

  private evaluateTitleScore(text: string): number {
    if (/(考试|试卷|检测|月考|期中|期末|模拟|诊断|练习|测验)/.test(text)) return 100
    if (SUBJECT_LIST.some((s) => text.includes(s))) return 80
    if (/(年级|班|姓名|学号)/.test(text)) return 50
    return 20
  }

  private evaluateQuestionNoScore(lines: string[]): number {
    let matchedLines = 0
    let totalLines = 0
    for (const line of lines) {
      const t = line.trim()
      if (!t) continue
      totalLines++
      if (QUESTION_NO_RE.test(t)) matchedLines++
      if (/^[A-D]\s*[.、）)]/.test(t)) matchedLines++
    }
    if (totalLines === 0) return 0
    const ratio = matchedLines / totalLines
    if (ratio > 0.3) return 100
    if (ratio > 0.15) return 70
    if (ratio > 0.05) return 40
    return 20
  }

  private evaluateTableScore(lines: string[]): number {
    const text = lines.join('\n')
    let score = 0
    if (/[|].*[|]/.test(text)) score += 40
    if (/[+\-]+\+[+\-]+\+/.test(text)) score += 30
    if (/\d+\s{2,}\d+/.test(text)) score += 30
    return Math.min(100, score)
  }

  private evaluateScoreScore(lines: string[]): number {
    const text = lines.join('\n')
    let score = 0
    if (/(满分|总分|得分|扣分)[：:]/g.test(text)) score += 30
    const scoreMatches = text.match(/\d+\s*[/分]\s*\d+/g)
    if (scoreMatches && scoreMatches.length >= 3) score += 40
    if (scoreMatches && scoreMatches.length >= 1) score += 20
    const numberPairs = text.match(/\b\d{1,3}\s{2,}\d{1,3}\b/g)
    if (numberPairs && numberPairs.length >= 3) score += 30
    return Math.min(100, score + (numberPairs ? 0 : 0))
  }

  private evaluateAnswerScore(lines: string[]): number {
    const text = lines.join('\n')
    let score = 0
    const answerPatterns = [/答案[：:]\s*[A-Da-d]/, /^\d+\s*[.、）)]\s*[A-Da-d]\s*$/m]
    for (const pattern of answerPatterns) {
      if (pattern.test(text)) score += 40
    }
    const choiceLetters = text.match(/[A-D]/g)
    if (choiceLetters && choiceLetters.length >= 5) score += 20
    const cjkChars = text.match(/[一-鿿]/g)
    if (cjkChars && cjkChars.length > 100) score += 20
    return Math.min(100, score)
  }

  // ════════════════════════════════════════════════════════════
  //  元数据提取 — Phase 15-P: 优先 metadataSection，修复标题过滤
  // ════════════════════════════════════════════════════════════

  /**
   * 提取考试元信息
   * Phase 15-P 改进:
   *   1. 优先从 metadataSection 提取，降级到全文
   *   2. 标题过滤已知段落标题（"考试信息" 不再被识别为考试名称）
   */
  private extractMetadata(sections: ParsedSections, allText: string): ExamMetadata {
    let title: string | null = null
    let subject: string | null = null
    let grade: string | null = null
    let date: string | null = null
    let totalScore: number | null = null

    // 优先从 metadataSection 提取
    const metadataText = sections.metadataSection ?? ''
    const targetText = metadataText || allText
    const lines = targetText.split('\n')

    // ── 标题提取 ──
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.length > 60 || trimmed.startsWith('#')) continue

      if (/(考试名称|考试|试卷|检测|月考|期中|期末|模拟|诊断|练习|测验)/.test(trimmed) && trimmed.length > 2) {
        // 从 "考试名称：xxx" 中提取真实名称
        const namedMatch = trimmed.match(/考试名称[：:]\s*(.+)/)
        if (namedMatch) {
          title = namedMatch[1].trim()
          break
        }
        // 从 "试卷标题：xxx" 中提取（Phase 15-Q 新提示词格式）
        const paperTitleMatch = trimmed.match(/试卷标题[：:]\s*(.+)/)
        if (paperTitleMatch) {
          title = paperTitleMatch[1].trim()
          break
        }
        // 从 "- xxx" 列表项中提取
        const listMatch = trimmed.match(/^[-*]\s*(.+)/)
        if (listMatch) {
          const candidate = listMatch[1].trim()
          if (!SECTION_HEADING_SET.has(candidate)) {
            title = candidate
            break
          }
        }
        // 纯文本检查
        const candidate = trimmed.replace(/^[-*]\s*/, '')
        if (!SECTION_HEADING_SET.has(candidate)) {
          title = candidate
          break
        }
      }
    }

    // ── 科目提取 ──
    for (const line of lines) {
      for (const subj of SUBJECT_LIST) {
        if (line.includes(subj) && !line.includes('语文科') && !line.includes('英语科')) {
          subject = subj
          break
        }
      }
      if (subject) break
    }

    // ── 年级提取 ──
    const gradePatterns = [/高一/, /高二/, /高三/, /七年级|初一/, /八年级|初二/, /九年级|初三/]
    for (const line of lines) {
      for (const pattern of gradePatterns) {
        if (pattern.test(line) && !grade) {
          const match = line.match(pattern)
          if (match) grade = match[0]
          break
        }
      }
      if (grade) break
    }

    // ── 日期提取（从全文） ──
    const dateMatch = allText.match(DATE_RE)
    if (dateMatch) date = `${dateMatch[1]}年${dateMatch[2]}月`

    // ── 总分提取（从 metadataSection） ──
    const scoreMatch = targetText.match(TOTAL_SCORE_RE)
    if (scoreMatch) totalScore = parseInt(scoreMatch[1], 10)

    return { title, subject, grade, date, totalScore }
  }

  // ════════════════════════════════════════════════════════════
  //  题目提取 — Phase 15-P: 行级扫描替代段落匹配
  // ════════════════════════════════════════════════════════════

  /**
   * 从 questionSection 提取题目
   *
   * Phase 15-O 根因:
   *   旧实现 split(/\n\n+/) → 段落 → QUESTION_NO_RE
   *   模型输出 "## 试卷内容\n1. xxx\nA. xxx" 为一个段落
   *   以 # 开头导致 QUESTION_NO_RE 无法匹配 → 全部丢失
   *
   * Phase 15-P 修复:
   *   行级扫描，逐行识别题号，累积内容
   *   跳过空行和 ## 子标题行
   */
  private extractQuestions(section: string): Question[] {
    if (!section) return []

    const lines = section.split('\n')
    const questions: Question[] = []
    let currentQ: { qn: string; lines: string[] } | null = null
    const seenQn = new Set<string>()

    for (const line of lines) {
      const trimmed = line.trim()

      // 跳过空行和 # 子标题（如 "### 一、选择题"）
      if (!trimmed || trimmed.startsWith('#')) continue

      // 检测题号: "1." "1、" "1）" "Q1." "Q1:"
      const match = trimmed.match(QUESTION_NO_RE) ?? trimmed.match(QUESTION_NO_Q_RE)

      if (match) {
        const qn = match[1]

        // 保存上一题
        if (currentQ) {
          if (!seenQn.has(currentQ.qn)) {
            questions.push(this.buildQuestion(currentQ.qn, currentQ.lines))
            seenQn.add(currentQ.qn)
          }
        }

        // 跳过已见过的题号（防重复）
        if (seenQn.has(qn)) {
          currentQ = null
          continue
        }

        currentQ = { qn, lines: [trimmed] }
      } else if (currentQ) {
        // 累积到当前题目内容（选项、题干续行等）
        currentQ.lines.push(trimmed)
      }
      // 无当前题目且非题号 → 忽略（可能是段落间说明文字）
    }

    // 保存最后一题
    if (currentQ && !seenQn.has(currentQ.qn)) {
      questions.push(this.buildQuestion(currentQ.qn, currentQ.lines))
    }

    return questions.sort((a, b) => parseInt(a.questionNo) - parseInt(b.questionNo))
  }

  /**
   * 从行列表构建 Question 对象
   */
  private buildQuestion(qn: string, lines: string[]): Question {
    const content = lines.join('\n')
    return {
      questionNo: qn,
      questionType: this.detectQuestionType(content),
      content,
      fullScore: this.extractScore(content),
      knowledgePoints: [],
    }
  }

  /**
   * 检测题目类型
   *   - 选项 ≥ 3 → choice
   *   - 含下划线 → fill
   *   - 内容 > 60 字符 → subjective
   *   - 默认 unknown
   */
  private detectQuestionType(content: string): QuestionType {
    const optionMatches = content.match(CHOICE_OPTION_RE)
    if (optionMatches && optionMatches.length >= 3) return 'choice'
    if (content.includes('___') || content.includes('＿＿')) return 'fill'
    if (content.length > 60) return 'subjective'
    return 'unknown'
  }

  /**
   * 从内容中提取分数 "(5分)" "（10分）"
   */
  private extractScore(content: string): number | null {
    const match = content.match(/[（(]\s*(\d+)\s*分\s*[）)]/)
    if (match) return parseInt(match[1], 10)
    return null
  }

  // ════════════════════════════════════════════════════════════
  //  答案提取 — Phase 15-P: 从 answerSection 逐行提取
  // ════════════════════════════════════════════════════════════

  /**
   * 从 answerSection 提取学生答案
   * 支持格式:
   *   "1. B" "1、A" "1：A"
   *   "答案：A"
   *   主观题全文内容
   */
  private extractAnswers(section: string): StudentAnswer[] {
    if (!section) return []

    const lines = section.split('\n')
    const answerMap = new Map<string, StudentAnswer>()
    let lastQn: string | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      // 格式 "1.A" "2.B" "1：A" "1. B"
      const match = trimmed.match(/^\s*(\d+)\s*[.、）):：]\s*([A-Da-d])\s*$/)
      if (match) {
        const qn = match[1]
        if (!answerMap.has(qn)) {
          answerMap.set(qn, {
            questionNo: qn,
            answer: match[2].toUpperCase(),
            confidence: 0.8,
            source: 'examPaper',
          })
        }
        lastQn = qn
        continue
      }

      // 格式 "答案：A"
      const answerMatch = trimmed.match(/(?:^|\s)答案[：:]\s*([A-Da-d][^。]*)/)
      if (answerMatch) {
        const qn = this.findPrecedingQuestionNo(lines, line)
        if (qn && !answerMap.has(qn)) {
          answerMap.set(qn, {
            questionNo: qn,
            answer: answerMatch[1].trim(),
            confidence: 0.6,
            source: 'examPaper',
          })
        }
        continue
      }

      // Phase 15-Q: 格式 "题号：11" → 记录为当前主观题号
      const qnLabelMatch = trimmed.match(/^题号[：:]\s*(\d+)/)
      if (qnLabelMatch) {
        lastQn = qnLabelMatch[1]
        continue
      }

      // Phase 15-Q: 格式 "学生答案：xxx" → 关联到前一个题号
      const studentAnswerMatch = trimmed.match(/^学生答案[：:]\s*(.+)/)
      if (studentAnswerMatch && lastQn && !answerMap.has(lastQn)) {
        const answer = studentAnswerMatch[1].trim()
        if (answer.length > 0) {
          answerMap.set(lastQn, {
            questionNo: lastQn,
            answer,
            confidence: 0.7,
            source: 'examPaper',
          })
        }
        continue
      }

      // 主观题内容：行首为数字且无选项字母 → 作为主观题答案
      const subjectiveMatch = trimmed.match(/^\s*(\d+)\s*[.、）):：]\s*(.+)/)
      if (subjectiveMatch) {
        const qn = subjectiveMatch[1]
        const answer = subjectiveMatch[2].trim()
        // 仅在不是纯选项字母时作为主观题
        if (answer.length > 1 && !/^[A-Da-d]$/.test(answer)) {
          if (!answerMap.has(qn)) {
            answerMap.set(qn, {
              questionNo: qn,
              answer,
              confidence: 0.7,
              source: 'examPaper',
            })
          }
          lastQn = qn
        }
      }
    }

    return Array.from(answerMap.values()).sort((a, b) => parseInt(a.questionNo) - parseInt(b.questionNo))
  }

  // ════════════════════════════════════════════════════════════
  //  分数提取 — Phase 15-P: 从 scoreSection 提取，含 Markdown 表格
  // ════════════════════════════════════════════════════════════

  /**
   * 从 scoreSection 提取分数
   * 支持格式:
   *   "Q1: 3/5" "1. 3/5" "第1题 3分/5分"
   *   "题号：1 得分：3 满分：5"
   *   Markdown 表格:
   *     | 题号 | 得分 | 满分 |
   *     |------|------|------|
   *     | 1    | 3    | 5    |
   *   "总分：120" "平均分：85" — 仅记录总分
   */
  private extractScores(section: string): QuestionScore[] {
    if (!section) return []

    const lines = section.split('\n')
    const scoreMap = new Map<string, QuestionScore>()

    // Phase 15-P 新增: Markdown 表格提取
    const tableScores = this.extractScoresFromTable(lines)
    for (const s of tableScores) {
      if (!scoreMap.has(s.questionNo)) {
        scoreMap.set(s.questionNo, s)
      }
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      // 跳过已被表格解析的行（| 开头）
      if (trimmed.startsWith('|')) continue

      // 格式 "Q1: 3/5" "1. 3/5" "第1题 3分/5分"
      const match = trimmed.match(/(?:Q|第)?\s*(\d+)\s*[：:、.）)]?\s*(\d+)\s*[/分]\s*(\d+)/)
      if (match) {
        const qn = match[1]
        if (!scoreMap.has(qn)) {
          scoreMap.set(qn, {
            questionNo: qn,
            score: parseInt(match[2], 10),
            fullScore: parseInt(match[3], 10),
            source: 'examPaper',
          })
        }
        continue
      }

      // 格式 "题号：1 得分：3 满分：5"
      const multiMatch = trimmed.match(/题号[：:]\s*(\d+).*?得分[：:]\s*(\d+).*?满分[：:]\s*(\d+)/)
      if (multiMatch) {
        const qn = multiMatch[1]
        if (!scoreMap.has(qn)) {
          scoreMap.set(qn, {
            questionNo: qn,
            score: parseInt(multiMatch[2], 10),
            fullScore: parseInt(multiMatch[3], 10),
            source: 'examPaper',
          })
        }
      }
    }

    return Array.from(scoreMap.values()).sort((a, b) => parseInt(a.questionNo) - parseInt(b.questionNo))
  }

  /**
   * 从 Markdown 表格提取分数
   * 支持表格格式:
   *   | 题号 | 得分 | 满分 |
   *   |------|------|------|
   *   | 1    | 3    | 5    |
   *   | 2    | 5    | 5    |
   */
  private extractScoresFromTable(lines: string[]): QuestionScore[] {
    const scores: QuestionScore[] = []

    // 找表头: 包含 "题号" / "得分" / "满分" 的行
    let headerIdx = -1
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (trimmed.startsWith('|') && /(题号|得分|满分|分数)/.test(trimmed)) {
        headerIdx = i
        break
      }
    }

    if (headerIdx === -1) return scores

    // 表头列映射
    const headerLine = lines[headerIdx].trim()
    const headerCols = headerLine.split('|').map((c) => c.trim()).filter(Boolean)
    const colMap: { qn?: number; score?: number; full?: number } = {}
    headerCols.forEach((col, idx) => {
      if (/题号|题目/.test(col)) colMap.qn = idx
      else if (/得分|实得/.test(col)) colMap.score = idx
      else if (/满分|总分/.test(col)) colMap.full = idx
    })

    // 必需有题号和得分
    if (colMap.qn == null || colMap.score == null) return scores

    // 从表头后第 2 行开始（跳过 separator 行）解析数据行
    for (let i = headerIdx + 2; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (!trimmed.startsWith('|')) break

      const cells = trimmed.split('|').map((c) => c.trim()).filter(Boolean)
      const qnRaw = cells[colMap.qn]?.trim()
      const scoreRaw = cells[colMap.score]?.trim()
      const fullRaw = colMap.full != null ? cells[colMap.full]?.trim() : undefined

      const qn = qnRaw?.match(/(\d+)/)
      const score = scoreRaw?.match(/(\d+)/)
      const full = fullRaw?.match(/(\d+)/)

      if (qn && score && full) {
        scores.push({
          questionNo: qn[1],
          score: parseInt(score[1], 10),
          fullScore: parseInt(full[1], 10),
          source: 'examPaper',
        })
      }
    }

    return scores
  }

  // ════════════════════════════════════════════════════════════
  //  错题提取 — Phase 15-P 新增: 从 mistakeSection 直接提取
  // ════════════════════════════════════════════════════════════

  /**
   * 从 mistakeSection 直接提取错题/小分信息
   * 支持格式:
   *   "题号：1 得分：3 满分：5 扣分：2 知识点：三角函数"
   *   "Q1 3/5 扣2分 知识点：三角函数"
   *   "1. 3/5 扣2分"
   */
  private extractMistakes(section: string): MistakeEntry[] {
    if (!section) return []

    const lines = section.split('\n')
    const mistakes: MistakeEntry[] = []

    // ── 多行状态机：处理逐行格式 ──
    // 题号：12
    // 得分：8
    // 满分：12
    // 扣分：4
    // 知识点：xxx
    let multiEntry: { qn: string; score?: number; fullScore?: number; lost?: number; kp?: string } | null = null

    const flushMultiEntry = () => {
      if (!multiEntry) return
      const { qn, score = 0, fullScore = 0, lost, kp } = multiEntry
      const finalLost = lost ?? (fullScore > 0 ? fullScore - score : 0)
      const rate = fullScore > 0 ? Math.round((score / fullScore) * 100) + '%' : 'N/A'
      mistakes.push({
        questionNo: qn,
        lostScore: finalLost,
        rate,
        knowledgePoint: kp,
      })
      multiEntry = null
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) { flushMultiEntry(); continue }

      // 检测新条目的起始
      const qnMatch = trimmed.match(/^题号[：:]\s*(\d+)/)
      if (qnMatch) {
        flushMultiEntry()  // 保存上一条
        multiEntry = { qn: qnMatch[1] }
        continue
      }

      if (multiEntry) {
        const scoreMatch = trimmed.match(/^得分[：:]\s*(\d+)/)
        if (scoreMatch) { multiEntry.score = parseInt(scoreMatch[1], 10); continue }

        const fullMatch = trimmed.match(/^满分[：:]\s*(\d+)/)
        if (fullMatch) { multiEntry.fullScore = parseInt(fullMatch[1], 10); continue }

        const lostMatch = trimmed.match(/^扣分[：:]\s*(\d+)/)
        if (lostMatch) { multiEntry.lost = parseInt(lostMatch[1], 10); continue }

        const kpMatch = trimmed.match(/^知识点[：:]\s*(.+)/)
        if (kpMatch) { multiEntry.kp = kpMatch[1].trim(); continue }

        // 不认识的字段 → 结束当前条目
        flushMultiEntry()
      }

      // 格式 "题号：1 得分：3 满分：5 扣分：2 知识点：xxx"（单行）
      const fullMatch = trimmed.match(/题号[：:]\s*(\d+).*?(?:得分|得分)[：:]\s*(\d+).*?(?:满分|总分)[：:]\s*(\d+)(?:.*?扣分[：:]\s*(\d+))?(?:.*?知识点[：:]\s*(.+))?/)
      if (fullMatch) {
        flushMultiEntry()
        const qn = fullMatch[1]
        const score = parseInt(fullMatch[2], 10)
        const fullScore = parseInt(fullMatch[3], 10)
        const lost = fullMatch[4] ? parseInt(fullMatch[4], 10) : fullScore - score
        const rate = fullScore > 0 ? Math.round((score / fullScore) * 100) + '%' : 'N/A'

        mistakes.push({
          questionNo: qn,
          lostScore: lost,
          rate,
          knowledgePoint: fullMatch[5]?.trim(),
        })
        continue
      }

      // 格式 "Q1 3/5 扣2分"
      const shortMatch = trimmed.match(/(?:Q|第)?\s*(\d+)\s*[.、）)]?\s*(\d+)\s*[/分]\s*(\d+)(?:.*?扣(\d+))?/)
      if (shortMatch) {
        flushMultiEntry()
        const qn = shortMatch[1]
        const score = parseInt(shortMatch[2], 10)
        const fullScore = parseInt(shortMatch[3], 10)
        const lost = shortMatch[4] ? parseInt(shortMatch[4], 10) : fullScore - score
        const rate = fullScore > 0 ? Math.round((score / fullScore) * 100) + '%' : 'N/A'

        mistakes.push({
          questionNo: qn,
          lostScore: lost,
          rate,
        })
      }
    }

    flushMultiEntry()  // 结尾清理

    return mistakes
  }

  // ════════════════════════════════════════════════════════════
  //  错题推导（无 mistakeSection 时的降级路径）
  // ════════════════════════════════════════════════════════════

  private deriveMistakes(questions: Question[], scores: QuestionScore[]): MistakeEntry[] {
    const mistakes: MistakeEntry[] = []
    for (const s of scores) {
      if (s.fullScore > 0 && s.score < s.fullScore) {
        const lost = s.fullScore - s.score
        const rate = Math.round((s.score / s.fullScore) * 100) + '%'
        const question = questions.find((q) => q.questionNo === s.questionNo)
        mistakes.push({
          questionNo: s.questionNo,
          lostScore: lost,
          rate,
          knowledgePoint: question?.knowledgePoints?.[0],
        })
      }
    }
    return mistakes
  }

  // ════════════════════════════════════════════════════════════
  //  完整性检查
  // ════════════════════════════════════════════════════════════

  private checkIntegrity(input: {
    questions: number
    answers: number
    scores: number
    metadata: ExamMetadata
    ocrQuality: number
  }): string[] {
    const warnings: string[] = []

    if (input.questions === 0) {
      warnings.push('未检测到题目，请确认 Vision/OCR 结果是否完整')
    }
    if (input.scores === 0) {
      warnings.push('未检测到成绩信息，成绩统计将受到限制')
    }
    if (input.answers === 0) {
      warnings.push('未检测到学生答案，学生作答将缺失')
    }
    if (!input.metadata.title && !input.metadata.subject) {
      warnings.push('未识别到考试基本信息，请手动补充')
    }
    if (input.ocrQuality < 70) {
      warnings.push(`识别质量评分偏低（${input.ocrQuality}），建议重新上传`)
    }

    return warnings
  }

  // ════════════════════════════════════════════════════════════
  //  总体质量评分
  // ════════════════════════════════════════════════════════════

  private calculateOverallQuality(input: {
    ocrQuality: number
    questionCount: number
    answerCount: number
    scoreCount: number
    warnings: string[]
  }): number {
    const { ocrQuality, questionCount, answerCount, scoreCount, warnings } = input

    // OCR 质量权重 40%
    const ocrScore = Math.min(100, ocrQuality)

    // 完整度权重 30%
    const completeness =
      (questionCount > 0 ? 40 : 0) +
      (answerCount > 0 ? 30 : 0) +
      (scoreCount > 0 ? 30 : 0)

    // 内容质量权重 20%
    const contentScore = questionCount > 0 ? Math.min(100, questionCount * 5) : 0

    // 警告惩罚 10%
    const warningPenalty = Math.min(100, warnings.length * 15)

    const raw = Math.round(
      ocrScore * 0.40 +
      completeness * 0.30 +
      contentScore * 0.20 +
      (100 - warningPenalty) * 0.10,
    )

    return Math.max(0, Math.min(100, raw))
  }

  // ════════════════════════════════════════════════════════════
  //  辅助方法
  // ════════════════════════════════════════════════════════════

  /**
   * 在行列表中向前查找最近的题号
   */
  private findPrecedingQuestionNo(lines: string[], currentLine: string): string | null {
    const idx = lines.indexOf(currentLine)
    if (idx < 0) return null
    for (let i = idx; i >= 0; i--) {
      const match = lines[i].match(QUESTION_NO_RE)
      if (match) return match[1]
    }
    return null
  }
}
