import { useState, useCallback, useEffect, useRef } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { sounds } from "@/lib/sounds";
import { formatMoney } from "@/lib/utils";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";

// ── Gem visual definitions ───────────────────────────────────────────────────
const GEMS = [
  { id: 0, label: "x0.2", bg: "linear-gradient(145deg,#ff6b6b,#c0392b,#8b1a1a)", border: "#ff4757", glow: "rgba(255,71,87,0.7)",  shape: "square"   },
  { id: 1, label: "x0.5", bg: "linear-gradient(145deg,#74b9ff,#2980b9,#1a5276)", border: "#3498db", glow: "rgba(52,152,219,0.7)",  shape: "tri-down"  },
  { id: 2, label: "x1",   bg: "linear-gradient(145deg,#ffd32a,#e1b12c,#9a7d0a)", border: "#f1c40f", glow: "rgba(241,196,15,0.7)",  shape: "tri-up"    },
  { id: 3, label: "x2",   bg: "linear-gradient(145deg,#d980fa,#9b59b6,#5b2c6f)", border: "#9b59b6", glow: "rgba(155,89,182,0.75)", shape: "sphere"    },
  { id: 4, label: "x5",   bg: "linear-gradient(145deg,#00d2d3,#1dd1a1,#0a7c5c)", border: "#1dd1a1", glow: "rgba(29,209,161,0.7)",  shape: "pentagon"  },
  { id: 5, label: "x10",  bg: "linear-gradient(145deg,#ff9ff3,#e84393,#8b1a56)", border: "#e84393", glow: "rgba(232,67,147,0.85)", shape: "crystal"   },
];

