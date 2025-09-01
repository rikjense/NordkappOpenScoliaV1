import { Router } from "express";

/**
 * Enkel helsesjekk for load balancers, uptime checks, dev-test.
 * Returnerer også enkel metadata som kan være nyttig i drift.
 */
export const healthRoute = Router();

healthRoute.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "dart-system-server",
    env: process.env.NODE_ENV ?? "development",
    time: new Date().toISOString()
  });
});
