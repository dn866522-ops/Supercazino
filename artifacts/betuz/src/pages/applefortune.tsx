import { useState, useCallback } from "react";
import { useGamePlay } from "@/hooks/useGamePlay";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/sounds";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";

const GRID = 5;
const TOTAL = GRID * GRID;

// Multiplier table for 50/50 per-step with house edge
// mult[k] ≈ 0.97 × 2^k  (k = safe reveals so far)
const MULTS = [
  1.94, 3.76, 7.28, 14.1, 27.3, 52.8, 102, 197, 381, 736, 1424,
  2746, 5300, 10200, 19700, 38000, 73300, 141000, 272000,
  524000, 1010000, 1950000, 3760000,
];

function fmt(m: number) {
  if (m >= 1_000_000) return (m / 1_000_000).toFixed(1) + "M";
  if (m >= 1_000)     return (m / 1_000).toFixed(1) + "k";
  return m.toFixed(2);
}

type CellState = "hidden" | "apple" | "rotten";

// Wooden circle cell styles
const woodHidden =
  "radial-gradient(circle at 38% 30%, #d4915a 0%, #a0582a 45%, #7a3f18 100%)";
const woodApple =
  "radial-gradient(circle at 38% 30%, #4ade80 0%, #16a34a 50%, #14532d 100%)";
const woodRotten =
  "radial-gradient(circle at 38% 30%, #7c3a3a 0%, #5c1a1a 50%, #2d0a0a 100%)";

function WoodCell({
  state,
  onClick,
  active,
}: {
  state: CellState;
  onClick: () => void;
  active: boolean;
}) {
  const bg = state === "apple" ? woodApple : state === "rotten" ? woodRotten : woodHidden;

  return (
    <div
      className="aspect-square rounded-full relative"
      style={{
        border: state === "hidden" ? "2px solid #5c3010" : state === "apple" ? "2px solid #15803d" : "2px solid #7f1d1d",
        boxShadow:
          state === "hidden"
            ? "0 4px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.18)"
            : state === "apple"
            ? "0 0 10px rgba(74,222,128,0.4)"
            : "0 0 10px rgba(220,38,38,0.5)",
      }}
    >
    <motion.button
      onClick={onClick}
      whileTap={active && state === "hidden" ? { scale: 0.85 } : {}}
      disabled={!active || state !== "hidden"}
      className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center"
      style={{
        background: bg,
        cursor: active && state === "hidden" ? "pointer" : "default",
        clipPath: "circle(50%)",
      }}
    >
      {state === "hidden" && (
        <div
          className="absolute w-[55%] h-[55%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12), transparent)", top: "12%", left: "15%" }}
        />
      )}
      {state === "apple" && (
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          className="text-2xl select-none"
        >
          🍎
        </motion.span>
      )}
      {state === "rotten" && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.25, 1] }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center justify-center"
        >
          <span className="text-xl select-none" style={{ filter: "grayscale(0.6) brightness(0.7)" }}>🍎</span>
          <span className="text-[10px] font-black text-red-400 leading-none">✕</span>
        </motion.div>
      )}
    </motion.button>
    </div>
  );
}

