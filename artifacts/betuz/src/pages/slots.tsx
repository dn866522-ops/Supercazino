import { useState } from "react";
import { useGamePlay } from "@/hooks/useGamePlay";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { sounds } from "@/lib/sounds";
import { Link } from "wouter";
import { ArrowLeft, Info } from "lucide-react";

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];

const PAYTABLE = [
  { sym: '💎', mult: 10 },
  { sym: '7️⃣', mult: 7 },
  { sym: '🔔', mult: 5 },
  { sym: '⭐', mult: 4 },
  { sym: '🍇', mult: 2.5 },
  { sym: '🍊', mult: 2 },
  { sym: '🍋', mult: 1.8 },
  { sym: '🍒', mult: 1.5 },
];

export default function SlotsPage() {
  const [bet, setBet] = useState(3000);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['🍒', '🍋', '🍊']);
  const [spinReels, setSpinReels] = useState([false, false, false]);
  const [showPaytable, setShowPaytable] = useState(false);
  const [lastResult, setLastResult] = useState<{ won: boolean; mult: number; win: number } | null>(null);

  const { data: user } = useGetMe();
  const { play } = useGamePlay();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSpin = () => {
    if (spinning) return;
    if ((user?.balance || 0) < bet) {
      toast({ title: "Xatolik", description: "Balans yetarli emas", variant: "destructive" });
      return;
    }
    setSpinning(true);
    setLastResult(null);
    setSpinReels([true, true, true]);
    sounds.spin();

    // Call backend FIRST — server decides won/lost and multiplier
    play({ data: { gameType: 'slots', betAmount: bet, gameData: {} } }, {
      onSuccess: (data: any) => {
        const isWin: boolean = data.won;
        const mult: number = data.multiplier ?? 0;
        const winAmount: number = data.winAmount ?? 0;

        // Generate matching visual reels based on server result
        let finalReels: string[];
        if (isWin) {
          // Find symbol closest to server multiplier, or random winning symbol
          const entry = PAYTABLE.find(p => p.mult === mult) ?? PAYTABLE[Math.floor(Math.random() * PAYTABLE.length)];
          finalReels = [entry.sym, entry.sym, entry.sym];
        } else {
          do {
            finalReels = Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
          } while (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]);
        }

        // Reveal reels one by one with animation
        [0, 1, 2].forEach(i => {
          setTimeout(() => {
            setReels(prev => { const r = [...prev]; r[i] = finalReels[i]; return r; });
            setSpinReels(prev => { const s = [...prev]; s[i] = false; return s; });
            sounds.coin();
            if (i === 2) {
              setSpinning(false);
              setLastResult({ won: isWin, mult, win: winAmount });
              queryClient.invalidateQueries();
              if (isWin) {
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#D4AF37', '#1E88E5', '#fff'] });
                sounds.bigWin();
                toast({ title: "🎉 TABRIKLAYMIZ!", description: `${winAmount.toLocaleString()} UZS yutdingiz! (${mult}x)` });
              } else {
                sounds.lose();
              }
            }
          }, 600 + i * 500);
        });
      },
      onError: () => {
        setSpinning(false);
        setSpinReels([false, false, false]);
        toast({ title: "Xatolik yuz berdi", variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5"/></Button></Link>
        <h1 className="text-2xl font-bold">🎰 Slotlar</h1>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShowPaytable(p => !p)}>
          <Info className="w-5 h-5"/>
        </Button>
      </div>

      <AnimatePresence>
        {showPaytable && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="glass-panel rounded-xl p-3 overflow-hidden">
            <p className="text-xs font-bold text-accent mb-2">TO'LOV JADVALI</p>
            <div className="grid grid-cols-2 gap-1">
              {PAYTABLE.map(p => (
                <div key={p.sym} className="flex items-center gap-2 text-sm">
                  <span>{p.sym}{p.sym}{p.sym}</span>
                  <span className="text-accent font-bold">{p.mult}x</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reels */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl border-2 border-yellow-600/30 p-6">
        <div className="flex justify-center gap-3 mb-4">
          {reels.map((sym, i) => (
            <motion.div key={i}
              animate={spinReels[i] ? { y: [-20, 20, -20], opacity: [0.5, 1, 0.5] } : { y: 0, opacity: 1 }}
              transition={spinReels[i] ? { repeat: Infinity, duration: 0.15 } : {}}
              className="w-24 h-24 bg-slate-800 border border-yellow-500/30 rounded-xl flex items-center justify-center text-5xl shadow-inner"
            >
              {sym}
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {lastResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`text-center py-2 rounded-xl font-bold ${lastResult.won ? 'bg-emerald-900/50 text-emerald-300 text-lg' : 'bg-red-900/30 text-red-400 text-sm'}`}>
              {lastResult.won ? `🎉 ${lastResult.win.toLocaleString()} UZS — ${lastResult.mult}x` : "😞 Omadsiz! Qayta urining"}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tikish (UZS)</label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBet(b => Math.max(3000, Math.floor(b / 2)))} disabled={spinning}>½</Button>
            <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} className="font-bold text-center" disabled={spinning}/>
            <Button variant="outline" size="sm" onClick={() => setBet(b => b * 2)} disabled={spinning}>2x</Button>
          </div>
        </div>
        <div className="flex gap-2">
          {[3000, 5000, 10000, 50000].map(v => (
            <Button key={v} variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setBet(v)} disabled={spinning}>
              {v >= 1000 ? v/1000 + 'K' : v}
            </Button>
          ))}
        </div>
        <Button variant="gold" className="w-full text-xl py-6" onClick={handleSpin} disabled={spinning}>
          {spinning ? "🎰 Aylanmoqda..." : "🎰 AYLANTIRISH"}
        </Button>
      </div>
    </div>
  );
}
