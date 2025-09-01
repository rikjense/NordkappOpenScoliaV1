import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:4000";

/* --- Typer --- */
type Stats = {
  threeDartAvg: number;
  first9AvgA: number;
  first9AvgB: number;
  checkoutPct: number;
  highestFinish: number;
  visitsCount: number;
};

type Board = {
  id: string;
  name: string;
  serialNumber?: string | null;
  accessTokenMasked?: string | null;
};

type MatchRow = {
  id: string;
  boardId?: string | null;
  playerA: string;
  playerB: string;
  startScore: number;
  status?: "Idle" | "Running" | "Finished" | "Paused" | string;
  outMode?: "DOUBLE" | "SINGLE" | string;
  legsMode?: "BEST_OF" | "RACE_TO" | string | null;
  legsTarget?: number | null;
  scoreA?: number | null;
  scoreB?: number | null;
  currentTurn?: "A" | "B" | string;
  legsWonA?: number | null;
  legsWonB?: number | null;
  updatedAt?: string | null;
  stats?: Stats;
};

const label = (s: string) => <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{s}</div>;
const inputStyle: React.CSSProperties = {
  width: "100%", padding: 8, background: "#0b1220", color: "#e5e7eb",
  border: "1px solid #1f2937", borderRadius: 8,
};
const selectStyle = inputStyle;

/* --- Dart input komponent --- */
function DartInput({
  value, onChange, disabled,
}: {
  value: { m: "S" | "D" | "T"; v: number };
  onChange: (v: { m: "S" | "D" | "T"; v: number }) => void;
  disabled?: boolean;
}) {
  const sectors = [...Array(20).keys()].map((i) => i + 1).concat([25, 50]);
  const s25or50 = value.v === 25 || value.v === 50;
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select
        value={value.m}
        disabled={disabled || value.v === 25 || value.v === 50}
        onChange={(e) => onChange({ ...value, m: e.target.value as any })}
        style={{ ...selectStyle, width: 80 }}
        title={s25or50 ? "Bull behandles som single/double automatisk" : ""}
      >
        <option value="S">S</option>
        <option value="D">D</option>
        <option value="T">T</option>
      </select>
      <select
        value={value.v}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, v: Number(e.target.value) })}
        style={{ ...selectStyle, width: 120 }}
      >
        {sectors.map((s) => (
          <option key={s} value={s}>
            {s === 25 ? "25 (outer bull)" : s === 50 ? "50 (bull)" : s}
          </option>
        ))}
      </select>
    </div>
  );
}

