// ── 题目提取提示词（Phase 15-N） ───────────────────────────
// 从 Markdown 中提取结构化的题目列表（备用场景）

export const QUESTION_EXTRACTION_PROMPT = `从以下考试文档 Markdown 中提取所有题目。

每道题输出格式：
题号：<数字>
类型：<choice|fill|subjective>
分值：<数字或无>
内容：<题目文本>
选项：<如果有>

示例：
题号：1
类型：choice
分值：5
内容：下列哪个是二次函数？
选项：A. y=x B. y=x² C. y=1/x D. y=|x|

题号：2
类型：fill
分值：3
内容：圆的面积公式是____。

只输出题目列表，不要额外解释。`
