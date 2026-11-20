ALTER TABLE "Trip"
ADD COLUMN "estimatedExpenses" JSONB;

ALTER TABLE "Expense"
ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "Expense_sourceKey_key"
ON "Expense"("sourceKey");