export default function AppleFortunePage() {
  const [bet, setBet] = useState(3000);
  const [cells, setCells] = useState<CellState[]>(Array(TOTAL).fill("hidden"));
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [lost, setLost] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [winAmt, setWinAmt] = useState(0);

  const { data: user } = useGetMe();
  const { play: playGame } = useGamePlay();
  const { toast } = useToast();

  const currentMult = MULTS[Math.max(0, revealed - 1)] ?? 1;
  const nextMult    = MULTS[revealed] ?? currentMult;

  // How many rotten apples to SHOW when player loses
  function rottenCount(rev: number) {
    if (rev < 5) return 2;
    return 2 + (rev - 5 + 1); // 3, 4, 5...
  }

  // Probability of hitting rotten apple at this step
  function rottenProb(rev: number) {
    return 0.5; // 50/50 throughout (increases after 5 via visual only)
  }

  const startGame = () => {
    if ((user?.balance || 0) < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    setCells(Array(TOTAL).fill("hidden"));
    setRevealed(0);
    setPlaying(true);
    setLost(false);
    setCashedOut(false);
    setWinAmt(0);
    sounds.coin();
  };

  const clickCell = useCallback(
    (i: number) => {
      if (!playing || lost || cashedOut || cells[i] !== "hidden") return;

      const isRotten = Math.random() < rottenProb(revealed);

      if (isRotten) {
        // Show rotten here + randomly place more rotten on unrevealed cells
        const newCells = [...cells];
        newCells[i] = "rotten";

        const count = rottenCount(revealed);
        const hidden = newCells
          .map((c, idx) => (c === "hidden" && idx !== i ? idx : -1))
          .filter(x => x >= 0);

        // Shuffle hidden and mark first (count-1) as rotten
        for (let r = hidden.length - 1; r > 0; r--) {
          const j = Math.floor(Math.random() * (r + 1));
          [hidden[r], hidden[j]] = [hidden[j], hidden[r]];
        }
        hidden.slice(0, count - 1).forEach(idx => { newCells[idx] = "rotten"; });

        setCells(newCells);
        setPlaying(false);
        setLost(true);
        sounds.lose();

        playGame(
          { data: { gameType: "applefortune", betAmount: bet, gameData: { result: "lose", revealed, bombs: count } } },
          { onSuccess: () => {} },
        );
        toast({ title: "😞 Yomon olma! Yutqazdingiz!", variant: "destructive" } as any);
      } else {
        // Safe — show apple
        const newCells = [...cells];
        newCells[i] = "apple";
        setCells(newCells);
        const newRev = revealed + 1;
        setRevealed(newRev);
        sounds.win();

        // Auto cash out if all cells revealed
        if (newRev === TOTAL) {
          const mult = MULTS[newRev - 1] ?? currentMult;
          const won  = Math.floor(bet * mult);
          setWinAmt(won);
          setPlaying(false);
          setCashedOut(true);
          sounds.bigWin();
          confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ["#4ade80", "#D4AF37", "#fff"] });
          playGame(
            { data: { gameType: "applefortune", betAmount: bet, gameData: { result: "win", multiplier: mult, revealed: newRev, bombs: 2 } } },
            { onSuccess: () => {} },
          );
          toast({ title: `🎉 Barcha olma topildi! ${fmt(mult)}x`, description: `+${won.toLocaleString()} UZS` } as any);
        }
      }
    },
    [playing, lost, cashedOut, cells, revealed, bet],
  );

  const cashOut = () => {
    if (!playing || revealed === 0) return;
    const mult = MULTS[revealed - 1] ?? 1;
    const won  = Math.floor(bet * mult);
    setWinAmt(won);
    setPlaying(false);
    setCashedOut(true);

    // Reveal some rotten apples
    const newCells = [...cells];
    const hidden = newCells.map((c, i) => (c === "hidden" ? i : -1)).filter(x => x >= 0);
    for (let r = hidden.length - 1; r > 0; r--) {
      const j = Math.floor(Math.random() * (r + 1));
      [hidden[r], hidden[j]] = [hidden[j], hidden[r]];
    }
    const showRotten = Math.min(rottenCount(revealed), hidden.length);
    hidden.slice(0, showRotten).forEach(idx => { newCells[idx] = "rotten"; });
    setCells(newCells);

    sounds.bigWin();
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ["#D4AF37", "#fff"] });

    playGame(
      { data: { gameType: "applefortune", betAmount: bet, gameData: { result: "win", multiplier: mult, revealed, bombs: 2 } } },
      { onSuccess: () => {} },
    );
    toast({ title: `💰 Olib oldingiz! ${fmt(mult)}x`, description: `+${won.toLocaleString()} UZS` } as any);
  };

  const bombsNow = rottenCount(revealed);

  return (
    <div
      className="min-h-screen pb-6"
      style={{ background: "linear-gradient(180deg, #1a4a2a 0%, #0d2e18 60%, #051508 100%)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-black text-white tracking-widest uppercase">Apple of Fortune</h1>
      </div>

      {/* Stats bar */}
      <div className="mx-4 mb-3 grid grid-cols-3 gap-2">
        {[
          { label: "Joriy", val: `${fmt(revealed > 0 ? currentMult : MULTS[0])}x`, color: "#D4AF37" },
          { label: "Topildi", val: `${revealed}`, color: "#4ade80" },
          { label: "Keyingi", val: `${fmt(nextMult)}x`, color: "#60a5fa" },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            className="rounded-xl text-center py-2"
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
            <p className="text-lg font-black" style={{ color }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Result banner */}
      <AnimatePresence>
        {(cashedOut || lost) && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-4 mb-3 text-center py-3 rounded-2xl font-black text-lg"
            style={{
              background: cashedOut ? "rgba(22,163,74,0.3)" : "rgba(185,28,28,0.3)",
              border: `1px solid ${cashedOut ? "#16a34a" : "#b91c1c"}`,
              color: cashedOut ? "#4ade80" : "#f87171",
            }}
          >
            {cashedOut ? `💰 +${winAmt.toLocaleString()} UZS` : "😞 Yomon olma! Yutqazdingiz!"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div
        className="mx-4 rounded-3xl p-4 mb-4"
        style={{
          background: "rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(4px)",
        }}
      >
        <div className="grid grid-cols-5 gap-2.5">
          {cells.map((cell, i) => (
            <WoodCell key={i} state={cell} onClick={() => clickCell(i)} active={playing} />
          ))}
        </div>

        {/* Rotten apple info (shows when > 11 reveals) */}
        {playing && revealed >= 5 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs mt-3 font-bold"
            style={{ color: "#f87171" }}
          >
            ⚠️ {bombsNow} ta yomon olma yashiringan!
          </motion.p>
        )}
      </div>

      {/* Controls */}
      <div className="mx-4 space-y-3">
        {!playing ? (
          <>
            {/* Bet input */}
            <div
              className="rounded-2xl p-3"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <label className="text-xs text-white/40 mb-1 block">Tikish (UZS)</label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBet(b => Math.max(1000, Math.floor(b / 2)))}
                  className="text-white border-white/20"
                >
                  ½
                </Button>
                <Input
                  type="number"
                  value={bet}
                  onChange={e => setBet(Number(e.target.value))}
                  className="text-center font-bold text-white bg-white/10 border-white/20"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBet(b => b * 2)}
                  className="text-white border-white/20"
                >
                  2x
                </Button>
              </div>
            </div>

            <button
              onClick={startGame}
              className="w-full py-5 rounded-2xl text-lg font-black text-black transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}
            >
              {lost || cashedOut ? "🔄 Qayta O'ynash" : "🍎 O'YINNI BOSHLASH"}
            </button>
          </>
        ) : (
          <div className="space-y-2">
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(74,222,128,0.2)" }}
            >
              <span className="text-sm text-white/50">Olib olinsa:</span>
              <span className="font-black text-lg" style={{ color: "#4ade80" }}>
                {revealed > 0
                  ? `${Math.floor(bet * currentMult).toLocaleString()} UZS`
                  : "Olma tanlang"}
              </span>
            </div>
            <button
              onClick={cashOut}
              disabled={revealed === 0}
              className="w-full py-4 rounded-2xl text-lg font-black transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #D4AF37, #b8960c)", color: "#000" }}
            >
              💰 Olib Olish {revealed > 0 && `(${fmt(currentMult)}x)`}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <p className="text-center text-xs mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
        🍎 Yutish: 50% • {revealed < 5 ? "2" : bombsNow} ta yomon olma yashiringan
      </p>
    </div>
  );
}
