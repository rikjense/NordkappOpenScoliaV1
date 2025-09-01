import { Request, Response, NextFunction } from "express";
import config from "../config";

/**
 * Enkelt admin-sjekk via header `x-admin-key`.
 * Bruk i utvikling for å beskytte simulerings-endepunkter.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-admin-key");
  if (!key || key !== config.adminKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
