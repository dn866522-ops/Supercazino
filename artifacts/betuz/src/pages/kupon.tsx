import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, TicketCheck, Clock, CheckCircle2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCoupon } from "@/lib/couponContext";
import { formatMoney } from "@/lib/utils";
import { useLocation } from "wouter";

export default function KuponPage() {
  const { items, removeItem, clearAll, totalOdds } = useCoupon();
  const [amount, setAmount] = useState("5000");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const { data: user, refetch } = useGetMe();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const loadHistory = async () => {
    try {
      const token = localStorage.getItem("betuz_token");
      const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch("/api/sports/my-bets", { headers });
      const d = await r.json();
      if (d.bets) setHistory(d.bets);
    } catch {}
  };

  useEffect(() => { loadHistory(); }, []);

  const potentialWin = Math.round(Number(amount) * totalOdds);

  const placeCoupon = async () => {
    const amt = Number(amount);
    if (!amt || amt < 1000) {
      toast({ title: "Minimal 1 000 UZS", variant: "destructive" } as any);
      return;
    }
    if (amt > (user?.balance || 0)) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }

    setLoading(true);
    try {
      let r: Response;

      if (items.length === 1) {
        // Single bet via regular endpoint
        r = await fetch("/api/sports/bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: items[0].matchId,
            betDescription: items[0].betDescription,
            betAmount: amt,
            odds: items[0].odds,
          }),
        });
      } else {
        // Accumulator
        r = await fetch("/api/sports/coupon-bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selections: items.map(i => ({
              matchId: i.matchId,
              betDescription: i.betDescription,
              odds: i.odds,
            })),
            betAmount: amt,
          }),
        });
      }

      const data = await r.json();
      if (!r.ok) {
        toast({ title: data.error || "Xatolik", variant: "destructive" } as any);
        return;
      }
      toast({
        title: items.length > 1 ? "🎫 Kupon qabul qilindi!" : "⏳ Stavka qabul qilindi!",
        description: data.message,
      });
      clearAll();
      qc.invalidateQueries();
      refetch();
      setTimeout(loadHistory, 800);
    } catch {
      toast({ title: "Server xatosi", variant: "destructive" } as any);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
        borderRadius: 20, padding: "20px 16px",
        borderBottom: "2px solid rgba(212,175,55,0.3)",
      }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg,#d4af37,#f5d77e)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TicketCheck className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Kupon</h1>
            <p className="text-xs text-gray-400">Bir nechta o'yinni jipslang</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-400">Balans</div>
            <div className="font-bold text-accent text-sm">{formatMoney(user?.balance || 0)}</div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 18,
          border: "2px dashed rgba(255,255,255,0.12)",
          padding: "48px 24px", textAlign: "center",
        }}>
          <TicketCheck className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400 text-sm font-medium">Kupon bo'sh</p>
          <p className="text-gray-600 text-xs mt-1">
            Sport sahifasida o'yinga kiring va odds yonidagi <strong className="text-yellow-400">+ Kuponga</strong> tugmasini bosing
          </p>
          <Button
            className="mt-4 text-sm"
            variant="outline"
            onClick={() => navigate("/sport")}
          >
            Sport sahifasiga o'tish →
          </Button>
        </div>
      )}

      {/* Coupon items */}
      {items.length > 0 && (
        <>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 18, overflow: "hidden" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-bold text-white">
                {items.length} ta tanlov
                {items.length > 1 && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    (Ekspress kupon)
                  </span>
                )}
              </span>
              <button
                onClick={clearAll}
                className="text-xs text-red-400 flex items-center gap-1 hover:text-red-300"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hammasini o'chir
              </button>
            </div>

            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  key={`${item.matchId}-${item.betDescription}`}
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  style={{
                    padding: "12px 16px",
                    borderBottom: idx < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 truncate">{item.matchName}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{item.betDescription}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{
                        background: "linear-gradient(135deg,#d4af37,#f5d77e)",
                        color: "#000", fontWeight: 800, fontSize: 13, borderRadius: 8,
                        padding: "2px 8px",
                      }}>x{item.odds.toFixed(2)}</span>
                      <button
                        onClick={() => removeItem(item.matchId, item.betDescription)}
                        className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/40"
                      >
                        <X className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Total odds — only for 2+ */}
            {items.length > 1 && (
              <div style={{
                background: "rgba(212,175,55,0.08)",
                borderTop: "1px solid rgba(212,175,55,0.2)",
                padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span className="text-sm text-gray-300">Jami koeffitsient</span>
                <span style={{ color: "#d4af37", fontWeight: 900, fontSize: 20 }}>
                  x{totalOdds.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Bet amount + place */}
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 18, padding: "16px" }}>
            <p className="text-sm font-bold text-white mb-3">Tikish miqdori</p>
            <div className="flex gap-2 mb-3">
              {["1000", "5000", "10000", "50000"].map(v => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 10, fontSize: 12, fontWeight: 700,
                    background: amount === v ? "linear-gradient(135deg,#d4af37,#f5d77e)" : "rgba(255,255,255,0.07)",
                    color: amount === v ? "#000" : "#ccc",
                    border: "none", cursor: "pointer",
                  }}
                >
                  {Number(v) >= 1000 ? `${Number(v) / 1000}k` : v}
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Miqdor (UZS)"
              className="mb-3 bg-white/5 border-white/10 text-white"
            />
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-400">
                {items.length > 1 ? "Mumkin bo'lgan yutish:" : "Taxminiy yutish:"}
              </span>
              <span className="font-bold text-green-400">{potentialWin.toLocaleString()} UZS</span>
            </div>
            <Button
              onClick={placeCoupon}
              disabled={loading}
              className="w-full font-black text-base py-6"
              style={{ background: "linear-gradient(135deg,#d4af37,#c9a227)", color: "#000" }}
            >
              {loading
                ? "Yuborilmoqda..."
                : items.length > 1
                  ? `🎫 Kuponni Tasdiqlash • x${totalOdds.toFixed(2)}`
                  : `⚽ Pul Tikish • ${potentialWin.toLocaleString()} UZS`
              }
            </Button>
            {items.length === 1 && (
              <p className="text-center text-xs text-gray-500 mt-2">
                Yana o'yin qo'shing — oddlar ko'paytiriladi
              </p>
            )}
            {items.length > 1 && (
              <p className="text-center text-xs text-gray-500 mt-2">
                O'yin oxirida natija aniqlanadi
              </p>
            )}
          </div>
        </>
      )}

      {/* History */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 18, overflow: "hidden" }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Clock className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-white">Kupon Tarixi</span>
        </div>
        {history.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-500">
            Hali kupon tikmaganingiz
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {history.map((bet: any) => (
              <div key={bet.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {bet.status === "pending"
                        ? <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        : bet.won
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      }
                      <span className="text-xs font-bold text-white truncate">{bet.matchName}</span>
                      {bet.isCoupon && (
                        <span style={{
                          fontSize: 9, background: "rgba(212,175,55,0.2)", color: "#d4af37",
                          borderRadius: 4, padding: "1px 5px", fontWeight: 700, whiteSpace: "nowrap",
                        }}>KUPON</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{bet.betDescription}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {new Date(bet.createdAt).toLocaleString("uz-UZ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-400">
                      {bet.betAmount.toLocaleString()} × x{bet.odds.toFixed(2)}
                    </div>
                    <div className={`text-sm font-bold ${
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
