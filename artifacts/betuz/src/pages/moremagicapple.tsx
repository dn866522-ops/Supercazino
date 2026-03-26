import { useState, useEffect, useRef, useCallback } from "react";
import { useGamePlay } from "@/hooks/useGamePlay";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/sounds";
import { Link } from "wouter";
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";

// ── Symbol definitions ──────────────────────────────────────────────────────
type SymType = 'J'|'Q'|'K'|'A'|'wild'|'red_apple'|'gold_apple'|'mini'|'minor'|'major'|'grand';
const ALL_SYMS: SymType[] = ['J','Q','K','A','wild','red_apple','gold_apple','mini','minor','major','grand'];
const SPIN_POOL: SymType[] = ['J','Q','K','A','J','Q','K','A','wild','red_apple','gold_apple'];

function isApple(s: string) {
  return ['red_apple','gold_apple','mini','minor','major','grand'].includes(s);
}

const SYM_CONF: Record<SymType, { bg: string; border: string; text: string; label: string; glow?: string }> = {
  J:          { bg:'#1e3a5f', border:'#3b82f6', text:'#93c5fd', label:'J',   glow:'#3b82f640' },
  Q:          { bg:'#3b0764', border:'#a855f7', text:'#d8b4fe', label:'Q',   glow:'#a855f740' },
  K:          { bg:'#7f1d1d', border:'#ef4444', text:'#fca5a5', label:'K',   glow:'#ef444440' },
  A:          { bg:'#713f12', border:'#f59e0b', text:'#fde68a', label:'A',   glow:'#f59e0b40' },
  wild:       { bg:'linear-gradient(135deg,#7c3aed,#db2777)', border:'#f0abfc', text:'white',   label:'WILD', glow:'#c026d360' },
  red_apple:  { bg:'#991b1b', border:'#ef4444', text:'white',   label:'🍎',  glow:'#ef444460' },
  gold_apple: { bg:'#78350f', border:'#f59e0b', text:'white',   label:'🍏',  glow:'#f59e0b80' },
  mini:       { bg:'#431407', border:'#fb923c', text:'white',   label:'🍎',  glow:'#fb923c60' },
  minor:      { bg:'#1e293b', border:'#94a3b8', text:'white',   label:'🍎',  glow:'#94a3b870' },
  major:      { bg:'#1c1100', border:'#f59e0b', text:'white',   label:'🍎',  glow:'#f59e0baa' },
  grand:      { bg:'linear-gradient(135deg,#7f1d1d,#78350f,#5b21b6)', border:'#fbbf24', text:'white', label:'🍎', glow:'#fbbf24cc' },
};

