-- CreateTable
CREATE TABLE "analysis_feedback" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "accurate" BOOLEAN NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analysis_feedback_reportId_key" ON "analysis_feedback"("reportId");

-- CreateIndex
CREATE INDEX "analysis_feedback_reportId_idx" ON "analysis_feedback"("reportId");

-- AddForeignKey
ALTER TABLE "analysis_feedback" ADD CONSTRAINT "analysis_feedback_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "analysis_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
