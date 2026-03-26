import { useState, useCallback, useEffect, useRef } from "react";
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

const ROWS = 12;
const MULTIPLIERS = [110, 41, 10, 5, 3, 1.5, 1, 0.5, 1, 1.5, 3, 5, 10, 41, 110];
const W = 340;
const S = 22;
const topPad = 28;
const rowH = 30;
const ballR = 7;
const pegR = 4;
const H = topPad + ROWS * rowH + 70;

function bx(rightMoves: number, r: number) {
  return W / 2 + (rightMoves - r / 2) * S;
}
function by(r: number) {
  return topPad + r * rowH;
}

function genPath(serverSlot: number): number[] {
  const path: number[] = [0];
  for (let r = 0; r < ROWS; r++) {
    const cur = path[r];
    const remaining = ROWS - r;
    const needed = serverSlot - cur;
    let dir: 0 | 1;
    if (needed >= remaining) dir = 1;
    else if (needed <= 0) dir = 0;
    else dir = Math.random() < 0.5 ? 0 : 1;
    path.push(cur + dir);
  }
  return path;
}

function multColor(m: number): string {
  if (m >= 41) return '#ef4444';
  if (m >= 10) return '#f97316';
  if (m >= 3)  return '#f59e0b';
  if (m >= 1.5) return '#22c55e';
  if (m >= 1)  return '#64748b';
  return '#475569';
}

function multBg(m: number): string {
  if (m >= 41) return 'rgba(239,68,68,0.15)';
  if (m >= 10) return 'rgba(249,115,22,0.12)';
  if (m >= 3)  return 'rgba(245,158,11,0.12)';
  if (m >= 1.5) return 'rgba(34,197,94,0.1)';
  return 'rgba(100,116,139,0.08)';
}

interface Ball { id: number; path: number[]; mult: number }

function PlinkoBall({ ball, onBounce, onDone }: { ball: Ball; onBounce: () => void; onDone: () => void }) {
  const cxKeys = [W / 2, ...ball.path.map((rm, r) => bx(rm, r))];
  const cyKeys = [topPad - rowH, ...ball.path.map((_, r) => by(r))];
  const times = cxKeys.map((_, i) => i / (cxKeys.length - 1));
  const col = multColor(ball.mult);

  return (
    <motion.circle
      r={ballR}
      fill={col}
      stroke="white"
      strokeWidth={1.5}
      filter="url(#ballGlow)"
      initial={{ cx: W / 2, cy: topPad - rowH, opacity: 1 }}
      animate={{ cx: cxKeys, cy: cyKeys, opacity: [1, 1, 1, 0.8, 1] }}
      transition={{ duration: ROWS * 0.26, ease: "linear", times }}
      onAnimationComplete={onDone}
    />
  );
}

