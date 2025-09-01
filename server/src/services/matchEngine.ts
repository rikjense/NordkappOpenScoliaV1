import { prisma } from "../db/prisma";
import { eventBus } from "../core/eventBus";
import { applyThrow, startLegRuntime, threeDartAvg, LegRuntime, PlayerKey } from "./scoring";

export type MatchState = {
  id: string;
  boardId?: string | null;
  playerA: string;
  playerB: string;
  startScore: number;
  status: "Idle" | "Running" | "Finished" | "Paused";
  currentLegId?: string | null;
  currentLegNumber?: number | null;
  // 4C: live visning
  stats?: {
    currentPlayer: PlayerKey;
    remainingA: number; remainingB: number;
    dartsA: number; dartsB: number;
    pointsA: number; pointsB: number;
    avg3A: number; avg3B: number;
    coAttemptsA: number; coAttemptsB: number;
    coHitsA: number; coHitsB: number;
    checkoutPctA: number; checkoutPctB: number;
  };
  updatedAt: string; // ISO
};

class MatchEngine {
  private matches = new Map<string, MatchState>();
  private byBoard = new Map<string, string>(); // boardId -> matchId
  private legRt = new Map<string, LegRuntime>(); // legId -> runtime i minne

  constructor() {
    // Koble inn kast fra riktig board
    eventBus.on("throw.detected", async ({ boardId, payload }) => {
      const matchId = this.byBoard.get(String(boardId));
      if (!matchId) return;
      const ms = this.matches.get(matchId);
      if (!ms || ms.status !== "Running" || !ms.currentLegId) return;

      const sector = String((payload as any)?.sector ?? "None");
      await this.onThrow(ms, sector);
    });

    // Bytt tur ved takeout.finish (hvis visit ikke allerede byttet)
    eventBus.on("takeout.finished", async ({ boardId, falseTakeout }) => {
      if (falseTakeout) return;
      const matchId = this.byBoard.get(String(boardId));
      if (!matchId) return;
      const ms = this.matches.get(matchId);
      if (!ms || ms.status !== "Running" || !ms.currentLegId) return;

      const rt = this.legRt.get(ms.currentLegId);
      if (!rt) return;

      // Hvis midt i visit (1–2 darts), avslutt visit og bytt spiller
      if (rt.dartsInVisit > 0 && rt.dartsInVisit < 3) {
        rt.dartsInVisit = 0;
        rt.current = rt.current === "A" ? "B" : "A";
        rt.visitAttemptFlag = false;
        await this.persistLegRuntime(ms.currentLegId, rt);
        this.emitUpdate(ms.id);
      }
    });
  }

  // ---------- Public API (ruter kaller disse) ----------

  async createMatch(params: { playerA: string; playerB: string; boardId?: string; startScore?: number; }) {
    const { playerA, playerB } = params;
    const startScore = params.startScore ?? 501;
    const row = await prisma.match.create({
      data: {
        playerA, playerB, startScore,
        boardId: params.boardId ?? null,
        status: "Idle"
      }
    });
    const st = await this.hydrate(row.id);
    if (row.boardId) this.byBoard.set(row.boardId, row.id);
    this.emitUpdate(row.id);
    return st;
  }

  async assignBoard(matchId: string, boardId?: string) {
    const row = await prisma.match.update({
      where: { id: matchId },
      data: { boardId: boardId ?? null }
    });
    // oppdater mapping
    [...this.byBoard.entries()].forEach(([bId, mid]) => { if (mid === matchId) this.byBoard.delete(bId); });
    if (row.boardId) this.byBoard.set(row.boardId, row.id);

    const st = await this.hydrate(matchId);
    this.emitUpdate(matchId);
    return st;
  }

  async startLeg(matchId: string) {
    const m = await prisma.match.findUnique({ where: { id: matchId } });
    if (!m) throw new Error("Match finnes ikke");
    const count = await prisma.leg.count({ where: { matchId } });
    const legNumber = count + 1;

    const now = new Date();
    const leg = await prisma.leg.create({
      data: {
        matchId,
        number: legNumber,
        status: "InProgress",
        startedAt: now,
        currentPlayer: "A",
        dartsInVisit: 0,
        remainingA: m.startScore,
        remainingB: m.startScore,
        // øvrige felt blir 0 via defaults
      }
    });

    await prisma.match.update({ where: { id: matchId }, data: { status: "Running" } });

    // lag runtime i minne
    this.legRt.set(leg.id, startLegRuntime(m.startScore));

    const st = await this.hydrate(matchId, { currentLegId: leg.id, currentLegNumber: leg.number, status: "Running" });
    this.emitUpdate(matchId);
    return st;
  }

  async finishLeg(matchId: string) {
    const leg = await prisma.leg.findFirst({
      where: { matchId, status: "InProgress" },
      orderBy: { number: "desc" }
    });
    if (!leg) throw new Error("Ingen aktiv leg");

    await prisma.leg.update({
      where: { id: leg.id },
      data: { status: "Finished", finishedAt: new Date() }
    });

    await prisma.match.update({ where: { id: matchId }, data: { status: "Idle" } });

    // fjern runtime
    this.legRt.delete(leg.id);

    const st = await this.hydrate(matchId, { currentLegId: null, currentLegNumber: null, status: "Idle" });
    this.emitUpdate(matchId);
    return st;
  }

  async getState(matchId: string): Promise<MatchState | undefined> {
    if (this.matches.has(matchId)) return this.matches.get(matchId);
    return this.hydrate(matchId);
  }

  listActiveStates(): MatchState[] {
    return [...this.matches.values()];
  }

