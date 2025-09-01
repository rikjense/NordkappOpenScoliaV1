import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:4000";

/* ---------- Typer vi bruker i UI ---------- */
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
  updatedAt?: string;
};

/* ---------- Hjelpere ---------- */
const label = (s: string) => <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{s}</div>;
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  background: "#0b1220",
  color: "#e5e7eb",
  border: "1px solid #1f2937",
  borderRadius: 8,
};
const selectStyle = inputStyle;

export function App() {
  /* ---------- Admin header ---------- */
  const [adminKey, setAdminKey] = useState("dev-admin-key");
  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-admin-key": adminKey }),
    [adminKey]
  );

  /* ---------- Data ---------- */
  const [boards, setBoards] = useState<Board[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  /* ---------- Board-control ---------- */
  const [boardId, setBoardId] = useState("board-1");
  const [name, setName] = useState("Board 1");
  const [serialNumber, setSerialNumber] = useState("");
  const [accessToken, setAccessToken] = useState("");

  /* ---------- Match-create dialog ---------- */
  const [showCreate, setShowCreate] = useState(false);
  const [mcPlayerA, setMcPlayerA] = useState("Player A");
  const [mcPlayerB, setMcPlayerB] = useState("Player B");
  const [mcStartScore, setMcStartScore] = useState<number>(501);
  const [mcOutMode, setMcOutMode] = useState<"DOUBLE" | "SINGLE">("DOUBLE");
  const [mcLegsMode, setMcLegsMode] = useState<"BEST_OF" | "RACE_TO">("BEST_OF");
  const [mcLegsTarget, setMcLegsTarget] = useState<number>(3);
  const [mcBoardId, setMcBoardId] = useState("");

  /* ---------- Lasting (boards + matches) ---------- */
  const loadData = async () => {
    try {
      // /boards krever normalt ikke admin
      const bRes = await fetch(`${API}/boards`);
      const b = await bRes.json().catch(() => []);
      if (Array.isArray(b)) {
        setBoards(b);
        const cur = b.find((x: Board) => x.id === boardId);
        if (cur) {
          setName(cur.name || cur.id);
          setSerialNumber(cur.serialNumber || "");
        }
      }

      // /matches krever admin-header
      const mRes = await fetch(`${API}/matches`, { headers: { "x-admin-key": adminKey } });
      if (mRes.status === 401) {
        setErr("Uautorisert mot /matches – sjekk Admin key.");
        setMatches([]);
      } else {
        const m = await mRes.json().catch(() => []);
        if (Array.isArray(m)) setMatches(m);
      }
    } catch {
      // Nettverksfeil – la boards/matches være som de er
    }
  };

  // Poll hvert 2. sekund
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop) return;
      await loadData();
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [boardId, adminKey]);

  /* ---------- Board-control lagre ---------- */
  const onSelectBoard = (id: string) => {
    setBoardId(id);
    const b = boards.find((x) => x.id === id);
    setName(b?.name ?? id);
    setSerialNumber(b?.serialNumber ?? "");
    setAccessToken("");
    setMsg("");
    setErr("");
  };

  const onSaveBoard = async () => {
    setLoading(true);
    setMsg("");
    setErr("");
    try {
      const r = await fetch(`${API}/boards/save`, {
        method: "POST",
        headers,
        body: JSON.stringify({ boardId, name, serialNumber, accessToken }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErr(d?.error || "Kunne ikke lagre.");
      else {
        setMsg("Lagret!");
        setAccessToken("");
        await loadData(); // refetch etter lagring
      }
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Board-lister ---------- */
  const boardOptions = useMemo(() => {
    const map = new Map<string, string>();
    boards.forEach((b) => map.set(b.id, b.name || b.id));
    for (let i = 1; i <= 8; i++) {
      const id = `board-${i}`;
      if (!map.has(id)) map.set(id, `Board ${i}`);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [boards]);

  const allBoardOptions = boardOptions; // også brukt i "Ny match"

  /* ---------- Match-create helpers ---------- */
  const busyBoardIds = useMemo(() => {
    const busy = new Set<string>();
    matches.forEach((m) => {
      if (m.boardId && m.status !== "Finished") busy.add(m.boardId);
    });
    return busy;
  }, [matches]);

  const handleOpenCreate = () => {
    setErr("");
    setMsg("");
    setShowCreate(true);
    // foreslå første ledige board
    const firstFree = allBoardOptions.find((b) => !busyBoardIds.has(b.id))?.id || "";
    setMcBoardId(firstFree);
  };

  const createMatch = async () => {
    setLoading(true);
    setMsg("");
    setErr("");

    // Klientside: én match per board
    if (mcBoardId) {
      const conflict = matches.find(
        (m) => m.boardId === mcBoardId && m.status !== "Finished"
      );
      if (conflict) {
        setLoading(false);
        setErr("Det finnes allerede en aktiv match på valgt board.");
        return;
      }
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
      const r = await fetch(`${API}/matches`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d?.error || "Kunne ikke opprette match.");
      } else {
        setMsg("Match opprettet!");
        setShowCreate(false);
        await loadData(); // refetch umiddelbart
      }
    } catch {
      setErr("Nettverksfeil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Admin — Board & Match-control</h1>

      <div style={{ marginTop: 8, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        {/* ---------- VENSTRE: Board-control ---------- */}
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Board-control</h3>

          {label("Admin key")}
          <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} style={inputStyle} />

          {label("Velg board")}
          <select value={boardId} onChange={(e) => onSelectBoard(e.target.value)} style={selectStyle}>
            {boardOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.id})
              </option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <div>
              {label("Board navn")}
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              {label("Board ID")}
              <input value={boardId} readOnly title="ID-rename kommer senere" style={{ ...inputStyle, color: "#9ca3af", cursor: "not-allowed" }} />
            </div>
          </div>

          {label("Scolia — Serial number")}
          <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="SN-XXXXXXXX" style={inputStyle} />

          {label("Scolia — API token")}
          <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="skriv/lim inn (lagres kryptert)" style={inputStyle} />

          <button
            onClick={onSaveBoard}
            disabled={loading}
            style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "#22c55e", color: "#0b1220", border: "none", fontWeight: 700 }}
          >
            {loading ? "Lagrer..." : "Lagre"}
          </button>

          {msg && <div style={{ marginTop: 8, color: "#22c55e", fontSize: 12 }}>{msg}</div>}
          {err && <div style={{ marginTop: 8, color: "#f87171", fontSize: 12 }}>Feil: {err}</div>}
        </div>

        {/* ---------- HØYRE: Oversikter + Match-control ---------- */}
        <div style={{ display: "grid", gap: 12 }}>
          {/* Boards oversikt */}
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <h3 style={{ marginTop: 0, marginBottom: 8, flex: 1 }}>Boards (oversikt)</h3>
            </div>
            <pre style={{ background: "#0b1220", padding: 12, borderRadius: 8, maxHeight: 240, overflow: "auto" }}>
              {JSON.stringify(boards, null, 2)}
            </pre>
            <div style={{ opacity: 0.7, fontSize: 12 }}>NB: Token vises alltid maskert.</div>
          </div>

          {/* Match-control */}
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8, flex: 1 }}>Match-control</h3>
              <button
                onClick={handleOpenCreate}
                style={{ padding: "8px 12px", borderRadius: 8, background: "#22c55e", color: "#0b1220", border: "none", fontWeight: 700 }}
              >
                Lag ny match
              </button>
            </div>

            {/* Aktive matcher – enkel liste */}
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
                      <th style={{ padding: "6px 4px" }} />
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
                          <td style={{ padding: "8px 4px", textAlign: "right", opacity: 0.6 }}>
                            <span title="Endre (kommer i neste steg)">⚙️</span>{" "}
                            <span title="Slett (kommer i neste steg)">🗑️</span>
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

      {/* ---------- CREATE MATCH MODAL ---------- */}
      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
          onClick={() => !loading && setShowCreate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 560,
              maxWidth: "95vw",
              background: "#0b1220",
              border: "1px solid #1f2937",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, flex: 1 }}>Ny match</h3>
              <button
                onClick={() => !loading && setShowCreate(false)}
                style={{ border: "none", background: "transparent", color: "#e5e7eb", fontSize: 18 }}
                title="Lukk"
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                {label("Navn spiller 1")}
                <input value={mcPlayerA} onChange={(e) => setMcPlayerA(e.target.value)} style={inputStyle} />
              </div>
              <div>
                {label("Navn spiller 2")}
                <input value={mcPlayerB} onChange={(e) => setMcPlayerB(e.target.value)} style={inputStyle} />
              </div>

              <div>
                {label("Start score")}
                <input
                  type="number"
                  value={mcStartScore}
                  onChange={(e) => setMcStartScore(Number(e.target.value || 0))}
                  style={inputStyle}
                />
              </div>

              <div>
                {label("Out-modus")}
                <select value={mcOutMode} onChange={(e) => setMcOutMode(e.target.value as any)} style={selectStyle}>
                  <option value="DOUBLE">Double out</option>
                  <option value="SINGLE">Single out</option>
                </select>
              </div>

              <div>
                {label("Legs-modus")}
                <select value={mcLegsMode} onChange={(e) => setMcLegsMode(e.target.value as any)} style={selectStyle}>
                  <option value="BEST_OF">Best of</option>
                  <option value="RACE_TO">Race to</option>
                </select>
              </div>

              <div>
                {label(mcLegsMode === "BEST_OF" ? "Best of (antall)" : "Race to (mål)")}
                <input
                  type="number"
                  value={mcLegsTarget}
                  onChange={(e) => setMcLegsTarget(Number(e.target.value || 0))}
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: "1 / span 2" }}>
                {label("Board")}
                <select value={mcBoardId} onChange={(e) => setMcBoardId(e.target.value)} style={selectStyle}>
                  <option value="">(Ingen – kan knyttes senere)</option>
                  {allBoardOptions.map((b) => (
                    <option key={b.id} value={b.id} disabled={busyBoardIds.has(b.id)}>
                      {b.name} {busyBoardIds.has(b.id) ? "• opptatt" : ""}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  * Det kan kun være <strong>én</strong> aktiv match pr. board. Opptatte boards er deaktivert.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreate(false)}
                disabled={loading}
                style={{ padding: "8px 12px", borderRadius: 8, background: "#374151", color: "#e5e7eb", border: "none" }}
              >
                Avbryt
              </button>
              <button
                onClick={createMatch}
                disabled={loading}
                style={{ padding: "8px 12px", borderRadius: 8, background: "#22c55e", color: "#0b1220", border: "none", fontWeight: 700 }}
              >
                {loading ? "Oppretter..." : "Opprett match"}
              </button>
            </div>

            {err && <div style={{ marginTop: 8, color: "#f87171", fontSize: 12 }}>Feil: {err}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
