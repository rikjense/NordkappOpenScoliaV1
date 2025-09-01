import type { Response, Request } from "express";
import { eventBus } from "./eventBus";
import { boards } from "./boardManager";
import { maskToken } from "../utils/security";
import { matchEngine } from "../services/matchEngine";

type Client = {
  id: number;
  res: Response;
  boardFilter?: string | null;
};

let nextId = 1;

function send(res: Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function publicBoard(b: any) {
  if (!b) return null;
  const configured = Boolean(b?.scolia?.serialNumber && b?.scolia?.accessToken);
  return {
    ...b,
    scolia: {
      serialNumber: b?.scolia?.serialNumber ?? null,
      accessTokenMasked: maskToken(b?.scolia?.accessToken),
      configured
    }
  };
}

class SSEHub {
  private clients = new Set<Client>();
  private heartbeat?: NodeJS.Timeout;

  constructor() {
    // Board-hendelser -> push
    const emit = (boardId: string) => this.pushBoard(boardId);
    eventBus.on("status.changed", ({ boardId }) => emit(String(boardId)));
    eventBus.on("throw.detected", ({ boardId }) => emit(String(boardId)));
    eventBus.on("takeout.started", ({ boardId }) => emit(String(boardId)));
    eventBus.on("takeout.finished", ({ boardId }) => emit(String(boardId)));

    // Match-hendelser -> push
    eventBus.on("match.update", ({ state }) => {
      for (const c of this.clients) {
        try { send(c.res, "match.update", state); } catch {}
      }
    });
  }

  connect(req: Request, res: Response) {
    const boardFilter = (req.query.boardId as string) || null;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const client: Client = { id: nextId++, res, boardFilter };
    this.clients.add(client);

    // Snapshot: boards (ev. filtrert)
    const snapshotBoards = boards.list()
      .filter(b => !boardFilter || b.id === boardFilter)
      .map(publicBoard);
    send(res, "boards.snapshot", { boards: snapshotBoards });

    // Snapshot: aktive matcher
    const matchSnapshot = matchEngine.listActiveStates();
    send(res, "matches.snapshot", { matches: matchSnapshot });

    req.on("close", () => {
      this.clients.delete(client);
      if (this.clients.size === 0 && this.heartbeat) {
        clearInterval(this.heartbeat); this.heartbeat = undefined;
      }
    });

    if (!this.heartbeat) {
      this.heartbeat = setInterval(() => {
        for (const c of this.clients) {
          try { c.res.write(`event: ping\ndata: "keepalive"\n\n`); } catch {}
        }
      }, 25000);
    }
  }

  private pushBoard(boardId: string) {
    const b = boards.get(boardId);
    const payload = publicBoard(b);
    if (!payload) return;
    for (const c of this.clients) {
      if (c.boardFilter && c.boardFilter !== boardId) continue;
      try { send(c.res, "board.update", payload); } catch {}
    }
  }
}

export const sseHub = new SSEHub();
