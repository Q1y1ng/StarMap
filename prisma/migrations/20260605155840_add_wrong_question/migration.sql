-- CreateTable
CREATE TABLE "wrong_questions" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "knowledgePoint" VARCHAR(128) NOT NULL,
    "wrongCount" INTEGER NOT NULL DEFAULT 1,
    "latestScoreRate" DOUBLE PRECISION NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wrong_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wrong_questions_questionId_key" ON "wrong_questions"("questionId");

-- CreateIndex
CREATE INDEX "wrong_questions_subject_idx" ON "wrong_questions"("subject");

-- CreateIndex
CREATE INDEX "wrong_questions_priorityScore_idx" ON "wrong_questions"("priorityScore");

-- AddForeignKey
ALTER TABLE "wrong_questions" ADD CONSTRAINT "wrong_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wrong_questions" ADD CONSTRAINT "wrong_questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
