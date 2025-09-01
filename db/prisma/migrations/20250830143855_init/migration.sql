-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Leg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "currentPlayer" TEXT NOT NULL DEFAULT 'A',
    "dartsInVisit" INTEGER NOT NULL DEFAULT 0,
    "remainingA" INTEGER NOT NULL DEFAULT 0,
    "remainingB" INTEGER NOT NULL DEFAULT 0,
    "pointsA" INTEGER NOT NULL DEFAULT 0,
    "pointsB" INTEGER NOT NULL DEFAULT 0,
    "dartsA" INTEGER NOT NULL DEFAULT 0,
    "dartsB" INTEGER NOT NULL DEFAULT 0,
    "coAttemptsA" INTEGER NOT NULL DEFAULT 0,
    "coAttemptsB" INTEGER NOT NULL DEFAULT 0,
    "coHitsA" INTEGER NOT NULL DEFAULT 0,
    "coHitsB" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Leg_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Leg" ("finishedAt", "id", "matchId", "number", "startedAt", "status") SELECT "finishedAt", "id", "matchId", "number", "startedAt", "status" FROM "Leg";
DROP TABLE "Leg";
ALTER TABLE "new_Leg" RENAME TO "Leg";
CREATE INDEX "Leg_matchId_number_idx" ON "Leg"("matchId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
