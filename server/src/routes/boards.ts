import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { maskToken } from "../utils/crypto.js";
import { saveBoardAll } from "../services/persistence.js";

const router = Router();

/* Enkel admin-sjekk. Bruker x-admin-key = ADMIN_KEY (eller dev-admin-key). */
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const k = (req.header("x-admin-key") || "").trim();
  const admin = (process.env.ADMIN_KEY || "dev-admin-key").trim();
  if (!k || k !== admin) return res.status(401).json({ error: "Unauthorized" });
  next();
};

/* GET /boards  -> liste for UI (maskert token) */
router.get("/", async (_req: Request, res: Response) => {
  const rows = await prisma.board.findMany({ orderBy: { id: "asc" } });

  // Prøv å fylle ut med årsaklige felter UI var vant til; ukjente felter settes “mykt”.
  const result = rows.map((r: any) => ({
    id: r.id,
    name: r.name ?? r.id,
    serialNumber: r.serialNumber ?? null,
    accessTokenMasked: r.accessTokenEnc ? maskToken(r.accessTokenEnc) : null,
    // Disse er valgfrie – behold hvis modellen din har dem:
    status: r.status ?? "Ready",
    phase: r.phase ?? (r.status === "Ready" ? "Throw" : null),
    lastUpdate: r.updatedAt ?? null,
    scolia: {
      serialNumber: r.serialNumber ?? null,
      configured: !!(r.serialNumber && r.accessTokenEnc),
    },
  }));

  res.json(result);
});

/* POST /boards/save  -> lagre navn/serial/token (krypteres). */
router.post("/save", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { boardId, name, serialNumber, accessToken } = req.body || {};
    if (!boardId || typeof boardId !== "string") {
      return res.status(400).json({ error: "boardId mangler." });
    }
    const saved = await saveBoardAll({ boardId, name, serialNumber, accessToken });
    return res.json({ board: saved });
  } catch (err) {
    console.error("[POST /boards/save] error", err);
    return res.status(500).json({ error: "Kunne ikke lagre board." });
  }
});

export default router;
