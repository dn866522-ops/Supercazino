import { useState, useEffect } from "react";
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

// European roulette number sequence (actual order on wheel)
const WHEEL_ORDER = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];
const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

function numColor(n: number) {
  if (n === 0) return '#15803d';
  return RED.includes(n) ? '#dc2626' : '#1e1e1e';
}

function numColorClass(n: number) {
  if (n === 0) return 'bg-green-700 border-green-500';
  return RED.includes(n) ? 'bg-red-700 border-red-500' : 'bg-gray-900 border-gray-600';
}

const BETS = [
  { id: 'red',    label: 'QIZIL',   sub: '🔴', payout: 2,  color: '#dc2626' },
  { id: 'black',  label: 'QORA',    sub: '⚫', payout: 2,  color: '#1e293b' },
  { id: 'even',   label: 'JUFT',    sub: '2-4-6', payout: 2,  color: '#3b82f6' },
  { id: 'odd',    label: 'TOQ',     sub: '1-3-5', payout: 2,  color: '#8b5cf6' },
  { id: '1-18',   label: '1–18',    sub: 'LOW',payout: 2,  color: '#0891b2' },
  { id: '19-36',  label: '19–36',   sub: 'HIGH',payout: 2, color: '#0891b2' },
  { id: 'dozen1', label: '1–12',    sub: '1st',payout: 3,  color: '#d97706' },
  { id: 'dozen2', label: '13–24',   sub: '2nd',payout: 3,  color: '#d97706' },
  { id: 'dozen3', label: '25–36',   sub: '3rd',payout: 3,  color: '#d97706' },
];