// ── SVG shape renderer ───────────────────────────────────────────────────────
function GemShape({ shape, size }: { shape: string; size: number }) {
  const s = size * 0.55, cx = size / 2, cy = size / 2;
  switch (shape) {
    case "square":
      return <svg width={size} height={size}><rect x={cx-s/2} y={cy-s/2} width={s} height={s} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" rx="3"/><polygon points={`${cx},${cy-s*0.28} ${cx+s*0.28},${cy} ${cx},${cy+s*0.28} ${cx-s*0.28},${cy}`} fill="rgba(255,255,255,0.55)"/></svg>;
    case "tri-down":
      return <svg width={size} height={size}><polygon points={`${cx-s/2},${cy-s*0.38} ${cx+s/2},${cy-s*0.38} ${cx},${cy+s*0.42}`} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/><line x1={cx-s*0.2} y1={cy-s*0.15} x2={cx+s*0.2} y2={cy-s*0.15} stroke="rgba(255,255,255,0.5)" strokeWidth="1"/></svg>;
    case "tri-up":
      return <svg width={size} height={size}><polygon points={`${cx},${cy-s*0.42} ${cx+s/2},${cy+s*0.38} ${cx-s/2},${cy+s*0.38}`} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/><line x1={cx-s*0.2} y1={cy+s*0.1} x2={cx+s*0.2} y2={cy+s*0.1} stroke="rgba(255,255,255,0.5)" strokeWidth="1"/></svg>;
    case "sphere":
      return <svg width={size} height={size}><circle cx={cx} cy={cy} r={s*0.45} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/><ellipse cx={cx-s*0.1} cy={cy-s*0.12} rx={s*0.14} ry={s*0.09} fill="rgba(255,255,255,0.5)"/></svg>;
    case "pentagon": {
      const r = s*0.45;
      const pts = Array.from({length:5},(_,i)=>{ const a=(i*72-90)*Math.PI/180; return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`; }).join(" ");
      const pts2 = Array.from({length:5},(_,i)=>{ const a=(i*72-90)*Math.PI/180, ri=r*0.45; return `${cx+ri*Math.cos(a)},${cy+ri*Math.sin(a)}`; }).join(" ");
      return <svg width={size} height={size}><polygon points={pts} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/><polygon points={pts2} fill="rgba(255,255,255,0.3)"/></svg>;
    }
    case "crystal":
      return <svg width={size} height={size}><polygon points={`${cx},${cy-s*0.45} ${cx+s*0.25},${cy-s*0.15} ${cx+s*0.18},${cy+s*0.42} ${cx-s*0.18},${cy+s*0.42} ${cx-s*0.25},${cy-s*0.15}`} fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/><line x1={cx} y1={cy-s*0.45} x2={cx} y2={cy+s*0.42} stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/></svg>;
    default: return null;
  }
}

// ── Gem cell — NO layout prop to avoid reflow jumps ─────────────────────────
function GemCell({ gemId, isMatched, isNew, isEmpty, size }: {
  gemId: number; isMatched: boolean; isNew: boolean; isEmpty: boolean; size: number;
}) {
  const gem = GEMS[gemId] ?? GEMS[0];
  if (isEmpty) return <div style={{ width: size, height: size, borderRadius: 8 }} />;
  return (
    <motion.div
      initial={isNew ? { y: -size * 2.5, opacity: 0 } : false}
      animate={
        isMatched
          ? { scale: [1, 1.2, 0], opacity: [1, 1, 0], transition: { duration: 0.4 } }
          : isNew
          ? { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 22 } }
          : { scale: 1, opacity: 1 }
      }
      style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        background: gem.bg,
        border: isMatched ? "2px solid #fff" : `1.5px solid ${gem.border}`,
        boxShadow: isMatched
          ? `0 0 18px ${gem.glow}, 0 0 6px #fff`
          : `0 2px 8px ${gem.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: 5, width: "28%", height: "22%",
        background: "rgba(255,255,255,0.45)", borderRadius: "50%", filter: "blur(2px)",
      }} />
      <GemShape shape={gem.shape} size={size * 0.72} />
    </motion.div>
  );
}

// ── Legend strip ─────────────────────────────────────────────────────────────
function LegendStrip({ gems }: { gems: typeof GEMS }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-around", padding: "4px 8px" }}>
      {gems.map((g) => (
        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 5,
            background: g.bg, border: `1.5px solid ${g.border}`,
            boxShadow: `0 1px 5px ${g.glow}`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <GemShape shape={g.shape} size={20} />
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>{g.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
interface CascadeStep { matched: number[]; gridAfter: number[]; newPositions: number[]; stepMult: number; }
interface PlayResult   { initialGrid: number[]; cascades: CascadeStep[]; }
type Phase = "idle" | "filling" | "matching" | "falling" | "done";

// ── Main component ───────────────────────────────────────────────────────────
export default function GemsOdysseyPage() {
  const { data: user, refetch } = useGetMe();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [bet, setBet]           = useState(3000);
  const [betInput, setBetInput] = useState("3000");
  const [playing, setPlaying]   = useState(false);

  // Grid animation state
  const [grid, setGrid]             = useState<number[]>(Array.from({ length: 25 }, (_, i) => i % 6));
  const [matchedSet, setMatchedSet] = useState(new Set<number>());
  const [newSet, setNewSet]         = useState(new Set<number>());
  const [emptySet, setEmptySet]     = useState(new Set<number>());
  const [phase, setPhase]           = useState<Phase>("idle");
  const [totalMult, setTotalMult]   = useState(0);
  const [showIdle, setShowIdle]     = useState(true);
  const [wonAmt, setWonAmt]         = useState(0);
  const [finalWon, setFinalWon]     = useState(false);

  // Result message: fixed-height slot so it never shifts the layout
  type MsgType = "none" | "win" | "push" | "lose";
  const [msg, setMsg] = useState<MsgType>("none");

  const balance = user?.balance ?? 0;

  // ── Bet helpers ──────────────────────────────────────────────────────────
  const applyBet = (v: number) => {
    const c = Math.max(3000, Math.min(balance || 3000, v));
    setBet(c); setBetInput(String(c));
  };

  // ── Cascade runner ───────────────────────────────────────────────────────
  const runCascades = useCallback((
    initial: number[], cascades: CascadeStep[], won: boolean, winAmount: number,
  ) => {
    setShowIdle(false);
    setMsg("none");
    setGrid(initial);
    setMatchedSet(new Set());
    setEmptySet(new Set());
    setNewSet(new Set(Array.from({ length: 25 }, (_, i) => i)));
    setTotalMult(0);

    if (cascades.length === 0) {
      setTimeout(() => {
        setPhase("done"); setPlaying(false); setFinalWon(false); setMsg("lose");
        refetch(); qc.invalidateQueries();
      }, 500);
      return;
    }

    let step = 0, cum = 0;
    function next() {
      if (step >= cascades.length) {
        setPhase("done"); setPlaying(false); setFinalWon(won); setWonAmt(winAmount);
        const mt = parseFloat(cum.toFixed(2));
        setMsg(won ? (mt > 1 ? "win" : "push") : "lose");
        if (won) sounds.win?.();
        refetch(); qc.invalidateQueries();
        return;
      }
      const c = cascades[step];
      cum += c.stepMult;

      setPhase("matching");
      setMatchedSet(new Set(c.matched));
      setNewSet(new Set());

      setTimeout(() => {
        setEmptySet(new Set(c.matched));
        setMatchedSet(new Set());
        setTimeout(() => {
          setGrid(c.gridAfter);
          setEmptySet(new Set());
          setNewSet(new Set(c.newPositions));
          setTotalMult(parseFloat(cum.toFixed(2)));
          setPhase("falling");
          setTimeout(() => { setNewSet(new Set()); step++; next(); }, 550);
        }, 220);
      }, 400);
    }
    setTimeout(next, 350);
  }, [refetch, qc]);

  // ── Play handler ─────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    if (playing) return;
    if (!user || bet > user.balance) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    sounds.click?.();
    setPlaying(true); setPhase("filling"); setFinalWon(false); setWonAmt(0); setTotalMult(0); setMsg("none");

    try {
      const r = await fetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "gemsodyssey", betAmount: bet }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error || "Xatolik", variant: "destructive" } as any); setPlaying(false); return; }
      const result = data.result as PlayResult;
      runCascades(result.initialGrid, result.cascades, data.won, data.winAmount);
    } catch { toast({ title: "Server xatosi", variant: "destructive" } as any); setPlaying(false); }
  }, [playing, user, bet, toast, runCascades]);

  // ── Compute cell size from screen width ──────────────────────────────────
  const GAP = 5, PAD = 8, COLS = 5;
  const maxW = Math.min(360, (typeof window !== "undefined" ? window.innerWidth : 360) - 24);
  const cellSize = Math.floor((maxW - PAD * 2 - GAP * (COLS - 1)) / COLS);
  const gridPx = cellSize * COLS + GAP * (COLS - 1) + PAD * 2;

  return (
    /*
      KEY FIX: height=100dvh + overflow=hidden stops the page from
      resizing / scrolling during animation. All children use fixed sizes.
    */
    <div style={{
      height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column",
      background: "linear-gradient(160deg,#0d0d2b 0%,#1b0935 45%,#0d1a3a 100%)",
    }}>

      {/* ── Header (fixed height) ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 12px 6px", gap: 10, flexShrink: 0 }}>
        <button onClick={() => navigate("/slotlar")} style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <ChevronLeft style={{ width: 20, height: 20, color: "#fff" }} />
        </button>
        <p style={{ flex: 1, textAlign: "center", fontSize: 12, fontWeight: 900,
          color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Gems Odyssey
        </p>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Balans</p>
          <p style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{formatMoney(balance)}</p>
        </div>
      </div>

      {/* ── Legend top (fixed height ~32px) ── */}
      <div style={{ flexShrink: 0 }}>
        <LegendStrip gems={GEMS.slice(0, 3)} />
      </div>

      {/* ── Grid (fixed size — NEVER reflowed) ── */}
      <div style={{ display: "flex", justifyContent: "center", flexShrink: 0, padding: "4px 0" }}>
        <div style={{
          position: "relative", width: gridPx, height: gridPx,
          background: "rgba(255,255,255,0.035)",
          border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 14,
          padding: PAD, boxSizing: "border-box",
        }}>
          {/* Idle overlay */}
          {showIdle && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 20, borderRadius: 14,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600,
                textAlign: "center", padding: "0 20px" }}>
                O'yinni boshlash uchun garov tiking
              </p>
            </div>
          )}

          {/* Cascade multiplier badge */}
          {totalMult > 0 && phase !== "idle" && (
            <div style={{
              position: "absolute", top: 6, right: 6, zIndex: 30,
              padding: "2px 7px", borderRadius: 8, fontWeight: 900,
              fontSize: 11, color: "#fff",
              background: "rgba(232,67,147,0.85)",
              border: "1px solid rgba(255,100,180,0.5)",
            }}>
              x{totalMult}
            </div>
          )}

          {/* 5×5 gem grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(5, ${cellSize}px)`,
            gap: GAP,
          }}>
            {grid.map((gemId, idx) => (
              <GemCell
                key={idx}
                gemId={gemId}
                isMatched={matchedSet.has(idx)}
                isNew={newSet.has(idx)}
                isEmpty={emptySet.has(idx)}
                size={cellSize}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Legend bottom (fixed height) ── */}
      <div style={{ flexShrink: 0 }}>
        <LegendStrip gems={GEMS.slice(3)} />
      </div>

      {/*
        ── Result banner area — FIXED HEIGHT always, content swaps inside.
           This prevents any layout shift when banner appears/disappears.
      ── */}
      <div style={{ flexShrink: 0, height: 44, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {msg === "win" && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              width: "100%", textAlign: "center", borderRadius: 12, padding: "6px 10px",
              background: "rgba(29,209,161,0.15)", border: "1px solid rgba(29,209,161,0.4)",
            }}
          >
            <p style={{ color: "#6ee7b7", fontWeight: 900, fontSize: 15 }}>
              🎉 +{wonAmt.toLocaleString()} UZS — x{totalMult}
            </p>
          </motion.div>
        )}
        {msg === "push" && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              width: "100%", textAlign: "center", borderRadius: 12, padding: "6px 10px",
              background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)",
            }}
          >
            <p style={{ color: "#fde68a", fontWeight: 900, fontSize: 14 }}>↩ Garov qaytarildi (x1)</p>
          </motion.div>
        )}
        {msg === "lose" && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              width: "100%", textAlign: "center", borderRadius: 12, padding: "6px 10px",
              background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)",
            }}
          >
            <p style={{ color: "#fca5a5", fontWeight: 700, fontSize: 13 }}>😞 Mos keluvchi tosh topilmadi</p>
          </motion.div>
        )}
      </div>

      {/* ── Controls (push to bottom with flex-1 spacer) ── */}
      <div style={{ flex: 1, minHeight: 0 }} />
      <div style={{ flexShrink: 0, padding: "0 14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Quick bet buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
          {[
            { label: "MIN",  fn: () => applyBet(3000) },
            { label: "X2",   fn: () => applyBet(bet * 2) },
            { label: "X/2",  fn: () => applyBet(Math.floor(bet / 2)) },
            { label: "MAX",  fn: () => applyBet(balance) },
          ].map((b) => (
            <button key={b.label} onClick={b.fn} disabled={playing} style={{
              padding: "10px 0", borderRadius: 12, fontWeight: 900,
              fontSize: 13, cursor: "pointer", transition: "opacity .15s",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.8)",
              opacity: playing ? 0.5 : 1,
            }}>
              {b.label}
            </button>
          ))}
        </div>

        {/* Bet input + GAROV */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <input
              type="number"
              value={betInput}
              disabled={playing}
              onChange={(e) => { setBetInput(e.target.value); const v = Number(e.target.value); if (!isNaN(v) && v > 0) setBet(v); }}
              onBlur={() => applyBet(Number(betInput))}
              style={{
                width: "100%", height: 48, borderRadius: 12, padding: "0 12px",
                fontSize: 16, fontWeight: 700, color: "#fff",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                outline: "none", boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3, paddingLeft: 4 }}>
              min 3 000 — max {balance.toLocaleString()} UZS
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={play}
            disabled={playing}
            style={{
              height: 48, paddingLeft: 20, paddingRight: 20, borderRadius: 12,
              fontWeight: 900, color: "#fff", fontSize: 16, letterSpacing: "0.05em",
              minWidth: 90, border: "none", cursor: playing ? "not-allowed" : "pointer",
              background: playing ? "rgba(180,40,40,0.5)" : "linear-gradient(135deg,#e53935,#b71c1c)",
              boxShadow: playing ? "none" : "0 4px 20px rgba(229,57,53,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {playing
              ? <span style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.4)",
                  borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite",
                  display: "inline-block" }} />
              : "GAROV"}
          </motion.button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
