-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "questionNo" INTEGER NOT NULL,
    "questionType" VARCHAR(32) NOT NULL,
    "fullScore" DOUBLE PRECISION NOT NULL,
    "questionText" TEXT NOT NULL,
    "subQuestions" JSONB,
    "pageNumber" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_results" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "fullScore" DOUBLE PRECISION NOT NULL,
    "scoreRate" DOUBLE PRECISION NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_examId_idx" ON "questions"("examId");

-- CreateIndex
CREATE INDEX "question_results_examId_idx" ON "question_results"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "question_results_questionId_examId_key" ON "question_results"("questionId", "examId");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_results" ADD CONSTRAINT "question_results_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_results" ADD CONSTRAINT "question_results_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
