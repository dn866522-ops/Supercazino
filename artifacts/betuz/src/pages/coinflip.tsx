import { useState } from "react";
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
import confetti from "canvas-confetti";

export default function CoinflipPage() {
  const [bet, setBet] = useState(3000);
  const [pick, setPick] = useState<'heads' | 'tails'>('heads');
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0);

  const { data: user } = useGetMe();
  const { play } = useGamePlay();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const flip = () => {
    if (flipping) return;
    if ((user?.balance || 0) < bet) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    setFlipping(true);
    setResult(null);
    setWon(null);
    sounds.spin();

    // Call backend FIRST — backend decides the outcome
    play({ data: { gameType: 'coinflip', betAmount: bet, gameData: { pick } } }, {
      onSuccess: (data: any) => {
        const serverResult: 'heads' | 'tails' = data.result?.result ?? (Math.random() < 0.5 ? 'heads' : 'tails');
        const didWin: boolean = data.won;

        // Wait for animation, then reveal server result
        setTimeout(() => {
          setResult(serverResult);
          setWon(didWin);
          setFlipping(false);
          queryClient.invalidateQueries();
          setStreak(s => didWin ? s + 1 : 0);
          if (didWin) {
            sounds.bigWin();
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#D4AF37', '#1E88E5'] });
          } else {
            sounds.lose();
          }
          toast({
            title: didWin ? "🎉 Yutdingiz! 2x" : "😞 Yutqazdingiz",
            description: `${serverResult === 'heads' ? '⭕ Oldin' : '⬤ Keyin'}`,
            variant: didWin ? 'default' : 'destructive'
          } as any);
        }, 1500);
      },
      onError: () => {
        setFlipping(false);
        toast({ title: "Xatolik yuz berdi", variant: "destructive" } as any);
      }
    });
  };

  return (
    <div className="max-w-sm mx-auto space-y-6 py-4">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5"/></Button></Link>
        <h1 className="text-2xl font-bold">🪙 Tanga (Coinflip)</h1>
        {streak > 1 && <span className="ml-auto text-accent font-bold text-sm">🔥 {streak}ta yutish!</span>}
      </div>

      <div className="flex flex-col items-center justify-center h-64">
        <motion.div
          animate={flipping ? { rotateY: [0, 360, 720, 1080], scale: [1, 1.2, 1] } : { rotateY: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="relative w-40 h-40"
        >
          <div className={`w-full h-full rounded-full flex items-center justify-center text-6xl shadow-2xl border-4 transition-colors duration-300
            ${result === null ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-300' :
              result === 'heads' ? 'bg-gradient-to-br from-yellow-400 to-amber-600 border-yellow-300' :
              'bg-gradient-to-br from-slate-400 to-slate-600 border-slate-300'}`}
          >
            {flipping ? '🔄' : result === 'heads' ? '⭕' : result === 'tails' ? '⬤' : '🪙'}
          </div>
        </motion.div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className={`mt-4 text-xl font-bold ${won ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {won ? `🎉 +${(bet * 1.95).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} UZS` : `😞 -${bet.toLocaleString()} UZS`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass-panel p-4 rounded-2xl space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2 text-center">Qaysi tomon?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant={pick === 'heads' ? 'default' : 'outline'} className="h-16 text-2xl flex flex-col"
              onClick={() => { if (!flipping) { setPick('heads'); sounds.click(); } }}>
              ⭕<span className="text-xs mt-1">Oldin</span>
            </Button>
            <Button variant={pick === 'tails' ? 'default' : 'outline'} className="h-16 text-2xl flex flex-col"
              onClick={() => { if (!flipping) { setPick('tails'); sounds.click(); } }}>
              ⬤<span className="text-xs mt-1">Keyin</span>
            </Button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tikish (UZS) — Yutganda 1.95x</label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBet(b => Math.max(3000, Math.floor(b / 2)))} disabled={flipping}>½</Button>
            <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} className="font-bold text-center" disabled={flipping}/>
            <Button variant="outline" size="sm" onClick={() => setBet(b => b * 2)} disabled={flipping}>2x</Button>
          </div>
        </div>

        <Button variant="gold" className="w-full text-xl py-6" onClick={flip} disabled={flipping}>
          {flipping ? "🪙 Aylanmoqda..." : "🪙 TASHLASH"}
        </Button>
      </div>
    </div>
  );
}
