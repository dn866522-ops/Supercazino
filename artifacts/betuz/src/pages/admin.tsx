import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Ban, ShieldAlert, Search, ChevronDown, ChevronUp,
  RefreshCw, Users, TrendingUp, DollarSign, Unlock, Lock,
  ImageIcon, BarChart2, X, Loader2, SendHorizontal,
} from "lucide-react";
import { sounds } from "@/lib/sounds";

const ADMIN_CODE = "M1i2r3z4o5";

async function adminFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("betuz_token") || "";
  const headers: any = {
    "x-admin-code": ADMIN_CODE,
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  };
  const res = await fetch(path, { ...opts, headers });
  return res;
}

// ─── Login screen ───────────────────────────────────────────────────────────
const ADMIN_SESSION_KEY = "betuz_admin_auth";

export default function AdminPage() {
  const [code, setCode] = useState("");
  const [isAuth, setIsAuth] = useState(() => localStorage.getItem(ADMIN_SESSION_KEY) === "1");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { toast } = useToast();

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setTimeout(() => {
      if (code.trim() === ADMIN_CODE) {
        localStorage.setItem(ADMIN_SESSION_KEY, "1");
        setIsAuth(true);
        sounds.win?.();
      } else {
        toast({ title: "❌ Noto'g'ri maxfiy kod", variant: "destructive" } as any);
        sounds.lose?.();
        setCode("");
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
      setLoading(false);
    }, 400);
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#080c14] via-[#0d111e] to-[#080c14] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          {/* Card */}
          <div className="glass-panel rounded-3xl p-8 border border-red-500/20 shadow-2xl shadow-red-900/20 text-center">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-red-600/30 to-red-900/30 border border-red-500/30 flex items-center justify-center shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-10 h-10 text-red-400" />
            </div>

            <h2 className="text-2xl font-black text-white mb-1">Admin Panel</h2>
            <p className="text-muted-foreground text-sm mb-8">Maxfiy kodni kiriting</p>

            {/* PIN form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <motion.div
                animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                <input
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="••••••••••"
                  autoFocus
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full bg-white/5 border border-white/10 focus:border-red-500/50 rounded-xl px-4 py-4 text-center text-xl font-black tracking-[0.3em] text-white placeholder:text-white/20 outline-none transition-colors"
                />
              </motion.div>

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-black rounded-xl py-4 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Kirish
                  </>
                )}
              </button>
            </form>

            <p className="text-[11px] text-muted-foreground mt-5 leading-relaxed">
              🔒 Bu sahifa faqat vakolatli xodimlar uchun.<br />
              Ruxsatsiz kirish taqiqlanadi.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return <AdminDashboard />;
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [statsUser, setStatsUser] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Global Win Rate state
  const [winRate, setWinRateVal] = useState<number>(40);
  const [winRateSaving, setWinRateSaving] = useState(false);

  // Per-user win rate state: userId -> pct (0-100) | null (= global)
  const [userWinRates, setUserWinRates] = useState<Record<string, number | null>>({});
  const [userWinRateSaving, setUserWinRateSaving] = useState<Record<string, boolean>>({});

  const { toast } = useToast();

  // Load current win rate
  useEffect(() => {
    adminFetch("/api/admin/settings").then(r => {
      if (r.ok) r.json().then((d: any) => setWinRateVal(d.winRate ?? 40));
    }).catch(() => {});
  }, []);

  const saveWinRate = async (val: number) => {
    setWinRateSaving(true);
    try {
      const res = await adminFetch("/api/admin/settings/win-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winRate: val }),
      });
      const d = await res.json();
      if (res.ok) {
        setWinRateVal(d.winRate);
        toast({ title: `✅ Win Rate: ${d.winRate}%`, description: "Saqlandi" });
        sounds.coin();
      } else {
        toast({ title: d.error || "Xatolik", variant: "destructive" } as any);
      }
    } finally {
      setWinRateSaving(false);
    }
  };

  const saveUserWinRate = async (userId: string, pct: number | null) => {
    setUserWinRateSaving(p => ({ ...p, [userId]: true }));
    try {
      const res = await adminFetch(`/api/admin/user/${userId}/win-rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winRate: pct }),
      });
      const d = await res.json();
      if (res.ok) {
        setUserWinRates(p => ({ ...p, [userId]: d.winRate }));
        setUsers(prev => prev.map(u => u.userId === userId ? { ...u, winRate: d.winRate } : u));
        toast({ title: pct === null ? "🔄 Global sozlamaga qaytarildi" : `✅ ${d.winRate}% o'rnatildi`, description: d.message });
        sounds.coin();
      } else {
        toast({ title: d.error || "Xatolik", variant: "destructive" } as any);
      }
    } finally {
      setUserWinRateSaving(p => ({ ...p, [userId]: false }));
    }
  };

  const openStats = async (user: any) => {
    setStatsUser(user);
    setStats(null);
    setStatsLoading(true);
    try {
      const res = await adminFetch(`/api/admin/user/${user.userId}/stats`);
      if (res.ok) setStats(await res.json());
    } catch {}
    setStatsLoading(false);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, dRes] = await Promise.all([
        adminFetch("/api/admin/users"),
        adminFetch("/api/admin/deposits"),
      ]);
      if (uRes.ok) {
        const d = await uRes.json();
        const userList = d.users || [];
        setUsers(userList);
        // Initialize per-user win rates
        const rates: Record<string, number | null> = {};
        for (const u of userList) {
          rates[u.userId] = u.winRate ?? null;
        }
        setUserWinRates(prev => ({ ...rates, ...prev }));
      }
      if (dRes.ok) {
        const d = await dRes.json();
        setDeposits(d.deposits || []);
      }
    } catch {
      toast({ title: "Ma'lumot yuklanmadi", variant: "destructive" } as any);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 10000);
    return () => clearInterval(t);
  }, [loadData]);

  // Adjust balance
  const handleBalance = async (userId: string, action: "add" | "subtract") => {
    const amount = Number(amounts[userId]);
    if (!amount || amount <= 0) {
      toast({ title: "Summa kiriting", variant: "destructive" } as any);
      return;
    }
    const res = await adminFetch("/api/admin/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount, action }),
    });
    if (res.ok) {
      toast({ title: `✅ Balans ${action === "add" ? "qo'shildi" : "ayirildi"}`, description: `${amount.toLocaleString()} UZS` });
      setAmounts((p) => ({ ...p, [userId]: "" }));
      sounds.coin();
      loadData();
    } else {
      const d = await res.json();
      toast({ title: d.error || "Xatolik", variant: "destructive" } as any);
    }
  };

  // Block / unblock
  const handleBlock = async (userId: string, isBlocked: boolean) => {
    const res = await adminFetch("/api/admin/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: isBlocked ? "unblock" : "block" }),
    });
    if (res.ok) {
      toast({ title: isBlocked ? "✅ Blokdan chiqarildi" : "🔒 Bloklandi" });
      sounds.click();
      loadData();
    }
  };

  // Approve deposit
  const approveDeposit = async (depositId: number, userId: string, amount: number) => {
    const res = await adminFetch("/api/admin/deposit/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depositId, userId, amount }),
    });
    if (res.ok) {
      toast({ title: "✅ Depozit tasdiqlandi", description: `${amount.toLocaleString()} UZS balansi to'ldirildi` });
      sounds.bigWin();
      setDeposits((d) => d.filter((x) => x.id !== depositId));
      loadData();
    }
  };

  const filtered = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search) ||
      u.userId?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalBalance = users.reduce((s, u) => s + (u.balance || 0), 0);
  const totalDeposited = users.reduce((s, u) => s + (u.totalDeposited || 0), 0);

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-[#0d111e]/95 backdrop-blur-lg border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-red-400" />
          <span className="font-black text-white">Admin Panel</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-lg px-3 py-1.5"
        >
          <Lock className="w-3.5 h-3.5" />
          Chiqish
        </button>
      </div>

      <div className="space-y-4 max-w-4xl mx-auto pb-4 px-4 pt-4">

      {/* ── Win Rate Control Panel ── */}
      <div className="glass-panel p-4 rounded-2xl border border-red-500/30 bg-red-950/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="font-black text-white text-sm">Yutqazish / Yutish Nisbati</h3>
            <p className="text-[11px] text-muted-foreground">Kichik = foydalanuvchi ko'p yutqazadi</p>
          </div>
          <div className="ml-auto text-right">
            <span className={`text-2xl font-black ${winRate <= 20 ? "text-red-400" : winRate <= 40 ? "text-amber-400" : "text-emerald-400"}`}>
              {winRate}%
            </span>
            <p className="text-[10px] text-muted-foreground">Yutish ehtimoli</p>
          </div>
        </div>

        {/* Quick preset buttons */}
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {[5, 10, 20, 40, 60].map(pct => (
            <button
              key={pct}
              onClick={() => setWinRateVal(pct)}
              className={`py-2 rounded-xl text-xs font-black transition-all border ${
                winRate === pct
                  ? pct <= 15 ? "bg-red-500 border-red-500 text-white"
                    : pct <= 30 ? "bg-amber-500 border-amber-500 text-black"
                    : "bg-emerald-500 border-emerald-500 text-black"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Slider */}
        <input
          type="range"
          min={1}
          max={95}
          value={winRate}
          onChange={e => setWinRateVal(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer mb-3"
          style={{ background: `linear-gradient(to right, #ef4444 ${winRate}%, #374151 ${winRate}%)` }}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mb-3">
          <span>1% (max yutqazish)</span>
          <span>50%</span>
          <span>95% (max yutish)</span>
        </div>

        {/* Save button */}
        <Button
          className="w-full h-10 font-black text-sm"
          variant="destructive"
          onClick={() => saveWinRate(winRate)}
          disabled={winRateSaving}
        >
          {winRateSaving ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saqlanmoqda...</span>
          ) : (
            `💾 ${winRate}% Win Rate ni saqlash`
          )}
        </Button>
      </div>

      {/* Stats Modal */}
      <AnimatePresence>
        {statsUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setStatsUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <h3 className="font-black text-white text-lg flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-accent" /> {statsUser.username} — Aylanma
                  </h3>
                  <p className="text-xs text-muted-foreground">{statsUser.phone}</p>
                </div>
                <button onClick={() => setStatsUser(null)} className="text-muted-foreground hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {statsLoading && (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Yuklanmoqda...
                  </div>
                )}

                {!statsLoading && stats && (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-3">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase">Jami Depozit</p>
                        <p className="text-lg font-black text-white">{formatMoney(stats.summary.totalDeposited)}</p>
                      </div>
                      <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-3">
                        <p className="text-[10px] text-blue-400 font-bold uppercase">Jami Aylanma</p>
                        <p className="text-lg font-black text-white">{formatMoney(stats.summary.totalWagered)}</p>
                        <p className="text-[10px] text-blue-300 mt-0.5">
                          x{stats.summary.totalDeposited > 0
                            ? (stats.summary.totalWagered / stats.summary.totalDeposited).toFixed(1)
                            : "0"} ko'paytma
                        </p>
                      </div>
                      <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-[10px] text-amber-400 font-bold uppercase">Jami Yutgan</p>
                        <p className="text-lg font-black text-white">{formatMoney(stats.summary.totalWon)}</p>
                      </div>
                      <div className={`border rounded-xl p-3 ${stats.summary.netResult < 0 ? "bg-red-900/30 border-red-500/30" : "bg-green-900/30 border-green-500/30"}`}>
                        <p className={`text-[10px] font-bold uppercase ${stats.summary.netResult < 0 ? "text-red-400" : "text-green-400"}`}>Natija (yutdi/yutqazdi)</p>
                        <p className="text-lg font-black text-white">{stats.summary.netResult >= 0 ? "+" : ""}{formatMoney(stats.summary.netResult)}</p>
                      </div>
                    </div>

                    {/* Lucky Wheel */}
                    <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl p-3">
                      <p className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-1">🎡 Lucky Wheel Statistikasi</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Aylanishlar</p>
                          <p className="font-black text-white">{stats.luckyWheel.spins}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-emerald-400">Yutgan</p>
                          <p className="font-black text-emerald-400">{formatMoney(stats.luckyWheel.won)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-red-400">Sarflagan</p>
                          <p className="font-black text-red-400">{formatMoney(stats.luckyWheel.lost)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Per-deposit breakdown */}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">📋 Har bir depozit bo'yicha aylanma</p>
                      {stats.deposits.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">Hali depozit yo'q</p>
                      )}
                      <div className="space-y-2">
                        {stats.deposits.map((dep: any, i: number) => (
                          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-muted-foreground">
                                {dep.source === "admin" ? "👤 Admin" : "💳 Depozit"} #{i + 1}
                                {" · "}
                                {new Date(dep.depositDate).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                dep.wagerRatio >= 3 ? "bg-emerald-900/50 text-emerald-400" :
                                dep.wagerRatio >= 1 ? "bg-amber-900/50 text-amber-400" :
                                "bg-red-900/50 text-red-400"
                              }`}>
                                x{dep.wagerRatio} aylanma
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-[9px] text-emerald-400">Kirim</p>
                                <p className="text-sm font-black text-white">{formatMoney(dep.depositAmount)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-blue-400">Aylanma</p>
                                <p className="text-sm font-black text-blue-300">{formatMoney(dep.wagered)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-amber-400">Yutgan</p>
                                <p className="text-sm font-black text-amber-300">{formatMoney(dep.won)}</p>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-2 bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (dep.wagered / Math.max(dep.depositAmount, 1)) * 33.3)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={<Users className="w-5 h-5" />} label="Foydalanuvchilar" value={users.length} color="text-primary" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Jami Balans" value={formatMoney(totalBalance)} color="text-accent" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Depozit kutuv." value={deposits.length} color="text-emerald-400" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-accent w-6 h-6" />
          <h2 className="text-xl font-black">Admin Boshqaruv</h2>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">Faol</span>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Pending deposits */}
      <AnimatePresence>
        {deposits.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-4 rounded-xl border border-amber-500/30 space-y-2">
            <h3 className="font-bold text-amber-400 text-sm flex items-center gap-2">
              ⏳ Tasdiqlanmagan depozitlar
              <span className="bg-amber-500 text-black text-xs px-2 py-0.5 rounded-full font-black">{deposits.length}</span>
            </h3>
            {deposits.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 bg-amber-900/20 p-3 rounded-xl border border-amber-500/20">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white">{d.username || d.userId}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.method?.toUpperCase()} · {(d.amount || 0).toLocaleString()} UZS
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.createdAt ? new Date(d.createdAt).toLocaleString("uz-UZ") : ""}
                  </p>
                  {d.receiptUrl && (
                    <a
                      href={`/api/uploads/receipts/${d.receiptUrl.split("/").pop()}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline flex items-center gap-1 mt-0.5"
                    >
                      <ImageIcon className="w-3 h-3" /> Chekni ko'rish
                    </a>
                  )}
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                  onClick={() => approveDeposit(d.id, d.userId, d.amount)}>
                  ✅ Tasdiqlash
                </Button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Foydalanuvchi qidirish (ism, tel, ID)..."
          className="pl-9"
        />
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground px-1">
        Ko'rsatilayapti: <strong className="text-white">{filtered.length}</strong> / {users.length} ta foydalanuvchi
      </p>

      {/* Users list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            {search ? "Foydalanuvchi topilmadi" : "Foydalanuvchilar yuklanmoqda..."}
          </div>
        )}

        {filtered.map((user) => (
          <motion.div key={user.userId} layout className="glass-panel rounded-xl border border-white/10 overflow-hidden">
            {/* Summary row */}
            <button
              className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
              onClick={() => setExpanded(expanded === user.userId ? null : user.userId)}
            >
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center font-black text-primary shrink-0">
                {(user.username?.[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white">{user.username}</span>
                  {user.isBlocked && (
                    <span className="text-[10px] bg-red-900/60 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-500/30">
                      <Ban className="w-2.5 h-2.5" /> Bloklangan
                    </span>
                  )}
                  {user.winRate !== null && user.winRate !== undefined && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                      user.winRate <= 20
                        ? "bg-red-900/60 text-red-400 border-red-500/30"
                        : user.winRate <= 50
                        ? "bg-amber-900/60 text-amber-400 border-amber-500/30"
                        : "bg-emerald-900/60 text-emerald-400 border-emerald-500/30"
                    }`}>
                      🎰 {user.winRate}%
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                  <span>{user.phone}</span>
                  <span>·</span>
                  <span className="text-primary font-bold">{formatMoney(user.balance || 0)}</span>
                  <span>·</span>
                  <span className="text-xs text-muted-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("uz-UZ") : ""}</span>
                </div>
              </div>
              {expanded === user.userId
                ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>

            {/* Expanded panel */}
            <AnimatePresence>
              {expanded === user.userId && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-white/10 p-4 space-y-4 bg-black/30">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: "User ID", value: user.userId },
                        { label: "Balans", value: formatMoney(user.balance || 0) },
                        { label: "Telefon", value: user.phone },
                        { label: "Jami depozit", value: formatMoney(user.totalDeposited || 0) },
                        { label: "Ro'yxat sanasi", value: user.createdAt ? new Date(user.createdAt).toLocaleDateString("uz-UZ") : "—" },
                        { label: "Status", value: user.isBlocked ? "🔒 Bloklangan" : "✅ Faol" },
                        { label: "🌐 IP manzil", value: user.lastIp || "—" },
                        { label: "🔒 Blok sababi", value: user.blockReason || "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white/5 rounded-lg p-2 border border-white/5">
                          <p className="text-muted-foreground text-[10px]">{label}</p>
                          <p className="font-bold text-white break-all">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Balance management */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">💰 Pul yuborish / Ayirish</p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Summa (UZS)"
                          className="flex-1 h-10 text-sm"
                          value={amounts[user.userId] || ""}
                          onChange={(e) => setAmounts((p) => ({ ...p, [user.userId]: e.target.value }))}
                        />
                      </div>
                      {/* Quick amounts */}
                      <div className="grid grid-cols-5 gap-1">
                        {[10000, 50000, 100000, 250000, 500000].map((v) => (
                          <Button key={v} variant="outline" size="sm" className="text-xs h-8"
                            onClick={() => setAmounts((p) => ({ ...p, [user.userId]: String(v) }))}>
                            {v >= 1000000 ? v / 1000000 + "M" : v / 1000 + "k"}
                          </Button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11"
                          onClick={() => handleBalance(user.userId, "add")}
                        >
                          <SendHorizontal className="w-4 h-4 mr-2" />
                          Pul Yuborish
                        </Button>
                        <Button
                          variant="destructive"
                          className="font-bold h-11"
                          onClick={() => handleBalance(user.userId, "subtract")}
                        >
                          — Ayirish
                        </Button>
                      </div>
                    </div>

                    {/* Aylanma stats button */}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">📊 Statistika</p>
                      <Button
                        size="sm"
                        className="w-full h-11 font-bold bg-purple-700 hover:bg-purple-600 text-white"
                        onClick={() => openStats(user)}
                      >
                        <BarChart2 className="w-4 h-4 mr-2" /> Aylanma & Depozit Ko'rish
                      </Button>
                    </div>

                    {/* Per-user Win Rate */}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">🎰 Yutish nazorati</p>
                      <UserWinRatePanel
                        userId={user.userId}
                        currentRate={userWinRates[user.userId] ?? null}
                        isSaving={!!userWinRateSaving[user.userId]}
                        globalRate={winRate}
                        onSave={saveUserWinRate}
                      />
                    </div>

                    {/* Block / Unblock */}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">🔐 Akkaunt boshqarish</p>
                      <Button
                        size="sm"
                        className={`w-full h-11 font-bold ${user.isBlocked ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-red-700 hover:bg-red-600 text-white"}`}
                        onClick={() => handleBlock(user.userId, user.isBlocked)}
                      >
                        {user.isBlocked ? (
                          <><Unlock className="w-4 h-4 mr-2" />Blokdan Chiqarish</>
                        ) : (
                          <><Lock className="w-4 h-4 mr-2" />Bloklash</>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: any; color: string }) {
  return (
    <div className="glass-panel p-3 rounded-xl text-center border border-white/10">
      <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
      <div className={`font-black text-base ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

// ─── Per-user Win Rate Panel ────────────────────────────────────────────────
function UserWinRatePanel({
  userId, currentRate, isSaving, globalRate, onSave
}: {
  userId: string;
  currentRate: number | null;
  isSaving: boolean;
  globalRate: number;
  onSave: (userId: string, pct: number | null) => void;
}) {
  const [localPct, setLocalPct] = useState<number>(currentRate ?? globalRate);
  const [useGlobal, setUseGlobal] = useState<boolean>(currentRate === null);

  useEffect(() => {
    if (currentRate !== null) {
      setLocalPct(currentRate);
      setUseGlobal(false);
    } else {
      setLocalPct(globalRate);
      setUseGlobal(true);
    }
  }, [currentRate, globalRate]);

  const color = localPct <= 10 ? "text-red-400" : localPct <= 30 ? "text-amber-400" : localPct <= 60 ? "text-yellow-400" : "text-emerald-400";
  const bgColor = localPct <= 10 ? "bg-red-500" : localPct <= 30 ? "bg-amber-500" : localPct <= 60 ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="bg-black/20 border border-white/10 rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-2xl font-black ${color}`}>{useGlobal ? `~${globalRate}%` : `${localPct}%`}</span>
          <span className="text-[10px] text-muted-foreground ml-1">
            {useGlobal ? "(global)" : "(alohida)"}
          </span>
        </div>
        {!useGlobal && (
          <button
            onClick={() => { setUseGlobal(true); onSave(userId, null); }}
            disabled={isSaving}
            className="text-[10px] text-muted-foreground hover:text-blue-400 border border-white/10 hover:border-blue-400/30 rounded-lg px-2 py-1 transition-colors"
          >
            🔄 Global
          </button>
        )}
      </div>

      {/* Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={localPct}
          onChange={(e) => { setLocalPct(Number(e.target.value)); setUseGlobal(false); }}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: localPct <= 10 ? '#ef4444' : localPct <= 30 ? '#f59e0b' : localPct <= 60 ? '#eab308' : '#10b981' }}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>0% (doim yutqazadi)</span>
          <span>100% (doim yutadi)</span>
        </div>
      </div>

      {/* Quick presets */}
      <div className="grid grid-cols-5 gap-1">
        {[5, 10, 20, 40, 70].map(p => (
          <button
            key={p}
            onClick={() => { setLocalPct(p); setUseGlobal(false); }}
            className={`text-[11px] font-bold rounded-lg py-1.5 transition-all border ${
              localPct === p && !useGlobal
                ? `${bgColor} text-black border-transparent`
                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
            }`}
          >
            {p}%
          </button>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={() => onSave(userId, useGlobal ? null : localPct)}
        disabled={isSaving}
        className={`w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 ${bgColor} text-black`}
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {isSaving ? "Saqlanmoqda..." : useGlobal ? "🔄 Global sozlama" : `💾 ${localPct}% saqlash`}
      </button>
    </div>
  );
}
