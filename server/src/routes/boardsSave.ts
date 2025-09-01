import { Router, Request, Response, NextFunction } from "express";
import { saveBoardAll } from "../services/persistence.js";

const router = Router();

// Enkel admin-sjekk (unngår avhengighet til annen middleware)
const requireAdminLocal = (req: Request, res: Response, next: NextFunction) => {
  const k = req.header("x-admin-key");
  const admin = (process.env.ADMIN_KEY || "dev-admin-key").trim();
  if (!k || k !== admin) return res.status(401).json({ error: "Unauthorized" });
  next();
};

// POST /boards/save  -> lagrer navn, serialNumber og API-token (kryptert)
router.post("/save", requireAdminLocal, async (req: Request, res: Response) => {
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
