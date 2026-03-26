import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { X, Info, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";

// ── Segment definitions (10 segments, 36° each) ───────────────────────────
const SEGMENTS = [
  { type: "bomb",      emoji: "💣", label: "Bomba",      color: "#1e2f6e", alt: "#172464" },
  { type: "free_spin", emoji: "🔄", label: "Bepul",      color: "#0d4a5e", alt: "#0b3d4e" },
  { type: "bomb",      emoji: "💣", label: "Bomba",      color: "#1e2f6e", alt: "#172464" },
  { type: "x2",        emoji: "×2", label: "×2",         color: "#2d1070", alt: "#230d5c" },
  { type: "bomb",      emoji: "💣", label: "Bomba",      color: "#1e2f6e", alt: "#172464" },
  { type: "bomb",      emoji: "💣", label: "Bomba",      color: "#172464", alt: "#1e2f6e" },
  { type: "free_bet",  emoji: "🎰", label: "FREE BET",   color: "#1a3a8b", alt: "#142f73" },
  { type: "bomb",      emoji: "💣", label: "Bomba",      color: "#1e2f6e", alt: "#172464" },
  { type: "money",     emoji: "💰", label: "5 000",      color: "#0d5228", alt: "#0a4220" },
  { type: "bomb",      emoji: "💣", label: "Bomba",      color: "#172464", alt: "#1e2f6e" },
];

const SEG_COUNT = SEGMENTS.length;
const SEG_ANGLE = 360 / SEG_COUNT; // 36°
const CX = 160, CY = 160, R = 142, R_TEXT = 106, R_LABEL = 82;

// ── SVG helpers ───────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  return `M${cx},${cy} L${s.x.toFixed(2)},${s.y.toFixed(2)} A${r},${r},0,0,1,${e.x.toFixed(2)},${e.y.toFixed(2)}Z`;
}

// ── Countdown helper ──────────────────────────────────────────────────────
function useCountdown(nextAt: string | null) {
  const [display, setDisplay] = useState("00:00:00");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!nextAt) { setExpired(true); return; }
    const tick = () => {
      const diff = new Date(nextAt).getTime() - Date.now();
      if (diff <= 0) { setDisplay("00:00:00"); setExpired(true); return; }
      setExpired(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextAt]);

  return { display, expired };
}

