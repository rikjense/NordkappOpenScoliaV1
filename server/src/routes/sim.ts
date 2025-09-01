import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { boards } from "../core/boardManager";
import type { ThrowDetectedPayload, TakeoutFinishedPayload, TakeoutStartedPayload } from "../scolia/types";
import { maskToken } from "../utils/security";

export const simRoute = Router();
simRoute.use(adminAuth);

function publicBoard(b: any) {
  const configured = Boolean(b?.scolia?.serialNumber && b?.scolia?.accessToken);
  return {
    ...b,
    scolia: {
      serialNumber: b?.scolia?.serialNumber ?? null,
      accessTokenMasked: maskToken(b?.scolia?.accessToken),
      configured
    }
  };
}

// NB: ingen /sim i stiene her lenger

simRoute.post("/board/register", (req, res) => {
  const { boardId, name, serialNumber, accessToken } = req.body ?? {};
  if (!boardId) return res.status(400).json({ error: "boardId is required" });

  const state = boards.upsert(String(boardId), String(name ?? `Board ${boardId}`));
  if (serialNumber || accessToken) {
    boards.setScoliaConfig(String(boardId), { serialNumber, accessToken });
  }
  res.json(publicBoard(boards.get(String(boardId))));
});

simRoute.post("/throw", (req, res) => {
  const { boardId, ...payload } = req.body as { boardId: string } & ThrowDetectedPayload;
  if (!boardId) return res.status(400).json({ error: "boardId is required" });
  if (!payload?.sector) return res.status(400).json({ error: "sector is required" });
  const state = boards.applyThrow(String(boardId), payload);
  res.json(publicBoard(state));
});

simRoute.post("/takeout/start", (req, res) => {
  const { boardId } = req.body as { boardId: string } & TakeoutStartedPayload;
  if (!boardId) return res.status(400).json({ error: "boardId is required" });
  const state = boards.takeoutStart(String(boardId));
  res.json(publicBoard(state));
});

simRoute.post("/takeout/finish", (req, res) => {
  const { boardId, falseTakeout } = req.body as { boardId: string } & TakeoutFinishedPayload;
  if (!boardId) return res.status(400).json({ error: "boardId is required" });
  const state = boards.takeoutFinish(String(boardId), Boolean(falseTakeout));
  res.json(publicBoard(state));
});
