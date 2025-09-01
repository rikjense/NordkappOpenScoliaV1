// server/src/routes/boards.ts
import { Router } from "express";
import { prisma } from "../db/prisma";
import { maskToken, encryptToken } from "../services/crypto";
import { seedBoardsFromEnv } from "../services/boardSeed";

const router = Router();

function requireAdmin(req: any) {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    const e: any = new Error("Unauthorized");
    e.status = 401;
    throw e;
  }
}

router.get("/", async (_req, res, next) => {
  try {
    const boards = await prisma.board.findMany({ orderBy: { id: "asc" } });
    const safe = boards.map((b) => ({
      id: b.id,
      name: b.name,
      serialNumber: b.serialNumber,
      accessTokenMasked: maskToken(b.accessTokenEnc),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
    res.json(safe);
  } catch (err) { next(err); }
});

router.post("/save", async (req, res, next) => {
  try {
    requireAdmin(req);
    const { boardId, name, serialNumber, accessToken, clearToken } = req.body || {};
    if (!boardId || typeof boardId !== "string") {
      return res.status(400).json({ error: "Mangler boardId" });
    }

    const data: any = {};
    if (typeof name === "string") data.name = name.trim();
    if (typeof serialNumber === "string") data.serialNumber = serialNumber.trim();

    if (clearToken === true) {
      data.accessTokenEnc = null;
    } else if (typeof accessToken === "string" && accessToken.trim()) {
      data.accessTokenEnc = encryptToken(accessToken.trim());
    }

    const board = await prisma.board.upsert({
      where: { id: boardId },
      create: { id: boardId, name: data.name || boardId, serialNumber: data.serialNumber || null, accessTokenEnc: data.accessTokenEnc ?? null },
      update: data,
    });

    res.json({
      ok: true,
      board: {
        id: board.id,
        name: board.name,
        serialNumber: board.serialNumber,
        accessTokenMasked: maskToken(board.accessTokenEnc),
      },
    });
  } catch (err) { next(err); }
});

router.post("/seed-from-env", async (req, res, next) => {
  try {
    requireAdmin(req);
    const updated = await seedBoardsFromEnv();
    res.json({ ok: true, updated });
  } catch (err) { next(err); }
});

export default router;