// ── Main component ────────────────────────────────────────────────────────
export default function LuckyWheelPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { refetch: refetchUser } = useGetMe();

  const [canSpin, setCanSpin]       = useState(false);
  const [hasDeposited, setHasDeposited] = useState(true);
  const [nextAt, setNextAt]         = useState<string | null>(null);
  const [spinning, setSpinning]     = useState(false);
  const [rotation, setRotation]     = useState(0);
  const [result, setResult]         = useState<any | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showInfo, setShowInfo]     = useState(false);

  const { display: countdownText, expired } = useCountdown(nextAt);

  function authHeaders(): HeadersInit {
    const token = localStorage.getItem("betuz_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Load status
  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/lucky-wheel/status", { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setCanSpin(d.canSpin);
        setNextAt(d.nextSpinAt);
        setHasDeposited(d.hasDeposited ?? true);
      }
    } catch {}
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // When countdown expires, allow spin
  useEffect(() => { if (expired) setCanSpin(true); }, [expired]);

  // Calculate final rotation to land on segment `idx` (pointer at 90° = right)
  function calcRotation(idx: number, current: number): number {
    const target = ((90 - idx * SEG_ANGLE - SEG_ANGLE / 2) % 360 + 360) % 360;
    const minFinal = current + 1800;
    const k = Math.ceil((minFinal - target) / 360);
    return k * 360 + target;
  }

  const handleSpin = async () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setCanSpin(false);

    try {
      const r = await fetch("/api/lucky-wheel/spin", { method: "POST", headers: authHeaders() });
      const data = await r.json();

      if (!r.ok) {
        toast({ title: data.error || "Xatolik", variant: "destructive" } as any);
        setCanSpin(true);
        setSpinning(false);
        return;
      }

      const finalRot = calcRotation(data.segmentIndex, rotation);
      setRotation(finalRot);
      setResult(data);

      // Show result after spin animation (4s)
      setTimeout(() => {
        setSpinning(false);
        setShowResult(true);
        if (data.segment.type !== "free_spin") {
          setNextAt(new Date(Date.now() + 24 * 3600000).toISOString());
        }
        refetchUser();
      }, 4200);
    } catch {
      toast({ title: "Server xatosi", variant: "destructive" } as any);
      setCanSpin(true);
      setSpinning(false);
    }
  };

  const closeResult = () => {
    setShowResult(false);
    if (result?.segment?.type === "free_spin") {
      setCanSpin(true);
    }
  };

  const goToGame = () => {
    setShowResult(false);
    if (result?.game?.path) navigate(result.game.path);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center pb-8 relative"
      style={{ background: "linear-gradient(180deg,#0a0f1e 0%,#050810 100%)" }}
    >
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => navigate("/")} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(212,175,55,0.9)" }}>
          LUCKY WHEEL
        </h1>
        <button onClick={() => setShowInfo(true)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <Info className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Stars background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              background: "#fff",
              opacity: Math.random() * 0.5 + 0.1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 60}%`,
            }}
          />
        ))}
      </div>

      {/* Wheel wrapper */}
      <div className="relative mt-6 flex items-center justify-center" style={{ width: 340, height: 340, contain: "paint", isolation: "isolate" }}>
        {/* Glow */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(212,175,55,0.18) 0%, transparent 70%)",
            animation: "pulse 2s infinite",
          }}
        />

        {/* SVG Wheel */}
        <svg viewBox="0 0 320 320" width="320" height="320" style={{ overflow: "visible" }}>
          {/* Outer decorative rings */}
          <circle cx={CX} cy={CY} r={R + 20} fill="none" stroke="#8b6914" strokeWidth="4" />
          <circle cx={CX} cy={CY} r={R + 14} fill="none" stroke="#d4af37" strokeWidth="10" />
          <circle cx={CX} cy={CY} r={R + 5}  fill="none" stroke="#b8960c" strokeWidth="3" />

          {/* Spinning group */}
          <g
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${CX}px ${CY}px`,
              transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              willChange: "transform",
            }}
          >
            {/* Background fill */}
            <circle cx={CX} cy={CY} r={R} fill="#0a1a3e" />

            {SEGMENTS.map((seg, i) => {
              const start  = i * SEG_ANGLE;
              const end    = (i + 1) * SEG_ANGLE;
              const mid    = i * SEG_ANGLE + SEG_ANGLE / 2;
              const tp     = polar(CX, CY, R_TEXT, mid);
              const lp     = polar(CX, CY, R_LABEL, mid);
              const isSpecial = seg.type !== "bomb";

              return (
                <g key={i}>
                  {/* Segment fill */}
                  <path
                    d={arcPath(CX, CY, R, start, end)}
                    fill={i % 2 === 0 ? seg.color : seg.alt}
                    stroke="#d4af37"
                    strokeWidth="1.2"
                  />

                  {/* Highlight for special segments */}
                  {isSpecial && (
                    <path
                      d={arcPath(CX, CY, R, start, end)}
                      fill="none"
                      stroke={
                        seg.type === "free_bet"  ? "rgba(212,175,55,0.6)"
                        : seg.type === "money"   ? "rgba(34,197,94,0.6)"
                        : seg.type === "x2"      ? "rgba(167,139,250,0.6)"
                        : "rgba(20,184,166,0.6)"
                      }
                      strokeWidth="2.5"
                    />
                  )}

                  {/* Emoji */}
                  <text
                    x={tp.x} y={tp.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={seg.type === "x2" ? "20" : "22"}
                    fontWeight="900"
                    fill={seg.type === "x2" ? "#c4b5fd" : "#fff"}
                    transform={`rotate(${mid}, ${tp.x}, ${tp.y})`}
                    style={{ userSelect: "none" }}
                  >
                    {seg.emoji}
                  </text>

                  {/* Label */}
                  <text
                    x={lp.x} y={lp.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={seg.type === "free_bet" ? "6.5" : "6"}
                    fontWeight="700"
                    fill={
                      seg.type === "free_bet" ? "#d4af37"
                      : seg.type === "money"  ? "#86efac"
                      : seg.type === "x2"     ? "#c4b5fd"
                      : "rgba(148,163,184,0.7)"
                    }
                    transform={`rotate(${mid}, ${lp.x}, ${lp.y})`}
                    style={{ userSelect: "none" }}
                  >
                    {seg.label}
                  </text>
                </g>
              );
            })}

            {/* Center gem */}
            <circle cx={CX} cy={CY} r={30} fill="#6b0000" />
            <circle cx={CX} cy={CY} r={26} fill="#cc0000" />
            <circle cx={CX} cy={CY} r={22} fill="#e60000" />
            <circle cx={CX} cy={CY} r={14} fill="rgba(255,100,100,0.5)" />
            <circle cx={CX} cy={CY} r={7}  fill="rgba(255,200,200,0.7)" />
          </g>

          {/* Pointer arrow (fixed, at right = 90°) */}
          <polygon
            points={`${CX + R + 22},${CY} ${CX + R + 4},${CY - 13} ${CX + R + 4},${CY + 13}`}
            fill="#e63946"
            stroke="#d4af37"
            strokeWidth="2"
          />
          {/* Pointer gem */}
          <circle cx={CX + R + 22} cy={CY} r="5" fill="#ff6b6b" stroke="#d4af37" strokeWidth="1.5" />

          {/* Top decoration gem */}
          <circle cx={CX} cy={CY - R - 14} r="7" fill="#cc0000" stroke="#d4af37" strokeWidth="2" />
        </svg>
      </div>

      {/* Countdown / deposit required */}
      <div className="mt-6 flex flex-col items-center gap-1">
        {!hasDeposited && (
          <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl text-center"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="text-sm font-bold" style={{ color: "#f87171" }}>
              🔒 Lucky Wheel uchun depozit kerak
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              Kamida 1 marta pul kiriting
            </p>
          </div>
        )}
        {hasDeposited && !canSpin && (
          <>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              Takror bepul aylantirishga:
            </p>
            <div
              className="font-mono text-2xl font-black tracking-widest"
              style={{ color: "#d4af37", textShadow: "0 0 20px rgba(212,175,55,0.5)" }}
            >
              {countdownText}
            </div>
          </>
        )}
        {hasDeposited && canSpin && (
          <p className="text-sm font-bold" style={{ color: "#4ade80" }}>
            ✅ Aylantirishga tayyor!
          </p>
        )}
      </div>

      {/* Spin button */}
      <div className="mt-5 w-full max-w-xs px-4">
        {!hasDeposited ? (
          <button
            onClick={() => navigate("/deposit")}
            className="w-full py-4 rounded-2xl text-base font-black uppercase tracking-wider transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #d4af37, #b8860b)",
              color: "#000",
              boxShadow: "0 4px 20px rgba(212,175,55,0.4)",
            }}
          >
            💳 DEPOZIT QILISH
          </button>
        ) : (
        <button
          onClick={handleSpin}
          disabled={!canSpin || spinning}
          className="w-full py-4 rounded-2xl text-base font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: canSpin && !spinning
              ? "linear-gradient(135deg, #22c55e, #16a34a)"
              : "rgba(255,255,255,0.08)",
            color: canSpin && !spinning ? "#000" : "rgba(255,255,255,0.4)",
            boxShadow: canSpin && !spinning ? "0 4px 20px rgba(34,197,94,0.4)" : "none",
          }}
        >
          {spinning ? "⏳ Aylanmoqda..." : canSpin ? "🎡 AYLANTIRISH" : "⏳ Kutilmoqda"}
        </button>
        )}

        <button
          onClick={() => setShowInfo(true)}
          className="w-full mt-3 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          BONUSLAR HAQIDA MA'LUMOT
        </button>
      </div>

      {/* ── Result Modal ── */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.8)" }}
            onClick={closeResult}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              className="w-full max-w-lg rounded-t-3xl p-6 pb-10 space-y-5"
              style={{ background: "#0f1923", border: "1px solid rgba(212,175,55,0.3)", borderBottom: "none" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-white">Natija</h2>
                <button onClick={closeResult} className="p-1 rounded-full hover:bg-white/10">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Prize display */}
              <div className="text-center py-4">
                {result.segment.type === "bomb" ? (
                  <>
                    <div className="text-6xl mb-3">💣</div>
                    <p className="text-2xl font-black text-red-400">Omadsizlik!</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      24 soatdan keyin yana urinib ko'ring
                    </p>
                  </>
                ) : result.segment.type === "free_spin" ? (
                  <>
                    <div className="text-6xl mb-3">🔄</div>
                    <p className="text-2xl font-black text-teal-400">Bepul spin!</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Yana bir bor aylantirishingiz mumkin
                    </p>
                  </>
                ) : result.segment.type === "money" ? (
                  <>
                    <div className="text-6xl mb-3">💰</div>
                    <p className="text-2xl font-black text-green-400">+5,000 UZS</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Balansingizga qo'shildi!
                    </p>
                  </>
                ) : result.segment.type === "x2" ? (
                  <>
                    <div className="text-6xl mb-3">×2</div>
                    <p className="text-2xl font-black text-purple-400">+10,000 UZS Bonus</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Balansingizga qo'shildi! {result.game?.name} o'yiniga yo'naltirilasiz
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-3">🎰</div>
                    <p className="text-2xl font-black" style={{ color: "#d4af37" }}>FREE BET!</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      20,000 UZS bonus balansingizga qo'shildi
                    </p>
                    <p className="text-sm font-bold mt-1 text-white">
                      {result.game?.name} o'yiniga yo'naltirilasiz
                    </p>
                  </>
                )}
              </div>

              {/* Actions */}
              {result.segment.type === "free_spin" ? (
                <Button className="w-full" onClick={closeResult}
                  style={{ background: "linear-gradient(135deg,#0d9488,#0f766e)", color: "#fff" }}>
                  🔄 Yana aylantirish
                </Button>
              ) : result.game ? (
                <Button className="w-full" onClick={goToGame}
                  style={{ background: "linear-gradient(135deg,#d4af37,#b8960c)", color: "#000" }}>
                  🎮 {result.game.name} o'ynash →
                </Button>
              ) : (
                <Button className="w-full" onClick={closeResult}
                  style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                  Yopish
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Info Modal ── */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="w-full max-w-lg rounded-t-3xl overflow-y-auto"
              style={{ background: "#fff", maxHeight: "75vh" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 flex items-center justify-between px-5 py-4">
                <h2 className="text-base font-black text-gray-900">Bonuslar haqida ma'lumot</h2>
                <button onClick={() => setShowInfo(false)} className="p-1 rounded-full hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {INFO_ITEMS.map((item, i) => (
                  <div key={i} className="flex items-start gap-4 px-5 py-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
                      style={{ background: item.bg }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900 leading-snug">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const INFO_ITEMS = [
  {
    icon: "×2",
    bg: "linear-gradient(135deg,#4c1d95,#7c3aed)",
    title: "×2 Bonus",
    desc: "10,000 UZS balansga qo'shiladi va tasodifiy tanlangan o'yinga yo'naltirilasiz.",
  },
  {
    icon: "💰",
    bg: "linear-gradient(135deg,#14532d,#16a34a)",
    title: "Bepul pul",
    desc: "5,000 UZS balansga to'g'ridan-to'g'ri qo'shiladi. Istalgan o'yinda ishlatishingiz mumkin.",
  },
  {
    icon: "🎰",
    bg: "linear-gradient(135deg,#1e3a8a,#2563eb)",
    title: "FREE BET — 20,000 UZS",
    desc: "20,000 UZS bonus sifatida balansingizga qo'shiladi va tasodifiy o'yinga yo'naltirilasiz. Yutgan pulni to'liq olasiz!",
  },
  {
    icon: "🔄",
    bg: "linear-gradient(135deg,#134e4a,#0d9488)",
    title: "Lucky Wheel bepul aylantirish",
    desc: "Yana bir bor bepul aylantirish huquqi beriladi. 24 soatlik kutish davri qayta boshlanmaydi!",
  },
  {
    icon: "💣",
    bg: "linear-gradient(135deg,#7f1d1d,#dc2626)",
    title: "Bomba — Omadsizlik",
    desc: "24 soatlik taymer ishga tushadi. Ertaga yana urinib ko'ring!",
  },
];
