// server/src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { prisma } from "./db/prisma";
import boardsRouter from "./routes/boards";
import matchesRouter from "./routes/matches";
import { seedBoardsFromEnv } from "./services/boardSeed";

const app = express();
app.set("trust proxy", true);

// CORS: bruk CORS_ORIGIN hvis satt, ellers tillat alt (dev)
const origins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

app.use(express.json());

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Routes
app.use("/boards", boardsRouter);
app.use("/matches", matchesRouter);

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("[ERROR]", err);
  res.status(err?.status || 500).json({ error: err?.message || "Internal server error" });
});

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

const port = Number(process.env.PORT || 4000);

(async () => {
  try {
    await prisma.$connect();
    try {
      await seedBoardsFromEnv();        // idempotent
      console.log("[Server] Seeded boards from .env (if present).");
    } catch (e: any) {
      console.warn("[Server] Seed skipped:", e?.message);
    }
    app.listen(port, () => console.log(`API up at http://localhost:${port}`));
  } catch (e) {
    console.error("Boot error:", e);
    process.exit(1);
  }
})();

process.on("SIGINT", async () => { try { await prisma.$disconnect(); } finally { process.exit(0); }});
process.on("SIGTERM", async () => { try { await prisma.$disconnect(); } finally { process.exit(0); }});
