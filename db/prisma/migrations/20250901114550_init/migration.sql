/*
  Warnings:

  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `lastThrowAt` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `lastThrowSector` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `phase` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Board` table. All the data in the column will be lost.
  - You are about to drop the column `coAttemptsA` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `coAttemptsB` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `coHitsA` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `coHitsB` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `currentPlayer` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `dartsA` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `dartsB` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `dartsInVisit` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `finishedAt` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `pointsA` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `pointsB` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `remainingA` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `remainingB` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `Leg` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Leg` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Leg` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Event_boardId_createdAt_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Event";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "accessTokenEnc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Board" ("accessTokenEnc", "createdAt", "id", "name", "serialNumber", "updatedAt") SELECT "accessTokenEnc", "createdAt", "id", "name", "serialNumber", "updatedAt" FROM "Board";
DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE TABLE "new_Leg" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 1,
    "winner" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Leg_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Leg" ("id", "matchId", "number") SELECT "id", "matchId", "number" FROM "Leg";
DROP TABLE "Leg";
ALTER TABLE "new_Leg" RENAME TO "Leg";
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT,
    "playerA" TEXT NOT NULL,
    "playerB" TEXT NOT NULL,
    "startScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Idle',
    "outMode" TEXT NOT NULL DEFAULT 'DOUBLE',
    "legsMode" TEXT,
    "legsTarget" INTEGER,
    "scoreA" INTEGER NOT NULL DEFAULT 501,
    "scoreB" INTEGER NOT NULL DEFAULT 501,
    "currentTurn" TEXT NOT NULL DEFAULT 'A',
    "legsWonA" INTEGER NOT NULL DEFAULT 0,
    "legsWonB" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("boardId", "createdAt", "id", "playerA", "playerB", "startScore", "status", "updatedAt") SELECT "boardId", "createdAt", "id", "playerA", "playerB", "startScore", "status", "updatedAt" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
