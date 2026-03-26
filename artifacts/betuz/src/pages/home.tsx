import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Landmark, Trophy, Dice5, Layers, Headset, ChevronLeft, ChevronRight, Gift, Zap, Star } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { sounds } from "@/lib/sounds";
import { GameGrid, type GameItem } from "@/components/GameCard";

// ── Promo banners ──────────────────────────────────────────────────────────────
const PROMOS = [
  {
    id: "bonus100",
    gradient: "linear-gradient(135deg, #0d3b1e 0%, #0a2810 50%, #061a0a 100%)",
    border: "rgba(0,200,80,0.35)",
    glow: "rgba(0,200,80,0.15)",
    icon: "💰",
    badge: "YANGI FOYDALANUVCHI",
    badgeColor: "#00c850",
    title: "100% Bonus",
    subtitle: "Birinchi depozitingizga 100%\nbonus oling!",
    btnText: "Bonus olish",
    btnHref: "/deposit",
    btnColor: "#00c850",
    accent: "#4ade80",
  },
  {
    id: "daily",
    gradient: "linear-gradient(135deg, #1a1050 0%, #0a0f2e 50%, #050810 100%)",
    border: "rgba(168,85,247,0.35)",
    glow: "rgba(168,85,247,0.15)",
    icon: "🎡",
    badge: "HAR KUNI",
    badgeColor: "#a855f7",
    title: "Bepul Aylanish",
    subtitle: "Lucky Wheel'ni har 24 soatda\nbepul aylantiring!",
    btnText: "Spin qilish",
    btnHref: "/lucky-wheel",
    btnColor: "#a855f7",
    accent: "#c084fc",
  },
  {
    id: "cashback",
    gradient: "linear-gradient(135deg, #1e1000 0%, #150a00 50%, #0a0500 100%)",
    border: "rgba(212,175,55,0.35)",
    glow: "rgba(212,175,55,0.15)",
    icon: "🏆",
    badge: "DOIM FAOL",
    badgeColor: "#d4af37",
    title: "Cashback 15%",
    subtitle: "Har haftada yutqazgan summangizning\n15% ini qaytaramiz!",
    btnText: "Batafsil",
    btnHref: "/profile",
    btnColor: "#d4af37",
    accent: "#fbbf24",
  },
  {
    id: "refer",
    gradient: "linear-gradient(135deg, #0a1a3a 0%, #061228 50%, #030c1a 100%)",
    border: "rgba(59,130,246,0.35)",
    glow: "rgba(59,130,246,0.15)",
    icon: "🤝",
    badge: "REFERAL",
    badgeColor: "#3b82f6",
    title: "Do'st taklif qiling",
    subtitle: "Har bir do'st uchun\n25 000 UZS bonus!",
    btnText: "Referal",
    btnHref: "/profile",
    btnColor: "#3b82f6",
    accent: "#60a5fa",
  },
];

