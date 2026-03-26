import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useGamePlay } from "@/hooks/useGamePlay";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { sounds } from "@/lib/sounds";
import { Link } from "wouter";
import { ArrowLeft, Zap, History } from "lucide-react";

// ─── constants ────────────────────────────────────────────────────────────────
const MULTS = [1.92, 3.84, 7.68, 15.36, 30.72];

// Six aim zones (2 rows × 3 cols)
const ZONES = [
  { id: 0, label: "↖", desc: "Yuqori chap",   row: 0, col: 0 },
  { id: 1, label: "↑", desc: "Yuqori markaz", row: 0, col: 1 },
  { id: 2, label: "↗", desc: "Yuqori o'ng",   row: 0, col: 2 },
  { id: 3, label: "←", desc: "Pastki chap",   row: 1, col: 0 },
  { id: 4, label: "●", desc: "Pastki markaz", row: 1, col: 1 },
  { id: 5, label: "→", desc: "Pastki o'ng",   row: 1, col: 2 },
];

// Zone → ball target in SVG coords (viewBox 0 0 460 310)
const BALL_TARGETS = [
  { x: 130, y: 72  }, // TL
  { x: 230, y: 60  }, // TC
  { x: 330, y: 72  }, // TR
  { x: 130, y: 175 }, // BL
  { x: 230, y: 180 }, // BC
  { x: 330, y: 175 }, // BR
];

type KeeperState = "center" | "dive-left" | "dive-right" | "jump-tl" | "jump-tr" | "jump-tc";

interface KeeperPos { x: number; y: number; rotate: number; }
const KEEPER_POSES: Record<KeeperState, KeeperPos> = {
  "center":     { x: 0,    y: 0,   rotate: 0   },
  "dive-left":  { x: -95,  y: 28,  rotate: -58 },
  "dive-right": { x: 95,   y: 28,  rotate: 58  },
  "jump-tl":    { x: -60,  y: -55, rotate: -28 },
  "jump-tr":    { x: 60,   y: -55, rotate: 28  },
  "jump-tc":    { x: 0,    y: -62, rotate: 0   },
};

// When SAVED: keeper goes to correct zone
const SAVE_KEEPER: KeeperState[] = ["jump-tl","jump-tc","jump-tr","dive-left","center","dive-right"];
// When GOAL: keeper goes wrong direction (pick randomly from options)
const GOAL_KEEPER: KeeperState[][] = [
  ["dive-right","jump-tr"],
  ["dive-left","dive-right"],
  ["dive-left","jump-tl"],
  ["dive-right","jump-tr"],
  ["jump-tl","jump-tr"],
  ["dive-left","jump-tl"],
];

function pickKeeperState(zone: number, scored: boolean): KeeperState {
  if (!scored) return SAVE_KEEPER[zone];
  const opts = GOAL_KEEPER[zone];
  return opts[Math.floor(Math.random() * opts.length)];
}

type GamePhase = "idle" | "starting" | "aiming" | "kicking" | "show-result" | "cashed-out" | "lost" | "complete";

interface HistoryItem { zone: number; scored: boolean; mult: number; }

function fmt(n: number) { return n.toLocaleString("uz-UZ"); }

