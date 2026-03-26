import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, Download, CheckCircle2, ChevronRight, Chrome, Share2, Star, Shield, Zap, Bell } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const BASE = import.meta.env.BASE_URL;

export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/android/.test(ua)) setPlatform("android");
    setIsTelegram(/telegram/i.test(navigator.userAgent));

    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setInstalled(isInstalled);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setDeferredPrompt(null);
      }
    } finally {
      setInstalling(false);
    }
  };

  const appFeatures = [
    { icon: <Zap className="w-4 h-4" />, text: "Tez yuklanadi, offline ham ishlaydi", color: "text-yellow-400" },
    { icon: <Bell className="w-4 h-4" />, text: "Push bildirishnomalar — bonus va natijalar", color: "text-blue-400" },
    { icon: <Shield className="w-4 h-4" />, text: "100% xavfsiz — ma'lumotlar himoyalangan", color: "text-emerald-400" },
    { icon: <Star className="w-4 h-4" />, text: "50+ kazino o'yini va sport stavkalar", color: "text-purple-400" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#080c14] via-[#0a0f1a] to-[#080c14] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#080c14]/90 backdrop-blur-lg border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <button className="text-muted-foreground hover:text-white transition-colors p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <span className="font-black text-white">Ilovani yuklab olish</span>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">

        {/* ─── Hero: App Icon + info ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          {/* App icon */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-[22px] overflow-hidden shadow-2xl shadow-yellow-500/20 border-2 border-yellow-500/30">
              <img
                src={`${BASE}app-icon.png`}
                alt="BetUZ"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.src = `${BASE}pwa-512x512.png`;
                }}
              />
            </div>
            {/* Rating badge */}
            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-[10px] font-black rounded-full px-1.5 py-0.5 flex items-center gap-0.5 shadow-lg">
              <Star className="w-2.5 h-2.5 fill-black" />4.9
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black gold-text leading-tight">BetUZ</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Kazino & Sport Stavka</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">BEPUL</span>
              <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">18+</span>
              <span className="text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold">O'ZBEKISTON</span>
            </div>
          </div>
        </motion.div>

        {/* ─── Star rating bar ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-3 border border-white/5"
        >
          <div className="text-center">
            <p className="text-2xl font-black text-yellow-400">4.9</p>
            <div className="flex gap-0.5 mt-0.5">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Reyting</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-black text-white">10K+</p>
            <p className="text-[10px] text-muted-foreground mt-1">Foydalanuvchi</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-black text-white">50+</p>
            <p className="text-[10px] text-muted-foreground mt-1">O'yinlar</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-black text-emerald-400">24/7</p>
            <p className="text-[10px] text-muted-foreground mt-1">Ishlaydi</p>
          </div>
        </motion.div>

        {/* ─── Installed notice ─── */}
        {installed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-emerald-400">Ilova o'rnatilgan!</p>
              <p className="text-xs text-muted-foreground">Uy ekranida BetUZ ikonkasi paydo bo'ldi</p>
            </div>
          </motion.div>
        )}

        {/* ─── Install CTA ─── */}
        {!installed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            {/* Telegram browser */}
            {isTelegram && (
              <div className="space-y-2">
                <a
                  href="https://t.me/Super_cazino_bot?start=apk"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between bg-gradient-to-r from-[#229ED9] to-[#1a7fc0] text-white font-black rounded-2xl px-5 py-4 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <img src={`${BASE}app-icon.png`} alt="" className="w-10 h-10 rounded-xl object-cover"
                      onError={e => { e.currentTarget.src=`${BASE}pwa-192x192.png`; }} />
                    <div className="text-left">
                      <p className="text-sm font-black">Botdan yuklab olish</p>
                      <p className="text-xs opacity-80">@Super_cazino_bot orqali</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </a>
                <p className="text-center text-xs text-muted-foreground">Bot sizga o'rnatish ko'rsatmasini yuboradi</p>
              </div>
            )}

            {/* Android Chrome — direct install */}
            {!isTelegram && deferredPrompt && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="w-full flex items-center justify-between bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black rounded-2xl px-5 py-4 transition-all active:scale-95 disabled:opacity-70 shadow-lg shadow-yellow-500/25"
              >
                <div className="flex items-center gap-3">
                  <img src={`${BASE}app-icon.png`} alt="" className="w-10 h-10 rounded-xl object-cover"
                    onError={e => { e.currentTarget.src=`${BASE}pwa-192x192.png`; }} />
                  <div className="text-left">
                    <p className="text-sm font-black">{installing ? "O'rnatilmoqda..." : "Ilovani o'rnatish"}</p>
                    <p className="text-xs opacity-70">Bepul • Android uchun</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Download className="w-5 h-5" />
                </div>
              </button>
            )}

            {/* Android Chrome — manual guide */}
            {!isTelegram && !deferredPrompt && (platform === "android" || platform === "other") && (
              <div className="glass-panel rounded-2xl p-4 border border-yellow-500/20 space-y-3">
                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                  <Chrome className="w-5 h-5" />
                  <span className="font-bold text-sm">Chrome orqali o'rnatish</span>
                </div>
                {[
                  "Chrome brauzerni oching (Telegram emas)",
                  "Yuqori o'ng burchakdagi ⋮ menyuni bosing",
                  `"Ilovani o'rnatish" yoki "Qurilmaga qo'shish" tanlang`,
                  `"O'rnatish" tugmasini bosing ✅`,
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            )}

            {/* iOS */}
            {!isTelegram && platform === "ios" && (
              <div className="glass-panel rounded-2xl p-4 border border-blue-500/20 space-y-3">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <Share2 className="w-5 h-5" />
                  <span className="font-bold text-sm">iPhone / iPad uchun</span>
                </div>
                {[
                  "Safari brauzerni oching (Chrome emas)",
                  `Pastdagi "Ulashish" ( ⬆ ) tugmasini bosing`,
                  `"Bosh ekranga qo'shish" tanlang`,
                  `"Qo'shish" tugmasini bosing ✅`,
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── App screenshots row ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Skrinshotlar</p>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {[
              { bg: "from-yellow-900/60 to-slate-900", emoji: "🎰", label: "Kazino o'yinlar" },
              { bg: "from-green-900/60 to-slate-900", emoji: "⚽", label: "Sport stavka" },
              { bg: "from-purple-900/60 to-slate-900", emoji: "🎡", label: "Lucky Wheel" },
              { bg: "from-blue-900/60 to-slate-900", emoji: "💎", label: "Gems Odyssey" },
            ].map((s, i) => (
              <div key={i} className={`shrink-0 w-28 h-48 rounded-2xl bg-gradient-to-b ${s.bg} border border-white/10 flex flex-col items-center justify-center gap-2`}>
                <span className="text-4xl">{s.emoji}</span>
                <p className="text-[10px] text-center text-muted-foreground px-2 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Features ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3"
        >
          <p className="font-bold text-sm">Ilova afzalliklari</p>
          {appFeatures.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`${f.color} shrink-0`}>{f.icon}</div>
              <p className="text-xs text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </motion.div>

        {/* ─── Footer ─── */}
        <p className="text-center text-[10px] text-muted-foreground pb-4">
          BetUZ v2.0 • PWA • Bepul yuklab olish • 18+
        </p>
      </div>
    </div>
  );
}
