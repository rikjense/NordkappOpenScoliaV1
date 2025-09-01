import React, { useEffect, useState } from "react";

// API-basens URL – serveren vår
const API = "http://localhost:4000";

// Minimal type for visning
type Board = {
  id: string;
  name: string;
  status: "Offline" | "Updating" | "Initializing" | "Calibrating" | "Ready" | "Error";
  phase: "Throw" | "Takeout" | null;
  lastThrow?: { sector: string; at: string };
};

export function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [sseConnected, setSseConnected] = useState(false); // true = live, false = fallback (polling)

  // Hjelper: oppdater/legg til et board i lista
  const upsertBoard = (list: Board[], incoming: Board): Board[] => {
    const idx = list.findIndex((x) => x.id === incoming.id);
    if (idx === -1) return [...list, incoming];
    const merged = { ...list[idx], ...incoming };
    const next = list.slice();
    next[idx] = merged;
    return next;
  };

  // --------- A) SSE: LIVE-STRØM FRA SERVER ---------
  useEffect(() => {
    const es = new EventSource(`${API}/events/stream`);
    es.onopen = () => setSseConnected(true);

    es.addEventListener("boards.snapshot", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data?.boards)) setBoards(data.boards);
      } catch {}
    });

    es.addEventListener("board.update", (e: MessageEvent) => {
      try {
        const b: Board = JSON.parse(e.data);
        setBoards((prev) => upsertBoard(prev, b));
      } catch {}
    });

    es.onerror = () => {
      setSseConnected(false); // lar polling være fallback
    };

    return () => es.close();
  }, []);

  // --------- B) Polling fallback (deaktiv når SSE er koblet) ---------
  useEffect(() => {
    if (sseConnected) return; // ingen polling når SSE er oppe

    const fn = async () => {
      try {
        const r = await fetch(`${API}/boards`);
        const data = await r.json();
        if (Array.isArray(data)) setBoards(data);
      } catch {
        // ignorer – vis gammelt innhold
      }
    };
    fn();
    const t = setInterval(fn, 1000);
    return () => clearInterval(t);
  }, [sseConnected]);

  // Fyll ut grid med plasser til 8 brett hvis vi mangler noen
  const cells = boards.length ? boards : Array.from({ length: 8 }).map((_, i) => ({
    id: `slot-${i+1}`, name: `Board ${i+1}`, status: "Offline", phase: null
  })) as any[];

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>
        Visning {sseConnected ? "• LIVE" : "• fallback"}
      </h1>
      <p style={{ opacity: 0.8 }}>Grid viser {boards.length || 8} brett.</p>
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {cells.slice(0, 8).map((b: any, i: number) => (
          <div key={b.id ?? i} style={{
            background: "#0b1220",
            border: "1px solid #1f2937",
            borderRadius: 12,
            padding: 12,
            minHeight: 120
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ opacity: 0.8, fontSize: 12 }}>{b.id}</div>
              <div style={{
                fontSize: 11, padding: "2px 6px", borderRadius: 6,
                background: b.status === "Ready" ? "#064e3b" : "#3f3f46"
              }}>
                {b.status}{b.phase ? ` · ${b.phase}` : ""}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{b.name}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Siste kast:</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {b.lastThrow?.sector ?? "—"}
              </div>
              <div style={{ opacity: 0.6, fontSize: 12 }}>
                {b.lastThrow?.at ? new Date(b.lastThrow.at).toLocaleTimeString() : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
