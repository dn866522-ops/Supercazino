import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, XCircle, Plus, Minus } from "lucide-react";

type TabId = "depozit" | "chiqim";

const METHOD_LABELS: Record<string, string> = {
  uzcard: "🟦 Uzcard",
  humo:   "🟩 Humo",
  visa:   "💳 Visa",
};

function statusInfo(status: string, type: TabId) {
  if (type === "depozit") {
    if (status === "approved")         return { label: "✅ Tasdiqlandi",   color: "text-green-400",  bg: "rgba(34,197,94,0.12)",  icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    if (status === "rejected")         return { label: "❌ Rad etildi",    color: "text-red-400",    bg: "rgba(239,68,68,0.12)",  icon: <XCircle className="w-3.5 h-3.5" /> };
    if (status === "receipt_uploaded") return { label: "⏳ Ko'rib chiqilmoqda", color: "text-blue-400",   bg: "rgba(59,130,246,0.12)", icon: <Clock className="w-3.5 h-3.5" /> };
    return                                    { label: "🕐 Kutilmoqda",    color: "text-yellow-400", bg: "rgba(212,175,55,0.12)", icon: <Clock className="w-3.5 h-3.5" /> };
  } else {
    if (status === "paid")             return { label: "✅ To'landi",      color: "text-green-400",  bg: "rgba(34,197,94,0.12)",  icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    if (status === "rejected")         return { label: "❌ Rad etildi",    color: "text-red-400",    bg: "rgba(239,68,68,0.12)",  icon: <XCircle className="w-3.5 h-3.5" /> };
    return                                    { label: "🕐 Kutilmoqda",    color: "text-yellow-400", bg: "rgba(212,175,55,0.12)", icon: <Clock className="w-3.5 h-3.5" /> };
  }
}

export default function PulTarixiPage() {
  const [tab, setTab] = useState<TabId>("depozit");
  const [deposits, setDeposits]       = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/deposit/my-history").then(r => r.json()).catch(() => ({})),
      fetch("/api/withdrawal/my-history").then(r => r.json()).catch(() => ({})),
    ]).then(([d, w]) => {
      if (d.deposits)   setDeposits(d.deposits);
      if (w.withdrawals) setWithdrawals(w.withdrawals);
      setLoading(false);
    });
  }, []);

  const totalDep = deposits.filter(d => d.status === "approved").reduce((s, d) => s + d.amount, 0);
  const totalWit = withdrawals.filter(w => w.status === "paid").reduce((s, w) => s + w.amount, 0);

  const list = tab === "depozit" ? deposits : withdrawals;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
        >
          <div className="flex items-center gap-2 text-green-400">
            <ArrowDownCircle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Jami depozit</span>
          </div>
          <p className="text-xl font-black text-white mt-1">{totalDep.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">UZS</p>
        </div>
        <div
          className="rounded-2xl p-4 flex flex-col gap-1"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <div className="flex items-center gap-2 text-red-400">
            <ArrowUpCircle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Jami chiqim</span>
          </div>
          <p className="text-xl font-black text-white mt-1">{totalWit.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">UZS</p>
        </div>
      </div>

      {/* Tab + Action buttons */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            className="flex-1 py-3.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
            style={tab === "depozit" ? { color: "#22c55e", borderBottom: "2px solid #22c55e" } : { color: "rgba(255,255,255,0.4)" }}
            onClick={() => setTab("depozit")}
          >
            <ArrowDownCircle className="w-4 h-4" />
            Depozit tarixi
          </button>
          <button
            className="flex-1 py-3.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
            style={tab === "chiqim" ? { color: "#ef4444", borderBottom: "2px solid #ef4444" } : { color: "rgba(255,255,255,0.4)" }}
            onClick={() => setTab("chiqim")}
          >
            <ArrowUpCircle className="w-4 h-4" />
            Chiqim tarixi
          </button>
        </div>

        {/* Quick action buttons */}
        <div className="flex gap-3 p-4 border-b border-border/50">
          <Link href="/deposit" className="flex-1">
            <button
              className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              <Plus className="w-4 h-4" />
              Depozit qilish
            </button>
          </Link>
          <Link href="/withdraw" className="flex-1">
            <button
              className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              <Minus className="w-4 h-4" />
              Chiqim qilish
            </button>
          </Link>
        </div>

        {/* List */}
        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            {tab === "depozit"
              ? <ArrowDownCircle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              : <ArrowUpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            }
            <p className="text-muted-foreground text-sm">
              {tab === "depozit" ? "Hali depozit yo'q" : "Hali chiqim yo'q"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {list.map((item: any) => {
              const st = statusInfo(item.status, tab);
              return (
                <div key={item.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  {/* Left: icon + details */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: tab === "depozit" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)" }}
                    >
                      {tab === "depozit"
                        ? <ArrowDownCircle className="w-4.5 h-4.5 text-green-400" />
                        : <ArrowUpCircle className="w-4.5 h-4.5 text-red-400" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">
                          {METHOD_LABELS[item.method] ?? item.method.toUpperCase()}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${st.color}`}
                          style={{ background: st.bg }}
                        >
                          {st.icon}
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(item.createdAt).toLocaleString("uz-UZ")}
                      </p>
                      {tab === "chiqim" && item.cardNumber && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          💳 **** {item.cardNumber.slice(-4)}
                        </p>
                      )}
                      {tab === "depozit" && item.confirmedAt && (
                        <p className="text-xs text-green-400/60 mt-0.5">
                          ✅ {new Date(item.confirmedAt).toLocaleString("uz-UZ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: amount */}
                  <div className="text-right shrink-0">
                    <p className={`text-base font-black ${tab === "depozit" ? "text-green-400" : "text-red-400"}`}>
                      {tab === "depozit" ? "+" : "−"}{item.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">UZS</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
