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

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function makeDeck() {
  return SUITS.flatMap(s => RANKS.map(r => ({ rank: r, suit: s, val: r === 'A' ? 11 : ['J','Q','K'].includes(r) ? 10 : Number(r) })));
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function handTotal(cards: any[]) {
  let total = cards.reduce((s, c) => s + c.val, 0);
  let aces = cards.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function CardComp({ card, hidden }: { card: any; hidden?: boolean }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <motion.div initial={{ scale: 0, rotateY: 90 }} animate={{ scale: 1, rotateY: 0 }}
      className={`w-14 h-20 rounded-lg border flex flex-col items-center justify-center font-bold text-lg shadow-lg select-none
        ${hidden ? 'bg-blue-900 border-blue-700' : `bg-white border-gray-300 ${isRed ? 'text-red-600' : 'text-gray-900'}`}`}>
      {hidden ? <span className="text-2xl">🂠</span> : <><span className="text-base leading-none">{card.rank}</span><span className="text-base">{card.suit}</span></>}
    </motion.div>
  );
}

type State = 'idle' | 'playing' | 'done';

export default function BlackjackPage() {
  const [bet, setBet] = useState(3000);
  const [deck, setDeck] = useState<any[]>([]);
  const [player, setPlayer] = useState<any[]>([]);
  const [dealer, setDealer] = useState<any[]>([]);
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState('');

  const { data: user, refetch: refetchUser } = useGetMe();
  const { play } = useGamePlay();
  const qc = useQueryClient();
  const { toast } = useToast();

  const startGame = () => {
    if ((user?.balance || 0) < bet) { toast({ title: "Balans yetarli emas", variant: "destructive" } as any); return; }
    const d = shuffle(makeDeck());
    const p = [d.pop()!, d.pop()!];
    const dl = [d.pop()!, d.pop()!];
    setDeck(d); setPlayer(p); setDealer(dl); setState('playing'); setResult('');
    sounds.coin();
    if (handTotal(p) === 21) { endGame(p, dl, d, 'blackjack'); }
  };

  const hit = () => {
    if (state !== 'playing') return;
    const d = [...deck];
    const p = [...player, d.pop()!];
    setPlayer(p); setDeck(d); sounds.coin();
    if (handTotal(p) > 21) { endGame(p, dealer, d, 'bust'); }
  };

  const stand = () => {
    if (state !== 'playing') return;
    let d = [...deck], dl = [...dealer];
    while (handTotal(dl) < 17) { dl.push(d.pop()!); }
    setDealer(dl); setDeck(d);
    const pt = handTotal(player), dt = handTotal(dl);
    if (dt > 21 || pt > dt) endGame(player, dl, d, 'win');
    else if (pt === dt) endGame(player, dl, d, 'push');
    else endGame(player, dl, d, 'lose');
  };

  const endGame = (p: any[], dl: any[], d: any[], outcome: string) => {
    setDealer(dl); setState('done');
    const pt = handTotal(p), dlt = handTotal(dl);
    let msg = '', won = false;
    if (outcome === 'blackjack') { msg = '🎉 BLACKJACK! 2.5x'; won = true; sounds.bigWin(); }
    else if (outcome === 'bust') { msg = `😞 Bust! ${pt} — Yutqazdingiz`; sounds.lose(); }
    else if (outcome === 'win') { msg = `🎉 ${pt} vs ${dlt} — Yutdingiz!`; won = true; sounds.win(); }
    else if (outcome === 'push') { msg = `🤝 ${pt} vs ${dlt} — Tenglik`; }
    else { msg = `😞 ${pt} vs ${dlt} — Yutqazdingiz`; sounds.lose(); }
    setResult(msg);
    const mult = outcome === 'blackjack' ? 2.5 : outcome === 'win' ? 2 : outcome === 'push' ? 1 : 0;
    play({ data: { gameType: 'blackjack', betAmount: bet, gameData: { playerTotal: pt, dealerTotal: dlt, outcome } } }, {
      onSuccess: () => { qc.invalidateQueries(); },
    });
    toast({ title: msg, variant: won ? 'default' : 'destructive' } as any);
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5"/></Button></Link>
        <h1 className="text-2xl font-bold">🃏 Blackjek</h1>
      </div>

      <div className="bg-gradient-to-br from-green-950 to-slate-900 rounded-2xl border border-green-800/40 p-4 min-h-[280px] space-y-4">
        {state !== 'idle' && (
          <>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Diler {state === 'done' ? `(${handTotal(dealer)})` : '(?)'}</p>
              <div className="flex gap-2 flex-wrap">
                {dealer.map((c, i) => <CardComp key={i} card={c} hidden={state === 'playing' && i === 1}/>)}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Siz ({handTotal(player)})</p>
              <div className="flex gap-2 flex-wrap">
                {player.map((c, i) => <CardComp key={i} card={c}/>)}
              </div>
            </div>
          </>
        )}
        {state === 'idle' && (
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground text-center">O'yinni boshlash uchun<br/>pastdagi tugmani bosing</p>
          </div>
        )}
        <AnimatePresence>
          {result && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-2 font-bold text-lg text-white">{result}</motion.div>}
        </AnimatePresence>
      </div>

      <div className="glass-panel p-4 rounded-2xl space-y-3">
        {state === 'playing' && (
          <div className="grid grid-cols-2 gap-3">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white text-lg py-6" onClick={hit}>➕ Ol (Hit)</Button>
            <Button className="bg-orange-600 hover:bg-orange-500 text-white text-lg py-6" onClick={stand}>✋ To'xta (Stand)</Button>
          </div>
        )}
        {(state === 'idle' || state === 'done') && (
          <>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setBet(b => Math.max(3000, b / 2))}>½</Button>
              <Input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} className="font-bold text-center"/>
              <Button variant="outline" size="sm" onClick={() => setBet(b => b * 2)}>2x</Button>
            </div>
            <Button variant="gold" className="w-full text-xl py-6" onClick={startGame}>
              {state === 'done' ? '🔄 Qayta O\'ynash' : '🃏 O\'YINNI BOSHLASH'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