// ─── Goalkeeper SVG component ─────────────────────────────────────────────────
function Goalkeeper({ pos }: { pos: KeeperPos }) {
  return (
    <motion.g
      animate={{ x: pos.x, y: pos.y, rotate: pos.rotate }}
      transition={{ type: "spring", stiffness: 340, damping: 26, duration: 0.38 }}
      style={{ originX: "230px", originY: "175px" }}
    >
      {/* Shadow */}
      <ellipse cx="230" cy="228" rx="22" ry="5" fill="rgba(0,0,0,0.3)" />
      {/* Legs */}
      <rect x="217" y="210" width="11" height="22" rx="4" fill="#1e3a8a" />
      <rect x="232" y="210" width="11" height="22" rx="4" fill="#1e3a8a" />
      {/* Boots */}
      <ellipse cx="222" cy="232" rx="8" ry="4" fill="#111" />
      <ellipse cx="237" cy="232" rx="8" ry="4" fill="#111" />
      {/* Body / jersey */}
      <rect x="212" y="168" width="36" height="46" rx="8" fill="#1d4ed8" />
      {/* Jersey stripes */}
      <rect x="212" y="172" width="36" height="5" rx="2" fill="#2563eb" opacity="0.6" />
      <rect x="212" y="198" width="36" height="5" rx="2" fill="#2563eb" opacity="0.6" />
      {/* Arms */}
      <rect x="192" y="170" width="22" height="10" rx="5" fill="#1d4ed8" />
      <rect x="246" y="170" width="22" height="10" rx="5" fill="#1d4ed8" />
      {/* Gloves */}
      <circle cx="190" cy="175" r="11" fill="#fbbf24" />
      <circle cx="270" cy="175" r="11" fill="#fbbf24" />
      {/* Glove stitches */}
      <line x1="185" y1="175" x2="195" y2="175" stroke="#d97706" strokeWidth="1.5" />
      <line x1="190" y1="170" x2="190" y2="180" stroke="#d97706" strokeWidth="1.5" />
      <line x1="265" y1="175" x2="275" y2="175" stroke="#d97706" strokeWidth="1.5" />
      <line x1="270" y1="170" x2="270" y2="180" stroke="#d97706" strokeWidth="1.5" />
      {/* Neck */}
      <rect x="225" y="152" width="10" height="18" rx="4" fill="#fcd5a2" />
      {/* Head */}
      <circle cx="230" cy="143" r="18" fill="#fcd5a2" />
      {/* Hair */}
      <ellipse cx="230" cy="128" rx="18" ry="8" fill="#1c1c1c" />
      {/* Eyes */}
      <circle cx="224" cy="143" r="2.5" fill="#111" />
      <circle cx="236" cy="143" r="2.5" fill="#111" />
      {/* Mouth */}
      <path d="M226 151 Q230 155 234 151" stroke="#c0726a" strokeWidth="1.5" fill="none" />
      {/* Jersey number */}
      <text x="230" y="196" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">1</text>
      {/* Glove shine */}
      <circle cx="186" cy="171" r="3" fill="rgba(255,255,255,0.4)" />
      <circle cx="266" cy="171" r="3" fill="rgba(255,255,255,0.4)" />
    </motion.g>
  );
}

