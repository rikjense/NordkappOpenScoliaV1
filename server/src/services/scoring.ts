// 4C: Scoring og regler for 501 double-out

export type PlayerKey = "A" | "B";

export function sectorPoints(sector: string): number {
  if (!sector) return 0;
  const s = sector.trim();
  if (s === "None") return 0;
  if (s === "Bull") return 50;
  if (s === "25") return 25;
  const m = /^([SDT])(\d{1,2})$/.exec(s);
  if (!m) return 0;
  const mult = m[1] === "S" ? 1 : m[1] === "D" ? 2 : 3;
  const n = Number(m[2]);
  if (n < 1 || n > 20) return 0;
  return mult * n;
}

export function isDoubleSector(sector: string): boolean {
  if (!sector) return false;
  if (sector === "Bull") return true; // bull teller som dobbel for checkout
  return /^D\d{1,2}$/.test(sector);
}

/**
 * En enkel bust-sjekk for 501:
 *  - Går under 0  => bust
 *  - Ender på 1   => bust
 *  - Ender på 0 uten dobbel => bust
 */
export function willBust(remaining: number, sector: string): boolean {
  const p = sectorPoints(sector);
  const after = remaining - p;
  if (after < 0) return true;
  if (after === 1) return true;
  if (after === 0 && !isDoubleSector(sector)) return true;
  return false;
}

export type LegRuntime = {
  current: PlayerKey;
  dartsInVisit: number; // 0..3
  // state per spiller
  remainingA: number; remainingB: number;
  pointsA: number;    pointsB: number;
  dartsA: number;     dartsB: number;
  coAttemptsA: number; coAttemptsB: number;
  coHitsA: number;     coHitsB: number;
  // intern flagg: har vi telt checkout-attempt for dagens visit?
  visitAttemptFlag: boolean;
};

export function startLegRuntime(startScore: number): LegRuntime {
  return {
    current: "A",
    dartsInVisit: 0,
    remainingA: startScore,
    remainingB: startScore,
    pointsA: 0, pointsB: 0,
    dartsA: 0, dartsB: 0,
    coAttemptsA: 0, coAttemptsB: 0,
    coHitsA: 0, coHitsB: 0,
    visitAttemptFlag: false,
  };
}

export function threeDartAvg(points: number, darts: number): number {
  if (darts <= 0) return 0;
  return (points / darts) * 3;
}

/**
 * Brukes i det øyeblikket en dart kastes.
 * Returnerer:
 *  - oppdatert runtime
 *  - flags: { bust: boolean, legWonBy?: "A"|"B" }
 */
export function applyThrow(rt: LegRuntime, sector: string): { rt: LegRuntime; bust: boolean; legWonBy?: PlayerKey } {
  const cur: PlayerKey = rt.current;
  const opp: PlayerKey = cur === "A" ? "B" : "A";

  const getRem = (k: PlayerKey) => (k === "A" ? rt.remainingA : rt.remainingB);
  const setRem = (k: PlayerKey, v: number) => { if (k === "A") rt.remainingA = v; else rt.remainingB = v; };
  const addPts = (k: PlayerKey, v: number) => { if (k === "A") rt.pointsA += v; else rt.pointsB += v; };
  const addDart = (k: PlayerKey) => { if (k === "A") rt.dartsA += 1; else rt.dartsB += 1; };
  const incAtt = (k: PlayerKey) => { if (k === "A") rt.coAttemptsA += 1; else rt.coAttemptsB += 1; };
  const incHit = (k: PlayerKey) => { if (k === "A") rt.coHitsA += 1; else rt.coHitsB += 1; };

  // Count checkout attempt én gang per visit dersom spiller er på 170 eller mindre
  if (rt.dartsInVisit === 0 && getRem(cur) <= 170) {
    rt.visitAttemptFlag = true;
    incAtt(cur);
  }

  const p = sectorPoints(sector);
  addDart(cur);

  // Bust?
  if (willBust(getRem(cur), sector)) {
    // på bust gir visit 0 poeng, remaining tilbakestilles "implicit" (vi endret det aldri)
    const next = { ...rt, dartsInVisit: 0, current: opp, visitAttemptFlag: false };
    return { rt: next, bust: true };
  }

  // Normal score
  const after = getRem(cur) - p;
  setRem(cur, after);
  addPts(cur, p);
  rt.dartsInVisit += 1;

  // Sjekk win
  if (after === 0) {
    if (rt.visitAttemptFlag) incHit(cur);
    const next = { ...rt, dartsInVisit: 0, visitAttemptFlag: false };
    return { rt: next, bust: false, legWonBy: cur };
  }

  // Fortsetter samme visit eller bytter tur?
  if (rt.dartsInVisit >= 3) {
    const next = { ...rt, dartsInVisit: 0, current: opp, visitAttemptFlag: false };
    return { rt: next, bust: false };
  }

  return { rt, bust: false };
}
