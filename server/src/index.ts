import { envFileUsed } from "./loadEnv";
import { ensureSecretKey, secretKeyPath } from "./utils/keyManager";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import config from "./config";
import { logger } from "./logger";
import { healthRoute } from "./routes/health";
import { simRoute } from "./routes/sim";
import { boards } from "./core/boardManager";
import boardsRoute from "./routes/boards.js";
import { initPrisma } from "./db/prisma";
import { loadBoardsFromDB, attachEventPersistence } from "./services/persistence";
import { adminRoute } from "./routes/admin";
import { prisma } from "./db/prisma";
import { makeBackup } from "./services/backup";
import { eventsRoute } from "./routes/events";
import matchesRoute from "./routes/matches.js";
import { matchEngine } from "./services/matchEngine";
import boardsSaveRoute from "./routes/boardsSave.js";


const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use("/boards", boardsRoute);
app.use("/matches", matchesRoute);

async function boot() {
await initPrisma();
ensureSecretKey();
logger.info({ secretKeyPath }, "Secret key ready");
await matchEngine.loadFromDBOnBoot(); // ta opp “ikke ferdige” matcher ved restart


  // 1) Seed fra .env (slots og ev. credentials)
  for (const b of config.scolia.envBoards) {
    const state = boards.upsert(b.id, b.name ?? b.id);
    if (b.serialNumber || b.accessToken) {
      boards.setScoliaConfig(b.id, { serialNumber: b.serialNumber, accessToken: b.accessToken });
    }
    logger.info({ boardId: state.id, hasSerial: !!b.serialNumber, hasToken: !!b.accessToken }, "Board seeded from .env");
  }

  // 2) Overlay fra DB (bestemmer hvis noe finnes)
  await loadBoardsFromDB();

  // 3) Abonner på events -> skriv til DB (siste state + event logg)
  attachEventPersistence();

  // Routes

// Offentlige ruter (ingen admin-key)
app.use(healthRoute);
app.use("/boards", boardsRoute);  // /boards, /boards/config
app.use(eventsRoute);             // /events/stream
app.use("/matches", matchesRoute); // <-- VIKTIG: prefiks her

// Kun simulatoren er beskyttet
app.use("/sim", simRoute);        // krever x-admin-key

// Admin-verktøy, f.eks. backup, ligger ofte med egen auth internt
app.use(adminRoute);


// Global error handler – hindrer at ukjente feil dreper prosessen
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
    app.listen(config.port, () => {
      logger.info({ port: config.port }, "API opp og kjører");
    });
  }

boot().catch(err => {
  logger.error(err, "Boot error");
  process.exit(1);

  // ---- Graceful shutdown hook ----
function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down…");
  try {
    const file = makeBackup();                 // lag en kopi av db/prisma/dev.db
    logger.info({ file }, "DB backup created on shutdown");
  } catch (e) {
    logger.warn(e as any, "Backup on shutdown failed");
  }
  prisma.$disconnect()                         // lukk DB-tilkobling pent
    .catch(() => {})
    .finally(() => process.exit(0));
}

process.on("SIGINT",  () => shutdown("SIGINT"));   // Ctrl+C
process.on("SIGTERM", () => shutdown("SIGTERM"));  // typisk i prod

});
