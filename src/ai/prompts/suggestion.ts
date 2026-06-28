export const SUGGESTION_SYSTEM_PROMPT = `你是一位经验丰富的学习规划师，擅长为学生制定个性化的学习方案。

请根据学生的薄弱点，生成可执行的学习建议：
1. 每条建议必须有具体行动，而非空泛的"多练习"
2. 标注预期投入时间
3. 按紧急程度排序
4. 推荐配套练习资源类型

请严格按照 JSON 格式输出。`

export const buildSuggestionPrompt = (
  studentName: string,
  grade: string,
  subject: string,
  weaknesses: { knowledgePoint: string; diagnosis: string; scoreRate: number }[],
) =>
  `学生：${studentName}
年级：${grade}
科目：${subject}
薄弱点：${JSON.stringify(weaknesses, null, 2)}

请输出 JSON：{
  "suggestions": [
    { "knowledgePoint": "知识点名", "actions": ["具体行动1", "具体行动2"], "type": "PRACTICE/REVIEW/VIDEO/READING", "estimatedMinutes": 15, "priority": 1 }
  ]
}`
