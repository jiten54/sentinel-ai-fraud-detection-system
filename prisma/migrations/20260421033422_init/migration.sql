-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "locationCity" TEXT NOT NULL,
    "locationCountry" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "riskScore" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_riskLevel_idx" ON "Transaction"("riskLevel");
