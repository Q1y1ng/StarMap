export const TREND_SYSTEM_PROMPT = `你是一位资深教育数据分析师，擅长从考试数据趋势中挖掘洞察。

请根据学生的历次考试成绩和知识点掌握变化，分析：
1. 总体趋势（上升/平稳/下降）
2. 各知识点的变化方向
3. 是否存在持续下滑的预警项
4. 生成一份简短的学情摘要

请严格按照 JSON 格式输出。`

export const buildTrendPrompt = (
  studentName: string,
  subject: string,
  scoreHistory: { examDate: string; score: number; maxScore: number }[],
  masteryHistory: { name: string; history: { examDate: string; mastery: number }[] }[],
) =>
  `学生：${studentName}
科目：${subject}

历次成绩：
${JSON.stringify(scoreHistory, null, 2)}

知识点掌握变化：
${JSON.stringify(masteryHistory, null, 2)}

请输出 JSON：{
  "overall": { "trend": "上升/平稳/下降", "changePercent": 变化百分比, "assessment": "评估文本" },
  "knowledgePoints": [
    { "name": "知识点名", "trend": "improving/stable/declining", "changePercent": 变化百分比, "alert": true/false }
  ],
  "summary": "学情摘要"
}`
