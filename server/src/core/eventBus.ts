import { EventEmitter } from "node:events";

/**
 * Enkel Event Bus for intern meldingsflyt.
 * UI kan senere lytte via SSE/WS hvis ønskelig.
 */
export const eventBus = new EventEmitter();

// Hjelpetyper for sterkere typing i BoardManager
export type EventMap = {
  "throw.detected": { boardId: string; payload: any };
  "takeout.started": { boardId: string; time: string };
  "takeout.finished": { boardId: string; time: string; falseTakeout: boolean };
  "status.changed": { boardId: string; status: string; phase: string | null };
};
