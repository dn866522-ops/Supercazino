import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GameGrid, type GameItem } from "@/components/GameCard";

const CASINO_GAMES: GameItem[] = [
  { id: "mma",        emoji: "🍎", name: "More Magic Apple", sub: "x1000 gacha", path: "/moremagicapple", grad: "from-green-800 to-emerald-950", hot: true },
  { id: "penalty",    emoji: "⚽", name: "Penalty Shoot", sub: "Real o'yin",   path: "/penalty",      grad: "from-green-700 to-emerald-900",  hot: true  },
  { id: "roulette",   emoji: "🎯", name: "Ruletka",       sub: "x35 gacha",    path: "/roulette",     grad: "from-red-700 to-pink-800",       hot: true  },
  { id: "applefort",  emoji: "🍎", name: "Apple Fortune", sub: "x50000 gacha", path: "/applefortune", grad: "from-red-600 to-rose-900",       hot: true  },
  { id: "wildwest",   emoji: "🤠", name: "Wild West Gold",sub: "x10 gacha",    path: "/wildwestgold", grad: "from-amber-600 to-yellow-900",   hot: true  },
  { id: "plinko",     emoji: "⚡", name: "Plinko",        sub: "x10 gacha",    path: "/plinko",       grad: "from-yellow-700 to-orange-800",  hot: true  },
  { id: "crash",      emoji: "🚀", name: "Crash",         sub: "x1000 gacha",  path: "/crash",        grad: "from-green-700 to-teal-800",     hot: true  },
  { id: "blackjack",  emoji: "🃏", name: "Blackjek",      sub: "x2.5 gacha",   path: "/blackjack",    grad: "from-slate-700 to-slate-900",    hot: false },
  { id: "dice",       emoji: "🎲", name: "Zar",           sub: "x99 gacha",    path: "/dice",         grad: "from-blue-700 to-cyan-800",      hot: false },
  { id: "wheel",      emoji: "🎡", name: "G'ildirak",     sub: "x50 gacha",    path: "/wheel",        grad: "from-pink-700 to-rose-800",      hot: false },
  { id: "coinflip",   emoji: "🪙", name: "Tanga",         sub: "2x | 50/50",   path: "/coinflip",     grad: "from-amber-700 to-yellow-800",   hot: false },
  { id: "baccarat",   emoji: "🎴", name: "Bakkara",       sub: "x9 gacha",     path: "/slots",        grad: "from-violet-700 to-purple-900",  hot: false },
  { id: "keno",       emoji: "🎱", name: "Keno",          sub: "x500 gacha",   path: "/slots",        grad: "from-cyan-700 to-blue-900",      hot: false },
  { id: "hilo",       emoji: "🔼", name: "Hi-Lo",         sub: "x200 gacha",   path: "/slots",        grad: "from-emerald-700 to-green-900",  hot: false },
  { id: "dragontiger",emoji: "🐉", name: "Ajdaho",        sub: "x2 gacha",     path: "/slots",        grad: "from-red-800 to-orange-900",     hot: false },
  { id: "andar",      emoji: "🂡", name: "Andar Bahar",   sub: "x2 gacha",     path: "/coinflip",     grad: "from-lime-700 to-green-900",     hot: false },
  { id: "teenpatii",  emoji: "🃏", name: "Teen Patti",    sub: "x5 gacha",     path: "/blackjack",    grad: "from-fuchsia-700 to-purple-900", hot: false },
];

export default function CasinoPage() {
  const [filter, setFilter] = useState<"all" | "hot">("all");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="relative rounded-2xl overflow-hidden flex items-center p-5 shadow-2xl"
        style={{
          minHeight: 110,
          background: "linear-gradient(135deg, #3b1d8a 0%, #0f172a 60%, #1e1240 100%)",
          border: "1px solid rgba(168,85,247,0.25)",
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 25% 50%, #a855f7 0%, transparent 55%)" }}
        />
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-white mb-0.5">🎰 Kazino</h1>
          <p className="text-sm" style={{ color: "rgba(192,132,252,0.75)" }}>
            Ruletka, Blackjek, Plinko va boshqalar
          </p>
        </div>
        <div
          className="absolute right-5 top-1/2 -translate-y-1/2 select-none"
          style={{ fontSize: 64, opacity: 0.08 }}
        >
          🎰
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setFilter("all")}
        >
          Barchasi ({CASINO_GAMES.length})
        </Button>
        <Button
          variant={filter === "hot" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setFilter("hot")}
        >
          🔥 Top ({CASINO_GAMES.filter((g) => g.hot).length})
        </Button>
      </div>

      {/* Uniform game grid */}
      <GameGrid games={CASINO_GAMES} filter={filter} />
    </div>
  );
}
