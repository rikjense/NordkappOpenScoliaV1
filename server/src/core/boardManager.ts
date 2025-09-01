import { eventBus } from "./eventBus";
import type { ThrowDetectedPayload } from "../scolia/types";

export type BoardStatus = "Offline" | "Updating" | "Initializing" | "Calibrating" | "Ready" | "Error";
export type BoardPhase = "Throw" | "Takeout" | null;

export type ScoliaConfig = {
  serialNumber?: string;
  accessToken?: string; // lagres kun i minne på server
};

export type BoardState = {
  id: string;          // f.eks "board-1" (kan bli ekte serial senere)
  name: string;
  status: BoardStatus;
  phase: BoardPhase;
  lastThrow?: ThrowDetectedPayload & { at: string };
  lastUpdate: string;  // ISO
  scolia: ScoliaConfig; // <-- ALLTID objekt (ikke optional)
};

class BoardManager {
  private boards = new Map<string, BoardState>();

  list(): BoardState[] {
    return Array.from(this.boards.values());
  }

  get(id: string): BoardState | undefined {
    return this.boards.get(id);
  }

  upsert(id: string, name: string): BoardState {
    const now = new Date().toISOString();
    const existing = this.boards.get(id);
    const state: BoardState = existing ?? {
      id,
      name,
      status: "Ready",
      phase: "Throw",
      lastUpdate: now,
      scolia: {} // <-- initér alltid
    };
    state.name = name ?? state.name;
    state.lastUpdate = now;
    this.boards.set(id, state);
    eventBus.emit("status.changed", { boardId: id, status: state.status, phase: state.phase });
    return state;
  }

  setScoliaConfig(id: string, cfg: ScoliaConfig): BoardState {
    const b = this.ensureBoard(id);
    b.scolia = { ...(b.scolia ?? {}), ...(cfg ?? {}) }; // <-- safe spread
    b.lastUpdate = new Date().toISOString();
    this.boards.set(id, b);
    return b;
  }

  applyThrow(id: string, payload: ThrowDetectedPayload): BoardState {
    const b = this.ensureBoard(id);
    if (b.status !== "Ready") b.status = "Ready";
    if (b.phase !== "Throw") b.phase = "Throw";
    const now = payload.detectionTime ?? new Date().toISOString();
    b.lastThrow = { ...payload, at: now };
    b.lastUpdate = now;
    this.boards.set(id, b);
    eventBus.emit("throw.detected", { boardId: id, payload });
    return b;
  }

  takeoutStart(id: string): BoardState {
    const b = this.ensureBoard(id);
    b.phase = "Takeout";
    b.lastUpdate = new Date().toISOString();
    this.boards.set(id, b);
    eventBus.emit("takeout.started", { boardId: id, time: b.lastUpdate });
    return b;
  }

  takeoutFinish(id: string, falseTakeout = false): BoardState {
    const b = this.ensureBoard(id);
    b.phase = "Throw";
    b.lastUpdate = new Date().toISOString();
    this.boards.set(id, b);
    eventBus.emit("takeout.finished", { boardId: id, time: b.lastUpdate, falseTakeout });
    return b;
  }

  private ensureBoard(id: string): BoardState {
    const b = this.boards.get(id);
    if (b) return b;
    return this.upsert(id, `Board ${id}`);
  }
}

export const boards = new BoardManager();
