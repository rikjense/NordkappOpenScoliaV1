import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { makeBackup } from "../services/backup";

export const adminRoute = Router();
adminRoute.use(adminAuth);

adminRoute.post("/admin/backup", (_req, res) => {
  const file = makeBackup();
  res.json({ ok: true, file });
});
