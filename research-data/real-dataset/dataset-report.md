# Real Dataset 汇总报告

> 自动生成时间：2026-06-15
> 生成脚本：scripts/init-real-dataset.ts

---

## 1. 数据集总览

| 指标 | 数值 |
|------|------|
| 样本总数 | **41** |
| 覆盖科目 | **7** |
| 已处理样本（含 output.md） | **5** |
| 含原始文件的样本 | **17** |

## 2. 科目分布

| 科目 | 样本数 | 占比 |
|------|-------|------|
| 待识别 | 17 | 41% |
| 语文 | 4 | 10% |
| 英语 | 4 | 10% |
| 物理 | 4 | 10% |
| 化学 | 4 | 10% |
| 地理 | 4 | 10% |
| 数学 | 4 | 10% |

## 3. 数据来源

| 来源 | 样本数 | 说明 |
|------|-------|------|
| case-study | 5 | 已处理并人工验证的真实案例 |
| uploaded-pdf | 17 | 上传的真实 PDF 扫描件 |
| exambench-v1 | 19 | ExamBench-v1 标准样本 |

## 4. 年级分布

| 年级 | 样本数 |
|------|-------|
| 高二 | 13 |
| unknown | 17 |
| 高一 | 8 |
| 高三 | 3 |

## 5. 已处理样本明细

| Sample | 科目 | 总分 | 得分 | 得分率 | 耗时(ms) | 输出(字符) |
|--------|------|------|------|--------|---------|-----------|
| real-001 | 语文 | 150 | 51 | 34% | 9141 | 5213 |
| real-002 | 英语 | 100 | 60 | 60% | 9434 | 7069 |
| real-003 | 物理 | 100 | 51 | 51% | 7506 | 7400 |
| real-004 | 化学 | 100 | 58 | 58% | 10346 | 4518 |
| real-005 | 地理 | 100 | 66 | 66% | 9000 | 4283 |

## 6. 样本列表

- `real-001`: 语文 | 高二 | 诊断考试 | ✅ 已处理 | case-study
- `real-002`: 英语 | 高二 | 诊断考试 | ✅ 已处理 | case-study
- `real-003`: 物理 | 高二 | 诊断考试 | ✅ 已处理 | case-study
- `real-004`: 化学 | 高二 | 诊断考试 | ✅ 已处理 | case-study
- `real-005`: 地理 | 高二 | 诊断考试 | ✅ 已处理 | case-study
- `real-006`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-007`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-008`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-009`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-010`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-011`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-012`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-013`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-014`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-015`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-016`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-017`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-018`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-019`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-020`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-021`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-022`: unknown | unknown | 诊断考试 | ⏳ 待处理 | uploaded-pdf
- `real-023`: 语文 | 高二 | 期末考试 | ⏳ 待处理 | exambench-v1
- `real-024`: 语文 | 高二 | 期末考试 | ⏳ 待处理 | exambench-v1
- `real-025`: 语文 | 高二 | 期末考试 | ⏳ 待处理 | exambench-v1
- `real-026`: 数学 | 高一 | 期中考试 | ⏳ 待处理 | exambench-v1
- `real-027`: 数学 | 高二 | 期末考试 | ⏳ 待处理 | exambench-v1
- `real-028`: 数学 | 高一 | 期中考试 | ⏳ 待处理 | exambench-v1
- `real-029`: 数学 | 高二 | 期末考试 | ⏳ 待处理 | exambench-v1
- `real-030`: 英语 | 高三 | 月考 | ⏳ 待处理 | exambench-v1
- `real-031`: 英语 | 高三 | 月考 | ⏳ 待处理 | exambench-v1
- `real-032`: 英语 | 高三 | 月考 | ⏳ 待处理 | exambench-v1
- `real-033`: 物理 | 高一 | 期中考试 | ⏳ 待处理 | exambench-v1
- `real-034`: 物理 | 高一 | 期中考试 | ⏳ 待处理 | exambench-v1
- `real-035`: 物理 | 高一 | 期中考试 | ⏳ 待处理 | exambench-v1
- `real-036`: 化学 | 高二 | 期末考试 | ⏳ 待处理 | exambench-v1
- `real-037`: 化学 | 高二 | 期末考试 | ⏳ 待处理 | exambench-v1
- `real-038`: 化学 | 高二 | 期末考试 | ⏳ 待处理 | exambench-v1
- `real-039`: 地理 | 高一 | 期中考试 | ⏳ 待处理 | exambench-v1
- `real-040`: 地理 | 高一 | 期中考试 | ⏳ 待处理 | exambench-v1
- `real-041`: 地理 | 高一 | 期中考试 | ⏳ 待处理 | exambench-v1

---

*报告由 init-real-dataset.ts 自动生成*
