import { useState, useEffect, useRef } from "react";
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

type GameState = 'waiting' | 'running' | 'crashed' | 'cashedOut';

function StarField() {
  const stars = useRef(
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.7 + 0.3,
      duration: 2 + Math.random() * 4,
    }))
  ).current;
  return (
    <div className="absolute inset-0 overflow-hidden">
      {stars.map(s => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: s.opacity }}
          animate={{ opacity: [s.opacity, s.opacity * 0.3, s.opacity] }}
          transition={{ duration: s.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function RocketSVG({ state }: { state: GameState }) {
  return (
    <svg width="64" height="100" viewBox="0 0 64 100" fill="none">
      <defs>
        <radialGradient id="rocketGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rocketBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Flame */}
      {state === 'running' && (
        <motion.ellipse
          cx="32" cy="88" rx="10" ry="18"
          fill="url(#flameGrad)"
          animate={{ ry: [14, 22, 14], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        />
      )}
      {/* Body */}
      <ellipse cx="32" cy="55" rx="14" ry="28" fill="url(#rocketBody)" />
      {/* Nose cone */}
      <path d="M32 10 L18 42 Q32 36 46 42 Z" fill="#e2e8f0" />
      {/* Window */}
      <circle cx="32" cy="52" r="7" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1.5" />
      <circle cx="30" cy="50" r="2.5" fill="white" fillOpacity="0.6" />
      {/* Wings */}
      <path d="M18 70 L8 88 L20 80 Z" fill="#94a3b8" />
      <path d="M46 70 L56 88 L44 80 Z" fill="#94a3b8" />
      {/* Exhaust pipes */}
      <rect x="25" y="80" width="5" height="8" rx="2" fill="#64748b" />
      <rect x="34" y="80" width="5" height="8" rx="2" fill="#64748b" />
      {/* Glow when running */}
      {state === 'running' && (
        <ellipse cx="32" cy="55" rx="28" ry="38" fill="url(#rocketGlow)" />
      )}
    </svg>
  );
}

function ChartLine({ multiplier, state }: { multiplier: number; state: GameState }) {
  const W = 340, H = 180;
  const points: string[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * ((multiplier - 1) / 3);
    const x = (i / steps) * W;
    const y = H - Math.min((Math.log(1 + t * 3) / Math.log(multiplier)) * H * 0.85, H - 10);
    points.push(`${x},${y}`);
  }
  const color = state === 'crashed' ? '#ef4444' : state === 'cashedOut' ? '#10b981' : '#f59e0b';
  return (
    <svg width={W} height={H} style={{ position: 'absolute', bottom: 0, left: 0, opacity: 0.7 }}>
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <polygon points={`0,${H} ${points.join(' ')} ${W},${H}`} fill="url(#chartFill)" />
    </svg>
  );
}

export default function CrashPage() {
  const [bet, setBet] = useState(3000);
  const [autoCashOut, setAutoCashOut] = useState(2.0);
  const [state, setState] = useState<GameState>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [history, setHistory] = useState<number[]>([3.2, 1.5, 7.8, 1.1, 2.4, 5.6, 1.3, 11.2]);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; angle: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const outcomeRef = useRef<{ won: boolean; cashOutAt: number; cp: number; winAmount: number } | null>(null);

  const { data: user } = useGetMe();
  const { play } = useGamePlay();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    sounds.startAmbient('crash');
    return () => {
      sounds.stopAmbient();
      clearInterval(intervalRef.current);
    };
  }, []);

  const triggerExplosion = () => {
    const pts = Array.from({ length: 16 }, (_, i) => ({
      id: i, x: 50, y: 50, angle: (i / 16) * 360
    }));
    setParticles(pts);
    setTimeout(() => setParticles([]), 1000);
  };

  const startGame = () => {
    if ((user?.balance || 0) < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    setMultiplier(1.0);
    setState('running');
    setParticles([]);

    play({ data: { gameType: 'crash', betAmount: bet, gameData: { cashOutAt: autoCashOut } } }, {
      onSuccess: (data: any) => {
        const serverCrash: number = data.result?.crashPoint ?? 1.5;
        const didWin: boolean = data.won;
        const cashOutMult: number = didWin ? autoCashOut : 0;
        const winAmt: number = data.winAmount ?? 0;

        outcomeRef.current = { won: didWin, cashOutAt: cashOutMult, cp: serverCrash, winAmount: winAmt };
        setCrashPoint(serverCrash);

        const startTime = Date.now();
        let lastTickSec = -1;

        intervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          const current = parseFloat(Math.pow(Math.E, 0.2 * elapsed).toFixed(2));
          setMultiplier(current);
          const sec = Math.floor(elapsed);
          if (sec !== lastTickSec) { lastTickSec = sec; sounds.tick(); }

          const outcome = outcomeRef.current;
          if (!outcome) return;

          if (outcome.won && current >= outcome.cashOutAt) {
            clearInterval(intervalRef.current);
            setMultiplier(outcome.cashOutAt);
            setState('cashedOut');
            sounds.bigWin();
            setHistory(prev => [outcome.cp, ...prev.slice(0, 9)]);
            queryClient.invalidateQueries();
            toast({ title: `🎉 ${outcome.cashOutAt.toFixed(2)}x da olindi!`, description: `+${outcome.winAmount.toLocaleString()} UZS` });
          } else if (!outcome.won && current >= outcome.cp) {
            clearInterval(intervalRef.current);
            setMultiplier(outcome.cp);
            setState('crashed');
            sounds.crash();
            sounds.explosion();
            triggerExplosion();
            setHistory(prev => [outcome.cp, ...prev.slice(0, 9)]);
            queryClient.invalidateQueries();
            toast({ title: `💥 CRASH! ${outcome.cp.toFixed(2)}x`, description: "Yutqazdingiz", variant: "destructive" });
          }
        }, 80);
      },
      onError: () => {
        setState('waiting');
        toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
      }
    });
  };

  const multColor = state === 'crashed' ? '#ef4444' : state === 'cashedOut' ? '#10b981' : '#f59e0b';

  return (
    <div className="max-w-md mx-auto space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-2xl font-black tracking-wide">
          <span style={{ color: '#f59e0b' }}>🚀 CRASH</span>
        </h1>
        <span className="ml-auto text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">LIVE</span>
      </div>

      {/* History */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {history.map((h, i) => (
          <motion.span
            key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
            className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap border
              ${h < 2 ? 'bg-red-950 text-red-300 border-red-800' : h < 5 ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}`}>
            {h.toFixed(2)}x
          </motion.span>
        ))}
      </div>

      {/* Main Game Area */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          height: 280,
          background: 'radial-gradient(ellipse at 50% 0%, #0c1445 0%, #030010 70%)',
          border: `2px solid ${state === 'crashed' ? '#7f1d1d' : state === 'cashedOut' ? '#064e3b' : '#1e3a5f'}`,
          boxShadow: `0 0 40px ${state === 'crashed' ? '#ef444420' : state === 'cashedOut' ? '#10b98120' : '#3b82f620'}`,
        }}
      >
        <StarField />
        <ChartLine multiplier={multiplier} state={state} />

        {/* Explosion particles */}
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              className="absolute w-2 h-2 rounded-full bg-orange-400"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              initial={{ scale: 1, opacity: 1, x: 0, y: 0 }}
              animate={{
                scale: 0,
                opacity: 0,
                x: Math.cos(p.angle * Math.PI / 180) * 80,
                y: Math.sin(p.angle * Math.PI / 180) * 80,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
          ))}
        </AnimatePresence>

        {/* Rocket */}
        <motion.div
          className="absolute"
          style={{ bottom: 30, right: 40 }}
          animate={
            state === 'running' ? { y: [-4, 4, -4], x: [-2, 2, -2], rotate: [-3, 3, -3] } :
            state === 'crashed' ? { rotate: 90, y: 50, opacity: 0 } : {}
          }
          transition={state === 'running' ? { duration: 0.4, repeat: Infinity } : { duration: 0.3 }}
        >
          <RocketSVG state={state} />
        </motion.div>

        {/* Big Multiplier */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="text-center"
            animate={state === 'running' ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <motion.div
              key={multiplier.toFixed(1)}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="text-7xl font-black font-mono drop-shadow-2xl leading-none"
              style={{ color: multColor, textShadow: `0 0 40px ${multColor}60` }}
            >
              {multiplier.toFixed(2)}x
            </motion.div>
            <div className="text-sm mt-2 font-semibold" style={{ color: `${multColor}cc` }}>
              {state === 'waiting' && "O'yin kutilmoqda..."}
              {state === 'running' && "🚀 Uchmoqda!"}
              {state === 'crashed' && `💥 ${crashPoint.toFixed(2)}x da CRASH!`}
              {state === 'cashedOut' && `✅ ${multiplier.toFixed(2)}x da olindi!`}
            </div>
          </motion.div>
        </div>

        {/* Win flash */}
        <AnimatePresence>
          {state === 'cashedOut' && (
            <motion.div
              initial={{ opacity: 0.6 }} animate={{ opacity: 0 }}
              className="absolute inset-0 bg-emerald-500 rounded-2xl"
              transition={{ duration: 0.5 }}
            />
          )}
          {state === 'crashed' && (
            <motion.div
              initial={{ opacity: 0.6 }} animate={{ opacity: 0 }}
              className="absolute inset-0 bg-red-600 rounded-2xl"
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block font-semibold">TIKISH (UZS)</label>
            <div className="flex gap-1">
              <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))}
                disabled={state === 'running'} className="font-bold text-center" />
              <Button variant="outline" size="sm" onClick={() => setBet(b => b * 2)} disabled={state === 'running'} className="px-2">2×</Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block font-semibold">AUTO CASHOUT</label>
            <div className="flex gap-1">
              <Input type="number" step="0.1" value={autoCashOut} onChange={e => setAutoCashOut(Number(e.target.value))}
                disabled={state === 'running'} className="font-bold text-center" />
              <span className="flex items-center text-amber-400 font-bold text-sm px-1">×</span>
            </div>
          </div>
        </div>

        {/* Quick bets */}
        <div className="flex gap-2">
          {[1000, 5000, 10000, 50000].map(v => (
            <button key={v} onClick={() => setBet(v)} disabled={state === 'running'}
              className="flex-1 text-xs py-1.5 rounded-lg font-bold transition-all border border-amber-800/50 text-amber-400 hover:bg-amber-900/30 disabled:opacity-40">
              {v >= 1000 ? `${v / 1000}K` : v}
            </button>
          ))}
        </div>

        {state === 'waiting' || state === 'crashed' || state === 'cashedOut' ? (
          <Button variant="gold" className="w-full text-lg py-6 font-black" onClick={startGame}>
            {state === 'waiting' ? "🚀 O'YINNI BOSHLASH" : "🔄 QAYTA O'YNASH"}
          </Button>
        ) : (
          <div className="w-full text-lg py-5 rounded-xl text-center font-black text-slate-400 border border-slate-700"
            style={{ background: 'rgba(30,41,59,0.8)' }}>
            ⏳ Natija kutilmoqda...
          </div>
        )}
      </div>
    </div>
  );
}
