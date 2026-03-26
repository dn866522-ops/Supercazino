import { useState, useCallback, useEffect } from "react";
import { useGamePlay } from "@/hooks/useGamePlay";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/sounds";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const TOTAL = 25;

function DiamondIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="dGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="dShine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M14 2 L26 10 L14 26 L2 10 Z" fill="url(#dGrad)" />
      <path d="M14 2 L26 10 L14 13 Z" fill="url(#dShine)" />
      <path d="M2 10 L14 13 L14 26 Z" fill="#0284c7" opacity="0.4" />
      <path d="M14 2 L26 10 L14 13 L2 10 Z" fill="none" stroke="#7dd3fc" strokeWidth="0.5" opacity="0.8" />
    </svg>
  );
}

function BombIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <defs>
        <radialGradient id="bGrad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
      </defs>
      <circle cx="14" cy="16" r="10" fill="url(#bGrad)" />
      <circle cx="10" cy="12" r="2" fill="white" fillOpacity="0.2" />
      <path d="M14 6 Q16 2 20 3 Q18 6 16 6" fill="#92400e" stroke="#78350f" strokeWidth="0.5" />
      <circle cx="20" cy="3" r="2" fill="#fbbf24" />
      <motion.circle
        cx="20" cy="3" r="3"
        fill="#f97316" fillOpacity="0.8"
        animate={{ r: [2, 4, 2], fillOpacity: [0.8, 0.4, 0.8] }}
        transition={{ duration: 0.4, repeat: Infinity }}
      />
    </svg>
  );
}

function GoldCoin({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: -40, opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black text-amber-400 whitespace-nowrap pointer-events-none"
      style={{ textShadow: '0 0 10px #f59e0b' }}
    >
      +{amount.toLocaleString()}
    </motion.div>
  );
}

