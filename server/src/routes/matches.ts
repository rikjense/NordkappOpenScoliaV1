// server/src/routes/matches.ts
import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma";

const router = Router();

// --- Admin-sjekk via x-admin-key ---
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const k = (req.header("x-admin-key") || "").trim();
  const admin = (process.env.ADMIN_KEY || "dev-admin-key").trim();
  if (!k || k !== admin) return res.status(401).json({ error: "Unauthorized" });
  next();
};

// --- Helpers ---
function toRow(m: any) {
  // Normaliser nullbare felter til tall
  const start = Number(m.startScore ?? 501);
  const scoreA = Number((m.scoreA ?? start));
  const scoreB = Number((m.scoreB ?? start));
  const legsTarget = Number(m.legsTarget ?? 3);
  const legsWonA = Number(m.legsWonA ?? 0);
  const legsWonB = Number(m.legsWonB ?? 0);

  return {
    id: m.id,
    boardId: m.boardId ?? null,
    playerA: m.playerA,
    playerB: m.playerB,
    startScore: start,
    status: (m.status as string) ?? "Idle",
    updatedAt: m.updatedAt ?? null,

    // scoreboard/state
    outMode: (m.outMode as string) ?? "DOUBLE",
    legsMode: (m.legsMode as string) ?? "BEST_OF",
    legsTarget,
    scoreA,
    scoreB,
    currentTurn: (m.currentTurn as string) ?? "A",
    legsWonA,
    legsWonB,
  };
}

function winsNeeded(legsMode?: string | null, legsTarget?: number | null) {
  const mode = (legsMode || "BEST_OF").toUpperCase();
  const target = Number(legsTarget ?? 3);
  if (mode === "RACE_TO") return Math.max(1, target);
  // BEST_OF
  return Math.floor(target / 2) + 1;
}

async function isBoardBusy(boardId: string, excludeId?: string) {
  const row = await prisma.match.findFirst({
    where: {
      boardId,
      status: { not: "Finished" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !!row;
}

// =============== MATCH CRUD ===============

// --- GET LIST ---
router.get("/", requireAdmin, async (_req, res) => {
  const rows = await prisma.match.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(rows.map(toRow));
});

// --- CREATE ---
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      playerA,
      playerB,
      startScore = 501,
      boardId = null,
      outMode = "DOUBLE",
      legsMode = "BEST_OF",
      legsTarget = 3,
    } = req.body || {};

    if (!playerA || !playerB) {
      return res.status(400).json({ error: "playerA og playerB må være satt." });
    }
    if (boardId && (await isBoardBusy(String(boardId)))) {
      return res.status(409).json({ error: "Board har allerede en aktiv match." });
    }

    const ss = Number(startScore) || 501;

    const created = await prisma.match.create({
      data: {
        playerA: String(playerA),
        playerB: String(playerB),
        startScore: ss,
        status: "Idle",
        boardId: boardId ? String(boardId) : null,

        // scoreboard init
        outMode: String(outMode || "DOUBLE").toUpperCase(),
        legsMode: String(legsMode || "BEST_OF").toUpperCase(),
        legsTarget: Number(legsTarget || 3),
        scoreA: ss,
        scoreB: ss,
        currentTurn: "A",
      },
    });
    res.status(201).json(toRow(created));
  } catch (e) {
    console.error("[POST /matches] error", e);
    res.status(500).json({ error: "Kunne ikke opprette match." });
  }
});

// --- PATCH (endre) ---
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await prisma.match.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Not found" });

    const patch: any = {};
    if ("playerA" in req.body) patch.playerA = String(req.body.playerA ?? current.playerA);
    if ("playerB" in req.body) patch.playerB = String(req.body.playerB ?? current.playerB);
    if ("startScore" in req.body) {
      const n = Number(req.body.startScore);
      patch.startScore = Number.isFinite(n) && n > 0 ? n : current.startScore;
    }
    if ("status" in req.body) patch.status = String(req.body.status ?? current.status);

    if ("outMode" in req.body) patch.outMode = String(req.body.outMode || "DOUBLE").toUpperCase();
    if ("legsMode" in req.body) patch.legsMode = String(req.body.legsMode || "BEST_OF").toUpperCase();
    if ("legsTarget" in req.body) patch.legsTarget = Number(req.body.legsTarget || 3);

    if ("scoreA" in req.body) patch.scoreA = Number(req.body.scoreA);
    if ("scoreB" in req.body) patch.scoreB = Number(req.body.scoreB);
    if ("currentTurn" in req.body) patch.currentTurn = String(req.body.currentTurn || "A");
    if ("legsWonA" in req.body) patch.legsWonA = Number(req.body.legsWonA) || 0;
    if ("legsWonB" in req.body) patch.legsWonB = Number(req.body.legsWonB) || 0;

    if ("boardId" in req.body) {
      const newBoardId = req.body.boardId ? String(req.body.boardId) : null;
      if (newBoardId) {
        const busy = await isBoardBusy(newBoardId, id);
        if (busy) return res.status(409).json({ error: "Board har allerede en aktiv match." });
      }
      patch.boardId = newBoardId;
    }

    const updated = await prisma.match.update({ where: { id }, data: patch });
    res.json(toRow(updated));
  } catch (e) {
    console.error("[PATCH /matches/:id] error", e);
    res.status(500).json({ error: "Kunne ikke oppdatere match." });
  }
});

