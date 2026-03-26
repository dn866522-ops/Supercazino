import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const ROWS = 10;
const MIN_BET = 3000;

type Phase = "idle" | "playing" | "ended";
type Cell = "hidden" | "gold" | "bomb";

function fmtNum(n: number) {
  return n.toLocaleString("uz-UZ");
}

export default function WildWestGoldPage() {
  const { data: user, refetch } = useGetMe();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [bet, setBet] = useState(MIN_BET);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rowGold, setRowGold] = useState<("left" | "right")[]>([]);
  const [currentRow, setCurrentRow] = useState(0);      // 0 = bottom row
  const [revealed, setRevealed] = useState<{ row: number; side: "left" | "right"; cell: Cell }[]>([]);
  const [currentWin, setCurrentWin] = useState(0);
  const [loading, setLoading] = useState(false);

  const balance = user?.balance ?? 0;

  const token = () => localStorage.getItem("betuz_token") ?? "";

  const startGame = async () => {
    if (balance < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/games/play", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ gameType: "wildwestgold", betAmount: bet, gameData: { phase: "start" } }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Xatolik", variant: "destructive" } as any); return; }

      setRowGold(data.result.rowGold);
      setRevealed([]);
      setCurrentRow(0);
      setCurrentWin(0);
      setPhase("playing");
      qc.setQueryData(["me"], (old: any) => old ? { ...old, balance: data.newBalance } : old);
    } catch {
      toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
    } finally {
      setLoading(false);
    }
  };

  const pickCell = async (side: "left" | "right") => {
    if (phase !== "playing" || loading) return;

    const isGold = rowGold[currentRow] === side;
    const cell: Cell = isGold ? "gold" : "bomb";
    const newRevealed = [...revealed, { row: currentRow, side, cell }];
    setRevealed(newRevealed);

    if (isGold) {
      const newWin = currentRow === 0 ? bet * 2 : currentWin * 2;
      setCurrentWin(newWin);

      if (currentRow === ROWS - 1) {
        // Won all rows! Settle win
        await settleWin(newWin);
      } else {
        setCurrentRow(r => r + 1);
      }
    } else {
      // Bomb — reveal all remaining gold positions, end game
      const allRevealed = [...newRevealed];
      for (let r = 0; r < ROWS; r++) {
        if (!newRevealed.find(x => x.row === r)) {
          allRevealed.push({ row: r, side: rowGold[r], cell: "gold" });
        }
      }
      setRevealed(allRevealed);
      setPhase("ended");
      toast({ title: "💣 Bomba! Yutqizdingiz!", variant: "destructive" } as any);
    }
  };

  const cashOut = async () => {
    if (phase !== "playing" || currentWin <= 0 || loading) return;
    await settleWin(currentWin);
  };

  const settleWin = async (winAmount: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/games/wildwest-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ winAmount }),
      });
      const data = await res.json();
      if (res.ok) {
        qc.setQueryData(["me"], (old: any) => old ? { ...old, balance: data.newBalance } : old);
        await refetch();
        toast({ title: `🤠 +${fmtNum(winAmount)} UZS`, description: `${currentRow + 1} qadam to'g'ri!` } as any);
      }
    } catch {}
    finally {
      setPhase("ended");
      setLoading(false);
    }
  };

  const resetGame = () => {
    setPhase("idle");
    setRowGold([]);
    setRevealed([]);
    setCurrentRow(0);
    setCurrentWin(0);
  };

  const getCell = (row: number, side: "left" | "right"): Cell => {
    const r = revealed.find(x => x.row === row && x.side === side);
    return r?.cell ?? "hidden";
  };

  const isRowActive = (row: number) => phase === "playing" && row === currentRow;
  const isRowDone = (row: number) => revealed.some(x => x.row === row);
  const potentialWin = currentWin > 0 ? currentWin * 2 : bet * 2;

  // Rows displayed from top (row 9) to bottom (row 0)
  const displayRows = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i);

  return (
    <div className="min-h-screen flex flex-col" style={{
      background: "linear-gradient(180deg, #6FA3C0 0%, #C4874A 55%, #D4A055 100%)",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(30,45,15,0.95)", borderBottom: "2px solid #8B6914" }}>
        <Link href="/">
          <button className="text-[#F5D060] p-1"><ArrowLeft size={22} /></button>
        </Link>
        <div className="flex items-center gap-2">
          <span style={{ color: "#F5D060", fontWeight: 700, fontSize: 16 }}>{fmtNum(balance)} сўм</span>
          <Link href="/deposit">
            <span style={{
              background: "#4CAF50", borderRadius: "50%", width: 22, height: 22,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
            }}>+</span>
          </Link>
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: "#5A3E1B",
          border: "2px solid #8B6914", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 18,
        }}>🤠</div>
      </div>

      {/* Current win display */}
      {phase === "playing" && (
        <div className="px-4 py-2 flex items-center justify-between"
          style={{ background: "rgba(0,0,0,0.35)" }}>
          <div>
            <span style={{ color: "#aaa", fontSize: 12 }}>Yutish: </span>
            <span style={{ color: "#F5D060", fontWeight: 800, fontSize: 18 }}>{fmtNum(potentialWin)} UZS</span>
          </div>
          {currentWin > 0 && (
            <button onClick={cashOut} disabled={loading}
              style={{
                background: "linear-gradient(135deg, #22C55E, #16A34A)",
                color: "#fff", fontWeight: 700, fontSize: 13,
                padding: "6px 16px", borderRadius: 10,
                border: "none", cursor: "pointer",
              }}>
              💰 {fmtNum(currentWin)} yechib ol
            </button>
          )}
        </div>
      )}

      {/* 10×2 Grid — scroll if needed */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
        {displayRows.map(row => {
          const active = isRowActive(row);
          const done = isRowDone(row);
          const left = getCell(row, "left");
          const right = getCell(row, "right");

          return (
            <div key={row} className="flex gap-2 items-center">
              {/* Row number indicator */}
              <span style={{
                color: active ? "#F5D060" : "#888",
                fontSize: 11, fontWeight: 700, width: 20, textAlign: "center", flexShrink: 0,
              }}>{row + 1}</span>

              {/* Left cell */}
              <motion.button
                className="flex-1 rounded-xl flex items-center justify-center"
                style={{
                  height: 48,
                  background: left === "gold" ? "linear-gradient(135deg,#F5D060,#C8941A)"
                    : left === "bomb" ? "linear-gradient(135deg,#991B1B,#7F1D1D)"
                    : active ? "linear-gradient(135deg,#C4A47C,#A08060)"
                    : "linear-gradient(135deg,#D4B896,#C4A47C)",
                  border: active ? "2.5px solid #F5D060"
                    : left === "gold" ? "2px solid #F5D060"
                    : left === "bomb" ? "2px solid #EF4444"
                    : "1.5px solid #A08060",
                  boxShadow: active ? "0 0 10px rgba(245,208,96,0.5)" : "none",
                  cursor: active ? "pointer" : "default",
                  opacity: !active && !done && phase === "playing" ? 0.6 : 1,
                }}
                onClick={() => active && pickCell("left")}
                whileTap={active ? { scale: 0.95 } : {}}
                disabled={!active || loading}
              >
                <AnimatePresence mode="wait">
                  {left === "gold" && (
                    <motion.span key="gold-l" initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400 }} style={{ fontSize: 26 }}>🪙</motion.span>
                  )}
                  {left === "bomb" && (
                    <motion.span key="bomb-l" initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400 }} style={{ fontSize: 26 }}>💣</motion.span>
                  )}
                  {left === "hidden" && (
                    <span style={{ color: "#8B6553", fontSize: 20, opacity: active ? 0.9 : 0.4 }}>
                      {active ? "?" : "🤎"}
                    </span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Right cell */}
              <motion.button
                className="flex-1 rounded-xl flex items-center justify-center"
                style={{
                  height: 48,
                  background: right === "gold" ? "linear-gradient(135deg,#F5D060,#C8941A)"
                    : right === "bomb" ? "linear-gradient(135deg,#991B1B,#7F1D1D)"
                    : active ? "linear-gradient(135deg,#C4A47C,#A08060)"
                    : "linear-gradient(135deg,#D4B896,#C4A47C)",
                  border: active ? "2.5px solid #F5D060"
                    : right === "gold" ? "2px solid #F5D060"
                    : right === "bomb" ? "2px solid #EF4444"
                    : "1.5px solid #A08060",
                  boxShadow: active ? "0 0 10px rgba(245,208,96,0.5)" : "none",
                  cursor: active ? "pointer" : "default",
                  opacity: !active && !done && phase === "playing" ? 0.6 : 1,
                }}
                onClick={() => active && pickCell("right")}
                whileTap={active ? { scale: 0.95 } : {}}
                disabled={!active || loading}
              >
                <AnimatePresence mode="wait">
                  {right === "gold" && (
                    <motion.span key="gold-r" initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400 }} style={{ fontSize: 26 }}>🪙</motion.span>
                  )}
                  {right === "bomb" && (
                    <motion.span key="bomb-r" initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400 }} style={{ fontSize: 26 }}>💣</motion.span>
                  )}
                  {right === "hidden" && (
                    <span style={{ color: "#8B6553", fontSize: 20, opacity: active ? 0.9 : 0.4 }}>
                      {active ? "?" : "🤎"}
                    </span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Win amount indicator */}
              <span style={{
                color: active ? "#22C55E" : "#666",
                fontSize: 11, fontWeight: 700, width: 36, textAlign: "right", flexShrink: 0,
              }}>
                {currentRow === 0 ? `${bet / 1000}k×2` :
                 row === currentRow ? `${fmtNum(potentialWin / 1000)}k` : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom bar */}
      <div className="px-4 pb-5 pt-3"
        style={{ background: "linear-gradient(180deg,#5A2D0C,#3A1A05)", borderTop: "3px solid #8B5A2B" }}>

        {phase === "idle" && (
          <>
            {/* Bet input */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1"
                style={{ background: "rgba(255,255,255,0.1)", border: "1.5px solid #8B5A2B" }}>
                <input
                  type="number"
                  value={bet}
                  onChange={e => setBet(Math.max(MIN_BET, Number(e.target.value) || MIN_BET))}
                  className="bg-transparent flex-1 text-white font-bold text-base outline-none min-w-0"
                />
                <span style={{ color: "#F5D060", fontSize: 12 }}>UZS</span>
              </div>
              <button onClick={() => setBet(b => Math.max(MIN_BET, Math.floor(b / 2)))}
                className="px-3 py-2 rounded-xl font-bold text-sm"
                style={{ background: "#8B5A2B", color: "#F5D060", border: "1.5px solid #A0703A" }}>½</button>
              <button onClick={() => setBet(b => Math.min(balance, b * 2))}
                className="px-3 py-2 rounded-xl font-bold text-sm"
                style={{ background: "#8B5A2B", color: "#F5D060", border: "1.5px solid #A0703A" }}>2×</button>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#F5A623", border: "1.5px solid #F5D060", fontSize: 22 }}>🪙</div>
            </div>

            {/* Quick bets */}
            <div className="flex gap-2 mb-3">
              {[3000, 5000, 10000, 50000].map(v => (
                <button key={v} onClick={() => setBet(v)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: bet === v ? "#F5D060" : "rgba(255,255,255,0.1)",
                    color: bet === v ? "#3A1A05" : "#F5D060",
                    border: "1px solid #8B5A2B",
                  }}>
                  {v >= 1000 ? v / 1000 + "k" : v}
                </button>
              ))}
            </div>

            {/* Play button */}
            <button onClick={startGame} disabled={loading || bet < MIN_BET}
              className="w-full py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg,#4CAF50,#2E7D32)",
                color: "#fff", boxShadow: "0 4px 12px rgba(76,175,80,0.4)",
              }}>
              {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : "▶ O'ynash"}
            </button>
          </>
        )}

        {phase === "playing" && (
          <div className="flex gap-3">
            <button onClick={() => { setPhase("ended"); }} disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold text-base"
              style={{ background: "#7F1D1D", color: "#fff", border: "1.5px solid #EF4444" }}>
              ✖ Bekor qilish
            </button>
            {currentWin > 0 && (
              <button onClick={cashOut} disabled={loading}
                className="flex-1 py-3 rounded-xl font-bold text-base"
                style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff" }}>
                💰 {fmtNum(currentWin)} yechib ol
              </button>
            )}
          </div>
        )}

        {phase === "ended" && (
          <button onClick={resetGame}
            className="w-full py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#F5A623,#E8870A)", color: "#fff" }}>
            🔄 Qayta o'ynash
          </button>
        )}
      </div>
    </div>
  );
}
