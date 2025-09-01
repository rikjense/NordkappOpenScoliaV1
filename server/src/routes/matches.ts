import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

// Enkel admin-sjekk. Bruk samme ADMIN_KEY som i .env (fallback "dev-admin-key").
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const k = (req.header("x-admin-key") || "").trim();
  const admin = (process.env.ADMIN_KEY || "dev-admin-key").trim();
  if (!k || k !== admin) return res.status(401).json({ error: "Unauthorized" });
  next();
};

// Normaliser til formatet klienten forventer
function toRow(m: any) {
  return {
    id: m.id,
    boardId: m.boardId ?? null,
    playerA: m.playerA,
    playerB: m.playerB,
    startScore: m.startScore,
    status: m.status ?? "Idle",
    updatedAt: m.updatedAt ?? null,
  };
}

/**
 * GET /matches  (krever x-admin-key)
 * Returnerer ALLE matcher (enkelt sortert etter oppdatert tid, nyest først)
 */
router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await prisma.match.findMany({
    orderBy: { updatedAt: "desc" },
  });
  res.json(rows.map(toRow));
});

/**
 * POST /matches  (krever x-admin-key)
 * Oppretter en ny match.
 * Body:
 *  - playerA: string
 *  - playerB: string
 *  - startScore: number (default 501)
 *  - outMode: "DOUBLE" | "SINGLE" (valgfritt, lagres ikke nå)
 *  - legsMode: "BEST_OF" | "RACE_TO" (valgfritt, lagres ikke nå)
 *  - legsTarget: number (valgfritt, lagres ikke nå)
 *  - boardId: string | null (kan være tom)
 */
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      playerA,
      playerB,
      startScore = 501,
      boardId = null,
    } = req.body || {};

    if (!playerA || !playerB) {
      return res.status(400).json({ error: "playerA og playerB må være satt." });
    }

    const created = await prisma.match.create({
      data: {
        playerA: String(playerA),
        playerB: String(playerB),
        startScore: Number(startScore) || 501,
        status: "Idle",
        boardId: boardId ? String(boardId) : null,
      },
    });

    return res.status(201).json(toRow(created));
  } catch (e) {
    console.error("[POST /matches] error", e);
    return res.status(500).json({ error: "Kunne ikke opprette match." });
  }
});

export default router;