export default function PlinkoPage() {
  const [bet, setBet] = useState(3000);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [dropping, setDropping] = useState(false);
  const [lastResult, setLastResult] = useState<{ mult: number; won: boolean; win: number; slot: number } | null>(null);
  const [trailPegs, setTrailPegs] = useState<Set<string>>(new Set());

  const { data: user } = useGetMe();
  const { play } = useGamePlay();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    sounds.startAmbient('plinko');
    return () => sounds.stopAmbient();
  }, []);

  const drop = useCallback(() => {
    if (dropping) return;
    if ((user?.balance || 0) < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    setDropping(true);
    setTrailPegs(new Set());

    play({ data: { gameType: "plinko", betAmount: bet, gameData: {} } }, {
      onSuccess: (data: any) => {
        const serverSlot: number = data.result?.slot ?? 7;
        const mult: number = MULTIPLIERS[serverSlot] ?? 0.5;
        const winAmount: number = data.winAmount ?? 0;
        const won: boolean = data.won;

        const path = genPath(serverSlot);
        const id = Date.now();
        setBalls(prev => [...prev, { id, path, mult }]);

        // Bounce sounds along the path
        path.forEach((_, r) => {
          setTimeout(() => {
            sounds.bounce();
            setTrailPegs(prev => {
              const next = new Set(prev);
              next.add(`${r}-${path[r] ?? 0}`);
              return next;
            });
          }, r * 260);
        });

        const duration = (ROWS + 1) * 260 + 300;
        setTimeout(() => {
          setBalls(prev => prev.filter(b => b.id !== id));
          setDropping(false);
          setLastResult({ mult, won, win: winAmount, slot: serverSlot });
          queryClient.invalidateQueries();
          setTrailPegs(new Set());
          if (mult >= 10) sounds.bigWin();
          else if (mult > 1) sounds.win();
          else sounds.lose();
          toast({
            title: mult > 1
              ? `⚡ ${mult}× — +${winAmount.toLocaleString()} UZS`
              : mult === 1
                ? '↩️ Pul qaytdi (1×)'
                : '😞 Omadsiz!',
            variant: mult > 1 ? 'default' : 'destructive',
          } as any);
        }, duration);
      },
      onError: () => {
        setDropping(false);
        toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
      },
    });
  }, [dropping, bet, user?.balance]);

  return (
    <div className="max-w-sm mx-auto space-y-3 py-2">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-2xl font-black" style={{ color: '#f59e0b' }}>⚡ PLINKO</h1>

        {lastResult && (
          <motion.span
            key={lastResult.slot}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="ml-auto text-lg font-black"
            style={{ color: multColor(lastResult.mult) }}
          >
            {lastResult.mult}×
          </motion.span>
        )}
      </div>

      {/* Board */}
      <div
        className="flex justify-center rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #030018 0%, #0a0030 50%, #020012 100%)',
          border: '2px solid rgba(139,92,246,0.2)',
          boxShadow: '0 0 50px rgba(139,92,246,0.1), inset 0 0 60px rgba(0,0,0,0.7)',
          contain: 'paint',
        }}
      >
        <svg width={W} height={H} style={{ display: 'block' }}>
          <defs>
            <filter id="ballGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="pegGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="pegGrad" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#6d28d9" />
            </radialGradient>
            <radialGradient id="pegGradLit" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
          </defs>

          {/* Background stars */}
          {Array.from({ length: 30 }, (_, i) => (
            <circle
              key={`star-${i}`}
              cx={Math.sin(i * 137.5) * 160 + W / 2}
              cy={Math.cos(i * 137.5) * (H / 2) + H / 2}
              r={Math.random() < 0.3 ? 1.2 : 0.7}
              fill="white"
              opacity={0.2 + Math.random() * 0.3}
            />
          ))}

          {/* Pegs */}
          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: r + 1 }, (_, j) => {
              const key = `${r}-${j}`;
              const isLit = trailPegs.has(key);
              return (
                <g key={key}>
                  {isLit && (
                    <circle
                      cx={bx(j, r)} cy={by(r)} r={pegR + 3}
                      fill="#f59e0b" opacity={0.3}
                      filter="url(#pegGlow)"
                    />
                  )}
                  <circle
                    cx={bx(j, r)} cy={by(r)} r={pegR}
                    fill={isLit ? 'url(#pegGradLit)' : 'url(#pegGrad)'}
                    stroke={isLit ? '#fbbf24' : '#7c3aed'}
                    strokeWidth="0.8"
                    filter={isLit ? 'url(#pegGlow)' : undefined}
                  />
                  <circle
                    cx={bx(j, r) - 1} cy={by(r) - 1} r={1.2}
                    fill="white" opacity={0.5}
                  />
                </g>
              );
            })
          )}

          {/* Balls */}
          {balls.map(ball => (
            <PlinkoBall key={ball.id} ball={ball} onBounce={() => sounds.bounce()} onDone={() => {}} />
          ))}

          {/* Multiplier buckets */}
          {MULTIPLIERS.map((m, i) => {
            const cx = W / 2 + (i - Math.floor(MULTIPLIERS.length / 2)) * S;
            const cy = by(ROWS) + 26;
            const col = multColor(m);
            const bw = S * 0.88;
            const isLast = lastResult?.slot === i;

            return (
              <g key={i}>
                <rect
                  x={cx - bw / 2} y={cy - 16}
                  width={bw} height={28}
                  rx={5}
                  fill={isLast ? col + '40' : multBg(m)}
                  stroke={col}
                  strokeWidth={isLast ? 1.5 : 0.8}
                  filter={isLast ? 'url(#ballGlow)' : undefined}
                />
                <text
                  x={cx} y={cy + 4}
                  textAnchor="middle"
                  fontSize={m >= 41 ? "7" : m >= 10 ? "8" : "9"}
                  fontWeight="bold"
                  fill={col}
                >
                  {m >= 1 ? `${m}×` : `${m}×`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Last result */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            key={lastResult.slot + lastResult.win}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center p-3 rounded-xl font-black text-lg border"
            style={{
              background: lastResult.mult > 1 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              borderColor: lastResult.mult > 1 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
              color: multColor(lastResult.mult),
            }}
          >
            {lastResult.mult > 1
              ? `⚡ ${lastResult.mult}× — +${lastResult.win.toLocaleString()} UZS`
              : lastResult.mult === 1
                ? '↩️ Pul qaytdi (1×)'
                : '😞 Omadsiz!'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(139,92,246,0.15)' }}
      >
        <label className="text-xs text-slate-400 font-semibold block">TIKISH (UZS)</label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBet(b => Math.max(1000, Math.floor(b / 2)))} disabled={dropping} className="px-3">½</Button>
          <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} className="font-black text-center text-lg" disabled={dropping} />
          <Button variant="outline" size="sm" onClick={() => setBet(b => b * 2)} disabled={dropping} className="px-3">2×</Button>
        </div>
        <div className="flex gap-2">
          {[1000, 5000, 10000, 50000].map(v => (
            <button key={v} onClick={() => setBet(v)} disabled={dropping}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-purple-900/40 text-purple-400/80 hover:border-purple-500 hover:text-purple-300 transition-all disabled:opacity-40">
              {v >= 1000 ? `${v / 1000}K` : v}
            </button>
          ))}
        </div>
        <Button
          className="w-full text-xl py-7 font-black"
          style={{
            background: dropping ? 'rgba(30,41,59,0.8)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: 'white',
            boxShadow: dropping ? 'none' : '0 0 30px rgba(168,85,247,0.4)',
          }}
          onClick={drop}
          disabled={dropping}
        >
          {dropping ? (
            <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
              ⚡ Tushmoqda...
            </motion.span>
          ) : '⚡ TASHLASH'}
        </Button>
      </div>
    </div>
  );
}