function PromoBanner() {
  const [cur, setCur] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCur(c => (c + 1) % PROMOS.length), 3500);
  };

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const prev = () => { setCur(c => (c - 1 + PROMOS.length) % PROMOS.length); resetTimer(); sounds.click(); };
  const next = () => { setCur(c => (c + 1) % PROMOS.length); resetTimer(); sounds.click(); };

  const p = PROMOS[cur];

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ border: `1.5px solid ${p.border}`, boxShadow: `0 0 30px ${p.glow}` }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={p.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.28 }}
          style={{ background: p.gradient, padding: "18px 16px 14px" }}
        >
          {/* Glow overlay */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 15% 50%, ${p.glow} 0%, transparent 65%)` }} />

          <div className="relative z-10 flex items-center gap-3">
            {/* Icon */}
            <div className="shrink-0 text-4xl drop-shadow-lg">{p.icon}</div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: `${p.badgeColor}22`, color: p.badgeColor, border: `1px solid ${p.badgeColor}44` }}>
                  {p.badge}
                </span>
              </div>
              <h3 className="text-lg font-black text-white leading-tight">{p.title}</h3>
              <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: p.accent, opacity: 0.8 }}>{p.subtitle}</p>
            </div>

            {/* CTA */}
            <Link href={p.btnHref}>
              <button
                className="shrink-0 font-black text-xs px-3 py-2 rounded-xl whitespace-nowrap text-black transition-all active:scale-95"
                style={{ background: p.btnColor }}
                onClick={() => sounds.click()}
              >
                {p.btnText}
              </button>
            </Link>
          </div>

          {/* Dots & Arrows */}
          <div className="relative z-10 flex items-center justify-between mt-3">
            <button onClick={prev} className="opacity-40 hover:opacity-80 transition-opacity">
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <div className="flex gap-1.5">
              {PROMOS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCur(i); resetTimer(); sounds.click(); }}
                  className="rounded-full transition-all"
                  style={{
                    width: i === cur ? 18 : 6, height: 6,
                    background: i === cur ? p.btnColor : "rgba(255,255,255,0.25)",
                  }}
                />
              ))}
            </div>
            <button onClick={next} className="opacity-40 hover:opacity-80 transition-opacity">
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Hot games ──────────────────────────────────────────────────────────────────
const QUICK_GAMES: GameItem[] = [
  { id: "crash",      emoji: "🚀", name: "Crash",         sub: "x1000 gacha",  path: "/crash",        grad: "from-green-700 to-teal-800",     hot: true  },
  { id: "mines",      emoji: "💣", name: "Minalar",       sub: "x1000 gacha",  path: "/mines",        grad: "from-orange-700 to-red-800",     hot: true  },
  { id: "applefort",  emoji: "🍎", name: "Apple Fortune", sub: "x50000 gacha", path: "/applefortune", grad: "from-red-600 to-rose-900",       hot: true  },
  { id: "roulette",   emoji: "🎯", name: "Ruletka",       sub: "x35 gacha",    path: "/roulette",     grad: "from-red-700 to-pink-800",       hot: true  },
  { id: "blackjack",  emoji: "🃏", name: "Blackjek",      sub: "x2.5 gacha",   path: "/blackjack",    grad: "from-slate-700 to-slate-900",    hot: false },
  { id: "plinko",     emoji: "⚡", name: "Plinko",        sub: "x10 gacha",    path: "/plinko",       grad: "from-yellow-700 to-orange-800",  hot: true  },
];

function useLuckyWheelCanSpin() {
  const [canSpin, setCanSpin] = useState(false);
  useEffect(() => {
    fetch("/api/lucky-wheel/status")
      .then(r => r.json())
      .then(d => setCanSpin(!!d.canSpin))
      .catch(() => {});
  }, []);
  return canSpin;
}

// ── Live stats ticker ──────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { user: "Bobur***", game: "Crash", amount: "1 200 000" },
  { user: "Sarvar***", game: "Mines", amount: "850 000" },
  { user: "Dilnoza***", game: "Plinko", amount: "2 400 000" },
  { user: "Jasur***", game: "Apple Fortune", amount: "15 500 000" },
  { user: "Kamola***", game: "Ruletka", amount: "620 000" },
  { user: "Sherzod***", game: "Slots", amount: "980 000" },
  { user: "Malika***", game: "Crash", amount: "3 100 000" },
];

function WinTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % TICKER_ITEMS.length), 2200);
    return () => clearInterval(t);
  }, []);
  const item = TICKER_ITEMS[idx];
  return (
    <div className="overflow-hidden rounded-xl px-3 py-2 flex items-center gap-2"
      style={{ background: "rgba(0,200,80,0.07)", border: "1px solid rgba(0,200,80,0.18)" }}>
      <span className="text-xs animate-pulse" style={{ color: "#4ade80" }}>🔴 JONLI</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="text-xs text-white flex-1"
        >
          <span style={{ color: "#fbbf24" }}>{item.user}</span>
          {" "}— {item.game}da{" "}
          <span className="font-black" style={{ color: "#4ade80" }}>{item.amount} UZS</span>
          {" "}yutdi! 🎉
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function HomePage() {
  const { data: user } = useGetMe();
  const wheelCanSpin = useLuckyWheelCanSpin();

  return (
    <div className="space-y-4">

      {/* Live win ticker */}
      <WinTicker />

      {/* Promo banner carousel */}
      <PromoBanner />

      {/* Hero balance card */}
      <div
        className="relative rounded-2xl overflow-hidden flex items-center p-5 shadow-2xl"
        style={{
          minHeight: 150,
          background: "linear-gradient(135deg,#0f1e3a 0%,#091428 50%,#0a1628 100%)",
          border: "1px solid rgba(212,175,55,0.22)",
        }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 50%,#D4AF37 0%,transparent 48%),radial-gradient(circle at 82% 50%,#1E88E5 0%,transparent 48%)",
          }}
        />
        <div className="relative z-10 w-full">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(212,175,55,0.7)" }}>
            O'zbekistonning #1 platformasi
          </span>
          <h1 className="text-2xl font-black text-white mt-0.5 mb-2 leading-tight">
            🎰 BetUZ ga{" "}
            <span className="gold-text">Xush Kelibsiz!</span>
          </h1>
          {user && (
            <p className="text-sm mb-3" style={{ color: "rgba(203,213,225,0.8)" }}>
              Balans:{" "}
              <span className="font-bold text-lg" style={{ color: "#D4AF37" }}>
                {formatMoney(user.balance)}
              </span>
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Link href="/deposit">
              <Button variant="gold" size="sm" className="gap-1.5" onClick={() => sounds.click()}>
                <Wallet className="w-4 h-4" /> Depozit
              </Button>
            </Link>
            <Link href="/withdraw">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => sounds.click()}>
                <Landmark className="w-4 h-4" /> Chiqim
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Lucky Wheel Banner */}
      <Link href="/lucky-wheel" onClick={() => sounds.click()}>
        <motion.div
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="relative flex items-center overflow-hidden cursor-pointer"
          style={{
            borderRadius: 18,
            background: "linear-gradient(135deg, #0a1a3e 0%, #1a1050 60%, #0a0f1e 100%)",
            border: wheelCanSpin ? "1.5px solid #d4af37" : "1.5px solid rgba(212,175,55,0.3)",
            padding: "14px 16px",
            boxShadow: wheelCanSpin ? "0 0 20px rgba(212,175,55,0.25)" : "none",
          }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 20% 50%, rgba(212,175,55,0.12) 0%, transparent 60%)" }} />
          <div className="relative shrink-0 mr-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{
                background: "linear-gradient(135deg,#1e3a8a,#0a1a3e)",
                border: "3px solid #d4af37",
                boxShadow: "0 0 12px rgba(212,175,55,0.4)",
              }}
            >
              🎡
            </motion.div>
            {wheelCanSpin && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black" />
            )}
          </div>
          <div className="flex-1 z-10">
            <div className="flex items-center gap-2">
              <p className="font-black text-white text-base">Lucky Wheel</p>
              {wheelCanSpin && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                  TAYYOR!
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "rgba(212,175,55,0.65)" }}>
              {wheelCanSpin ? "24 soatlik bepul aylantirish sizni kutmoqda!" : "Har 24 soatda 1 marta bepul bonus yutuq"}
            </p>
          </div>
          <span className="text-lg ml-2 z-10" style={{ color: "rgba(212,175,55,0.5)" }}>→</span>
        </motion.div>
      </Link>

      {/* 3 Main Category Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/sport">
          <motion.div
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-2 cursor-pointer transition-all"
            style={{ padding: "16px 8px", borderRadius: 14, background: "linear-gradient(145deg,#052e16,#0f172a)", border: "1px solid rgba(34,197,94,0.3)" }}
            onClick={() => sounds.click()}
          >
            <Trophy className="w-8 h-8" style={{ color: "#4ade80" }} />
            <span className="font-bold text-white text-sm text-center">Sport</span>
            <span className="text-center" style={{ fontSize: 10, color: "rgba(74,222,128,0.65)" }}>Jonli tikish</span>
          </motion.div>
        </Link>

        <Link href="/casino">
          <motion.div
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-2 cursor-pointer transition-all"
            style={{ padding: "16px 8px", borderRadius: 14, background: "linear-gradient(145deg,#2e1065,#0f172a)", border: "1px solid rgba(168,85,247,0.3)" }}
            onClick={() => sounds.click()}
          >
            <Dice5 className="w-8 h-8" style={{ color: "#c084fc" }} />
            <span className="font-bold text-white text-sm text-center">Kazino</span>
            <span className="text-center" style={{ fontSize: 10, color: "rgba(192,132,252,0.65)" }}>15+ o'yin</span>
          </motion.div>
        </Link>

        <Link href="/slotlar">
          <motion.div
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-2 cursor-pointer transition-all"
            style={{ padding: "16px 8px", borderRadius: 14, background: "linear-gradient(145deg,#431407,#0f172a)", border: "1px solid rgba(249,115,22,0.3)" }}
            onClick={() => sounds.click()}
          >
            <Layers className="w-8 h-8" style={{ color: "#fb923c" }} />
            <span className="font-bold text-white text-sm text-center">Slotlar</span>
            <span className="text-center" style={{ fontSize: 10, color: "rgba(251,146,60,0.65)" }}>12+ slot</span>
          </motion.div>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: <Zap className="w-4 h-4" />, label: "Jonli o'yinlar", val: "20+", color: "#4ade80" },
          { icon: <Star className="w-4 h-4" />, label: "Kunlik g'oliblar", val: "340+", color: "#fbbf24" },
          { icon: <Gift className="w-4 h-4" />, label: "Jami yutuqlar", val: "∞", color: "#c084fc" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-2.5 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
            <div className="font-black text-white text-sm">{s.val}</div>
            <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Hot games */}
      <section>
        <h2 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>
          🔥 Eng mashhur o'yinlar
        </h2>
        <GameGrid games={QUICK_GAMES} filter="all" cols="grid-cols-3 sm:grid-cols-6" />
      </section>

      {/* Support banner */}
      <Link href="/support">
        <motion.div
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          className="flex items-center gap-4 cursor-pointer transition-all"
          style={{ padding: "14px 16px", borderRadius: 14, background: "linear-gradient(135deg,rgba(30,58,138,0.4),rgba(15,23,42,0.8))", border: "1px solid rgba(59,130,246,0.2)" }}
          onClick={() => sounds.click()}
        >
          <div className="flex items-center justify-center shrink-0"
            style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(59,130,246,0.15)" }}>
            <Headset className="w-5 h-5" style={{ color: "#60a5fa" }} />
          </div>
          <div>
            <p className="font-bold text-white text-sm">24/7 Qo'llab-quvvatlash</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(96,165,250,0.65)" }}>Operator bilan bog'laning</p>
          </div>
          <span className="ml-auto text-lg" style={{ color: "rgba(96,165,250,0.35)" }}>→</span>
        </motion.div>
      </Link>

    </div>
  );
}
