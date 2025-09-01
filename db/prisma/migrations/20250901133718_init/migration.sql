-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "legNo" INTEGER NOT NULL,
    "turn" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "darts" TEXT NOT NULL,
    "scoreBefore" INTEGER NOT NULL,
    "scoreAfter" INTEGER NOT NULL,
    "bust" BOOLEAN NOT NULL,
    "checkout" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Visit_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Leg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "winner" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Leg_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Leg" ("createdAt", "id", "matchId", "number", "updatedAt", "winner") SELECT "createdAt", "id", "matchId", "number", "updatedAt", "winner" FROM "Leg";
DROP TABLE "Leg";
ALTER TABLE "new_Leg" RENAME TO "Leg";
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT,
    "playerA" TEXT NOT NULL,
    "playerB" TEXT NOT NULL,
    "startScore" INTEGER NOT NULL,
    "status" TEXT,
    "outMode" TEXT,
    "legsMode" TEXT,
    "legsTarget" INTEGER,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "currentTurn" TEXT,
    "legsWonA" INTEGER,
    "legsWonB" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("boardId", "createdAt", "currentTurn", "id", "legsMode", "legsTarget", "legsWonA", "legsWonB", "outMode", "playerA", "playerB", "scoreA", "scoreB", "startScore", "status", "updatedAt") SELECT "boardId", "createdAt", "currentTurn", "id", "legsMode", "legsTarget", "legsWonA", "legsWonB", "outMode", "playerA", "playerB", "scoreA", "scoreB", "startScore", "status", "updatedAt" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Visit_matchId_createdAt_idx" ON "Visit"("matchId", "createdAt");