function RouletteWheel({ angle, spinning, result }: { angle: number; spinning: boolean; result: number | null }) {
  const r = 120;
  const segAngle = 360 / WHEEL_ORDER.length;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
      {/* Outer ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 280, height: 280,
          background: 'linear-gradient(135deg, #92400e, #78350f, #451a03)',
          boxShadow: '0 0 40px rgba(180,83,9,0.4), inset 0 0 20px rgba(0,0,0,0.5)',
        }}
      />
      {/* Wheel */}
      <motion.div
        className="absolute rounded-full overflow-hidden"
        style={{ width: 256, height: 256 }}
        animate={{ rotate: angle }}
        transition={spinning ? { duration: 4, ease: [0.12, 0, 0.08, 1] } : { duration: 0 }}
      >
        <svg width={256} height={256} viewBox="-130 -130 260 260">
          {WHEEL_ORDER.map((num, i) => {
            const startAngle = ((i - 0.5) * segAngle) * Math.PI / 180;
            const endAngle = ((i + 0.5) * segAngle) * Math.PI / 180;
            const x1 = r * Math.sin(startAngle);
            const y1 = -r * Math.cos(startAngle);
            const x2 = r * Math.sin(endAngle);
            const y2 = -r * Math.cos(endAngle);
            const midAngle = (i * segAngle) * Math.PI / 180;
            const tx = (r * 0.7) * Math.sin(midAngle);
            const ty = -(r * 0.7) * Math.cos(midAngle);

            return (
              <g key={i}>
                <path
                  d={`M 0 0 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                  fill={numColor(num)}
                  stroke="#78350f"
                  strokeWidth="0.8"
                />
                <text
                  x={tx} y={ty}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="white"
                  transform={`rotate(${i * segAngle}, ${tx}, ${ty})`}
                >
                  {num}
                </text>
              </g>
            );
          })}
          {/* Inner circle */}
          <circle cx="0" cy="0" r="38" fill="#1c0a00" stroke="#92400e" strokeWidth="2" />
          <circle cx="0" cy="0" r="32" fill="#0f0500" />

          {/* Dividers */}
          {WHEEL_ORDER.map((_, i) => {
            const a = (i * segAngle) * Math.PI / 180;
            return (
              <line
                key={`div-${i}`}
                x1="38" y1="0" x2={r} y2="0"
                stroke="#92400e" strokeWidth="0.6"
                transform={`rotate(${i * segAngle})`}
                opacity="0.6"
              />
            );
          })}
        </svg>

        {/* Center result */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 64, height: 64, marginLeft: -32, marginTop: -32 }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={result ?? 'spin'}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className={`text-2xl font-black ${result !== null ? (result === 0 ? 'text-green-300' : RED.includes(result) ? 'text-red-300' : 'text-white') : 'text-white/20'}`}
            >
              {spinning ? '?' : result ?? '?'}
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Ball */}
      {spinning && (
        <motion.div
          className="absolute w-4 h-4 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          style={{ zIndex: 20 }}
          animate={{
            rotate: [0, -720, -1440, -1800],
            x: [100, 90, 80, 50],
            y: [0, -5, 10, 0],
          }}
          transition={{ duration: 4, ease: [0.12, 0, 0.08, 1] }}
        />
      )}

      {/* Pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30" style={{ marginTop: -2 }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: '22px solid #fbbf24',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        }} />
      </div>
    </div>
  );
}

export default function RoulettePage() {
  const [bet, setBet] = useState(3000);
  const [selectedBet, setSelectedBet] = useState('red');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [angle, setAngle] = useState(0);

  const { data: user } = useGetMe();
  const { play } = useGamePlay();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    sounds.startAmbient('roulette');
    return () => sounds.stopAmbient();
  }, []);

  const spin = () => {
    if (spinning) return;
    if ((user?.balance || 0) < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    setSpinning(true);
    setResult(null);
    setWon(null);
    sounds.spin();

    play({ data: { gameType: 'roulette', betAmount: bet, gameData: { betType: selectedBet } } }, {
      onSuccess: (data: any) => {
        const num: number = data.result?.number ?? Math.floor(Math.random() * 37);
        const didWin: boolean = data.won;

        const wheelIdx = WHEEL_ORDER.indexOf(num);
        const segAngle = 360 / WHEEL_ORDER.length;
        const extraSpins = 7 + Math.floor(Math.random() * 4);
        const target = angle + extraSpins * 360 + wheelIdx * segAngle;
        setAngle(target);

        // Ball click sounds
        let clicks = 0;
        const clickInterval = setInterval(() => {
          sounds.rouletteClick();
          clicks++;
          if (clicks > 18) clearInterval(clickInterval);
        }, 200);

        setTimeout(() => {
          clearInterval(clickInterval);
          setResult(num);
          setSpinning(false);
          setWon(didWin);
          setHistory(p => [num, ...p.slice(0, 19)]);
          queryClient.invalidateQueries();
          if (didWin) sounds.bigWin(); else sounds.lose();
          const bt = BETS.find(b => b.id === selectedBet)!;
          toast({
            title: didWin ? `🎉 ${num} — Yutdingiz! ${bt.payout}×` : `😞 ${num} — Yutqazdingiz`,
            description: didWin ? `+${(bet * bt.payout).toLocaleString()} UZS` : undefined,
            variant: didWin ? 'default' : 'destructive',
          } as any);
        }, 4200);
      },
      onError: () => {
        setSpinning(false);
        toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
      }
    });
  };

  const selBet = BETS.find(b => b.id === selectedBet)!;

  return (
    <div className="max-w-md mx-auto space-y-3">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <h1 className="text-2xl font-black" style={{ color: '#f59e0b' }}>🎯 RULETKA</h1>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {history.map((n, i) => (
            <motion.span
              key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
              className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-black text-white border ${numColorClass(n)}`}
            >
              {n}
            </motion.span>
          ))}
        </div>
      )}

      {/* Wheel area */}
      <div
        className="flex flex-col items-center py-6 rounded-2xl"
        style={{
          background: 'radial-gradient(ellipse at 50% 20%, #1a3a1a 0%, #0a1a0a 70%)',
          border: '2px solid rgba(180,83,9,0.3)',
          boxShadow: '0 0 60px rgba(180,83,9,0.15)',
        }}
      >
        <RouletteWheel angle={angle} spinning={spinning} result={result} />

        {/* Result display */}
        <AnimatePresence>
          {result !== null && !spinning && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-3"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-white border-2
                  ${result === 0 ? 'border-green-400 bg-green-700' : RED.includes(result) ? 'border-red-400 bg-red-700' : 'border-gray-400 bg-gray-900'}`}
              >
                {result}
              </div>
              <div>
                <div className={`font-black text-lg ${won ? 'text-emerald-400' : 'text-red-400'}`}>
                  {won ? `+${(bet * selBet.payout).toLocaleString()} UZS` : `−${bet.toLocaleString()} UZS`}
                </div>
                <div className="text-xs text-slate-400">
                  {result === 0 ? 'Yashil • 0' : (RED.includes(result) ? 'Qizil' : 'Qora') + ' • ' + (result % 2 === 0 ? 'Juft' : 'Toq')}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bet type selection */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="grid grid-cols-3 gap-2">
          {BETS.map(b => (
            <motion.button
              key={b.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => { if (!spinning) { setSelectedBet(b.id); sounds.click(); } }}
              className="py-2.5 px-2 rounded-xl text-xs font-bold border-2 transition-all text-center"
              style={{
                background: selectedBet === b.id ? `${b.color}30` : 'rgba(255,255,255,0.03)',
                borderColor: selectedBet === b.id ? b.color : 'rgba(255,255,255,0.08)',
                color: selectedBet === b.id ? 'white' : '#94a3b8',
                boxShadow: selectedBet === b.id ? `0 0 15px ${b.color}40` : 'none',
              }}
            >
              <div>{b.sub}</div>
              <div className="text-[11px] mt-0.5">{b.label}</div>
              <div className="text-[10px] opacity-60">{b.payout}×</div>
            </motion.button>
          ))}
        </div>

        {/* Bet amount */}
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => setBet(b => Math.max(1000, Math.floor(b / 2)))} disabled={spinning} className="px-3">½</Button>
          <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} className="text-center font-black text-lg" disabled={spinning} />
          <Button variant="outline" size="sm" onClick={() => setBet(b => b * 2)} disabled={spinning} className="px-3">2×</Button>
        </div>

        {/* Quick chips */}
        <div className="flex gap-2">
          {[1000, 5000, 10000, 50000, 100000].map(v => (
            <button key={v} onClick={() => { if (!spinning) setBet(v); }}
              disabled={spinning}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-amber-900/40 text-amber-400/80 hover:border-amber-500 hover:text-amber-300 transition-all disabled:opacity-40"
            >
              {v >= 1000 ? `${v / 1000}K` : v}
            </button>
          ))}
        </div>

        <Button
          variant="gold"
          className="w-full text-xl py-7 font-black tracking-widest"
          onClick={spin}
          disabled={spinning}
        >
          {spinning ? (
            <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
              🎯 Aylanmoqda...
            </motion.span>
          ) : "🎯 AYLANTIRISH"}
        </Button>
      </div>
    </div>
  );
}
