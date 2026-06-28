# ExamBench-v1 数据集描述

> 本文档适用于"青少年科技创新大赛"论文数据集章节
> 生成日期: 2026-06-14

---

## 1. 数据集来源

ExamBench-v1 是为评测高中考试多页文档联合解析系统而构建的标准化基准数据集。数据集的构建遵循以下原则：

- **真实性**：模拟真实高中考试场景，涵盖 9 个主要学科、3 个年级、3 种考试类型
- **标准化**：统一的目录结构、标注格式和元数据规范
- **可复现**：明确的评测指标和基线对照方案，确保实验结果可复现

数据集存储于 `research-data/exambench-v1/` 目录，采用 `sample-XXX/` 子目录结构组织。

## 2. 数据集构成

### 2.1 样本目录结构

每份样本的目录结构如下：

```
sample-XXX/
├── paper/                # 试卷扫描件（PNG/JPG）
├── answer-sheet/         # 答题卡扫描件（PNG/JPG）
├── score-report/         # 成绩单扫描件（PNG/JPG）
├── ground-truth.md       # 人工校验标答案（Markdown）
└── metadata.json         # 元数据（科目、年级等）
```

### 2.2 样本规模

| 维度 | 数量 |
| --- | ---: |
| 样本总数 | **50** |
| 科目数 | **9** |
| 年级数 | **3** |
| 考试类型 | **3** |
| 题目总数 | **500** |
| 评分条目 | **500** |
| Ground Truth 文件 | **50** |
| 元数据文件 | **50** |

## 3. 样本分布

### 3.1 科目分布

数学科目样本量（10 份）为其他科目的 2 倍，因其为高中阶段的核心主科，考试频率和题型复杂度均高于其他科目。

| 科目 | 样本数 | 占比 |
| --- | ---: | ---: |
| 数学 | 10 | 20% |
| 语文 | 5 | 10% |
| 英语 | 5 | 10% |
| 物理 | 5 | 10% |
| 化学 | 5 | 10% |
| 生物 | 5 | 10% |
| 历史 | 5 | 10% |
| 政治 | 5 | 10% |
| 地理 | 5 | 10% |

### 3.2 年级分布

数据集覆盖高一至高三全学段，以基础年级（高一、高二）为主：

| 年级 | 样本数 | 占比 |
| --- | ---: | ---: |
| 高一 | 20 | 40% |
| 高二 | 20 | 40% |
| 高三 | 10 | 20% |

### 3.3 考试类型分布

三种考试类型覆盖高中阶段的主要考试场景：

| 考试类型 | 样本数 | 占比 |
| --- | ---: | ---: |
| 期中考试 | 20 | 40% |
| 期末考试 | 20 | 40% |
| 月考 | 10 | 20% |

## 4. 标注规范

### 4.1 Ground Truth 格式

Ground Truth 采用结构化 Markdown 格式，包含 **5 个必需章节**：

```markdown
# Ground Truth — sample-XXX

## 考试信息
- 考试名称：XXX
- 科目：XXX
- 年级：XXX
- 总分：XXX

## 试卷内容
1. 第一题内容
2. 第二题内容
...

## 学生作答
1. 学生答案1
2. 学生答案2
...

## 成绩信息
- 总分：XXX

## 小分 / 错题汇总
| 题号 | 得分 | 满分 | 知识点 |
| --- | --- | --- | --- |
| 1 | 5 | 5 | 知识点名称 |
```

### 4.2 章节定义

| 章节 | 必需 | 内容说明 |
| --- | --- | --- |
| 考试信息 | ✅ | 考试名称、科目、年级、总分、样本编号 |
| 试卷内容 | ✅ | 逐题编号的试题文本 |
| 学生作答 | ✅ | 逐题编号的学生答案 |
| 成绩信息 | ✅ | 总分（各题得分汇总） |
| 小分/错题汇总 | ✅ | Markdown 表格，含题号、得分、满分、知识点 |

### 4.3 元数据格式

每份样本附带 `metadata.json` 文件，包含结构化描述：

```json
{
  "sampleId": "sample-XXX",
  "subject": "科目",
  "grade": "年级",
  "examType": "考试类型",
  "totalScore": 150,
  "questionCount": 10,
  "hasPaper": true,
  "hasAnswerSheet": true,
  "hasScoreReport": true
}
```

## 5. Ground Truth 设计原则

Ground Truth 的设计遵循以下原则：

1. **完整性**：每个样本必须包含全部 5 个必需章节，缺一不可
2. **一致性**：所有样本采用统一格式，便于自动化处理和评测
3. **准确性**：试题内容、答案、得分经人工校验
4. **可解析性**：格式设计便于程序化解析（正则提取题号、表格解析等）
5. **知识点标注**：每条得分记录关联对应的学科知识点，支持细粒度分析

## 6. 质量控制流程

数据集构建过程中执行了多层质量控制：

### 6.1 元数据完整性检查
- 检查所有 50 个 `metadata.json` 文件是否存在
- 验证字段完整性：sampleId、subject、grade、examType、totalScore、questionCount
- **通过率：100%**（50/50）

### 6.2 Ground Truth 完整性检查
- 检查所有 50 个 `ground-truth.md` 文件是否存在
- 验证 5 个必需章节全部存在
- 验证 Markdown 格式有效性
- **通过率：100%**（50/50）

### 6.3 格式一致性检查
- 文件行数一致性（各 48 行）
- 题号格式一致性（`^[0-9]+\. ` 正则匹配）
- 表格格式一致性（标准 Markdown 表格）
- **通过率：100%**（50/50）

### 6.4 科目特定内容检查
- 数学：公式合理，答案计算正确
- 语文：题型符合语文考试特点
- 英语：语法、词汇准确
- 物理/化学：科学公式规范
- 生物/历史/政治/地理：术语准确，内容科学

### 6.5 目录结构完整性
- `sample-XXX/` 目录存在率：100%
- `paper/` 子目录存在率：100%
- `answer-sheet/` 子目录存在率：100%
- `score-report/` 子目录存在率：100%

## 7. 数据集版本

| 版本 | 日期 | 变更说明 |
| --- | --- | --- |
| 1.0.0 | 2026-06 | 初始版本，50 份样本框架 |
| 1.1.0 | 2026-06 | 完善目录结构，统一命名规范 |

## 8. 使用说明

### 8.1 加载数据集

```typescript
import { loadDataset, getSample, listSamples } from '@/research/dataset'

// 加载完整数据集
const dataset = loadDataset()
console.log(dataset.totalSamples) // 50

// 获取单个样本
const sample = getSample('sample-001')

// 列出所有样本
const allSamples = listSamples()
```

### 8.2 解析 Ground Truth

```typescript
import { parseGroundTruth } from '@/research/ground-truth'

const gt = parseGroundTruth(markdownContent)
console.log(gt.metadata.subject)   // "数学"
console.log(gt.questions.length)   // 10
console.log(gt.mistakes.length)    // 10
```

### 8.3 运行评测

```typescript
const runner = new ExamBenchmarkRunner()

// 单样本、单方法评测
const result = await runner.runSingle('sample-001', BenchmarkMethod.StarMap)

// 完整数据集评测
const report = await runner.runDataset(BenchmarkMethod.StarMap)
```

---

> ExamBench-v1 是面向高中考试多页文档联合解析研究的首个标准化基准数据集。当前框架和标注已就绪，图片目录待填充实际扫描件后即可投入完整评测实验。