// ── Symbol Cell ──────────────────────────────────────────────────────────────
function SymCell({
  sym, value, locked, spinning, highlight, isNew
}: {
  sym: SymType; value: number; locked: boolean; spinning: boolean;
  highlight?: boolean; isNew?: boolean;
}) {
  const conf = SYM_CONF[sym];
  const apple = isApple(sym);
  const isGrand = sym === 'grand';

  return (
    <motion.div
      className="relative flex items-center justify-center rounded-lg select-none overflow-hidden"
      style={{
        background: conf.bg,
        border: `2px solid ${locked ? '#fbbf24' : conf.border}`,
        boxShadow: locked
          ? `0 0 20px #fbbf2480, 0 0 6px #fbbf24`
          : highlight
            ? `0 0 18px ${conf.glow}`
            : spinning
              ? 'none'
              : `0 0 8px ${conf.glow ?? '#00000030'}`,
        filter: spinning ? 'blur(1.5px)' : 'none',
        aspectRatio: '1/1',
        width: '100%',
      }}
      animate={
        isNew ? { scale: [0.7, 1.15, 1], opacity: [0, 1, 1] } :
        locked ? { scale: [1, 1.04, 1] } : {}
      }
      transition={isNew ? { duration: 0.4, type:'spring' } : { duration: 1.5, repeat: Infinity }}
    >
      {/* Shimmer on locked apple */}
      {locked && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, transparent 60%)' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      {/* Grand jackpot glow */}
      {isGrand && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.3),rgba(168,85,247,0.3))' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.7, repeat: Infinity }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center justify-center gap-0.5">
        {/* Symbol label */}
        <div
          className="font-black leading-none"
          style={{
            color: conf.text,
            fontSize: sym === 'wild' ? '10px' : apple ? '18px' : '16px',
            fontFamily: apple ? 'inherit' : 'serif',
            textShadow: `0 0 8px ${conf.glow ?? conf.border}`,
          }}
        >
          {sym === 'J' ? 'J' : sym === 'Q' ? 'Q' : sym === 'K' ? 'K' : sym === 'A' ? 'A' :
           sym === 'wild' ? 'WILD' : conf.label}
        </div>

        {/* Jackpot tier badge */}
        {(sym === 'mini' || sym === 'minor' || sym === 'major' || sym === 'grand') && (
          <div
            className="text-[7px] font-black px-1 py-0.5 rounded mt-0.5"
            style={{
              background: sym === 'grand' ? '#fbbf24' : sym === 'major' ? '#f59e0b' : sym === 'minor' ? '#94a3b8' : '#fb923c',
              color: sym === 'minor' ? '#1e293b' : '#000',
            }}
          >
            {sym === 'grand' ? 'GRAND' : sym === 'major' ? 'MAJOR' : sym === 'minor' ? 'MINOR' : 'MINI'}
          </div>
        )}

        {/* Gold apple multiplier */}
        {sym === 'gold_apple' && value > 0 && (
          <div className="text-[8px] font-black text-amber-300 bg-black/40 px-1 rounded">
            x{Math.round(value / Math.max(1, value / 10))}
          </div>
        )}

        {/* Apple value in hold & win mode */}
        {locked && apple && value > 0 && (
          <div
            className="text-[9px] font-black mt-0.5 px-1 rounded"
            style={{ background:'rgba(0,0,0,0.5)', color:'#fbbf24' }}
          >
            {value.toLocaleString()}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Jackpot Bar ──────────────────────────────────────────────────────────────
function JackpotBar({ bet, winner }: { bet: number; winner: string | null }) {
  const tiers = [
    { key: 'major',  label: 'MAJOR',  mult: 25,  colors: { from:'#78350f', to:'#3f1f00', border:'#f59e0b', text:'#fde68a' } },
    { key: 'minor',  label: 'MINOR',  mult: 10,  colors: { from:'#1e293b', to:'#0f172a', border:'#94a3b8', text:'#e2e8f0' } },
    { key: 'mini',   label: 'MINI',   mult: 4,   colors: { from:'#431407', to:'#1c0a00', border:'#fb923c', text:'#fed7aa' } },
    { key: 'gold',   label: 'GOLD',   mult: 2,   colors: { from:'#1c1100', to:'#0a0800', border:'#fbbf24', text:'#fef08a' } },
  ];
  return (
    <div className="grid grid-cols-4 gap-1 mb-2">
      {tiers.map(t => (
        <motion.div
          key={t.key}
          className="relative rounded-lg p-1.5 text-center overflow-hidden"
          style={{
            background: `linear-gradient(180deg, ${t.colors.from}, ${t.colors.to})`,
            border: `1.5px solid ${t.colors.border}`,
            boxShadow: winner === t.key ? `0 0 25px ${t.colors.border}` : `0 0 5px ${t.colors.border}40`,
          }}
          animate={winner === t.key ? { scale: [1, 1.1, 1], boxShadow: [`0 0 25px ${t.colors.border}`, `0 0 50px ${t.colors.border}`, `0 0 25px ${t.colors.border}`] } : {}}
          transition={{ duration: 0.5, repeat: winner === t.key ? Infinity : 0 }}
        >
          {winner === t.key && (
            <motion.div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle, ${t.colors.border}30 0%, transparent 70%)` }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}
          <div className="relative z-10">
            <div className="text-[9px] font-black" style={{ color: t.colors.border }}>{t.label}</div>
            <div className="text-[11px] font-black" style={{ color: t.colors.text }}>
              {(bet * t.mult).toLocaleString()}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Hold & Win Overlay ───────────────────────────────────────────────────────
function HoldWinBanner({ lives, total, bet }: { lives: number; total: number; bet: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-x-0 top-2 z-30 flex justify-between items-center px-3 pointer-events-none"
    >
      <div
        className="px-3 py-1.5 rounded-xl font-black text-sm text-center"
        style={{ background: 'linear-gradient(135deg,#92400e,#78350f)', border:'2px solid #fbbf24', color:'#fef08a', boxShadow:'0 0 20px #fbbf2460' }}
      >
        <div className="text-[10px]">QOLGAN</div>
        <div className="text-2xl leading-none">{lives}</div>
      </div>
      <motion.div
        className="px-4 py-2 rounded-xl font-black text-center"
        style={{ background:'linear-gradient(135deg,#1a3a0f,#0d2006)', border:'2px solid #22c55e', color:'#86efac', boxShadow:'0 0 20px #22c55e40' }}
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <div className="text-[10px]">YUTISH</div>
        <div className="text-lg leading-none">{total.toLocaleString()} UZS</div>
      </motion.div>
    </motion.div>
  );
}

// ── Win Lines Overlay ────────────────────────────────────────────────────────
function WinLinesOverlay({ lines }: { lines: { line: number[]; sym: string }[] }) {
  if (!lines.length) return null;
  const cellW = 100 / 5;
  const cellH = 100 / 4;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
      {lines.map((l, li) => {
        const pts = l.line.map(idx => {
          const col = idx % 5;
          const row = Math.floor(idx / 5);
          return `${col * cellW + cellW / 2},${row * cellH + cellH / 2}`;
        }).join(' ');
        return (
          <motion.polyline
            key={li}
            points={pts}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="0.8"
            strokeOpacity="0.7"
            strokeDasharray="3,1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 0.8, 0.5] }}
            transition={{ duration: 0.6, delay: li * 0.1 }}
          />
        );
      })}
    </svg>
  );
}

// ── Main Game ───────────────────────────────────────────────────────────────
type Phase = 'idle' | 'spinning' | 'result' | 'holdwin' | 'jackpot';

const BET_STEPS = [3000, 5000, 10000, 25000, 50000, 100000, 500000, 1000000, 2000000, 4000000];

export default function MoreMagicApplePage() {
  const [bet, setBet] = useState(3000);
  const [phase, setPhase] = useState<Phase>('idle');
  const [grid, setGrid] = useState<SymType[]>(Array(20).fill('J'));
  const [values, setValues] = useState<number[]>(Array(20).fill(0));
  const [lockedCells, setLockedCells] = useState<Set<number>>(new Set());
  const [newCells, setNewCells] = useState<Set<number>>(new Set());
  const [spinningCols, setSpinningCols] = useState<Set<number>>(new Set([0,1,2,3,4]));
  const [winLines, setWinLines] = useState<{ line: number[]; sym: string }[]>([]);
  const [totalWin, setTotalWin] = useState(0);
  const [holdLives, setHoldLives] = useState(3);
  const [jackpotWinner, setJackpotWinner] = useState<string | null>(null);
  const [respinHistory, setRespinHistory] = useState<any[]>([]);
  const [respinStep, setRespinStep] = useState(0);
  const [confetti, setConfetti] = useState<{id:number;x:number;color:string}[]>([]);

  const { data: user } = useGetMe();
  const { play } = useGamePlay();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const spinTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Fast spin animation — cycles random symbols
  const spinInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [spinGrid, setSpinGrid] = useState<SymType[]>(Array(20).fill('J'));

  const clearTimers = () => {
    spinTimers.current.forEach(clearTimeout);
    spinTimers.current = [];
    if (spinInterval.current) { clearInterval(spinInterval.current); spinInterval.current = null; }
  };

  useEffect(() => {
    // Initial nice grid
    setGrid(['A','K','Q','J','A','wild','red_apple','K','Q','J','A','gold_apple','K','Q','wild','J','A','K','Q','J']);
    return clearTimers;
  }, []);

  const spawnConfetti = () => {
    const bits = Array.from({ length: 20 }, (_, i) => ({
      id: i, x: Math.random() * 100,
      color: ['#fbbf24','#f59e0b','#ef4444','#22c55e','#a855f7'][Math.floor(Math.random() * 5)],
    }));
    setConfetti(bits);
    setTimeout(() => setConfetti([]), 2500);
  };

  const startSpin = () => {
    if (phase === 'spinning' || phase === 'holdwin') return;
    if ((user?.balance || 0) < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }

    clearTimers();
    setPhase('spinning');
    setWinLines([]);
    setLockedCells(new Set());
    setNewCells(new Set());
    setJackpotWinner(null);
    setTotalWin(0);
    setRespinHistory([]);
    setRespinStep(0);

    const allCols = new Set([0,1,2,3,4]);
    setSpinningCols(allCols);

    // Fast cycling animation
    spinInterval.current = setInterval(() => {
      setSpinGrid(Array.from({ length: 20 }, () => SPIN_POOL[Math.floor(Math.random() * SPIN_POOL.length)]));
    }, 80);
    sounds.spin();

    // Call backend
    play({ data: { gameType: 'moremagicapple', betAmount: bet, gameData: {} } }, {
      onSuccess: (data: any) => {
        const res = data.result ?? {};
        const serverGrid: SymType[] = res.grid ?? Array(20).fill('J');
        const serverVals: number[] = res.values ?? Array(20).fill(0);

        // Reveal columns one by one (left to right) with stagger
        [0,1,2,3,4].forEach((col, ci) => {
          const t = setTimeout(() => {
            sounds.coin();
            setSpinningCols(prev => { const next = new Set(prev); next.delete(col); return next; });
            setGrid(prev => {
              const next = [...prev];
              for (let row = 0; row < 4; row++) { const idx = row * 5 + col; next[idx] = serverGrid[idx]; }
              return next;
            });
            setValues(prev => {
              const next = [...prev];
              for (let row = 0; row < 4; row++) { const idx = row * 5 + col; next[idx] = serverVals[idx]; }
              return next;
            });
          }, 600 + ci * 350);
          spinTimers.current.push(t);
        });

        // After last column stops
        const afterReveal = setTimeout(() => {
          if (spinInterval.current) { clearInterval(spinInterval.current); spinInterval.current = null; }
          setSpinningCols(new Set());
          setGrid(serverGrid);
          setValues(serverVals);

          if (res.triggerHoldWin) {
            // Lock apple cells immediately
            const appleSet = new Set<number>(res.appleIdxs ?? []);
            setLockedCells(appleSet);
            const histArr: any[] = res.history ?? [];
            setRespinHistory(histArr);

            const t2 = setTimeout(() => {
              setPhase('holdwin');
              setHoldLives(3);
              sounds.bigWin();
            }, 400);
            spinTimers.current.push(t2);
          } else if (res.regWin > 0 || data.won) {
            // Regular payline win
            setWinLines(res.winLines ?? []);
            setTotalWin(data.winAmount ?? 0);
            setPhase('result');
            sounds.win();
            queryClient.invalidateQueries();
          } else {
            setPhase('result');
            sounds.lose();
            queryClient.invalidateQueries();
          }
        }, 600 + 4 * 350 + 300);
        spinTimers.current.push(afterReveal);
      },
      onError: () => {
        clearTimers();
        if (spinInterval.current) { clearInterval(spinInterval.current); spinInterval.current = null; }
        setPhase('idle');
        toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
      },
    });
  };

  // Hold & Win respin automation
  useEffect(() => {
    if (phase !== 'holdwin') return;
    if (respinStep >= respinHistory.length) {
      // Done - show final result
      const finalStep = respinHistory[respinHistory.length - 1];
      if (finalStep) {
        setGrid(finalStep.grid);
        setValues(finalStep.values);
        setLockedCells(new Set(finalStep.newAppleIdxs));
      }
      const jackpot = respinHistory.length > 0
        ? (respinHistory[respinHistory.length - 1]?.grid?.includes('grand') ? 'grand'
          : respinHistory[respinHistory.length - 1]?.grid?.filter((s: string)=>s==='major').length >= 2 ? 'major' : null)
        : null;

      const total = (finalStep?.values ?? values).reduce((a: number, b: number) => a + b, 0);
      setTotalWin(total);
      setJackpotWinner(jackpot);

      const t = setTimeout(() => {
        if (jackpot) {
          setPhase('jackpot');
          sounds.bigWin();
          spawnConfetti();
        } else {
          setPhase('result');
          if (total > 0) { sounds.bigWin(); spawnConfetti(); }
          else sounds.lose();
        }
        queryClient.invalidateQueries();
      }, 600);
      spinTimers.current.push(t);
      return;
    }

    // Play next respin step after a delay
    const t = setTimeout(() => {
      const step = respinHistory[respinStep];
      if (!step) return;

      setHoldLives(step.livesLeft);
      const prevLocked = respinStep > 0 ? new Set(respinHistory[respinStep - 1].newAppleIdxs) : lockedCells;
      const nextLocked = new Set<number>(step.newAppleIdxs);
      const newlyLocked = new Set<number>([...nextLocked].filter(i => !prevLocked.has(i)));

      setNewCells(newlyLocked);
      setGrid(step.grid);
      setValues(step.values);
      setLockedCells(nextLocked);

      if (newlyLocked.size > 0) sounds.coin();

      const t2 = setTimeout(() => {
        setNewCells(new Set());
        setRespinStep(s => s + 1);
      }, 800);
      spinTimers.current.push(t2);
    }, 900);
    spinTimers.current.push(t);
  }, [phase, respinStep]);

  const displayGrid = (phase === 'spinning' && spinningCols.size === 5) ? spinGrid : grid;
  const betUp   = () => { const i = BET_STEPS.findIndex(b => b > bet); setBet(i === -1 ? BET_STEPS.at(-1)! : BET_STEPS[i]); };
  const betDown = () => { const i = [...BET_STEPS].reverse().findIndex(b => b < bet); setBet(i === -1 ? BET_STEPS[0] : BET_STEPS[BET_STEPS.length - 1 - i]); };

  const canSpin = phase === 'idle' || phase === 'result';

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #0d2a06 0%, #050f02 60%, #010800 100%)',
      }}
    >
      {/* Forest atmosphere particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 12 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 3 + Math.random() * 4,
              height: 3 + Math.random() * 4,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: '#22c55e',
              opacity: 0.15,
            }}
            animate={{ y: [-20, 20, -20], opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 4 }}
          />
        ))}
      </div>

      {/* Confetti */}
      <AnimatePresence>
        {confetti.map(c => (
          <motion.div
            key={c.id}
            className="absolute w-3 h-3 rounded-sm pointer-events-none z-50"
            style={{ left: `${c.x}%`, top: -20, background: c.color }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{ y: '110vh', rotate: 720, opacity: [1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: 'easeIn' }}
          />
        ))}
      </AnimatePresence>

      <div className="max-w-lg mx-auto px-3 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Link href="/casino"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-lg font-black leading-none" style={{ color:'#fbbf24', textShadow:'0 0 15px #fbbf2460' }}>
              🍎 MORE MAGIC APPLE
            </h1>
            <p className="text-xs text-green-500/60">Hold {'&'} Win • Grand 1000×</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-400">BALANS</div>
            <div className="text-sm font-black text-amber-400">
              {(user?.balance ?? 0).toLocaleString()} UZS
            </div>
          </div>
        </div>

        {/* Jackpot bar */}
        <JackpotBar bet={bet} winner={jackpotWinner} />

        {/* ── Main reel grid ────────────────────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden mb-3"
          style={{
            background: 'linear-gradient(180deg,#0a1f05 0%,#061002 100%)',
            border: phase === 'holdwin' ? '2px solid #fbbf24' : '2px solid rgba(34,197,94,0.2)',
            boxShadow: phase === 'holdwin'
              ? '0 0 40px rgba(251,191,36,0.3), inset 0 0 30px rgba(0,0,0,0.5)'
              : 'inset 0 0 40px rgba(0,0,0,0.5)',
            padding: '10px 8px 8px',
          }}
        >
          {/* Hold & Win lives + total overlay */}
          {phase === 'holdwin' && (
            <HoldWinBanner lives={holdLives} total={totalWin} bet={bet} />
          )}

          {/* Hold & Win banner */}
          {phase === 'holdwin' && (
            <motion.div
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
              className="absolute inset-x-0 top-0 z-20 text-center py-1 font-black text-sm"
              style={{ background:'linear-gradient(90deg,transparent,#92400e,#fbbf24,#92400e,transparent)', color:'#fef08a', letterSpacing:'3px' }}
            >
              HOLD {'&'} WIN
            </motion.div>
          )}

          {/* Grid */}
          <div
            className="grid gap-1.5 pt-1"
            style={{ gridTemplateColumns:'repeat(5,1fr)', gridTemplateRows:'repeat(4,1fr)', marginTop: phase === 'holdwin' ? '28px' : 0 }}
          >
            {displayGrid.map((sym, idx) => {
              const col = idx % 5;
              const isSpinning = spinningCols.has(col);
              return (
                <SymCell
                  key={idx}
                  sym={sym}
                  value={values[idx]}
                  locked={lockedCells.has(idx)}
                  spinning={isSpinning}
                  highlight={winLines.some(l => l.line.includes(idx))}
                  isNew={newCells.has(idx)}
                />
              );
            })}
          </div>

          {/* Win lines overlay */}
          {phase === 'result' && <WinLinesOverlay lines={winLines} />}

          {/* Column separators */}
          <div className="absolute inset-y-0 pointer-events-none" style={{ left:'22.5%', width:1, background:'rgba(255,255,255,0.04)' }} />
          <div className="absolute inset-y-0 pointer-events-none" style={{ left:'42%', width:1, background:'rgba(255,255,255,0.04)' }} />
          <div className="absolute inset-y-0 pointer-events-none" style={{ left:'61.5%', width:1, background:'rgba(255,255,255,0.04)' }} />
          <div className="absolute inset-y-0 pointer-events-none" style={{ left:'81%', width:1, background:'rgba(255,255,255,0.04)' }} />
        </div>

        {/* Jackpot celebration */}
        <AnimatePresence>
          {phase === 'jackpot' && jackpotWinner && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="mb-3 text-center py-5 rounded-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg,#7f1d1d,#78350f,#1c1100)',
                border:'2px solid #fbbf24',
                boxShadow:'0 0 60px #fbbf2450',
              }}
            >
              <motion.div
                animate={{ scale:[1,1.05,1] }}
                transition={{ duration:0.5, repeat:Infinity }}
                className="text-4xl font-black"
                style={{ color:'#fef08a', textShadow:'0 0 30px #fbbf24' }}
              >
                🏆 {jackpotWinner.toUpperCase()} JACKPOT!
              </motion.div>
              <div className="text-2xl font-black text-white mt-1">
                +{totalWin.toLocaleString()} UZS
              </div>
              <Button variant="gold" className="mt-3 px-8" onClick={() => { setPhase('idle'); setJackpotWinner(null); setTotalWin(0); }}>
                OLISH
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Win result */}
        <AnimatePresence>
          {phase === 'result' && totalWin > 0 && (
            <motion.div
              key={totalWin}
              initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ opacity:0 }}
              className="mb-3 text-center py-3 rounded-xl"
              style={{
                background:'linear-gradient(135deg,rgba(22,101,52,0.5),rgba(6,78,59,0.4))',
                border:'2px solid rgba(34,197,94,0.4)',
                boxShadow:'0 0 30px rgba(34,197,94,0.2)',
              }}
            >
              <div className="text-xs text-green-400 font-semibold">YUTISH</div>
              <motion.div
                className="text-3xl font-black text-green-300"
                animate={{ scale:[1,1.05,1] }}
                transition={{ duration:0.4, repeat:3 }}
              >
                +{totalWin.toLocaleString()} UZS
              </motion.div>
              {winLines.length > 0 && (
                <div className="text-xs text-green-500/70 mt-1">{winLines.length} ta payline</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom controls ────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-3 space-y-3"
          style={{ background:'rgba(5,15,2,0.9)', border:'1px solid rgba(34,197,94,0.15)' }}
        >
          {/* Bet input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 font-semibold">TIKISH MIQDORI</span>
              <span className="text-xs text-slate-500">min 3,000 — max 4,000,000 so'm</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={betDown} disabled={!canSpin}
                className="w-10 h-11 rounded-xl border border-green-900/50 text-green-400 hover:bg-green-900/20 flex items-center justify-center disabled:opacity-30 transition-all flex-shrink-0">
                <ChevronDown className="w-5 h-5" />
              </button>
              <div className="relative flex-1">
                <input
                  type="number"
                  value={bet}
                  min={3000}
                  max={4000000}
                  disabled={!canSpin}
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (!isNaN(v)) setBet(v);
                  }}
                  onBlur={e => {
                    const v = Number(e.target.value);
                    setBet(Math.min(4000000, Math.max(3000, isNaN(v) ? 3000 : v)));
                  }}
                  className="w-full h-11 rounded-xl text-center font-black text-xl pr-14 disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(34,197,94,0.3)',
                    color: '#fbbf24',
                    outline: 'none',
                    appearance: 'textfield',
                  }}
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none"
                  style={{ color: 'rgba(148,163,184,0.6)' }}
                >
                  so'm
                </span>
              </div>
              <button onClick={betUp} disabled={!canSpin}
                className="w-10 h-11 rounded-xl border border-green-900/50 text-green-400 hover:bg-green-900/20 flex items-center justify-center disabled:opacity-30 transition-all flex-shrink-0">
                <ChevronUp className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick bets */}
          <div>
            <div className="text-xs text-slate-400 font-semibold mb-1.5">TEZKOR TIKISH</div>
            <div className="grid grid-cols-5 gap-1.5">
              {[3000, 10000, 50000, 500000, 4000000].map(v => (
                <button key={v} onClick={() => canSpin && setBet(v)} disabled={!canSpin}
                  className="py-2 rounded-xl text-xs font-black border transition-all disabled:opacity-30"
                  style={{
                    background: bet === v ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)',
                    borderColor: bet === v ? '#22c55e' : 'rgba(255,255,255,0.08)',
                    color: bet === v ? '#86efac' : '#64748b',
                  }}
                >
                  {v >= 1000000 ? `${v/1000000}M` : v >= 1000 ? `${v/1000}K` : v}
                </button>
              ))}
            </div>
          </div>

          {/* SPIN button */}
          <motion.button
            whileTap={canSpin ? { scale: 0.96 } : {}}
            onClick={startSpin}
            disabled={!canSpin}
            className="w-full py-5 rounded-xl font-black text-xl tracking-widest relative overflow-hidden disabled:cursor-not-allowed"
            style={{
              background: canSpin
                ? 'linear-gradient(135deg, #15803d, #166534, #14532d)'
                : 'rgba(30,41,59,0.5)',
              border: canSpin ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.05)',
              color: canSpin ? 'white' : '#475569',
              boxShadow: canSpin ? '0 0 30px rgba(34,197,94,0.3)' : 'none',
            }}
          >
            {canSpin ? (
              <>
                <motion.div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)' }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
                <span className="relative z-10">🍎 AYLANTIRISH</span>
              </>
            ) : (
              <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                {phase === 'spinning' ? '⏳ Aylanmoqda...' : phase === 'holdwin' ? '🔒 HOLD & WIN...' : '...'}
              </motion.span>
            )}
          </motion.button>

          {/* Info row */}
          <div className="flex justify-between text-xs text-slate-500">
            <span>20 payline</span>
            <span>Hold {'&'} Win: 6+ olma</span>
            <span>Grand: x1000</span>
          </div>
        </div>

        {/* Paytable hint */}
        <div className="mt-3 rounded-xl p-3" style={{ background:'rgba(5,15,2,0.6)', border:'1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-xs text-slate-400 font-semibold mb-2">TO'LOV JADVALI</div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            {[
              { sym:'🍎', label:'3+ olma', val:'3–15×' },
              { sym:'🔮', label:'Wild', val:'2–12×' },
              { sym:'A', label:'Ace', val:'2–8×' },
              { sym:'K', label:'King', val:'1–6×' },
              { sym:'Q', label:'Queen', val:'1–5×' },
              { sym:'J', label:'Jack', val:'1–4×' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-1 bg-white/5 rounded px-2 py-1">
                <span>{row.sym}</span>
                <span className="text-slate-400">{row.label}</span>
                <span className="ml-auto text-amber-400 font-bold">{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