  async loadFromDBOnBoot() {
    const rows = await prisma.match.findMany({ where: { NOT: { status: "Finished" } } });
    for (const r of rows) {
      // Finn siste leg
      const lastLeg = await prisma.leg.findFirst({
        where: { matchId: r.id },
        orderBy: { number: "desc" }
      });

      // Legg i minne
      const st = await this.hydrate(r.id);
      if (r.boardId) this.byBoard.set(r.boardId, r.id);

      // Rekonstruer runtime for pågående leg
      if (lastLeg?.status === "InProgress") {
        const rt: LegRuntime = {
          current: (lastLeg.currentPlayer as any) ?? "A",
          dartsInVisit: lastLeg.dartsInVisit ?? 0,
          remainingA: lastLeg.remainingA ?? r.startScore,
          remainingB: lastLeg.remainingB ?? r.startScore,
          pointsA: lastLeg.pointsA ?? 0,
          pointsB: lastLeg.pointsB ?? 0,
          dartsA: lastLeg.dartsA ?? 0,
          dartsB: lastLeg.dartsB ?? 0,
          coAttemptsA: lastLeg.coAttemptsA ?? 0,
          coAttemptsB: lastLeg.coAttemptsB ?? 0,
          coHitsA: lastLeg.coHitsA ?? 0,
          coHitsB: lastLeg.coHitsB ?? 0,
          visitAttemptFlag: false,
        };
        this.legRt.set(lastLeg.id, rt);
      }
    }
  }

  // ---------- Intern logikk ----------

  private async onThrow(ms: MatchState, sector: string) {
    const legId = ms.currentLegId!;
    let rt = this.legRt.get(legId);
    if (!rt) return;

    const result = applyThrow(rt, sector);
    rt = result.rt;
    this.legRt.set(legId, rt);
    await this.persistLegRuntime(legId, rt);

    // Win?
    if (result.legWonBy) {
      await prisma.leg.update({
        where: { id: legId },
        data: { status: "Finished", finishedAt: new Date() }
      });
      await prisma.match.update({ where: { id: ms.id }, data: { status: "Idle" } });
      ms.status = "Idle";
      ms.currentLegId = null;
      ms.currentLegNumber = null;
      this.emitUpdate(ms.id);
      return;
    }

    // Bust & bytter håndteres i applyThrow (dartsInVisit=0 + current byttes ved bust)
    this.emitUpdate(ms.id);
  }

  private async persistLegRuntime(legId: string, rt: LegRuntime) {
    await prisma.leg.update({
      where: { id: legId },
      data: {
        currentPlayer: rt.current,
        dartsInVisit: rt.dartsInVisit,
        remainingA: rt.remainingA,
        remainingB: rt.remainingB,
        pointsA: rt.pointsA,
        pointsB: rt.pointsB,
        dartsA: rt.dartsA,
        dartsB: rt.dartsB,
        coAttemptsA: rt.coAttemptsA,
        coAttemptsB: rt.coAttemptsB,
        coHitsA: rt.coHitsA,
        coHitsB: rt.coHitsB,
      }
    });
  }

  private async hydrate(matchId: string, patch?: Partial<MatchState>): Promise<MatchState> {
    const r = await prisma.match.findUnique({ where: { id: matchId } });
    if (!r) throw new Error("Match finnes ikke");
    const lastLeg = await prisma.leg.findFirst({
      where: { matchId: r.id },
      orderBy: { number: "desc" }
    });

    const st: MatchState = {
      id: r.id,
      boardId: r.boardId,
      playerA: r.playerA,
      playerB: r.playerB,
      startScore: r.startScore,
      status: r.status as any,
      currentLegId: lastLeg?.status === "InProgress" ? lastLeg.id : null,
      currentLegNumber: lastLeg?.status === "InProgress" ? lastLeg.number : null,
      updatedAt: new Date().toISOString(),
      ...(patch ?? {})
    };

    // Kalkuler stats (for SSE/GET) dersom vi har leg-record
    if (lastLeg) {
      const avgA = threeDartAvg(lastLeg.pointsA ?? 0, lastLeg.dartsA ?? 0);
      const avgB = threeDartAvg(lastLeg.pointsB ?? 0, lastLeg.dartsB ?? 0);
      const coA = (lastLeg.coAttemptsA ?? 0) ? ((lastLeg.coHitsA ?? 0) / (lastLeg.coAttemptsA ?? 1)) * 100 : 0;
      const coB = (lastLeg.coAttemptsB ?? 0) ? ((lastLeg.coHitsB ?? 0) / (lastLeg.coAttemptsB ?? 1)) * 100 : 0;

      st.stats = {
        currentPlayer: (lastLeg.currentPlayer as any) ?? "A",
        remainingA: lastLeg.remainingA ?? r.startScore,
        remainingB: lastLeg.remainingB ?? r.startScore,
        dartsA: lastLeg.dartsA ?? 0,
        dartsB: lastLeg.dartsB ?? 0,
        pointsA: lastLeg.pointsA ?? 0,
        pointsB: lastLeg.pointsB ?? 0,
        avg3A: Number(avgA.toFixed(2)),
        avg3B: Number(avgB.toFixed(2)),
        coAttemptsA: lastLeg.coAttemptsA ?? 0,
        coAttemptsB: lastLeg.coAttemptsB ?? 0,
        coHitsA: lastLeg.coHitsA ?? 0,
        coHitsB: lastLeg.coHitsB ?? 0,
        checkoutPctA: Number(coA.toFixed(1)),
        checkoutPctB: Number(coB.toFixed(1)),
      };
    }

    this.matches.set(r.id, st);
    return st;
  }

  private emitUpdate(matchId: string) {
    const st = this.matches.get(matchId);
    if (st) eventBus.emit("match.update", { matchId, state: st });
  }
}

export const matchEngine = new MatchEngine();
