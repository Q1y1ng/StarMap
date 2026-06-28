-- CreateTable
CREATE TABLE "exam_difficulties" (
    "id" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "difficultyScore" DOUBLE PRECISION NOT NULL,
    "averageScoreRate" DOUBLE PRECISION NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "objectiveQuestionRatio" DOUBLE PRECISION NOT NULL,
    "subjectiveQuestionRatio" DOUBLE PRECISION NOT NULL,
    "knowledgeCoverage" INTEGER NOT NULL,
    "difficultyLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_difficulties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_difficulties_examId_key" ON "exam_difficulties"("examId");

-- AddForeignKey
ALTER TABLE "exam_difficulties" ADD CONSTRAINT "exam_difficulties_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
