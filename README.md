e-mail：s3431248075@163.com
# <img src="./docs/images/logo.svg" alt="StarMap" width="32" style="vertical-align: middle" /> StarMap

**StarMap v2.0 — AI Learning Portfolio Platform**

> 智能学情分析平台 · 基于 AI Vision 的高中考试结构化与学习画像系统

[![Version](https://img.shields.io/badge/version-2.0.0-blue)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)]()
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2d3748)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 📸 产品截图

<p align="center">
  <img src="./docs/images/dashboard.png" alt="Dashboard" width="45%" />
  <img src="./docs/images/exam-categories.png" alt="考试分类" width="45%" />
</p>
<p align="center">
  <img src="./docs/images/exam-detail.png" alt="考试详情" width="45%" />
  <img src="./docs/images/upload-confirmation.png" alt="上传确认" width="45%" />
</p>
<p align="center">
  <img src="./docs/images/knowledge-graph.png" alt="知识图谱" width="45%" />
  <img src="./docs/images/learning-profile.png" alt="学习档案" width="45%" />
</p>

---

## ✨ 核心功能

| 功能 | 描述 |
|------|------|
| 📤 **统一上传** | 拖拽上传试卷/答题卡/小分，自动 OCR 识别，支持多次追加 |
| 🧠 **AI 分析** | DeepSeek V4 Flash 驱动，自动提取题目、知识点、错题分析 |
| 📚 **考试分类** | 按年级/学期/类型自动归类，完整 Exam Session 架构 |
| 📊 **Dashboard** | 聚合统计、趋势图表、最近考试概览 |
| 🧩 **知识图谱** | 252 节点标准高中知识树，支持可视化浏览 |
| ⚠️ **风险预警** | 基于趋势分析的知识点退化风险预测 |
| 📕 **错题本** | 自动收集低频得分题，支持科目筛选、PDF 导出 |
| 🎯 **学习画像** | 跨学科知识掌握情况可视化，智能学习建议 |
| 📈 **成长趋势** | 基于真实考试数据的学习进度追踪 |

---

## 🏗️ 技术栈

| 层 | 技术 |
|------|--------|
| **框架** | Next.js 16.2.6 (App Router) |
| **语言** | TypeScript 5.7 |
| **数据库** | PostgreSQL + Prisma 7.8 ORM |
| **认证** | NextAuth.js v5 |
| **UI** | Tailwind CSS 4 + 玻璃拟态设计系统 |
| **动画** | Framer Motion |
| **图标** | Lucide React |
| **图表** | Recharts |
| **通知** | Sonner |
| **OCR** | PaddleOCR + Doubao Vision |
| **AI** | DeepSeek V4 Flash / Claude API |
| **部署** | Vercel / Node.js |

---

## 🏛️ 架构图

```
┌─────────────────────────────────────────────┐
│                 前端 (Next.js)                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────────┐  │
│  │Dashboard│ │考试分类│ │上传确认│ │学习画像/图谱│  │
│  └──────┘ └──────┘ └──────┘ └───────────┘  │
├─────────────────────────────────────────────┤
│               API 层 (Route Handlers)         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────────┐  │
│  │  Exams  │ │Sessions│ │ Upload │ │Analytics/..│  │
│  └──────┘ └──────┘ └──────┘ └───────────┘  │
├─────────────────────────────────────────────┤
│              服务层 (Services)               │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ OCR Engine │ │Document │ │  Learning   │  │
│  │(Paddle/Doubao)│ │Assembly │ │  Analytics  │  │
│  └──────────┘ └──────────┘ └────────────┘  │
├─────────────────────────────────────────────┤
│              数据层 (Prisma + PostgreSQL)     │
│  18 Models · 7 Enums · Full Relations       │
└─────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- PostgreSQL ≥ 14
- pnpm / npm

### 安装

```bash
# 克隆仓库
git clone https://github.com/Q1y1ng/StarMap.git
cd StarMap

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接串和 API Key

# 初始化数据库
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

### 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | ✅ |
| `NEXTAUTH_SECRET` | NextAuth 密钥 | ✅ |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | ✅ |
| `DOUBAO_API_KEY` | Doubao Vision API Key | 可选 |
| `OSS_ENDPOINT` | 阿里云 OSS Endpoint | 可选 |
| `OSS_BUCKET` | OSS Bucket 名称 | 可选 |

---

## 📁 项目结构

```
StarMap/
├── prisma/              # 数据库 Schema + 迁移文件
│   └── schema.prisma    # 18 Models
├── src/
│   ├── app/
│   │   ├── api/         # 28 个 API Route 目录
│   │   ├── dashboard/   # 仪表盘
│   │   ├── exam-sessions/ # 考试分类
│   │   ├── exams/       # 考试记录
│   │   ├── upload-exam/ # 统一上传
│   │   ├── upload-confirmation/ # 上传确认
│   │   ├── knowledge-graph/ # 知识图谱
│   │   ├── learning-profile/ # 学习档案
│   │   ├── wrong-book/  # 错题本
│   │   └── ...
│   ├── components/
│   │   ├── ui-system/   # 16 个 UI 组件
│   │   └── layout/      # AppShell, Sidebar, Theme
│   ├── services/        # OCR, Document, Analysis 服务
│   └── lib/             # 工具库
├── docs/
│   ├── releases/        # Release Notes
│   └── images/          # 产品截图
├── research-data/       # 科研数据集
└── DEV_LOG.md           # 详细开发日志
```

---

## 📊 数据库模型

| 模型 | 说明 |
|-------|------|
| `User` | 用户认证 |
| `ExamSession` | 考试分类（一次完整考试） |
| `Exam` | 考试/试卷记录 |
| `Student` | 学生信息 |
| `Score` | 成绩记录 |
| `Question` | 题目定义 |
| `QuestionResult` | 题目得分 |
| `KnowledgePoint` | 知识图谱节点 |
| `KnowledgeEdge` | 知识图谱边 |
| `LearningProfile` | 学习画像 |
| `LearningRisk` | 风险预警 |
| `WrongQuestion` | 错题本 |
| `ScoreBreakdown` | 小分识别 |
| `DocumentArtifact` | 文档溯源 |
| `ExamArtifact` | 考试档案 |
| *(共 18 个 Model)* |

---

## 📜 版本历史

| 版本 | 日期 | 说明 |
|-------|------|------|
| [v2.0.0](./docs/releases/v2.0.0.md) | 2026-06-28 | 🎉 产品完整版发布 |
| [v1.2.1](./CHANGELOG.md) | 2026-06-15 | OCR Markdown 导出 |
| [v1.2.0](./CHANGELOG.md) | 2026-06-09 | Vision-Native 架构 |
| [v1.11.0](./CHANGELOG.md) | 2026-06-08 | 文档智能引擎 |
| [v1.1.0](./CHANGELOG.md) | 2026-06-07 | 增量迭代 Phase 4–13 |
| [v1.0](./CHANGELOG.md) | 2026-06-07 | 初始版本 |

---

## 📄 License

MIT © 2026 HEAOZIE

---

## 👤 作者

**HEAOZIE** — [@Q1y1ng](https://github.com/Q1y1ng)

> StarMap v2.0 — Made by HEAOZIE © 2026
