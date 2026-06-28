# Changelog

> 详细开发历程（Phase 1 → Phase 23）请见 [DEV_LOG.md](./DEV_LOG.md)。
> 此处仅记录版本号发布和主要变更摘要。

## v2.0.0 (2026-06-28)

**🎉 StarMap v2.0 — 产品完整版发布**

### 新增功能

- **统一上传入口**: 拖拽上传图片/PDF，自动 OCR 识别，支持多次追加/删除
- **智能考试分类**: 完整 Exam Session 架构（Phase 22）
- **上传确认页**: OCR 预览 + AI 建议 + 用户确认再写入（Phase 23）
- **Dashboard**: 聚合统计、趋势图表、最近考试概览
- **AI 考试总结**: 自动生成考试分析总结（Phase 21/21-B）
- **学习风险预警**: 基于线性回归趋势分析（Phase 10）
- **知识图谱**: 252 节点标准高中知识树（Phase 9）
- **学习画像**: 跨学科知识掌握情况可视化
- **错题本**: 自动收集低频得分题，支持 PDF 导出
- **成长趋势**: 基于真实考试数据的学习进度追踪

### 工程质量

- 全站 API 统一 `{ success, data, error }` 响应格式
- Sonner Toast 通知系统，统一错误/成功/加载反馈
- 统一 Empty State / Loading / Error 状态组件
- 统一 Framer Motion 动画（stagger, fadeUp 模式）
- 统一 Lucide 图标系统
- Apple HIG 风格玻璃拟态设计系统
- TypeScript 0 Error / ESLint 0 Warning / Build 0 Error
- 18 个 Prisma Model，完整 Relation 和 Cascade 约束

| 文件 | 改动 |
|------|------|
| `package.json` | v1.2.1 → v2.0.0 |
| `README.md` | 完整重写 |
| `docs/releases/v2.0.0.md` | **新增** |
| `LICENSE` | **新增** (MIT) |
| `src/components/layout/AppShell.tsx` | 新增全局 Footer |
| `src/app/providers.tsx` | 新增 Toaster |
| `src/components/ui-system/EmptyState.tsx` | **新增** |
| `src/components/ui-system/Toast.tsx` | **新增** |
| `docs/images/` | **新增** 截图目录 |

---

## v1.2.1 (2026-06-15)

- **OCR Markdown 导出**: 上传页新增「导出 Markdown」按钮
- **ExamBench-v1 科研评测**: 50 样本数据集 + 评测模块
- **Case Study 案例库**: 地理 case-005 + 数学预留模板

## v1.2.0 (2026-06-09)

- **Vision-Native 架构转型**: VisionDocument 替换 OCR 为一级数据源
- **Section-Aware Parser**: 修复段落分割丢题
- **多次上传支持**: 拖拽追加 + 逐行删除
- **默认 HIGH_ACCURACY OCR 模式**

## v1.11.0 (2026-06-08)

- **文档智能引擎**: 统一上传入口，三层分类器，规则合并
- **DocumentArtifact 模型**
- 三个独立上传页面添加弃用引导

## v1.1.0 (2026-06-02 ~ 06-07)

增量迭代 Phase 4–13: 题目成绩、答题卡匹配、成长轨迹、难度引擎、错题本、学习计划、知识图谱、风险预警、用户系统、玻璃拟态 UI

## v1.0 (2026-06-07)

初始发布: Next.js + Prisma + PostgreSQL 脚手架，14 个数据模型，多引擎 OCR，基础认证，初始页面
