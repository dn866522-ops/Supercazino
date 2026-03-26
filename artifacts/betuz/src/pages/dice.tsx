import { useState } from "react";
import { useGamePlay } from "@/hooks/useGamePlay";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/sounds";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function DicePage() {
  const [bet, setBet] = useState(3000);
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState<'over' | 'under'>('over');
  const [roll, setRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<{ roll: number; won: boolean }[]>([]);

  const { data: user } = useGetMe();
  const { play } = useGamePlay();
  const { toast } = useToast();

  const chance = mode === 'over' ? (100 - target) : target;
  const payout = parseFloat((99 / Math.max(chance, 1)).toFixed(4));

  const handleRoll = () => {
    if (rolling) return;
    if ((user?.balance || 0) < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    setRolling(true);
    sounds.spin();

    // Call backend FIRST — server generates the real roll
    play({ data: { gameType: 'dice', betAmount: bet, gameData: { prediction: mode, target } } }, {
      onSuccess: (data: any) => {
        const finalRoll: number = data.result?.roll ?? Math.floor(Math.random() * 100) + 1;
        const won: boolean = data.won;

        // Show random spinning animation, then reveal server roll
        let count = 0;
        const interval = setInterval(() => {
          setRoll(Math.floor(Math.random() * 100) + 1);
          count++;
          if (count >= 15) {
            clearInterval(interval);
            setRoll(finalRoll);
            setRolling(false);
            setHistory(prev => [{ roll: finalRoll, won }, ...prev.slice(0, 9)]);
            if (won) sounds.win(); else sounds.lose();
            toast({
              title: won ? `🎲 ${finalRoll} — Yutdingiz!` : `🎲 ${finalRoll} — Yutqazdingiz`,
              variant: won ? 'default' : 'destructive'
            } as any);
          }
        }, 60);
      },
      onError: () => {
        setRolling(false);
        toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
      }
    });
  };

  const rollColor = roll === null ? 'text-white'
    : (mode === 'over' ? roll > target : roll < target) ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5"/></Button></Link>
        <h1 className="text-2xl font-bold">🎲 Zar (Dice)</h1>
      </div>

      <div className="bg-gradient-to-br from-blue-950 to-slate-900 rounded-2xl border border-blue-500/30 p-8 text-center">
        <motion.div
          key={roll}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-8xl font-black font-mono ${rollColor} drop-shadow-2xl`}
        >
          {rolling && roll !== null ? roll : (roll ?? '?')}
        </motion.div>
        <div className="text-sm text-muted-foreground mt-2">
          {roll === null ? "Zar otish uchun tugmani bosing" :
            (mode === 'over' ? roll > target : roll < target) ?
            `✅ ${roll} — ${mode === 'over' ? target + ' dan katta' : target + ' dan kichik'}` :
            `❌ ${roll} — Yutqazdingiz`}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {history.map((h, i) => (
            <span key={i} className={`text-xs font-bold px-2 py-1 rounded-full ${h.won ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/30 text-red-400'}`}>
              {h.roll}
            </span>
          ))}
        </div>
      )}

      <div className="glass-panel p-4 rounded-2xl space-y-4">
        {/* Mode */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === 'over' ? 'default' : 'outline'} onClick={() => setMode('over')} disabled={rolling}>
            ⬆ {target} dan katta
          </Button>
          <Button variant={mode === 'under' ? 'default' : 'outline'} onClick={() => setMode('under')} disabled={rolling}>
            ⬇ {target} dan kichik
          </Button>
        </div>

        {/* Target slider */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Chegara: {target}</span>
            <span>Imkoniyat: {chance}%</span>
            <span>Koeffitsient: {payout}x</span>
          </div>
          <input type="range" min={2} max={98} value={target}
            onChange={e => setTarget(Number(e.target.value))}
            disabled={rolling}
            className="w-full accent-primary"/>
        </div>

        {/* Bet */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tikish (UZS)</label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBet(b => Math.max(3000, Math.floor(b / 2)))} disabled={rolling}>½</Button>
            <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} className="font-bold text-center" disabled={rolling}/>
            <Button variant="outline" size="sm" onClick={() => setBet(b => b * 2)} disabled={rolling}>2x</Button>
          </div>
        </div>

        <Button variant="gold" className="w-full text-lg py-6" onClick={handleRoll} disabled={rolling}>
          {rolling ? "🎲 Otilmoqda..." : "🎲 TASHLASH"}
        </Button>
      </div>
    </div>
  );
}
