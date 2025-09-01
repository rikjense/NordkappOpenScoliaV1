-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT,
    "playerA" TEXT NOT NULL,
    "playerB" TEXT NOT NULL,
    "startScore" INTEGER NOT NULL DEFAULT 501,
    "status" TEXT NOT NULL DEFAULT 'Idle',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Leg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "Leg_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Match_boardId_idx" ON "Match"("boardId");

-- CreateIndex
CREATE INDEX "Leg_matchId_number_idx" ON "Leg"("matchId", "number");
