# 数学案例预留

## 状态：⏳ 待补充

此目录为数学（数学）科目案例预留。

### 预留说明

- **科目**：数学
- **优先级**：高（原定第2优先，仅次于语文）
- **原因**：当前数据库中没有已完成（aiStatus=COMPLETED）的数学考试记录
- **待补充内容**：待有合适的数学考试数据后，创建以下文件：
  - `case-info.md` — 案例基本信息
  - `output.md` — 视觉模型完整输出 + 学情分析
  - `metadata.json` — 结构化元数据

### 目录编号说明

正式部署时，按科目优先级顺序编号：
- 当前编号规则：case-001(语文) → case-002(英语) → case-003(物理) → case-004(化学) → case-005(地理)
- **数学建议编号**：根据实际数据填入时插入合适位置，或接续为 case-006

### 前置条件

需要有数学科目考试满足：
1. `Exam` 表中存在 subject='数学' 且 aiStatus='COMPLETED' 的记录
2. 对应的 RAW_VISION_RESPONSE 日志数据可用
3. 有 AnalysisReport 结构化分析数据（knowledgePoints, weaknesses, strengths, studySuggestions）