// ─── Ball SVG component ────────────────────────────────────────────────────────
function Ball({ tx, ty, animate: doAnim, kicked }: { tx: number; ty: number; animate: boolean; kicked: boolean }) {
  return (
    <motion.g
      initial={{ x: 0, y: 0, scale: 1 }}
      animate={doAnim
        ? { x: tx - 230, y: ty - 440, scale: 0.38, rotate: 540 }
        : { x: 0, y: 0, scale: 1, rotate: 0 }}
      transition={{ duration: 0.52, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Ball shadow (only when on ground) */}
      {!kicked && <ellipse cx="230" cy="453" rx="20" ry="6" fill="rgba(0,0,0,0.35)" />}
      {/* Ball body */}
      <circle cx="230" cy="440" r="20" fill="white" />
      {/* Black patches (pentagon pattern) */}
      <polygon points="230,424 218,432 222,446 238,446 242,432" fill="#111" />
      <polygon points="222,446 210,448 208,462 222,466 230,458" fill="#111" opacity="0.75" />
      <polygon points="238,446 250,448 252,462 238,466 230,458" fill="#111" opacity="0.75" />
      {/* Shine */}
      <circle cx="222" cy="432" r="5" fill="rgba(255,255,255,0.5)" />
    </motion.g>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function PenaltyPage() {
  const [bet, setBet] = useState(5000);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [kickIdx, setKickIdx] = useState(0);
  const [kickOutcomes, setKickOutcomes] = useState<boolean[]>([]);
  const [safeKicks, setSafeKicks] = useState(0);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [keeperState, setKeeperState] = useState<KeeperState>("center");
  const [ballTarget, setBallTarget] = useState({ tx: 230, ty: 440 });
  const [ballKicked, setBallKicked] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [finalWin, setFinalWin] = useState(0);
  const [serverMultiplier, setServerMultiplier] = useState(0);

  const shakeControls = useAnimation();
  const { data: user, refetch: refetchUser } = useGetMe();
  const { play } = useGamePlay();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const balance = (user?.balance ?? 0) / 100;
  const currentMult = kickIdx > 0 ? MULTS[kickIdx - 1] : 0;
  const cashOutAmount = Math.floor(bet * currentMult);
  const maxPotential = Math.floor(bet * MULTS[4]);

  // ── start game ──────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (balance < bet / 100) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    if (bet < 1000) {
      toast({ title: "Minimal stavka: 1 000 UZS", variant: "destructive" } as any);
      return;
    }
    setPhase("starting");
    sounds.click();

    play(
      { data: { gameType: "penalty", betAmount: bet, gameData: {} } },
      {
        onSuccess: (data: any) => {
          const outcomes: boolean[] = data.result?.kickOutcomes ?? [false, false, false, false, false];
          const safe: number = data.result?.safeKicks ?? 0;
          setKickOutcomes(outcomes);
          setSafeKicks(safe);
          setServerMultiplier(data.multiplier ?? 0);
          setFinalWin(data.winAmount ?? 0);
          setKickIdx(0);
          setSelectedZone(null);
          setKeeperState("center");
          setBallKicked(false);
          setShowGoal(false);
          setShowSave(false);
          setPhase("aiming");
          refetchUser();
          queryClient.invalidateQueries({ queryKey: ["me"] });
        },
        onError: () => {
          toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
          setPhase("idle");
        },
      }
    );
  }, [bet, balance, play, toast, refetchUser, queryClient]);

  // ── kick ─────────────────────────────────────────────────────────────────────
  const kick = useCallback(async (zoneId: number) => {
    if (phase !== "aiming") return;
    setPhase("kicking");
    setSelectedZone(zoneId);
    sounds.click();

    const scored = kickOutcomes[kickIdx] ?? false;
    const kp = pickKeeperState(zoneId, scored);
    const bt = BALL_TARGETS[zoneId];

    // 1. Ball flies + keeper dives
    setBallTarget({ tx: bt.x, ty: bt.y });
    setBallKicked(true);
    setKeeperState(kp);

    await new Promise(r => setTimeout(r, 560));

    // 2. Show result overlay
    setShowGoal(scored);
    setShowSave(!scored);
    if (scored) {
      sounds.win?.();
    } else {
      sounds.loss?.();
      // Screen shake
      await shakeControls.start({
        x: [-10, 10, -9, 9, -6, 6, -3, 3, 0],
        transition: { duration: 0.5, ease: "easeOut" },
      });
    }

    // Add to history
    const newItem: HistoryItem = { zone: zoneId, scored, mult: scored ? MULTS[kickIdx] : 0 };
    setHistory(prev => [newItem, ...prev].slice(0, 12));

    setPhase("show-result");

    await new Promise(r => setTimeout(r, 1300));

    // 3. Determine next state
    setShowGoal(false);
    setShowSave(false);

    if (!scored) {
      // Game over
      setBallKicked(false);
      setKeeperState("center");
      setPhase("lost");
      return;
    }

    const newKickIdx = kickIdx + 1;
    setKickIdx(newKickIdx);

    if (newKickIdx >= 5) {
      // Completed all 5 — max win!
      setBallKicked(false);
      setKeeperState("center");
      setPhase("complete");
      return;
    }

    // Reset for next kick
    setBallKicked(false);
    setBallTarget({ tx: 230, ty: 440 });
    await new Promise(r => setTimeout(r, 150));
    setSelectedZone(null);
    setKeeperState("center");
    setPhase("aiming");
  }, [phase, kickOutcomes, kickIdx, shakeControls]);

  // ── cash out ────────────────────────────────────────────────────────────────
  const cashOut = useCallback(() => {
    if (kickIdx === 0) return;
    sounds.win?.();
    setPhase("cashed-out");
  }, [kickIdx]);

  // ── reset ────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setPhase("idle");
    setKickIdx(0);
    setSelectedZone(null);
    setKeeperState("center");
    setBallKicked(false);
    setShowGoal(false);
    setShowSave(false);
  }, []);

  const isGameActive = ["aiming", "kicking", "show-result"].includes(phase);
  const canCashOut = phase === "aiming" && kickIdx > 0;

  return (
    <motion.div
      animate={shakeControls}
      className="min-h-screen flex flex-col select-none"
      style={{ background: "linear-gradient(180deg, #071d08 0%, #080c14 55%, #050810 100%)" }}
    >
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 flex items-center px-4 py-3 gap-3"
        style={{ background: "rgba(7,29,8,0.96)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(34,197,94,0.1)" }}>
        <Link href="/casino">
          <button className="flex items-center gap-1 text-sm font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            <ArrowLeft className="w-4 h-4" /> Lobby
          </button>
        </Link>
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-base">⚽</span>
          <span className="font-black text-white text-sm tracking-wide">PENALTY SHOOT-OUT</span>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Balans</div>
          <div className="font-black text-sm" style={{ color: "#fbbf24" }}>{fmt(Math.round(balance))} UZS</div>
        </div>
      </div>

      {/* ─── Multiplier Ladder + Field ───────────────────────────────────── */}
      <div className="flex gap-0 flex-1">

        {/* Multiplier Ladder — left side */}
        <div className="flex flex-col justify-center gap-1.5 px-2 py-3 w-[72px] shrink-0">
          {[...MULTS].reverse().map((m, revI) => {
            const i = 4 - revI;
            const reached = kickIdx > i;
            const current = kickIdx === i && isGameActive;
            const unlocked = kickIdx >= i + 1;
            return (
              <motion.div
                key={m}
                animate={current ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ repeat: current ? Infinity : 0, duration: 1.2 }}
                className="rounded-lg px-2 py-1.5 text-center text-xs font-black transition-all"
                style={{
                  background: unlocked
                    ? "rgba(34,197,94,0.22)"
                    : current
                    ? "rgba(251,191,36,0.18)"
                    : "rgba(255,255,255,0.04)",
                  border: current
                    ? "1.5px solid rgba(251,191,36,0.7)"
                    : unlocked
                    ? "1.5px solid rgba(34,197,94,0.4)"
                    : "1.5px solid rgba(255,255,255,0.06)",
                  color: unlocked ? "#4ade80" : current ? "#fbbf24" : "rgba(255,255,255,0.3)",
                  boxShadow: current ? "0 0 12px rgba(251,191,36,0.3)" : unlocked ? "0 0 8px rgba(34,197,94,0.2)" : "none",
                }}
              >
                {unlocked && <span className="text-green-400 mr-0.5">✓</span>}
                {m}x
              </motion.div>
            );
          })}
          {/* History label */}
          <div className="mt-3 text-center">
            <History className="w-3 h-3 mx-auto mb-1" style={{ color: "rgba(255,255,255,0.25)" }} />
            <div className="flex flex-col gap-1">
              {history.slice(0, 6).map((h, i) => (
                <div key={i} className="w-6 h-6 rounded-full mx-auto flex items-center justify-center text-[10px] font-black"
                  style={{ background: h.scored ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)", color: h.scored ? "#4ade80" : "#f87171" }}>
                  {h.scored ? "⚽" : "✕"}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Main Field Area ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col">
          {/* SVG football field */}
          <div className="relative">
            {/* Grass gradient overlay at top */}
            <div className="absolute inset-x-0 top-0 h-6 z-10"
              style={{ background: "linear-gradient(to bottom, rgba(7,29,8,0.8), transparent)" }} />

            <svg
              viewBox="0 0 390 310"
              className="w-full"
              style={{ display: "block", overflow: "visible" }}
            >
              {/* ── Grass / Pitch ── */}
              <defs>
                <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#166534" />
                  <stop offset="100%" stopColor="#14532d" />
                </linearGradient>
                <radialGradient id="goalGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="saveGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Pitch background */}
              <rect x="0" y="200" width="390" height="110" fill="url(#pitchGrad)" />
              {/* Grass stripes */}
              {[0, 30, 60, 90].map(x => (
                <rect key={x} x={x} y="200" width="15" height="110" fill="rgba(0,0,0,0.08)" />
              ))}
              {/* Penalty spot */}
              <circle cx="195" cy="295" r="4" fill="white" opacity="0.8" />
              {/* Penalty arc */}
              <path d="M145,260 A65,65 0 0,1 245,260" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />

              {/* ── Goal Net (behind) ── */}
              {/* Net side panels */}
              {[70, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290, 310].map(x => (
                <line key={x} x1={x} y1="30" x2={x} y2="205" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              ))}
              {[55, 75, 95, 115, 135, 155, 175, 195].map(y => (
                <line key={y} x1="55" y1={y} x2="335" y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              ))}
              {/* Net back */}
              <rect x="55" y="25" width="280" height="185" fill="rgba(255,255,255,0.03)" />

              {/* ── VFX overlays ── */}
              <AnimatePresence>
                {showGoal && (
                  <motion.rect
                    key="goal-flash"
                    x="55" y="25" width="280" height="185"
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0.4, 0.6, 0] }}
                    transition={{ duration: 1.0, times: [0, 0.15, 0.4, 0.7, 1] }}
                    fill="url(#goalGlow)"
                  />
                )}
                {showSave && (
                  <motion.rect
                    key="save-flash"
                    x="55" y="25" width="280" height="185"
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 0.65, 0] }}
                    transition={{ duration: 0.6 }}
                    fill="url(#saveGlow)"
                  />
                )}
              </AnimatePresence>

              {/* ── Goal Posts ── */}
              <rect x="52" y="22" width="286" height="188" rx="3" fill="none" stroke="white" strokeWidth="5" />
              {/* Post highlights */}
              <rect x="50" y="20" width="10" height="192" rx="4" fill="#e5e7eb" />
              <rect x="330" y="20" width="10" height="192" rx="4" fill="#e5e7eb" />
              <rect x="50" y="20" width="290" height="10" rx="4" fill="#e5e7eb" />
              {/* Post shadow */}
              <rect x="52" y="208" width="286" height="4" rx="2" fill="rgba(0,0,0,0.4)" />

              {/* ── Zone aim dots (aiming phase) ── */}
              <AnimatePresence>
                {phase === "aiming" && BALL_TARGETS.map((t, i) => (
                  <motion.g key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <circle cx={t.x} cy={t.y} r="14" fill="rgba(251,191,36,0.1)" stroke="rgba(251,191,36,0.45)" strokeWidth="1.5" strokeDasharray="3 2" />
                    <circle cx={t.x} cy={t.y} r="4" fill="rgba(251,191,36,0.6)" />
                  </motion.g>
                ))}
              </AnimatePresence>

              {/* ── Goalkeeper ── */}
              <Goalkeeper pos={KEEPER_POSES[keeperState]} />

              {/* ── Ball ── */}
              <Ball tx={ballTarget.tx} ty={ballTarget.ty} animate={ballKicked} kicked={ballKicked} />

              {/* ── Result text overlay ── */}
              <AnimatePresence>
                {showGoal && (
                  <motion.g key="goal-text" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <rect x="75" y="95" width="240" height="60" rx="14" fill="rgba(22,163,74,0.95)" />
                    <text x="195" y="127" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold">⚽ GOL!</text>
                    <text x="195" y="147" textAnchor="middle" fill="rgba(187,247,208,0.9)" fontSize="14">{MULTS[kickIdx]}x</text>
                  </motion.g>
                )}
                {showSave && (
                  <motion.g key="save-text" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <rect x="65" y="95" width="260" height="60" rx="14" fill="rgba(185,28,28,0.95)" />
                    <text x="195" y="122" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">🧤 Tutildi!</text>
                    <text x="195" y="145" textAnchor="middle" fill="rgba(254,202,202,0.85)" fontSize="13">Darvozabon to'xtatdi</text>
                  </motion.g>
                )}
              </AnimatePresence>
            </svg>
          </div>

          {/* ── Kick progress dots ── */}
          <div className="flex items-center justify-center gap-2 py-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const done = kickOutcomes[i] !== undefined && i < kickIdx;
              const isCurrent = i === kickIdx && isGameActive;
              const scored = kickOutcomes[i];
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300"
                    style={{
                      background: done
                        ? scored ? "rgba(34,197,94,0.8)" : "rgba(239,68,68,0.7)"
                        : isCurrent ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.07)",
                      border: isCurrent ? "2px solid #fbbf24" : done ? "2px solid transparent" : "2px solid rgba(255,255,255,0.12)",
                      boxShadow: isCurrent ? "0 0 10px rgba(251,191,36,0.4)" : "none",
                      color: "white",
                    }}
                  >
                    {done ? (scored ? "⚽" : "✕") : i + 1}
                  </div>
                  {done && scored && (
                    <div className="text-[9px] font-black" style={{ color: "#4ade80" }}>{MULTS[i]}x</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── INTERACTION AREA ─────────────────────────────────────────── */}

          {/* === IDLE: Bet panel === */}
          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="px-3 pb-5 space-y-3">

                {/* Multiplier info strip */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 px-1">
                  {MULTS.map((m, i) => (
                    <div key={i} className="flex-1 min-w-[52px] rounded-lg py-1.5 text-center text-xs font-black"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                      {m}x
                    </div>
                  ))}
                </div>

                {/* Bet input */}
                <div className="rounded-2xl p-4 space-y-2.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Stavka miqdori</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setBet(v => Math.max(1000, Math.floor(v / 2)))}
                      className="w-9 h-9 rounded-xl font-black text-lg transition-all active:scale-90"
                      style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>−</button>
                    <div className="flex-1 text-center font-black text-xl text-white">{fmt(bet)} UZS</div>
                    <button onClick={() => setBet(v => Math.min(balance * 100, v * 2))}
                      className="w-9 h-9 rounded-xl font-black text-lg transition-all active:scale-90"
                      style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>+</button>
                  </div>
                  <div className="flex gap-1.5">
                    {[2000, 5000, 10000, 25000, 50000].map(v => (
                      <button key={v} onClick={() => setBet(v)}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95"
                        style={{
                          background: bet === v ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.05)",
                          color: bet === v ? "#4ade80" : "rgba(255,255,255,0.5)",
                          border: bet === v ? "1px solid rgba(34,197,94,0.4)" : "1px solid transparent",
                        }}>
                        {v >= 1000 ? `${v / 1000}K` : v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Potential wins */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "1 gol", val: Math.floor(bet * 1.92), color: "#4ade80" },
                    { label: "3 gol", val: Math.floor(bet * 7.68), color: "#fbbf24" },
                    { label: "5 gol 🏆", val: Math.floor(bet * 30.72), color: "#f97316" },
                  ].map(it => (
                    <div key={it.label} className="rounded-xl py-2 px-1"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>{it.label}</div>
                      <div className="font-black text-xs" style={{ color: it.color }}>+{fmt(Math.round(it.val / 100))} UZS</div>
                    </div>
                  ))}
                </div>

                <button onClick={startGame}
                  className="w-full py-4 rounded-2xl font-black text-lg tracking-wide transition-all active:scale-[0.97]"
                  style={{
                    background: "linear-gradient(135deg, #15803d, #16a34a, #15803d)",
                    color: "white",
                    boxShadow: "0 6px 24px rgba(22,163,74,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
                  }}>
                  ⚽ O'YINNI BOSHLASH
                </button>
              </motion.div>
            )}

            {/* === STARTING: spinner === */}
            {phase === "starting" && (
              <motion.div key="starting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-6">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="text-4xl">⚽</motion.div>
                <p className="font-bold text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Tayyorlanmoqda...</p>
              </motion.div>
            )}

            {/* === AIMING: Zone selection + cash out === */}
            {phase === "aiming" && (
              <motion.div key="aiming" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="px-3 pb-5 space-y-3">

                {/* Multiplier progress bar */}
                <div className="rounded-xl p-3 space-y-1.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex justify-between text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span>Joriy natija</span>
                    <span style={{ color: kickIdx > 0 ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
                      {kickIdx > 0 ? `+${fmt(Math.round(cashOutAmount / 100))} UZS (${currentMult}x)` : "Hali gol yo'q"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <motion.div
                      animate={{ width: `${(kickIdx / 5) * 100}%` }}
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #4ade80, #fbbf24)" }}
                    />
                  </div>
                  <div className="flex justify-between">
                    {MULTS.map((m, i) => (
                      <span key={i} className="text-[9px] font-black"
                        style={{ color: i < kickIdx ? "#4ade80" : i === kickIdx ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>
                        {m}x
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-center font-black text-white text-sm tracking-wide">
                  🎯 Zarb {kickIdx + 1} — Qayerga tepasiz?
                </p>

                {/* 6-zone grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  {ZONES.map(z => (
                    <motion.button
                      key={z.id}
                      onClick={() => kick(z.id)}
                      whileTap={{ scale: 0.88 }}
                      whileHover={{ scale: 1.04 }}
                      className="h-[52px] rounded-xl font-black text-2xl flex flex-col items-center justify-center gap-0.5"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1.5px solid rgba(255,255,255,0.1)",
                        color: "white",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
                      }}
                    >
                      <span>{z.label}</span>
                      <span className="text-[8px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>{z.desc}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Cash Out button */}
                {canCashOut && (
                  <motion.button
                    onClick={cashOut}
                    animate={{ boxShadow: ["0 0 12px rgba(251,191,36,0.3)", "0 0 28px rgba(251,191,36,0.7)", "0 0 12px rgba(251,191,36,0.3)"] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="w-full py-4 rounded-2xl font-black text-base tracking-wide transition-all active:scale-[0.97]"
                    style={{
                      background: "linear-gradient(135deg, #b45309, #d97706, #fbbf24, #d97706, #b45309)",
                      color: "#1c1917",
                    }}
                  >
                    <Zap className="inline w-4 h-4 mr-1 mb-0.5" />
                    CASH OUT — +{fmt(Math.round(cashOutAmount / 100))} UZS ({currentMult}x)
                  </motion.button>
                )}
              </motion.div>
            )}

            {/* === KICKING / SHOW RESULT: lock the UI === */}
            {(phase === "kicking" || phase === "show-result") && (
              <motion.div key="kicking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex justify-center items-center py-6">
                <p className="text-sm font-bold animate-pulse" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {phase === "kicking" ? "⚽ To'p uchmoqda..." : showGoal ? "🎉 Davom etmoqda..." : "😬 Davom etmoqda..."}
                </p>
              </motion.div>
            )}

            {/* === CASHED OUT === */}
            {phase === "cashed-out" && (
              <motion.div key="cashed" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="px-3 pb-5 space-y-4">
                <div className="rounded-2xl p-5 text-center space-y-3"
                  style={{ background: "linear-gradient(135deg, rgba(180,83,9,0.2), rgba(217,119,6,0.15))", border: "1.5px solid rgba(251,191,36,0.4)", boxShadow: "0 0 30px rgba(251,191,36,0.15)" }}>
                  <div className="text-5xl">💰</div>
                  <h2 className="text-xl font-black text-white">Ajoyib qaror!</h2>
                  <div className="text-3xl font-black" style={{ color: "#fbbf24" }}>
                    +{fmt(Math.round(cashOutAmount / 100))} UZS
                  </div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {kickIdx} goldan keyin olingan • {currentMult}x multiplikator
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={reset}
                    className="flex-1 py-3.5 rounded-xl font-black"
                    style={{ background: "linear-gradient(135deg, #15803d, #16a34a)", color: "white" }}>
                    🔄 Qayta o'ynash
                  </button>
                  <Link href="/casino" className="flex-1">
                    <button className="w-full py-3.5 rounded-xl font-black"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      Lobby
                    </button>
                  </Link>
                </div>
              </motion.div>
            )}

            {/* === LOST === */}
            {phase === "lost" && (
              <motion.div key="lost" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="px-3 pb-5 space-y-4">
                <div className="rounded-2xl p-5 text-center space-y-3"
                  style={{ background: "rgba(220,38,38,0.1)", border: "1.5px solid rgba(239,68,68,0.3)" }}>
                  <div className="text-5xl">🧤</div>
                  <h2 className="text-xl font-black text-white">Darvozabon tutdi!</h2>
                  <div className="text-2xl font-black" style={{ color: "#f87171" }}>−{fmt(Math.round(bet / 100))} UZS</div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {kickIdx} gol urishingizdan keyin tutildi
                  </div>
                  {kickIdx > 0 && (
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Cash out qilgan bo'lsangiz {fmt(Math.round(Math.floor(bet * currentMult) / 100))} UZS olgan bo'lardingiz
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={reset}
                    className="flex-1 py-3.5 rounded-xl font-black"
                    style={{ background: "linear-gradient(135deg, #15803d, #16a34a)", color: "white" }}>
                    🔄 Qayta o'ynash
                  </button>
                  <Link href="/casino" className="flex-1">
                    <button className="w-full py-3.5 rounded-xl font-black"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      Lobby
                    </button>
                  </Link>
                </div>
              </motion.div>
            )}

            {/* === COMPLETE (all 5 goals!) === */}
            {phase === "complete" && (
              <motion.div key="complete" initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="px-3 pb-5 space-y-4">
                <div className="rounded-2xl p-5 text-center space-y-3"
                  style={{
                    background: "linear-gradient(135deg, rgba(22,163,74,0.18), rgba(251,191,36,0.12))",
                    border: "1.5px solid rgba(251,191,36,0.5)",
                    boxShadow: "0 0 40px rgba(251,191,36,0.2)",
                  }}>
                  <motion.div animate={{ rotate: [0, -10, 10, -8, 8, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-6xl">🏆</motion.div>
                  <h2 className="text-2xl font-black text-white">MUKAMMAL NATIJA!</h2>
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>5/5 gol • Maksimal yutuq</div>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, delay: 0.4 }}
                    className="text-3xl font-black" style={{ color: "#fbbf24" }}>
                    +{fmt(Math.round(finalWin / 100))} UZS
                  </motion.div>
                  <div className="text-sm font-bold" style={{ color: "#4ade80" }}>30.72x multiplikator!</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={reset}
                    className="flex-1 py-3.5 rounded-xl font-black"
                    style={{ background: "linear-gradient(135deg, #15803d, #16a34a)", color: "white" }}>
                    🔄 Qayta o'ynash
                  </button>
                  <Link href="/casino" className="flex-1">
                    <button className="w-full py-3.5 rounded-xl font-black"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      Lobby
                    </button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
