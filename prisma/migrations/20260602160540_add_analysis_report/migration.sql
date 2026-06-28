-- CreateEnum
CREATE TYPE "ai_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "analysis_type" AS ENUM ('KNOWLEDGE_POINT', 'WEAKNESS', 'SUGGESTION', 'TREND');

-- CreateEnum
CREATE TYPE "analysis_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "suggestion_type" AS ENUM ('PRACTICE', 'REVIEW', 'VIDEO', 'READING');

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "studentNumber" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "grade" VARCHAR(16) NOT NULL,
    "class" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" UUID NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "grade" VARCHAR(16) NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "fileUrl" VARCHAR(512),
    "fileType" VARCHAR(16),
    "aiStatus" "ai_status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "classRank" INTEGER,
    "gradeRank" INTEGER,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_points" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "category" VARCHAR(64),

    CONSTRAINT "knowledge_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_knowledge_points" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "knowledgePointId" UUID NOT NULL,
    "questionNumbers" TEXT[],
    "totalPoints" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "exam_knowledge_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_knowledge_mastery" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "knowledgePointId" UUID NOT NULL,
    "masteryLevel" DOUBLE PRECISION NOT NULL,
    "historyData" JSONB,
    "lastAssessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_knowledge_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weakness_analyses" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "knowledgePointId" UUID NOT NULL,
    "weaknessScore" DOUBLE PRECISION NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weakness_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_suggestions" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "weaknessAnalysisId" UUID,
    "content" TEXT NOT NULL,
    "type" "suggestion_type" NOT NULL,
    "resourceUrl" VARCHAR(512),
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analysis_logs" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "studentId" UUID,
    "type" "analysis_type" NOT NULL,
    "inputData" JSONB NOT NULL,
    "outputData" JSONB NOT NULL,
    "modelVersion" VARCHAR(32) NOT NULL,
    "tokenUsage" JSONB,
    "duration" INTEGER,
    "status" "analysis_status" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analysis_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_reports" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "summary" TEXT NOT NULL,
    "knowledgePoints" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "studySuggestions" JSONB NOT NULL,
    "inputContent" TEXT NOT NULL,
    "rawOutput" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "status" "analysis_status" NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_studentNumber_key" ON "students"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "scores_studentId_examId_key" ON "scores"("studentId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_knowledge_points_examId_knowledgePointId_key" ON "exam_knowledge_points"("examId", "knowledgePointId");

-- CreateIndex
CREATE UNIQUE INDEX "student_knowledge_mastery_studentId_knowledgePointId_key" ON "student_knowledge_mastery"("studentId", "knowledgePointId");

-- CreateIndex
CREATE INDEX "weakness_analyses_studentId_examId_idx" ON "weakness_analyses"("studentId", "examId");

-- CreateIndex
CREATE INDEX "ai_analysis_logs_examId_type_idx" ON "ai_analysis_logs"("examId", "type");

-- CreateIndex
CREATE INDEX "analysis_reports_examId_idx" ON "analysis_reports"("examId");

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_knowledge_points" ADD CONSTRAINT "exam_knowledge_points_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_knowledge_points" ADD CONSTRAINT "exam_knowledge_points_knowledgePointId_fkey" FOREIGN KEY ("knowledgePointId") REFERENCES "knowledge_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_knowledge_mastery" ADD CONSTRAINT "student_knowledge_mastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_knowledge_mastery" ADD CONSTRAINT "student_knowledge_mastery_knowledgePointId_fkey" FOREIGN KEY ("knowledgePointId") REFERENCES "knowledge_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weakness_analyses" ADD CONSTRAINT "weakness_analyses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weakness_analyses" ADD CONSTRAINT "weakness_analyses_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weakness_analyses" ADD CONSTRAINT "weakness_analyses_knowledgePointId_fkey" FOREIGN KEY ("knowledgePointId") REFERENCES "knowledge_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_suggestions" ADD CONSTRAINT "learning_suggestions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_suggestions" ADD CONSTRAINT "learning_suggestions_weaknessAnalysisId_fkey" FOREIGN KEY ("weaknessAnalysisId") REFERENCES "weakness_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analysis_logs" ADD CONSTRAINT "ai_analysis_logs_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_reports" ADD CONSTRAINT "analysis_reports_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
