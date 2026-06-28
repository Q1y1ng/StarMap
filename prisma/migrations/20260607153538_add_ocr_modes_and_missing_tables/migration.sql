-- CreateEnum
CREATE TYPE "ocr_mode" AS ENUM ('LOCAL', 'SMART', 'HIGH_ACCURACY');

-- CreateEnum
CREATE TYPE "ocr_engine" AS ENUM ('PADDLE', 'DOUBAO');

-- CreateTable
CREATE TABLE "knowledge_nodes" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "parentId" UUID,
    "level" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_edges" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "relationType" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_risks" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "knowledgePoint" VARCHAR(128) NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" VARCHAR(16) NOT NULL,
    "trendSlope" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "latestMastery" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_breakdowns" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "questionNo" INTEGER NOT NULL,
    "fullScore" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "lostScore" DOUBLE PRECISION NOT NULL,
    "source" VARCHAR(255) NOT NULL DEFAULT 'SCORE_BREAKDOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plans" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "planDate" TIMESTAMP(3) NOT NULL,
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 0,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "passwordHash" VARCHAR(256) NOT NULL,
    "role" VARCHAR(16) NOT NULL DEFAULT 'USER',
    "name" VARCHAR(64) NOT NULL,
    "apiKey" VARCHAR(512),
    "model" VARCHAR(64),
    "doubaoApiKey" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "analysis_reports" ADD COLUMN "ocrMode" "ocr_mode";
ALTER TABLE "analysis_reports" ADD COLUMN "ocrEngine" "ocr_engine";
ALTER TABLE "analysis_reports" ADD COLUMN "ocrQuality" DOUBLE PRECISION;
ALTER TABLE "analysis_reports" ADD COLUMN "ocrDurationMs" INTEGER;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN "userId" UUID;
ALTER TABLE "exams" ADD COLUMN "fileUrl" VARCHAR(512);
ALTER TABLE "exams" ADD COLUMN "fileType" VARCHAR(16);

-- AlterTable
ALTER TABLE "question_results" ADD COLUMN "lostScore" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_nodes_subject_name_key" ON "knowledge_nodes"("subject", "name");
CREATE INDEX "knowledge_nodes_subject_level_idx" ON "knowledge_nodes"("subject", "level");
CREATE INDEX "knowledge_nodes_parentId_idx" ON "knowledge_nodes"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_edges_sourceId_targetId_relationType_key" ON "knowledge_edges"("sourceId", "targetId", "relationType");
CREATE INDEX "knowledge_edges_sourceId_idx" ON "knowledge_edges"("sourceId");
CREATE INDEX "knowledge_edges_targetId_idx" ON "knowledge_edges"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_risks_subject_knowledgePoint_key" ON "learning_risks"("subject", "knowledgePoint");
CREATE INDEX "learning_risks_subject_riskLevel_idx" ON "learning_risks"("subject", "riskLevel");
CREATE INDEX "learning_risks_riskScore_idx" ON "learning_risks"("riskScore");

-- CreateIndex
CREATE UNIQUE INDEX "score_breakdowns_examId_questionNo_key" ON "score_breakdowns"("examId", "questionNo");
CREATE INDEX "score_breakdowns_examId_idx" ON "score_breakdowns"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "study_plans_subject_planDate_key" ON "study_plans"("subject", "planDate");
CREATE INDEX "study_plans_subject_planDate_idx" ON "study_plans"("subject", "planDate");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "exams_userId_idx" ON "exams"("userId");

-- AddForeignKey
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "knowledge_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_edges" ADD CONSTRAINT "knowledge_edges_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_breakdowns" ADD CONSTRAINT "score_breakdowns_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
