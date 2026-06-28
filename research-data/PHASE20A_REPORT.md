# Phase 20A-R 真实对比实验报告

> 生成时间：2026-06-18
> 实验管道完整执行 — PaddleOCR → SingleVision → StarMap → 对比分析 → 论文产出

---

## 1. 实验概述

在 5 个真实高中考试案例（语文、英语、物理、化学、地理）上，对比三种文档解析方法：

| 方法 | 引擎 | 模式 | 特点 |
|------|------|------|------|
| **A: PaddleOCR** | PADDLE | LOCAL GPU | 逐图本地 OCR，仅文字检测，无语义理解 |
| **B: SingleVision** | Doubao Vision | API JSON | 逐页 Vision API，JSON 提取，无跨页上下文 |
| **C: StarMap** | Doubao Vision | API Full | 多页联合 Vision 解析（本系统方案） |

## 2. 数据集

| 样本ID | 科目 | 学生 | 图片数 | 满分 | 实际得分 |
|--------|------|------|--------|------|---------|
| real-001 | 语文 | 刘阳乐 | 7 | 150 | 51 |
| real-002 | 英语 | 刘阳乐 | 6 | 100 | 60 |
| real-003 | 物理 | 刘阳乐 | 5 | 100 | 51 |
| real-004 | 化学 | 刘阳乐 | 6 | 100 | 58 |
| real-005 | 地理 | 罗浩泽 | 5 | 100 | 66 |

## 3. 管道执行状态

| 步骤 | 脚本 | 状态 | 说明 |
|------|------|------|------|
| 1. PaddleOCR 基线 | run-paddle-baseline.ts | ✅ 完成 | 29 pages, 2546 blocks (仅文字检测) |
| 2. SingleVision 基线 | run-singlevision-baseline.ts | ✅ 完成 | 29 pages, Doubao API JSON 提取 |
| 3. 三方法对比 | compare-baseline.ts | ✅ 完成 | QA/AA/SA/DSR 指标计算 |
| 4. 论文章节生成 | generate-paper-experiment.ts | ✅ 完成 | 207 行实验报告 |

## 4. 核心对比结果

| 方法 | QA | AA | SA | DSR |
|------|----|----|----|-----|
| PaddleOCR | 100%* | N/A（只检测文字） | N/A（无语义） | N/A（无语义） |
| SingleVision | **100%** | **92%** | **60%** | **80%** |
| **StarMap** | **100%** | **100%** | **100%** | **92%** |

> \* PaddleOCR 的 QA 来自启发式正则匹配（`/^[\d一-十]+[\.\、\s]/`），仅统计试卷图片，数值为 100% 但不代表真正的题目语义识别能力。

### 逐样本对比

| 样本 | 方法 | QA | AA | SA | DSR |
|------|------|----|----|----|-----|
| real-001 语文 | StarMap | 100% | 100% | 100% | 100% |
| | SingleVision | 100% | 94.4% | 0% | 80% |
| | PaddleOCR | 100%* | N/A | N/A | N/A |
| real-002 英语 | StarMap | 100% | 100% | 100% | 100% |
| | SingleVision | 100% | 64.9% | 100% | 80% |
| | PaddleOCR | 100%* | N/A | N/A | N/A |
| real-003 物理 | StarMap | 100% | 100% | 100% | 80% |
| | SingleVision | 100% | 100% | 100% | 80% |
| | PaddleOCR | 100%* | N/A | N/A | N/A |
| real-004 化学 | StarMap | 100% | 100% | 100% | 80% |
| | SingleVision | 100% | 100% | 100% | 80% |
| | PaddleOCR | 100%* | N/A | N/A | N/A |
| real-005 地理 | StarMap | 100% | 100% | 100% | 100% |
| | SingleVision | 100% | 100% | 0% | 80% |
| | PaddleOCR | 100%* | N/A | N/A | N/A |

## 5. 关键发现

1. **StarMap 全面领先** — QA/AA/SA 三项 100%，DSR 92%，验证多页联合 Vision 方案的有效性
2. **多页上下文是关键差异** — SingleVision 逐页处理在英语案例上仅 64.9% AA（跨页答案遗漏），而 StarMap 通过一次性送入所有页面实现 100% AA
3. **SingleVision 成绩提取不稳定** — 语文（SA=0%）和地理（SA=0%）案例中 score 字段与 ground truth 不匹配
4. **PaddleOCR 无语义理解** — 仅提供原始 OCR 文本块（2546 blocks），无法直接用于 AA/SA/DSR 评估。QA 采用启发式正则从试卷图片统计"题号"得到 100%，属于机械匹配而非语义理解

## 6. 产出文件清单

| 文件 | 路径 |
|------|------|
| PaddleOCR 结果 | research-data/benchmark/paddle/results.json |
| SingleVision 结果 | research-data/benchmark/singlevision/results.json |
| 对比摘要 | research-data/benchmark/comparison/benchmark-summary.json |
| 论文实验章节 | research-data/paper-assets/baseline-experiment.md |
| 本报告 | research-data/PHASE20A_REPORT.md |

## 7. 后续建议

- PaddleOCR 本地引擎数据已采集完成（29 页 2546 blocks），QA 启发式评估 100%，AA/SA/DSR 因无语义理解标注 N/A
- 对 SingleVision 添加多页上下文提示（few-shot），测试 AA/SA 提升幅度
- 增加样本量（当前仅 5 样本，每个学科 1 个），提高统计显著性
- 探索其他视觉模型（GPT-4o, Claude 3.5 Sonnet）作为对比