export default function MinesPage() {
  const [bet, setBet] = useState(3000);
  const [minesCount, setMinesCount] = useState(3);
  const [gameActive, setGameActive] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, 'safe' | 'mine'>>({});
  const [minePositions, setMinePositions] = useState<Set<number>>(new Set());
  const [multiplier, setMultiplier] = useState(1);
  const [safeCount, setSafeCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [coinPopups, setCoinPopups] = useState<{ id: number; idx: number }[]>([]);
  const [shakeMine, setShakeMine] = useState<number | null>(null);

  const { data: user, refetch: refetchUser } = useGetMe();
  const { play } = useGamePlay();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    sounds.startAmbient('mines');
    return () => sounds.stopAmbient();
  }, []);

  const calcMultiplier = (safe: number, mines: number) => {
    if (safe === 0) return 1;
    let m = 1;
    for (let i = 0; i < safe; i++) {
      m *= (TOTAL - mines - i) / (TOTAL - i);
    }
    return parseFloat((0.97 / m).toFixed(2));
  };

  const startGame = () => {
    if ((user?.balance || 0) < bet) {
      toast({ title: "Xatolik", description: "Balans yetarli emas", variant: "destructive" });
      return;
    }
    const mines = new Set<number>();
    while (mines.size < minesCount) mines.add(Math.floor(Math.random() * TOTAL));
    setMinePositions(mines);
    setRevealed({});
    setSafeCount(0);
    setMultiplier(1);
    setGameActive(true);
    setGameOver(false);
    setCoinPopups([]);
    setShakeMine(null);
    sounds.click();
  };

  const revealCell = (idx: number) => {
    if (!gameActive || revealed[idx] || gameOver) return;
    if (minePositions.has(idx)) {
      sounds.mine();
      setShakeMine(idx);
      setTimeout(() => setShakeMine(null), 600);
      const allRevealed: Record<number, 'safe' | 'mine'> = { ...revealed };
      minePositions.forEach(m => { allRevealed[m] = 'mine'; });
      Object.keys(revealed).forEach(k => { allRevealed[Number(k)] = revealed[Number(k)]; });
      setRevealed(allRevealed);
      setGameActive(false);
      setGameOver(true);
      play({ data: { gameType: 'mines', betAmount: bet, gameData: { minesCount, selectedCells: Object.keys(revealed).map(Number), hitMine: true } } }, {
        onSuccess: () => queryClient.invalidateQueries()
      });
      toast({ title: "💥 Mina topildi!", description: "Yutqazdingiz!", variant: "destructive" });
    } else {
      sounds.reveal();
      const newSafe = safeCount + 1;
      const newMult = calcMultiplier(newSafe, minesCount);
      setSafeCount(newSafe);
      setMultiplier(newMult);
      setRevealed(prev => ({ ...prev, [idx]: 'safe' }));
      const popId = Date.now();
      setCoinPopups(prev => [...prev, { id: popId, idx }]);
      setTimeout(() => setCoinPopups(prev => prev.filter(p => p.id !== popId)), 900);
      if (newSafe % 3 === 0) sounds.coin();
    }
  };

  const cashOut = () => {
    if (!gameActive || safeCount === 0) return;
    const winAmount = bet * multiplier;
    sounds.bigWin();
    play({ data: { gameType: 'mines', betAmount: bet, gameData: { minesCount, selectedCells: Object.keys(revealed).map(Number), hitMine: false, cashOut: true, multiplier } } }, {
      onSuccess: () => queryClient.invalidateQueries()
    });
    setGameActive(false);
    setGameOver(true);
    toast({ title: `💎 Yutdingiz!`, description: `+${winAmount.toLocaleString()} UZS` });
  };

  const nextMult = calcMultiplier(safeCount + 1, minesCount);

  return (
    <div className="max-w-md mx-auto space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-2xl font-black">
          <span style={{ color: '#f59e0b' }}>💣 MINALAR</span>
        </h1>
        {gameActive && (
          <motion.span
            key={multiplier}
            initial={{ scale: 1.4, color: '#10b981' }} animate={{ scale: 1 }}
            className="ml-auto text-xl font-black"
            style={{ color: '#f59e0b', textShadow: '0 0 15px #f59e0b80' }}
          >
            {multiplier}×
          </motion.span>
        )}
      </div>

      {/* Stats bar */}
      {gameActive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex gap-3 text-sm rounded-xl p-3"
          style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <div className="flex-1 text-center">
            <div className="text-slate-400 text-xs font-semibold">XAVFSIZ</div>
            <div className="text-emerald-400 font-black">{safeCount} ta</div>
          </div>
          <div className="flex-1 text-center border-x border-white/10">
            <div className="text-slate-400 text-xs font-semibold">YUTISH</div>
            <div className="text-amber-400 font-black">{(bet * multiplier).toLocaleString()}</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-slate-400 text-xs font-semibold">KEYINGI</div>
            <div className="text-blue-400 font-black">{nextMult}×</div>
          </div>
        </motion.div>
      )}

      {/* Game Grid */}
      <div
        className="grid grid-cols-5 gap-2 p-4 rounded-2xl"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #1c0a0a 0%, #0d1117 100%)',
          border: '1px solid rgba(245,158,11,0.15)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {Array.from({ length: TOTAL }, (_, i) => {
          const cellState = revealed[i];
          const isMine = cellState === 'mine';
          const isSafe = cellState === 'safe';
          const hasCoin = coinPopups.some(p => p.idx === i);
          const isShaking = shakeMine === i;

          return (
            <div key={i} className="relative aspect-square">
              <motion.button
                onClick={() => revealCell(i)}
                whileHover={gameActive && !cellState ? { scale: 1.08, y: -2 } : {}}
                whileTap={gameActive && !cellState ? { scale: 0.92 } : {}}
                animate={isShaking ? { x: [-6, 6, -6, 6, 0], transition: { duration: 0.4 } } : {}}
                className={`w-full h-full rounded-xl flex items-center justify-center font-bold transition-all border-2 relative overflow-hidden
                  ${!cellState
                    ? (gameActive
                      ? 'cursor-pointer border-amber-900/40 hover:border-amber-500/60'
                      : 'cursor-default border-slate-700/40')
                    : isSafe
                      ? 'border-blue-400/60 cursor-default'
                      : 'border-red-500/60 cursor-default'
                  }`}
                style={{
                  background: !cellState
                    ? (gameActive
                      ? 'linear-gradient(145deg, #1e293b, #0f172a)'
                      : 'linear-gradient(145deg, #1a2333, #0a1020)')
                    : isSafe
                      ? 'linear-gradient(145deg, #0c4a6e, #0369a1)'
                      : 'linear-gradient(145deg, #7f1d1d, #991b1b)',
                  boxShadow: isSafe
                    ? '0 0 20px rgba(56,189,248,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : isMine
                      ? '0 0 20px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
                      : gameActive
                        ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.5)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                {/* Hidden cell shimmer */}
                {!cellState && gameActive && (
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 60%)' }} />
                )}
                <AnimatePresence>
                  {isSafe && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <DiamondIcon />
                    </motion.div>
                  )}
                  {isMine && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, rotate: [0, -15, 15, -10, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      <BombIcon />
                    </motion.div>
                  )}
                  {!cellState && !gameActive && (
                    <span className="text-slate-600 text-xl select-none">·</span>
                  )}
                </AnimatePresence>
              </motion.button>

              {hasCoin && (
                <GoldCoin amount={Math.round(bet * (multiplier - (safeCount > 0 ? calcMultiplier(safeCount - 1, minesCount) : 1)))} />
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <AnimatePresence mode="wait">
        {!gameActive ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-semibold">💣 MINA SONI</label>
                <div className="grid grid-cols-3 gap-1">
                  {[1, 3, 5, 10, 15, 20].map(n => (
                    <button key={n} onClick={() => setMinesCount(n)}
                      className={`py-1.5 rounded-lg text-sm font-bold border transition-all
                        ${minesCount === n ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-semibold">💰 TIKISH (UZS)</label>
                <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} className="font-bold text-center mb-2" />
                <div className="grid grid-cols-2 gap-1">
                  {[5000, 10000, 50000, 100000].map(v => (
                    <button key={v} onClick={() => setBet(v)}
                      className="py-1 rounded-lg text-xs font-bold border border-slate-700 text-slate-400 hover:border-amber-700 hover:text-amber-400 transition-all">
                      {v >= 1000 ? `${v / 1000}K` : v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Multiplier preview */}
            <div className="flex items-center justify-between text-xs text-slate-400 bg-white/5 rounded-lg px-3 py-2">
              <span>1 ta topilsa:</span>
              <span className="text-emerald-400 font-bold">{calcMultiplier(1, minesCount)}×</span>
              <span>5 ta:</span>
              <span className="text-blue-400 font-bold">{calcMultiplier(5, minesCount)}×</span>
              <span>10 ta:</span>
              <span className="text-amber-400 font-bold">{calcMultiplier(10, minesCount)}×</span>
            </div>

            <Button variant="gold" className="w-full text-lg py-6 font-black" onClick={startGame}>
              💣 O'YINNI BOSHLASH
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="playing"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(245,158,11,0.15)' }}
          >
            <Button
              variant="gold"
              className="w-full text-lg py-6 font-black"
              onClick={cashOut}
              disabled={safeCount === 0}
            >
              {safeCount === 0
                ? "💎 Biror katakni bosing..."
                : `💰 YUTISHNI OLISH — ${(bet * multiplier).toLocaleString()} UZS`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