export function App() {
  /* --- Admin header --- */
  const [adminKey, setAdminKey] = useState("dev-admin-key");
  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-admin-key": adminKey }),
    [adminKey]
  );

  /* --- Data --- */
  const [boards, setBoards] = useState<Board[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  /* --- Board-control --- */
  const [boardId, setBoardId] = useState("board-1");
  const [name, setName] = useState("Board 1");
  const [serialNumber, setSerialNumber] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [editingBoard, setEditingBoard] = useState(false); // fokus-lås

  /* --- Create/Edit/Delete --- */
  const [showCreate, setShowCreate] = useState(false);
  const [mcPlayerA, setMcPlayerA] = useState("Player A");
  const [mcPlayerB, setMcPlayerB] = useState("Player B");
  const [mcStartScore, setMcStartScore] = useState<number>(501);
  const [mcOutMode, setMcOutMode] = useState<"DOUBLE" | "SINGLE">("DOUBLE");
  const [mcLegsMode, setMcLegsMode] = useState<"BEST_OF" | "RACE_TO">("BEST_OF");
  const [mcLegsTarget, setMcLegsTarget] = useState<number>(3);
  const [mcBoardId, setMcBoardId] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<MatchRow | null>(null);
  const [emPlayerA, setEmPlayerA] = useState("");
  const [emPlayerB, setEmPlayerB] = useState("");
  const [emStartScore, setEmStartScore] = useState<number>(501);
  const [emStatus, setEmStatus] = useState<"Idle" | "Running" | "Finished" | "Paused">("Idle");
  const [emBoardId, setEmBoardId] = useState<string>("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* --- Scoreboard & Simulator --- */
  const [simMatchId, setSimMatchId] = useState<string>("");
  const [simState, setSimState] = useState<MatchRow | null>(null);
  const [d1, setD1] = useState({ m: "S" as "S" | "D" | "T", v: 20 });
  const [d2, setD2] = useState({ m: "S" as "S" | "D" | "T", v: 20 });
  const [d3, setD3] = useState({ m: "S" as "S" | "D" | "T", v: 20 });
  const [dartCount, setDartCount] = useState<1 | 2 | 3>(3);

  /* --- Henting --- */
  const loadData = async () => {
    try {
      // Boards
      const bRes = await fetch(`${API}/boards`);
      const b = await bRes.json().catch(() => []);
      if (Array.isArray(b)) {
        setBoards(b);
        const cur = b.find((x: Board) => x.id === boardId);
        if (cur && !editingBoard) {
          setName(cur.name || cur.id);
          setSerialNumber(cur.serialNumber || "");
        }
      }

      // Matches
      const mRes = await fetch(`${API}/matches`, { headers: { "x-admin-key": adminKey } });
      if (mRes.status === 401) {
        setErr("Uautorisert mot /matches – sjekk Admin key.");
        setMatches([]);
      } else {
        const m = await mRes.json().catch(() => []);
        if (Array.isArray(m)) setMatches(m);
      }
    } catch {}
  };

  // Poll boards/matches (2s)
  useEffect(() => {
    let stop = false;
    const tick = async () => { if (!stop) await loadData(); };
    tick();
    const t = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(t); };
  }, [boardId, adminKey, editingBoard]);

  // Poll simState (1s)
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (!simMatchId || stop) return;
      try {
        const r = await fetch(`${API}/matches/${simMatchId}/state`, { headers: { "x-admin-key": adminKey } });
        if (r.ok) setSimState(await r.json());
      } catch {}
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => { stop = true; clearInterval(t); };
  }, [simMatchId, adminKey]);

  /* --- Board-control --- */
  const onSelectBoard = (id: string) => {
    setBoardId(id);
    const b = boards.find((x) => x.id === id);
    setName(b?.name ?? id);
    setSerialNumber(b?.serialNumber ?? "");
    setAccessToken("");
    setMsg(""); setErr("");
  };

  const onSaveBoard = async () => {
    setLoading(true); setMsg(""); setErr("");
    try {
      const r = await fetch(`${API}/boards/save`, {
        method: "POST", headers,
        body: JSON.stringify({ boardId, name, serialNumber, accessToken }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || "Kunne ikke lagre.");
      else { setMsg("Lagret!"); setAccessToken(""); await loadData(); }
    } catch { setErr("Nettverksfeil."); }
    finally { setLoading(false); }
  };

  const seedFromEnv = async () => {
    setLoading(true); setMsg(""); setErr("");
    try {
      const r = await fetch(`${API}/boards/seed-from-env`, { method: "POST", headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || "Kunne ikke seed fra .env.");
      else { setMsg("Boards oppdatert fra .env"); await loadData(); }
    } catch { setErr("Nettverksfeil."); }
    finally { setLoading(false); }
  };

  /* --- Board-lister --- */
  const boardOptions = useMemo(() => {
    const map = new Map<string, string>();
    boards.forEach((b) => map.set(b.id, b.name || b.id));
    for (let i = 1; i <= 8; i++) {
      const id = `board-${i}`;
      if (!map.has(id)) map.set(id, `Board ${i}`);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [boards]);
  const allBoardOptions = boardOptions;

  /* --- Busy boards --- */
  const busyBoardIds = useMemo(() => {
    const busy = new Set<string>();
    matches.forEach((m) => { if (m.boardId && m.status !== "Finished") busy.add(m.boardId); });
    return busy;
  }, [matches]);

  /* --- Create --- */
  const handleOpenCreate = () => {
    setErr(""); setMsg(""); setShowCreate(true);
    const firstFree = allBoardOptions.find((b) => !busyBoardIds.has(b.id))?.id || "";
    setMcBoardId(firstFree);
  };
  const createMatch = async () => {
    setLoading(true); setMsg(""); setErr("");
    if (mcBoardId) {
      const conflict = matches.find((m) => m.boardId === mcBoardId && m.status !== "Finished");
      if (conflict) { setLoading(false); setErr("Det finnes allerede en aktiv match på valgt board."); return; }
    }
    try {
      const body = {
        playerA: mcPlayerA.trim() || "Player A",
        playerB: mcPlayerB.trim() || "Player B",
        startScore: Number(mcStartScore) || 501,
        outMode: mcOutMode,
        legsMode: mcLegsMode,
        legsTarget: Number(mcLegsTarget) || 3,
        boardId: mcBoardId || null,
      };
      const r = await fetch(`${API}/matches`, { method: "POST", headers, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || "Kunne ikke opprette match.");
      else { setMsg("Match opprettet!"); setShowCreate(false); await loadData(); }
    } catch { setErr("Nettverksfeil."); }
    finally { setLoading(false); }
  };

  /* --- Edit --- */
  const openEdit = (m: MatchRow) => {
    setEditTarget(m);
    setEmPlayerA(m.playerA);
    setEmPlayerB(m.playerB);
    setEmStartScore(m.startScore);
    setEmStatus((m.status as any) || "Idle");
    setEmBoardId(m.boardId || "");
    setShowEdit(true);
  };
  const saveEdit = async () => {
    if (!editTarget) return;
    setLoading(true); setMsg(""); setErr("");
    try {
      const body: any = {
        playerA: emPlayerA.trim() || "Player A",
        playerB: emPlayerB.trim() || "Player B",
        startScore: Number(emStartScore) || 501,
        status: emStatus,
        boardId: emBoardId || null,
      };
      const r = await fetch(`${API}/matches/${editTarget.id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || "Kunne ikke oppdatere match.");
      else { setMsg("Match oppdatert!"); setShowEdit(false); setEditTarget(null); await loadData(); }
    } catch { setErr("Nettverksfeil."); }
    finally { setLoading(false); }
  };

  /* --- Delete --- */
  const doDelete = async () => {
    if (!deleteId) return;
    setLoading(true); setMsg(""); setErr("");
    try {
      const r = await fetch(`${API}/matches/${deleteId}`, { method: "DELETE", headers });
      if (!r.ok && r.status !== 204) {
        const d = await r.json().catch(() => ({}));
        setErr(d?.error || "Kunne ikke slette match.");
      } else { setMsg("Match slettet."); }
      setDeleteId(null);
      await loadData();
    } catch { setErr("Nettverksfeil."); }
    finally { setLoading(false); }
  };

  /* --- Simulator actions --- */
  const sendVisit = async () => {
    if (!simMatchId) return;
    setLoading(true); setErr(""); setMsg("");
    try {
      const dartsAll = [d1, d2, d3];
      const body = { darts: dartsAll.slice(0, dartCount) };
      const r = await fetch(`${API}/matches/${simMatchId}/visit`, { method: "POST", headers, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || "Kunne ikke sende visit.");
      else {
        if (d.matchWon && d.winner) {
          const who = d.winner === "A" ? (simState?.playerA || "Spiller A") : (simState?.playerB || "Spiller B");
          setMsg(`MATCH WON: ${who}!`);
        } else if (d.legWon) {
          const who = (simState?.currentTurn === "A") ? (simState?.playerA || "Spiller A") : (simState?.playerB || "Spiller B");
          setMsg(`Leg til ${who}. Neste leg startet.`);
        } else if (d.bust) {
          setMsg("Bust – tur byttet.");
        } else {
          setMsg(`Visit OK (score: ${d.visitScore}).`);
        }
      }
      const s = await fetch(`${API}/matches/${simMatchId}/state`, { headers: { "x-admin-key": adminKey } });
      if (s.ok) setSimState(await s.json());
    } catch { setErr("Nettverksfeil."); }
    finally { setLoading(false); }
  };
  const nextPlayer = async () => {
    if (!simMatchId) return;
    setLoading(true); setErr(""); setMsg("");
    try {
      const r = await fetch(`${API}/matches/${simMatchId}/next`, { method: "POST", headers });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr(d?.error || "Kunne ikke bytte spiller.");
      }
      const s = await fetch(`${API}/matches/${simMatchId}/state`, { headers: { "x-admin-key": adminKey } });
      if (s.ok) setSimState(await s.json());
    } catch { setErr("Nettverksfeil."); }
    finally { setLoading(false); }
  };

  // Klientside: beregn vinnernavn for banneret
  const computeWinner = (s: MatchRow | null) => {
    if (!s || s.status !== "Finished") return null;
    const mode = (s.legsMode || "BEST_OF").toUpperCase();
    const target = Number(s.legsTarget || 3);
    const need = mode === "RACE_TO" ? Math.max(1, target) : Math.floor(target / 2) + 1;
    if ((s.legsWonA || 0) >= need) return s.playerA;
    if ((s.legsWonB || 0) >= need) return s.playerB;
    return null;
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Admin — Board & Match-control + Simulator</h1>

      <div style={{ marginTop: 8, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        {/* --- Board-control --- */}
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Board-control</h3>

          {label("Admin key")}
          <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} style={inputStyle} />

          {label("Velg board")}
          <select value={boardId} onChange={(e) => onSelectBoard(e.target.value)} style={selectStyle}>
            {boardOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.id})</option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <div>
              {label("Board navn")}
              <input
                value={name}
                onFocus={() => setEditingBoard(true)}
                onBlur={() => setEditingBoard(false)}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              {label("Board ID")}
              <input value={boardId} readOnly style={{ ...inputStyle, color: "#9ca3af", cursor: "not-allowed" }} />
            </div>
          </div>

          {label("Scolia — Serial number")}
          <input
            value={serialNumber}
            onFocus={() => setEditingBoard(true)}
            onBlur={() => setEditingBoard(false)}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="SN-XXXXXXXX"
            style={inputStyle}
          />

          {label("Scolia — API token")}
          <input
            value={accessToken}
            onFocus={() => setEditingBoard(true)}
            onBlur={() => setEditingBoard(false)}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="skriv/lim inn (lagres kryptert)"
            style={inputStyle}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={onSaveBoard} disabled={loading}
              style={{ padding: "10px 12px", borderRadius: 8, background: "#22c55e", color: "#0b1220", border: "none", fontWeight: 700 }}>
              {loading ? "Lagrer..." : "Lagre"}
            </button>
            <button onClick={seedFromEnv} disabled={loading}
              style={{ padding: "10px 12px", borderRadius: 8, background: "#374151", color: "#e5e7eb", border: "none" }}>
              Reload fra .env
            </button>
          </div>

          {msg && <div style={{ marginTop: 8, color: "#22c55e", fontSize: 12 }}>{msg}</div>}
          {err && <div style={{ marginTop: 8, color: "#f87171", fontSize: 12 }}>Feil: {err}</div>}
        </div>

        {/* --- Høyre: Liste + handlinger --- */}
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Boards (oversikt)</h3>
            <pre style={{ background: "#0b1220", padding: 12, borderRadius: 8, maxHeight: 200, overflow: "auto" }}>
              {JSON.stringify(boards, null, 2)}
            </pre>
          </div>

          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8, flex: 1 }}>Match-control</h3>
              <button onClick={handleOpenCreate}
                style={{ padding: "8px 12px", borderRadius: 8, background: "#22c55e", color: "#0b1220", border: "none", fontWeight: 700 }}>
                Lag ny match
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              {matches.length === 0 ? (
                <div style={{ opacity: 0.8, fontSize: 12 }}>Ingen matcher ennå.</div>
              ) : (
                <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", opacity: 0.8 }}>
                      <th style={{ padding: "6px 4px" }}>Match</th>
                      <th style={{ padding: "6px 4px" }}>Board</th>
                      <th style={{ padding: "6px 4px" }}>Status</th>
                      <th style={{ padding: "6px 4px", textAlign: "right" }}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => {
                      const bName = boards.find((b) => b.id === m.boardId)?.name || m.boardId || "—";
                      return (
                        <tr key={m.id} style={{ borderTop: "1px solid #1f2937" }}>
                          <td style={{ padding: "8px 4px" }}>
                            <strong>{m.playerA}</strong> vs <strong>{m.playerB}</strong>
                          </td>
                          <td style={{ padding: "8px 4px" }}>{bName}</td>
                          <td style={{ padding: "8px 4px" }}>{m.status || "—"}</td>
                          <td style={{ padding: "8px 4px", textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button title="Bruk i simulator" onClick={() => setSimMatchId(m.id)}
                              style={{ padding: "6px 10px", border: "1px solid #2563eb", background: "#0b1220", color: "#93c5fd", borderRadius: 8 }}>
                              🎯
                            </button>
                            <button title="Endre" onClick={() => openEdit(m)}
                              style={{ padding: "6px 10px", border: "1px solid #374151", background: "#0b1220", color: "#e5e7eb", borderRadius: 8 }}>⚙️</button>
                            <button title="Slett" onClick={() => setDeleteId(m.id)}
                              style={{ padding: "6px 10px", border: "1px solid #b91c1c", background: "#0b1220", color: "#fca5a5", borderRadius: 8 }}>🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- SCOREBOARD + SIMULATOR --- */}
      <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Scoreboard</h3>
          {label("Velg match")}
          <select value={simMatchId} onChange={(e) => setSimMatchId(e.target.value)} style={selectStyle}>
            <option value="">(velg match)</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.playerA} vs {m.playerB} {m.boardId ? `– ${boards.find(b=>b.id===m.boardId)?.name || m.boardId}` : ""}
              </option>
            ))}
          </select>

          {simState ? (
            <div style={{ marginTop: 12 }}>
              {/* Vinnerbanner */}
              {simState.status === "Finished" && (
                <div style={{ padding: 10, borderRadius: 8, background: "#16a34a", color: "#0b1220", fontWeight: 800, marginBottom: 8 }}>
                  MATCH WON: {computeWinner(simState)}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>Spiller A</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{simState.playerA}</div>
                  <div style={{ fontSize: 32, marginTop: 6 }}>{simState.scoreA}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Legs: {simState.legsWonA ?? 0}</div>
                </div>
                <div style={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>Spiller B</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{simState.playerB}</div>
                  <div style={{ fontSize: 32, marginTop: 6 }}>{simState.scoreB}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Legs: {simState.legsWonB ?? 0}</div>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 14 }}>
                Tur: <strong>{simState.currentTurn === "A" ? simState.playerA : simState.playerB}</strong>
                {" · "}Out-modus: <strong>{(simState.outMode || "DOUBLE").toUpperCase()}</strong>
                {" · "}Serie:{" "}
                <strong>
                  {(simState.legsMode || "BEST_OF").toUpperCase() === "RACE_TO"
                    ? `Race to ${simState.legsTarget || 2}`
                    : `Best of ${simState.legsTarget || 3} (first to ${Math.floor((simState.legsTarget || 3)/2)+1})`}
                </strong>
                {" · "}Status: <strong>{simState.status}</strong>
              </div>

              {/* === Stats-boks === */}
              {simState.stats && (
                <div style={{ marginTop: 12, background: "#0b1220", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Stats</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>3-dart avg</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{simState.stats.threeDartAvg.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>First-9 A</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{simState.stats.first9AvgA.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>First-9 B</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{simState.stats.first9AvgB.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>Checkout %</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{simState.stats.checkoutPct.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>Highest finish</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{simState.stats.highestFinish}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>Visits</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{simState.stats.visitsCount}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>Ingen valgt match.</div>
          )}
        </div>

        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Simulator</h3>
          {simMatchId ? (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                {label("Antall piler")}
                <select value={dartCount} onChange={(e)=>setDartCount(Number(e.target.value) as 1|2|3)} style={{ ...selectStyle, width: 120 }}>
                  <option value={1}>1 pil</option>
                  <option value={2}>2 piler</option>
                  <option value={3}>3 piler</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <DartInput value={d1} onChange={setD1} />
                <DartInput value={d2} onChange={setD2} disabled={dartCount < 2} />
                <DartInput value={d3} onChange={setD3} disabled={dartCount < 3} />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={sendVisit} disabled={loading}
                  style={{ padding: "10px 12px", borderRadius: 8, background: "#22c55e", color: "#0b1220", border: "none", fontWeight: 700 }}>
                  Send visit
                </button>
                <button onClick={nextPlayer} disabled={loading}
                  style={{ padding: "10px 12px", borderRadius: 8, background: "#374151", color: "#e5e7eb", border: "none" }}>
                  Next player
                </button>
              </div>

              {msg && <div style={{ marginTop: 8, color: "#22c55e", fontSize: 12 }}>{msg}</div>}
              {err && <div style={{ marginTop: 8, color: "#f87171", fontSize: 12 }}>Feil: {err}</div>}
            </>
          ) : (
            <div style={{ opacity: 0.8, fontSize: 12 }}>Velg en match i dropdown til venstre først.</div>
          )}
        </div>
      </div>

      {/* === CREATE MODAL === */}
      {showCreate && (
        <div onClick={() => !loading && setShowCreate(false)}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"grid", placeItems:"center", zIndex:50 }}>
          <div onClick={(e)=>e.stopPropagation()}
               style={{ width:560, maxWidth:"95vw", background:"#0b1220", border:"1px solid #1f2937", borderRadius:12, padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
              <h3 style={{ margin:0, flex:1 }}>Ny match</h3>
              <button onClick={()=>!loading && setShowCreate(false)}
                      style={{ border:"none", background:"transparent", color:"#e5e7eb", fontSize:18 }}>×</button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>{label("Navn spiller 1")}<input value={mcPlayerA} onChange={e=>setMcPlayerA(e.target.value)} style={inputStyle} /></div>
              <div>{label("Navn spiller 2")}<input value={mcPlayerB} onChange={e=>setMcPlayerB(e.target.value)} style={inputStyle} /></div>
              <div>{label("Start score")}<input type="number" value={mcStartScore} onChange={e=>setMcStartScore(Number(e.target.value||0))} style={inputStyle}/></div>
              <div>{label("Out-modus")}
                <select value={mcOutMode} onChange={e=>setMcOutMode(e.target.value as any)} style={selectStyle}>
                  <option value="DOUBLE">Double out</option><option value="SINGLE">Single out</option>
                </select>
              </div>
              <div>{label("Legs-modus")}
                <select value={mcLegsMode} onChange={e=>setMcLegsMode(e.target.value as any)} style={selectStyle}>
                  <option value="BEST_OF">Best of</option><option value="RACE_TO">Race to</option>
                </select>
              </div>
              <div>{label(mcLegsMode==="BEST_OF"?"Best of (antall)":"Race to (mål)")}
                <input type="number" value={mcLegsTarget} onChange={e=>setMcLegsTarget(Number(e.target.value||0))} style={inputStyle}/>
              </div>
              <div style={{ gridColumn:"1 / span 2" }}>
                {label("Board")}
                <select value={mcBoardId} onChange={e=>setMcBoardId(e.target.value)} style={selectStyle}>
                  <option value="">(Ingen – kan knyttes senere)</option>
                  {allBoardOptions.map(b=>(
                    <option key={b.id} value={b.id} disabled={busyBoardIds.has(b.id)}>
                      {b.name} {busyBoardIds.has(b.id)?"• opptatt":""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowCreate(false)} disabled={loading}
                style={{ padding:"8px 12px", borderRadius:8, background:"#374151", color:"#e5e7eb", border:"none" }}>Avbryt</button>
              <button onClick={createMatch} disabled={loading}
                style={{ padding:"8px 12px", borderRadius:8, background:"#22c55e", color:"#0b1220", border:"none", fontWeight:700 }}>
                {loading?"Oppretter...":"Opprett match"}
              </button>
            </div>
            {err && <div style={{ marginTop:8, color:"#f87171", fontSize:12 }}>Feil: {err}</div>}
          </div>
        </div>
      )}

      {/* === EDIT MODAL === */}
      {showEdit && editTarget && (
        <div onClick={() => !loading && setShowEdit(false)}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"grid", placeItems:"center", zIndex:50 }}>
          <div onClick={(e)=>e.stopPropagation()}
               style={{ width:560, maxWidth:"95vw", background:"#0b1220", border:"1px solid #1f2937", borderRadius:12, padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:8 }}>
              <h3 style={{ margin:0, flex:1 }}>Endre match</h3>
              <button onClick={()=>!loading && setShowEdit(false)}
                      style={{ border:"none", background:"transparent", color:"#e5e7eb", fontSize:18 }}>×</button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>{label("Navn spiller 1")}<input value={emPlayerA} onChange={e=>setEmPlayerA(e.target.value)} style={inputStyle} /></div>
              <div>{label("Navn spiller 2")}<input value={emPlayerB} onChange={e=>setEmPlayerB(e.target.value)} style={inputStyle} /></div>
              <div>{label("Start score")}<input type="number" value={emStartScore} onChange={e=>setEmStartScore(Number(e.target.value||0))} style={inputStyle}/></div>
              <div>{label("Status")}
                <select value={emStatus} onChange={e=>setEmStatus(e.target.value as any)} style={selectStyle}>
                  <option value="Idle">Idle</option><option value="Running">Running</option>
                  <option value="Paused">Paused</option><option value="Finished">Finished</option>
                </select>
              </div>
              <div style={{ gridColumn:"1 / span 2" }}>
                {label("Board")}
                <select value={emBoardId} onChange={e=>setEmBoardId(e.target.value)} style={selectStyle}>
                  <option value="">(Ingen)</option>
                  {allBoardOptions.map(b=>(
                    <option key={b.id} value={b.id}
                      disabled={b.id!==editTarget.boardId && busyBoardIds.has(b.id)}>
                      {b.name} {b.id!==editTarget.boardId && busyBoardIds.has(b.id)?"• opptatt":""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowEdit(false)} disabled={loading}
                style={{ padding:"8px 12px", borderRadius:8, background:"#374151", color:"#e5e7eb", border:"none" }}>Avbryt</button>
              <button onClick={async()=>{await saveEdit(); if(editTarget) setSimMatchId(editTarget.id);}} disabled={loading}
                style={{ padding:"8px 12px", borderRadius:8, background:"#22c55e", color:"#0b1220", border:"none", fontWeight:700 }}>
                {loading?"Lagrer...":"Lagre endringer"}
              </button>
            </div>
            {err && <div style={{ marginTop:8, color:"#f87171", fontSize:12 }}>Feil: {err}</div>}
          </div>
        </div>
      )}

      {/* === DELETE CONFIRM === */}
      {deleteId && (
        <div onClick={() => !loading && setDeleteId(null)}
             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"grid", placeItems:"center", zIndex:50 }}>
          <div onClick={(e)=>e.stopPropagation()}
               style={{ width:420, maxWidth:"95vw", background:"#0b1220", border:"1px solid #1f2937", borderRadius:12, padding:16 }}>
            <h3 style={{ marginTop:0 }}>Slette match?</h3>
            <p style={{ marginTop:8, opacity:0.9 }}>
              Er du helt sikker? <strong>Denne avgjørelsen kan ikke gjøres om.</strong>
            </p>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
              <button onClick={()=>setDeleteId(null)} disabled={loading}
                style={{ padding:"8px 12px", borderRadius:8, background:"#374151", color:"#e5e7eb", border:"none" }}>Avbryt</button>
              <button onClick={async()=>{await doDelete(); if(deleteId===simMatchId) setSimMatchId("");}}
                disabled={loading}
                style={{ padding:"8px 12px", borderRadius:8, background:"#ef4444", color:"#0b1220", border:"none", fontWeight:700 }}>
                Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
