import { useState } from "react";
import { useGetSportsMatches, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { sounds } from "@/lib/sounds";
import { X, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

interface BetModal { match: any; betType: "home" | "draw" | "away"; odds: number; label: string; }

// ── Yellow / Red card badge ───────────────────────────────────────────────────
function CardsBadge({ yellow }: { yellow: number }) {
  if (yellow === 0) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:2 }}>
      <span style={{ width:8, height:11, background:"#facc15", borderRadius:1.5, display:"inline-block", border:"1px solid #ca8a04" }} />
      <span style={{ fontSize:9, fontWeight:700, color:"#fde047" }}>{yellow}</span>
    </span>
  );
}

export default function SportPage() {
  const [sportsTab, setSportsTab] = useState<"live" | "upcoming">("live");
  const [betModal, setBetModal] = useState<BetModal | null>(null);
  const [betAmount, setBetAmount] = useState("5000");
  const [, navigate] = useLocation();

  const { data: sports } = useGetSportsMatches({ query: { refetchInterval: 2000 } });
  const { data: user, refetch: refetchUser } = useGetMe();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [bettingPending, setBettingPending] = useState(false);

  const openBet = (match: any, betType: "home" | "draw" | "away", odds: number) => {
    const labels = { home: `1 (${match.homeTeam})`, draw: "X (Durang)", away: `2 (${match.awayTeam})` };
    setBetModal({ match, betType, odds, label: labels[betType] });
    sounds.click();
  };

  const submitBet = async () => {
    if (!betModal || bettingPending) return;
    const amount = Number(betAmount);
    if (!amount || amount < 1000) { toast({ title: "Minimal tikish 1 000 UZS", variant: "destructive" } as any); return; }
    if (amount > (user?.balance || 0)) { toast({ title: "Balans yetarli emas", variant: "destructive" } as any); return; }

    setBettingPending(true);
    sounds.click?.();
    try {
      const token = localStorage.getItem("betuz_token") || "";
      const r = await fetch("/api/sports/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          matchId: betModal.match.id,
          betDescription: betModal.label,
          betAmount: amount,
          odds: betModal.odds,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: data.error || "Xatolik", variant: "destructive" } as any);
        return;
      }
      if (data.pending) {
        // Bet queued — resolved at match end
        toast({ title: "⏳ " + (data.message || "Stavka qabul qilindi!"), description: "O'yin oxirida natija aniqlanadi" });
        sounds.click?.();
      } else if (data.won) {
        toast({ title: `🎉 Yutdingiz! +${data.winAmount?.toLocaleString()} UZS` });
        sounds.win?.();
      } else {
        toast({ title: "😞 Yutqazdingiz", description: "Keyingi o'yinda omad tilaymiz!" });
        sounds.lose?.();
      }
      qc.invalidateQueries();
      refetchUser();
      setBetModal(null);
    } catch {
      toast({ title: "Server xatosi", variant: "destructive" } as any);
    } finally {
      setBettingPending(false);
    }
  };

  const matches = sportsTab === "live" ? (sports?.live || []) : (sports?.upcoming || []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden min-h-[100px] flex items-center p-5 border border-green-600/30 shadow-2xl bg-gradient-to-r from-green-950 via-slate-900 to-green-950">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #22c55e 0%, transparent 60%)" }} />
        <div className="relative z-10 flex-1">
          <h1 className="text-xl font-black text-white mb-0.5">⚽ Sport Tikish</h1>
          <p className="text-green-300/80 text-xs">Jonli va kechki mashhur futbol o'yinlari</p>
        </div>
        <div className="relative z-10 text-right">
          <p className="text-xs text-green-400/60 uppercase tracking-wider">Balans</p>
          <p className="text-lg font-black text-white">{(user?.balance ?? 0).toLocaleString()} <span className="text-xs text-white/40">UZS</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={sportsTab === "live" ? "default" : "outline"}
          className={`flex-1 gap-2 ${sportsTab === "live" ? "bg-green-600 hover:bg-green-500" : ""}`}
          onClick={() => setSportsTab("live")}
        >
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          Jonli ({sports?.live?.length ?? 0})
        </Button>
        <Button
          variant={sportsTab === "upcoming" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setSportsTab("upcoming")}
        >
          🌙 Kechki futbol ({sports?.upcoming?.length ?? 0})
        </Button>
      </div>

      {/* Matches */}
      <div className="space-y-3">
        {matches.map((match) => (
          <motion.div key={match.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-green-700/20 hover:border-green-500/40 transition-all shadow-md overflow-hidden">

            {/* Match header — clickable → MatchView */}
            <div
              className="flex items-center justify-between px-4 pt-3 pb-1 cursor-pointer"
              onClick={() => navigate(`/match/${match.id}`)}
            >
              <div className="flex items-center gap-1.5">
                {match.isLive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                <span className="text-xs font-semibold text-white/60 truncate max-w-[160px]">{match.league}</span>
                {match.isLive && <span className="text-red-400 font-bold text-xs">{match.minute}'</span>}
              </div>
              <div className="flex items-center gap-2">
                {!match.isLive && (
                  <span className="text-white/40 text-xs">
                    {new Date(match.startTime).toLocaleString("uz-UZ", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-green-400 text-xs font-bold hover:text-green-300">
                  Batafsil <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Teams + score */}
            <div
              className="flex items-center justify-between px-4 py-2 cursor-pointer"
              onClick={() => navigate(`/match/${match.id}`)}
            >
              {/* Home team */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <span className="font-black text-sm text-white text-center leading-tight">{match.homeTeam}</span>
                {match.isLive && match.cards && (
                  <CardsBadge yellow={match.cards.homeYellow} />
                )}
              </div>

              {/* Score */}
              <div className="px-3 text-center flex-shrink-0">
                {match.isLive ? (
                  <motion.span
                    key={`${match.homeScore}-${match.awayScore}`}
                    initial={{ scale: 1.2, color: "#4ade80" }} animate={{ scale: 1, color: "#ffffff" }}
                    transition={{ duration: 0.4 }}
                    className="text-2xl font-black font-mono block"
                  >
                    {match.homeScore}:{match.awayScore}
                  </motion.span>
                ) : (
                  <span className="text-lg font-black text-accent">VS</span>
                )}
                {match.isLive && match.corners && (match.corners.home + match.corners.away) > 0 && (
                  <span className="text-xs text-white/30 block">🚩 {match.corners.home}-{match.corners.away}</span>
                )}
              </div>

              {/* Away team */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <span className="font-black text-sm text-white text-center leading-tight">{match.awayTeam}</span>
                {match.isLive && match.cards && (
                  <CardsBadge yellow={match.cards.awayYellow} />
                )}
              </div>
            </div>

            {/* Odds buttons */}
            <div className="grid grid-cols-3 gap-2 px-3 pb-3">
              {([
                { type: "home" as const, label: "1", odds: match.odds.home },
                { type: "draw" as const, label: "X", odds: match.odds.draw },
                { type: "away" as const, label: "2", odds: match.odds.away },
              ] as const).map((opt) => (
                <motion.button key={opt.type} whileTap={{ scale: 0.93 }}
                  onClick={() => openBet(match, opt.type, opt.odds)}
                  className="flex flex-col items-center py-2.5 px-2 rounded-xl bg-slate-800/80 hover:bg-green-800/40 hover:border-green-500 border border-white/10 transition-all cursor-pointer">
                  <span className="text-xs text-muted-foreground mb-0.5">{opt.label}</span>
                  <motion.span
                    key={opt.odds.toFixed(2)}
                    initial={{ color: "#D4AF37" }} animate={{ color: "#ffffff" }}
                    transition={{ duration: 0.4 }}
                    className="text-sm font-black"
                  >
                    {opt.odds.toFixed(2)}
                  </motion.span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}

        {matches.length === 0 && (
          <div className="text-center py-14 text-muted-foreground">
            <div className="text-5xl mb-3">{sportsTab === "live" ? "🔴" : "🌙"}</div>
            <p className="text-base font-medium">
              {sportsTab === "live" ? "Jonli o'yinlar yuklanmoqda…" : "Kechki o'yinlar yuklanmoqda…"}
            </p>
            <p className="text-sm mt-1 text-muted-foreground/60">Bir oz kuting</p>
          </div>
        )}
      </div>

      {/* Bet Modal */}
      <AnimatePresence>
        {betModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setBetModal(null); }}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 border border-green-500/30">

              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground">{betModal.match.league}</p>
                  <h3 className="font-bold text-white">{betModal.match.homeTeam} — {betModal.match.awayTeam}</h3>
                  <p className="text-sm text-green-400 mt-0.5 font-semibold">{betModal.label}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setBetModal(null)}><X className="w-4 h-4" /></Button>
              </div>

              <div className="flex items-center justify-between bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                <span className="text-sm text-muted-foreground">Koeffitsient</span>
                <span className="text-3xl font-black text-accent">{betModal.odds.toFixed(2)}x</span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tikish miqdori (UZS)</label>
                <Input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="font-bold text-lg text-center" />
                <div className="flex gap-2 mt-2">
                  {[1000, 5000, 10000, 50000].map((v) => (
                    <Button key={v} variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setBetAmount(String(v))}>
                      {v >= 1000 ? `${v / 1000}k` : v}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">Mumkin bo'lgan yutuq:</span>
                  <span className="text-emerald-400 font-black text-base">
                    +{(Number(betAmount) * betModal.odds).toLocaleString()} UZS
                  </span>
                </div>
              </div>

              <Button variant="gold" className="w-full text-base h-12" onClick={submitBet} disabled={bettingPending}>
                {bettingPending ? "⏳ Joylashtirilmoqda…" : `⚽ TIKISH — ${Number(betAmount).toLocaleString()} UZS`}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