// --- DELETE ---
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await prisma.match.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: "Not found" });

    await prisma.match.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    console.error("[DELETE /matches/:id] error", e);
    res.status(500).json({ error: "Kunne ikke slette match." });
  }
});

// =============== SCOREBOARD / SIMULATOR ===============

// GET /matches/:id/state  -> scoreboard + stats
router.get("/:id/state", requireAdmin, async (req, res) => {
  const m = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ error: "Not found" });

  const start = Number(m.startScore ?? 501);

  // Hent visits og PARSE TEXT->JSON for stats
  const visitsRaw = await prisma.visit.findMany({
    where: { matchId: m.id },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const visits = visitsRaw.map((v) => ({
    ...v,
    darts: (() => {
      try { return JSON.parse(v.darts || "[]"); } catch { return []; }
    })(),
  }));

  const scoringVisits = visits.filter((v) => !v.bust);
  const sumVisitScores = scoringVisits.reduce(
    (acc: number, v: any) => acc + (Number(v.scoreBefore ?? 0) - Number(v.scoreAfter ?? 0)),
    0
  );
  const dartsCount = scoringVisits.reduce(
    (acc: number, v: any) => acc + (Array.isArray(v.darts) ? v.darts.length : 0),
    0
  );
  const threeDartAvg = dartsCount > 0 ? (sumVisitScores / dartsCount) * 3 : 0;

  function first9For(player: "A" | "B") {
    const first3 = scoringVisits.filter((v: any) => v.player === player).slice(0, 3);
    const scored = first3.reduce((acc: number, v: any) => acc + (Number(v.scoreBefore ?? 0) - Number(v.scoreAfter ?? 0)), 0);
    const dcount = first3.reduce((acc: number, v: any) => acc + (Array.isArray(v.darts) ? v.darts.length : 0), 0);
    return dcount > 0 ? (scored / dcount) * 3 : 0;
  }

  const doublesAttempts = visits.filter(
    (v: any) => v.checkout || (v.bust && (Number(v.scoreBefore ?? 0) - Number(v.scoreAfter ?? 0)) > 0)
  ).length;
  const doublesHit = visits.filter((v: any) => v.checkout).length;
  const checkoutPct = doublesAttempts > 0 ? (100 * doublesHit) / doublesAttempts : 0;

  let highestFinish = 0;
  for (const v of visits as any[]) {
    if (v.checkout && Number(v.scoreAfter ?? 0) === 0) {
      highestFinish = Math.max(highestFinish, Number(v.scoreBefore ?? 0));
    }
  }

  res.json({
    id: m.id,
    playerA: m.playerA,
    playerB: m.playerB,
    outMode: (m.outMode as string) || "DOUBLE",
    legsMode: (m.legsMode as string) || "BEST_OF",
    legsTarget: Number(m.legsTarget ?? 3),
    startScore: start,
    scoreA: Number(m.scoreA ?? start),
    scoreB: Number(m.scoreB ?? start),
    currentTurn: (m.currentTurn as string),
    legsWonA: Number(m.legsWonA ?? 0),
    legsWonB: Number(m.legsWonB ?? 0),
    status: (m.status as string),
    updatedAt: m.updatedAt,
    stats: {
      threeDartAvg: Number(threeDartAvg.toFixed(2)),
      first9AvgA: Number(first9For("A").toFixed(2)),
      first9AvgB: Number(first9For("B").toFixed(2)),
      checkoutPct: Number(checkoutPct.toFixed(1)),
      highestFinish,
      visitsCount: visits.length,
    },
  });
});

// POST /matches/:id/next  -> bytt spiller (ingen poeng)
router.post("/:id/next", requireAdmin, async (req, res) => {
  const m = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ error: "Not found" });
  const next = (m.currentTurn as string) === "A" ? "B" : "A";
  const updated = await prisma.match.update({
    where: { id: m.id },
    data: { currentTurn: next, status: (m.status as string) === "Idle" ? "Running" : m.status },
  });
  res.json(toRow(updated));
});

