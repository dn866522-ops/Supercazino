import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GameGrid, type GameItem } from "@/components/GameCard";

const SLOT_GAMES: GameItem[] = [
  { id: "gemsodyssey", image: "/gems-odyssey-cover.jpg", name: "Gems Odyssey", sub: "x10 gacha", path: "/gemsodyssey", grad: "from-purple-900 to-indigo-900", hot: true  },
  { id: "slots",      emoji: "🎰", name: "Slotlar",       sub: "50/50 | 10x",  path: "/slots",        grad: "from-purple-700 to-indigo-800",  hot: true  },
  { id: "mines",      emoji: "💣", name: "Minalar",       sub: "x1000 gacha",  path: "/mines",        grad: "from-orange-700 to-red-800",     hot: true  },
  { id: "crash",      emoji: "🚀", name: "Crash",         sub: "x1000 gacha",  path: "/crash",        grad: "from-green-700 to-teal-800",     hot: true  },
  { id: "applefort",  emoji: "🍎", name: "Apple Fortune", sub: "x50000 gacha", path: "/applefortune", grad: "from-red-600 to-rose-900",       hot: true  },
  { id: "wildwest",   emoji: "🤠", name: "Wild West Gold",sub: "x10 gacha",    path: "/wildwestgold", grad: "from-amber-600 to-yellow-900",   hot: true  },
  { id: "crystal",    emoji: "💎", name: "Kristal",       sub: "x500 gacha",   path: "/slots",        grad: "from-sky-700 to-blue-900",       hot: false },
  { id: "dragontiger",emoji: "🐉", name: "Ajdaho Slot",   sub: "x2 gacha",     path: "/slots",        grad: "from-red-800 to-orange-900",     hot: false },
  { id: "tower",      emoji: "🏰", name: "Minora",        sub: "x1000 gacha",  path: "/mines",        grad: "from-stone-700 to-slate-900",    hot: false },
  { id: "videopoker", emoji: "🎮", name: "Video Poker",   sub: "x800 gacha",   path: "/blackjack",    grad: "from-indigo-700 to-blue-900",    hot: false },
  { id: "sicbo",      emoji: "🎲", name: "Sik Bo",        sub: "x180 gacha",   path: "/dice",         grad: "from-teal-700 to-cyan-900",      hot: false },
  { id: "fruit",      emoji: "🍒", name: "Meva Slot",     sub: "x20 gacha",    path: "/slots",        grad: "from-pink-700 to-rose-800",      hot: false },
  { id: "lucky7",     emoji: "7️⃣", name: "Lucky 7",       sub: "x7 gacha",     path: "/slots",        grad: "from-yellow-600 to-amber-800",   hot: false },
];

export default function SlotlarPage() {
  const [filter, setFilter] = useState<"all" | "hot">("all");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="relative rounded-2xl overflow-hidden flex items-center p-5 shadow-2xl"
        style={{
          minHeight: 110,
          background: "linear-gradient(135deg, #7c2d12 0%, #0f172a 60%, #431407 100%)",
          border: "1px solid rgba(249,115,22,0.25)",
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 25% 50%, #f97316 0%, transparent 55%)" }}
        />
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-white mb-0.5">🎰 Slotlar</h1>
          <p className="text-sm" style={{ color: "rgba(253,186,116,0.75)" }}>
            Minalar, Crash, Apple Fortune va boshqalar
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
          Barchasi ({SLOT_GAMES.length})
        </Button>
        <Button
          variant={filter === "hot" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setFilter("hot")}
        >
          🔥 Top ({SLOT_GAMES.filter((g) => g.hot).length})
        </Button>
      </div>

      {/* Uniform game grid */}
      <GameGrid games={SLOT_GAMES} filter={filter} />
    </div>
  );
}
