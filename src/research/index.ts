// ── Research Module 入口（Phase 16-B/C） ─────────────────
// ExamBench-v1 科研评测体系

// 类型
export type { ExamSample, DatasetInfo, BenchmarkMetrics, BenchmarkResult, DatasetReport }
  from './dataset'
export { BenchmarkMethod, loadDataset, getSample, listSamples } from './dataset'

// Ground Truth
export type { ExamGroundTruth, GTMetaData, GTQuestion, GTAnswer, GTScore, GTMistake }
  from './ground-truth'
export { parseGroundTruth, serializeGroundTruth } from './ground-truth'

// 评价指标
export type { ParsedExam } from './metrics'
export { parseExamMarkdown, calculateQA, calculateAA, calculateSA, calculateDSR, calculateAll }
  from './metrics'

// Benchmark 引擎
export { ExamBenchmarkRunner } from './benchmark'
export type { BenchmarkOptions } from './benchmark'

// 基线对照框架
export { ExamBenchEvaluator } from './evaluator'
export type { BenchmarkEvaluator, BenchmarkSummary } from './evaluator'
export { runBenchmark, runAllBenchmarks } from './evaluator'

// 数据导入器
export { importExamFolder, importAllExamFolders, importAndExport } from './importers'
export type { ImportResult } from './importers'

// 报告生成
export { generateReport, generatePaperAssets, generatePaperTables, generateChartDataCSV }
  from './report-generator'
