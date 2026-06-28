-- CreateTable
CREATE TABLE "knowledge_mastery_history" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "knowledgePoint" VARCHAR(128) NOT NULL,
    "examId" UUID NOT NULL,
    "mastery" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "fullScore" DOUBLE PRECISION NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_mastery_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_profiles" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "strongPoints" JSONB NOT NULL DEFAULT '[]',
    "weakPoints" JSONB NOT NULL DEFAULT '[]',
    "improvingPoints" JSONB NOT NULL DEFAULT '[]',
    "decliningPoints" JSONB NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_mastery_history_subject_knowledgePoint_examDate_idx" ON "knowledge_mastery_history"("subject", "knowledgePoint", "examDate");

-- CreateIndex
CREATE INDEX "knowledge_mastery_history_examId_idx" ON "knowledge_mastery_history"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_mastery_history_subject_knowledgePoint_examId_key" ON "knowledge_mastery_history"("subject", "knowledgePoint", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_profiles_subject_key" ON "learning_profiles"("subject");

-- AddForeignKey
ALTER TABLE "knowledge_mastery_history" ADD CONSTRAINT "knowledge_mastery_history_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