// POST /matches/:id/visit  -> én visit (1–3 piler) + persistér Visit
router.post("/:id/visit", requireAdmin, async (req, res) => {
  const m = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ error: "Not found" });

  type Dart = { m: "S" | "D" | "T"; v: number };
  const incoming: Dart[] = Array.isArray(req.body?.darts) ? req.body.darts : [];
  const darts: Dart[] = incoming.slice(0, 3).filter(Boolean); // maks 3

  // Kalkuler poeng for visit
  let visitScore = 0;
  let lastIsDouble = false;

  for (const d of darts) {
    if (!d || !["S", "D", "T"].includes(d.m)) continue;
    const v = Number(d.v);
    const valid = [...Array(20).keys()].map(i => i + 1).concat([25, 50]);
    if (!valid.includes(v)) continue;

    if (v === 25) {
      if (d.m === "T") continue;
      const p = d.m === "D" ? 50 : 25;
      visitScore += p;
      lastIsDouble = d.m === "D";
    } else if (v === 50) {
      visitScore += 50;
      lastIsDouble = true; // bull counts as double for checkout
    } else {
      const mult = d.m === "S" ? 1 : d.m === "D" ? 2 : 3;
      visitScore += v * mult;
      lastIsDouble = d.m === "D";
    }
  }

  const isA = (m.currentTurn as string) === "A";
  const start = Number(m.startScore ?? 501);
  const curRaw = isA ? m.scoreA : m.scoreB;         // number | null
  const curNum = Number(curRaw ?? start);           // --> number
  const outDouble = String(m.outMode || "DOUBLE").toUpperCase() === "DOUBLE";
  const newScore = curNum - visitScore;             // number

  let bust = false;
  let checkout = false;

  if (newScore < 0) bust = true;
  else if (outDouble && newScore === 1) bust = true;
  else if (newScore === 0) {
    if (outDouble && !lastIsDouble) bust = true;
    else checkout = true;
  }

  // LegNr: legsWonA + legsWonB + 1
  const legNo = Number(m.legsWonA ?? 0) + Number(m.legsWonB ?? 0) + 1;

  const scoreBefore = curNum;
  const scoreAfterForVisit = bust ? curNum : newScore;

  // Bygg oppdatering av Match
  const data: any = {};
  if (!bust) {
    if (isA) data.scoreA = newScore;
    else data.scoreB = newScore;
  }
  if ((m.status as string) === "Idle") data.status = "Running";

  let legWon = false;
  let matchWon = false;
  let winner: "A" | "B" | null = null;

  if (checkout) {
    legWon = true;
    const needed = winsNeeded(m.legsMode as string, m.legsTarget as number);

    if (isA) data.legsWonA = Number(m.legsWonA ?? 0) + 1;
    else data.legsWonB = Number(m.legsWonB ?? 0) + 1;

    const nextLegsA = isA ? Number(m.legsWonA ?? 0) + 1 : Number(m.legsWonA ?? 0);
    const nextLegsB = !isA ? Number(m.legsWonB ?? 0) + 1 : Number(m.legsWonB ?? 0);

    if (nextLegsA >= needed || nextLegsB >= needed) {
      data.status = "Finished";
      matchWon = true;
      winner = nextLegsA >= needed ? "A" : "B";
      // behold 0 på den som sjekket ut
    } else {
      // Nytt leg umiddelbart
      data.scoreA = start;
      data.scoreB = start;
      data.status = "Running";
      data.currentTurn = isA ? "B" : "A"; // motstander starter neste leg
    }
  } else {
    // Ingen checkout: bytt tur (også ved bust)
    data.currentTurn = isA ? "B" : "A";
  }

  // Oppdater match
  const updated = await prisma.match.update({
    where: { id: m.id },
    data,
  });

  // Logg Visit (NB: darts som TEXT)
  await prisma.visit.create({
    data: {
      matchId: m.id,
      legNo,
      turn: isA ? "A" : "B",
      player: isA ? "A" : "B",
      darts: JSON.stringify(darts),
      scoreBefore,
      scoreAfter: scoreAfterForVisit,
      bust,
      checkout,
    },
  });

  res.json({
    ...toRow(updated),
    bust,
    checkout,
    legWon,
    matchWon,
    winner,
    visitScore,
    winsNeeded: winsNeeded(updated.legsMode as string, updated.legsTarget as number),
  });
});

// =============== VISITS API ===============

// GET /matches/:id/visits?limit=50 -> siste visits (darts er parsede arrays)
router.get("/:id/visits", requireAdmin, async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const rows = await prisma.visit.findMany({
    where: { matchId: String(req.params.id) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const parsed = rows.map((v: any) => ({
    ...v,
    darts: (() => {
      try { return JSON.parse(v.darts || "[]"); } catch { return []; }
    })(),
  }));
  res.json(parsed);
});

export default router;
