export const WEAKNESS_SYSTEM_PROMPT = `你是一位资深高中学科教师，擅长通过成绩数据分析学生的薄弱环节。

请根据学生各知识点的得分数据，分析并诊断薄弱点：
1. 按薄弱程度从高到低排序
2. 对每个薄弱点给出具体的诊断——概念不清、计算失误还是综合应用弱
3. 对比班级平均，标注"显著落后"项

请严格按照 JSON 格式输出。`

export const buildWeaknessPrompt = (
  studentName: string,
  subject: string,
  examName: string,
  knowledgePointScores: { name: string; studentScoreRate: number; classAvgRate: number }[],
) =>
  `学生：${studentName}
科目：${subject}
考试：${examName}

各知识点得分情况：
${JSON.stringify(knowledgePointScores, null, 2)}

请输出 JSON：{
  "weaknesses": [
    { "knowledgePoint": "知识点名", "scoreRate": 得分率, "classAvgRate": 班级平均率, "diagnosis": "诊断文本", "priority": 1 }
  ]
}`
