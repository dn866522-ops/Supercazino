import { useState, useRef, useEffect, useCallback } from "react";
import { useGetMe, useGetReferral, useGetTransactions, useUpdateProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Copy, Share2, CheckCircle, ShieldAlert, Clock, CheckCircle2, XCircle, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { Link } from "wouter";

export default function ProfilePage() {
  const { data: user, refetch } = useGetMe();
  const { data: ref } = useGetReferral();
  const { data: tx } = useGetTransactions();
  const { mutate: update } = useUpdateProfile();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [sportsBets, setSportsBets] = useState<any[]>([]);
  const [selectedBet, setSelectedBet] = useState<any | null>(null);
  const [liveMatch, setLiveMatch]     = useState<any | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);

  const authHeader = () => {
    const token = localStorage.getItem("betuz_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    fetch("/api/sports/my-bets", { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (d.bets) setSportsBets(d.bets); })
      .catch(() => {});
  }, [user]);

  const openBetDetail = useCallback(async (bet: any) => {
    setSelectedBet(bet);
    setLiveMatch(null);
    if (bet.status === "pending") {
      setLoadingMatch(true);
      try {
        const r = await fetch(`/api/sports/match/${bet.matchId}`);
        if (r.ok) {
          const d = await r.json();
          setLiveMatch(d.match ?? null);
        }
      } catch {}
      setLoadingMatch(false);
    }
  }, []);

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    country: user?.country || '',
    city: user?.city || ''
  });

  // Hidden admin access: tap version 7 times to show code input
  const [adminTaps, setAdminTaps] = useState(0);
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionTap = () => {
    const next = adminTaps + 1;
    setAdminTaps(next);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (next >= 7) {
      setShowAdminInput(true);
      setAdminTaps(0);
    } else {
      tapTimer.current = setTimeout(() => setAdminTaps(0), 2000);
    }
  };

  const submitAdminCode = async () => {
    try {
      const token = localStorage.getItem("betuz_token");
      const resp = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: adminCode }),
      });
      if (resp.ok) {
        toast({ title: "Admin huquqi berildi!" });
        setShowAdminInput(false);
        setAdminCode("");
        refetch();
      } else {
        toast({ title: "Noto'g'ri kod", variant: "destructive" } as any);
      }
    } catch {
      toast({ title: "Xatolik", variant: "destructive" } as any);
    }
  };

  if (!user) return null;

  const referralLink = `https://betuz.app/register?ref=${ref?.referralCode || ''}`;
  const refCode = ref?.referralCode || '...';

  const handleCopy = async () => {
    const text = `BetUZ — O'zbekistonning eng yaxshi onlayn casino!\nRo'yxatdan o'ting va bonus oling: ${referralLink}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    toast({ title: "Nusxalandi! ✅", description: "Referral havolasi nusxalandi" });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    const text = `🎰 BetUZ — O'zbekistonning eng yaxshi onlayn casino!\n🎁 Ro'yxatdan o'ting va 50,000 UZS bonus oling!\n👉 ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "BetUZ Casino", text, url: referralLink });
      } catch {}
    } else {
      const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("🎰 BetUZ Casino — Registratsiyadan o'ting va 50,000 UZS bonus oling!")}`;
      window.open(url, "_blank");
    }
  };

  const handleSave = () => {
    update({ data: form }, {
      onSuccess: () => {
        toast({ title: "Saqlandi", description: "Profil ma'lumotlari yangilandi" });
        refetch();
      }
    });
  };

  const progress = Math.min((ref?.referredCount || 0) / 5 * 100, 100);

  return (
    <>
    <div className="max-w-2xl mx-auto space-y-6 pb-8">

      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl flex items-center gap-6">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center border-2 border-primary">
          <UserCircle className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{user.username}</h2>
          <p className="text-muted-foreground font-mono text-sm">ID: {user.userId}</p>
          <div className="mt-2 text-xl font-bold text-accent">{formatMoney(user.balance)}</div>
        </div>
      </div>

      {/* Referral */}
      <div className="glass-panel p-6 rounded-3xl border border-accent/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <h3 className="text-lg font-bold text-accent mb-1">🎁 Referral Dasturi</h3>
        <p className="text-sm text-gray-300 mb-4">
          Do'stingizni taklif qiling — u 100,000+ depozit qilsa siz{" "}
          <strong className="text-white">200,000 UZS</strong> bonus olasiz!
        </p>

        <div className="bg-background/60 border border-border rounded-2xl px-4 py-3 mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Sizning kodingiz</p>
            <p className="font-mono text-lg font-bold tracking-widest text-primary">{refCode}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Taklif qilinganlar</p>
            <p className="font-bold text-white">{ref?.referredCount || 0} / 5</p>
          </div>
        </div>

        <div className="h-2 w-full bg-background rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-accent to-yellow-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex-1 bg-background px-3 py-2.5 rounded-xl font-mono text-xs border border-border text-muted-foreground truncate">
            {referralLink}
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleCopy}>
            {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Nusxalandi" : "Nusxala"}
          </Button>
          <Button size="sm" className="shrink-0 gap-1.5 bg-blue-600 hover:bg-blue-500" onClick={handleShare}>
            <Share2 className="w-4 h-4" /> Ulash
          </Button>
        </div>
      </div>

      {/* Personal Info */}
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <h3 className="text-lg font-bold border-b border-border pb-2">Shaxsiy Ma'lumotlar</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Ism</label>
            <Input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} placeholder="Ismingiz" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Familiya</label>
            <Input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} placeholder="Familiyangiz" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Davlat</label>
            <Input value={form.country} onChange={e => setForm({...form, country: e.target.value})} placeholder="O'zbekiston" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Shahar</label>
            <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Toshkent" />
          </div>
        </div>
        <Button className="w-full mt-2" onClick={handleSave}>Ma'lumotlarni Saqlash</Button>
      </div>

      {/* Sports Bet History */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <Clock className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-bold">Sport Stavkalari Tarixi</h3>
        </div>

        {sportsBets.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Hali sport stavkasi yo'q
          </div>
        ) : (
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {sportsBets.map((bet: any) => (
              <div
                key={bet.id}
                className="px-5 py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors"
                onClick={() => openBetDetail(bet)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {bet.status === "pending"
                      ? <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                      : bet.won
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    }
                    <p className="text-sm font-bold text-white truncate">{bet.matchName}</p>
                    {bet.isCoupon && (
                      <span style={{ fontSize: 10, background: "rgba(212,175,55,0.2)", color: "#d4af37",
                        borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>KUPON</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{bet.betDescription}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {new Date(bet.createdAt).toLocaleString("uz-UZ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground mb-0.5">
                    {bet.betAmount.toLocaleString()} × x{bet.odds.toFixed(2)}
                  </div>
                  <div className={`text-sm font-black ${
                    bet.status === "pending" ? "text-yellow-400"
                    : bet.won ? "text-green-400" : "text-red-400"
                  }`}>
                    {bet.status === "pending"
                      ? "⏳ Kutilmoqda"
                      : bet.won
                        ? `+${(bet.winAmount || 0).toLocaleString()}`
                        : `-${bet.betAmount.toLocaleString()}`
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History */}
      {tx && tx.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <h3 className="text-lg font-bold border-b border-border pb-2">Tranzaksiyalar</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {tx.slice(0, 20).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{t.description || t.type}</p>
                  <p className="text-xs text-muted-foreground">{t.createdAt ? new Date(t.createdAt).toLocaleString("uz-UZ") : ""}</p>
                </div>
                <span className={`font-bold text-sm ${Number(t.amount) > 0 ? "text-green-400" : "text-red-400"}`}>
                  {Number(t.amount) > 0 ? "+" : ""}{Number(t.amount).toLocaleString()} UZS
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Panel — visible ONLY to admin users */}
      {(user as any).isAdmin && (
        <Link href="/admin">
          <div className="flex items-center justify-between p-4 rounded-2xl border border-red-500/30 bg-red-950/25 hover:bg-red-950/40 transition-all cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                <ShieldAlert className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-bold text-red-400 text-sm">Admin Panel</p>
                <p className="text-xs text-muted-foreground">Tizimni boshqarish</p>
              </div>
            </div>
            <span className="text-red-400/60 text-xs font-bold">→</span>
          </div>
        </Link>
      )}

      {/* Secret admin code input (shows after 7 taps on version) */}
      {showAdminInput && (
        <div className="rounded-2xl p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p className="text-xs text-muted-foreground text-center">Kirish kodini kiriting</p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="••••••••••"
              className="bg-white/5 border-white/10 text-white flex-1"
              onKeyDown={(e) => e.key === "Enter" && submitAdminCode()}
            />
            <Button onClick={submitAdminCode} variant="outline" className="border-white/10">
              OK
            </Button>
          </div>
          <p
            className="text-center text-xs text-muted-foreground cursor-pointer"
            onClick={() => { setShowAdminInput(false); setAdminCode(""); }}
          >
            Bekor qilish
          </p>
        </div>
      )}

      {/* Version number — tap 7 times to reveal admin code input */}
      <div className="pb-2 pt-1">
        <p
          className="text-center select-none"
          style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", cursor: "default" }}
          onClick={handleVersionTap}
        >
          BetUZ v1.0.0{adminTaps > 0 ? ` (${7 - adminTaps})` : ""}
        </p>
      </div>

    </div>

    {/* ── Bet Detail Modal ── */}
    {selectedBet && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={() => setSelectedBet(null)}
      >
        <div
          className="w-full max-w-lg rounded-t-3xl overflow-y-auto"
          style={{ background: "#0f1923", border: "1px solid rgba(212,175,55,0.25)", borderBottom: "none", maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}
        >
        <div className="p-5 pb-8 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedBet.status === "pending"
                ? <Clock className="w-4 h-4 text-yellow-400" />
                : selectedBet.won
                  ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                  : <XCircle className="w-4 h-4 text-red-400" />
              }
              <span className="font-bold text-sm">
                {selectedBet.status === "pending" ? "Kutilmoqda" : selectedBet.won ? "Yutildi ✅" : "Yutqazildi ❌"}
              </span>
            </div>
            <button onClick={() => setSelectedBet(null)} className="p-1 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Match name */}
          <div className="text-center">
            <p className="text-lg font-black text-white">{selectedBet.matchName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(selectedBet.createdAt).toLocaleString("uz-UZ")}
            </p>
          </div>

          {/* Live match stats (pending only) */}
          {selectedBet.status === "pending" && (
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider text-center">Jonli holat</p>
              {loadingMatch ? (
                <p className="text-center text-sm text-muted-foreground">Yuklanmoqda...</p>
              ) : liveMatch ? (
                <>
                  {/* Score + minute */}
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-sm font-bold text-white text-right flex-1 truncate">{liveMatch.homeTeam}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-2xl font-black" style={{ color: "#d4af37" }}>
                        {liveMatch.homeScore}
                      </span>
                      <span className="text-base text-muted-foreground font-bold">:</span>
                      <span className="text-2xl font-black" style={{ color: "#d4af37" }}>
                        {liveMatch.awayScore}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-white text-left flex-1 truncate">{liveMatch.awayTeam}</span>
                  </div>

                  {/* Minute badge */}
                  <div className="flex justify-center">
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: "rgba(212,175,55,0.15)", color: "#d4af37", border: "1px solid rgba(212,175,55,0.3)" }}>
                      ⏱ {liveMatch.minute}′ {liveMatch.status === "live" ? "JONLI" : ""}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center mt-1">
                    <div className="rounded-xl py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <p className="text-lg font-black text-white">
                        {(liveMatch.cards?.homeYellow || 0) + (liveMatch.cards?.awayYellow || 0)}
                      </p>
                      <p className="text-xs text-yellow-400 mt-0.5">🟨 Sariq karta</p>
                      <p className="text-xs text-muted-foreground/60">
                        {liveMatch.cards?.homeYellow || 0} — {liveMatch.cards?.awayYellow || 0}
                      </p>
                    </div>
                    <div className="rounded-xl py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <p className="text-lg font-black text-white">
                        {(liveMatch.corners?.home || 0) + (liveMatch.corners?.away || 0)}
                      </p>
                      <p className="text-xs text-blue-400 mt-0.5">📐 Burchak</p>
                      <p className="text-xs text-muted-foreground/60">
                        {liveMatch.corners?.home || 0} — {liveMatch.corners?.away || 0}
                      </p>
                    </div>
                    <div className="rounded-xl py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <p className="text-lg font-black text-white">
                        {liveMatch.homeScore + liveMatch.awayScore}
                      </p>
                      <p className="text-xs text-green-400 mt-0.5">⚽ Gollar</p>
                      <p className="text-xs text-muted-foreground/60">
                        {liveMatch.homeScore} — {liveMatch.awayScore}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground">O'yin hali topilmadi yoki yakunlangan</p>
              )}
            </div>
          )}

          {/* Bet details */}
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Stavka tafsiloti</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Prognoz</span>
              <span className="text-white font-bold text-right max-w-[60%]">{selectedBet.betDescription}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stavka</span>
              <span className="text-white font-bold">{selectedBet.betAmount.toLocaleString()} UZS</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Koeffitsient</span>
              <span style={{ color: "#d4af37" }} className="font-bold">× {selectedBet.odds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border/50 pt-2">
              <span className="text-muted-foreground">Mumkin yutish</span>
              <span className="font-black text-green-400">
                {Math.round(selectedBet.betAmount * selectedBet.odds).toLocaleString()} UZS
              </span>
            </div>
            {selectedBet.status !== "pending" && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Natija</span>
                <span className={`font-black ${selectedBet.won ? "text-green-400" : "text-red-400"}`}>
                  {selectedBet.won
                    ? `+${(selectedBet.winAmount || 0).toLocaleString()} UZS`
                    : `-${selectedBet.betAmount.toLocaleString()} UZS`}
                </span>
              </div>
            )}
          </div>

          <Button
            className="w-full"
            variant="outline"
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
            onClick={() => setSelectedBet(null)}
          >
            Yopish
          </Button>
        </div>
        </div>
      </div>
    )}
    </>
  );
}
