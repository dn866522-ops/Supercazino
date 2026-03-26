import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { sounds } from "@/lib/sounds";
import { useCoupon } from "@/lib/couponContext";
import {
  ChevronLeft, ChevronDown, ChevronUp, Zap, MoreVertical,
  Flame, Star, Ticket, Clock, Grid2x2, Pin, X, PlusCircle, CheckCircle2
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
}

function abbr(name: string) {
  return name.length > 12 ? name.slice(0, 11) + "…" : name;
}

function useCountdown(targetIso: string, isLive: boolean, minute: number) {
  const [display, setDisplay] = useState({ h: "00", m: "00", s: "00", liveMin: minute });
  useEffect(() => {
    if (isLive) { setDisplay(d => ({ ...d, liveMin: minute })); return; }
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setDisplay({ h: "00", m: "00", s: "00", liveMin: 0 }); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay({ h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0"), liveMin: 0 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso, isLive, minute]);
  return display;
}

// ── Selected bet type ─────────────────────────────────────────────────────────
interface SelBet { marketId: string; marketName: string; label: string; value: number; }

// ── Odds button ───────────────────────────────────────────────────────────────
function OddsBtn({
  label, value, selected, onSelect,
}: { label: string; value: number; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onSelect}
      style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "8px 4px", borderRadius: 10, cursor: "pointer",
        border: selected ? "2px solid #16a34a" : "1.5px solid #e5e7eb",
        background: selected ? "#dcfce7" : "#f9fafb",
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 11, color: "#6b7280", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90%" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 900, color: selected ? "#15803d" : "#1f2937" }}>{value.toFixed(2)}</span>
    </motion.button>
  );
}

// ── Market accordion ──────────────────────────────────────────────────────────
function MarketAccordion({ market, matchId, matchName, homeTeam, awayTeam, selected, onSelect }: {
  market: any; matchId: string; matchName: string; homeTeam: string; awayTeam: string;
  selected: Set<string>; onSelect: (bet: SelBet) => void;
}) {
  const [open, setOpen] = useState(market.pinned ?? false);
  const { addItem, removeItem, hasItem } = useCoupon();
  const { toast } = useToast();
  const isCardMarket = market.id?.startsWith("cards_");

  const isSelected = (label: string) => selected.has(`${market.id}::${label}`);

  const handleSelect = (label: string, value: number) => {
    sounds.click?.();
    onSelect({ marketId: market.id, marketName: market.name, label, value });
  };

  const handleAddToCoupon = (label: string, value: number) => {
    const desc = `${market.name}: ${label}`;
    if (hasItem(matchId, desc)) {
      removeItem(matchId, desc);
      toast({ title: "Kupondan olib tashlandi" });
    } else {
      addItem({ matchId, matchName, betDescription: desc, odds: value });
      toast({ title: "✅ Kuponga qo'shildi!", description: `${desc} • x${value.toFixed(2)}` });
    }
    sounds.click?.();
  };

  return (
    <div style={{ borderBottom: "1px solid #e5e7eb" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          padding: "13px 16px", background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        <span style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600, color: "#111827" }}>
          {market.name}
        </span>
        <span style={{ fontSize: 12, color: "#9ca3af", marginRight: 8 }}>({market.count})</span>
        <Pin size={14} color={market.pinned ? "#16a34a" : "#d1d5db"} fill={market.pinned ? "#16a34a" : "none"} />
        <div style={{ marginLeft: 8, color: "#9ca3af" }}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 12px 12px" }}>
              {/* Card market notice */}
              {isCardMarket && (
                <div style={{
                  background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8,
                  padding: "6px 10px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 14 }}>⏳</span>
                  <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                    {market.note || "O'yin oxirida hisoblanadi"}
                  </span>
                </div>
              )}

              {/* 1X2 / double / yn */}
              {(market.type === "1x2" || market.type === "double" || market.type === "yn") && market.odds && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {market.odds.map((o: any) => (
                      <OddsBtn key={o.label} label={o.label} value={o.value}
                        selected={isSelected(o.label)}
                        onSelect={() => handleSelect(o.label, o.value)} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {market.odds.map((o: any) => {
                      const inCoupon = hasItem(matchId, `${market.name}: ${o.label}`);
                      return (
                        <button key={o.label} onClick={() => handleAddToCoupon(o.label, o.value)}
                          style={{
                            flex: 1, padding: "4px 0", borderRadius: 7, fontSize: 10, fontWeight: 700,
                            border: inCoupon ? "1.5px solid #d4af37" : "1.5px solid #e5e7eb",
                            background: inCoupon ? "#fef9e7" : "#f9fafb",
                            color: inCoupon ? "#92400e" : "#6b7280",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                          }}>
                          {inCoupon
                            ? <><CheckCircle2 size={10} color="#d4af37" /> Kuponda</>
                            : <><PlusCircle size={10} /> Kuponga</>
                          }
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Totals */}
              {market.type === "total" && market.totals && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#6b7280" }}>Liniya</span>
                    <span style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#16a34a" }}>Ko'p (O)</span>
                    <span style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#dc2626" }}>Kam (U)</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#d4af37", minWidth: 48, textAlign: "center" }}>Kupon</span>
                  </div>
                  {market.totals.map((t: any) => (
                    <div key={t.label} style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "7px 4px", borderRadius: 8, background: "#f3f4f6",
                        fontSize: 13, fontWeight: 700, color: "#374151" }}>
                        {t.label}
                      </div>
                      <OddsBtn label="O" value={t.over} selected={isSelected(`O${t.label}`)}
                        onSelect={() => handleSelect(`O${t.label}`, t.over)} />
                      <OddsBtn label="U" value={t.under} selected={isSelected(`U${t.label}`)}
                        onSelect={() => handleSelect(`U${t.label}`, t.under)} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 48 }}>
                        {[{ lbl: `O${t.label}`, val: t.over }, { lbl: `U${t.label}`, val: t.under }].map(({ lbl, val }) => {
                          const desc = `${market.name}: ${lbl}`;
                          const inCoupon = hasItem(matchId, desc);
                          return (
                            <button key={lbl} onClick={() => handleAddToCoupon(lbl, val)}
                              style={{
                                flex: 1, borderRadius: 6, fontSize: 9, fontWeight: 700,
                                border: inCoupon ? "1.5px solid #d4af37" : "1.5px solid #e5e7eb",
                                background: inCoupon ? "#fef9e7" : "#f9fafb",
                                color: inCoupon ? "#92400e" : "#9ca3af",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                              {inCoupon ? "✓" : "+"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Handicap */}
              {market.type === "handicap" && market.handicaps && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ flex: 1.2, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#6b7280" }}>Fora</span>
                    <span style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>1</span>
                    <span style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#b45309" }}>2</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#d4af37", minWidth: 48, textAlign: "center" }}>Kupon</span>
                  </div>
                  {market.handicaps.map((h: any) => (
                    <div key={h.label} style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1.2, display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "7px 4px", borderRadius: 8, background: "#f3f4f6",
                        fontSize: 13, fontWeight: 700, color: "#374151" }}>
                        {h.label}
                      </div>
                      <OddsBtn label="1" value={h.h1} selected={isSelected(`H1${h.label}`)}
                        onSelect={() => handleSelect(`H1${h.label}`, h.h1)} />
                      <OddsBtn label="2" value={h.h2} selected={isSelected(`H2${h.label}`)}
                        onSelect={() => handleSelect(`H2${h.label}`, h.h2)} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 48 }}>
                        {[{ lbl: `H1${h.label}`, val: h.h1 }, { lbl: `H2${h.label}`, val: h.h2 }].map(({ lbl, val }) => {
                          const desc = `${market.name}: ${lbl}`;
                          const inCoupon = hasItem(matchId, desc);
                          return (
                            <button key={lbl} onClick={() => handleAddToCoupon(lbl, val)}
                              style={{
                                flex: 1, borderRadius: 6, fontSize: 9, fontWeight: 700,
                                border: inCoupon ? "1.5px solid #d4af37" : "1.5px solid #e5e7eb",
                                background: inCoupon ? "#fef9e7" : "#f9fafb",
                                color: inCoupon ? "#92400e" : "#9ca3af",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                              {inCoupon ? "✓" : "+"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Kupon (Bet slip) bottom sheet ─────────────────────────────────────────────
function KuponSheet({ bets, match, onRemove, onClear, onClose }: {
  bets: SelBet[]; match: any;
  onRemove: (key: string) => void; onClear: () => void; onClose: () => void;
}) {
  const [amount, setAmount] = useState("5000");
  const { data: user, refetch } = useGetMe();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const totalOdds = bets.reduce((acc, b) => acc * b.value, 1);
  const winAmount = Math.round(Number(amount) * totalOdds);

  const placeBet = async () => {
    if (!user || Number(amount) > user.balance) {
      toast({ title: "Balans yetarli emas", variant: "destructive" } as any);
      return;
    }
    if (Number(amount) < 1000) {
      toast({ title: "Minimal 1 000 UZS", variant: "destructive" } as any);
      return;
    }
    setLoading(true);
    sounds.click?.();
    try {
      const token = localStorage.getItem("betuz_token");
      const r = await fetch("/api/sports/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          matchId: match.id,
          betDescription: bets.map(b => `${b.marketName}: ${b.label}`).join(" | "),
          betAmount: Number(amount),
          odds: parseFloat(totalOdds.toFixed(4)),
        }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error || "Xatolik", variant: "destructive" } as any); return; }
      toast({ title: "⏳ Stavka qabul qilindi!", description: data.message || "O'yin oxirida natija aniqlanadi" });
      sounds.coin?.();
      onClear(); onClose(); refetch(); qc.invalidateQueries();
    } finally { setLoading(false); }
  };

  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      style={{
        position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 60,
        background: "#fff", borderRadius: "20px 20px 0 0",
        boxShadow: "0 -4px 30px rgba(0,0,0,0.18)",
        maxHeight: "70vh", overflowY: "auto",
      }}
    >
      <div style={{ padding: "12px 16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: "#111" }}>🎟 Kupon ({bets.length})</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClear} style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, border: "none", background: "none", cursor: "pointer" }}>Tozalash</button>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#6b7280" }}><X size={18} /></button>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {bets.map((b) => {
          const key = `${b.marketId}::${b.label}`;
          return (
            <div key={key} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0", borderBottom: "1px solid #f3f4f6",
            }}>
              <div>
                <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 1 }}>{b.marketName}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{b.label}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#16a34a" }}>{b.value.toFixed(2)}</span>
                <button onClick={() => onRemove(key)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {bets.length > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Jami koeffitsient</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#1d4ed8" }}>{totalOdds.toFixed(2)}</span>
          </div>
        )}

        <div style={{ padding: "12px 0" }}>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 6 }}>Tikish miqdori (UZS)</label>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 15, fontWeight: 700,
              border: "1.5px solid #d1d5db", boxSizing: "border-box", outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[1000, 5000, 10000, 50000].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} style={{
                flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: "1.5px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", color: "#374151",
              }}>
                {v >= 1000 ? `${v / 1000}k` : v}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Mumkin bo'lgan yutug:</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#16a34a" }}>{winAmount.toLocaleString()} UZS</span>
          </div>
        </div>

        <button
          onClick={placeBet} disabled={loading || bets.length === 0}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 14, fontSize: 16, fontWeight: 900,
            color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "#9ca3af" : "linear-gradient(135deg,#16a34a,#15803d)",
            boxShadow: "0 4px 16px rgba(22,163,74,0.4)", marginBottom: 16,
          }}
        >
          {loading ? "Joylashtirilmoqda..." : `⚽ TIKISH • ${winAmount.toLocaleString()} UZS`}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const MARKET_TABS = ["Asosiy o'yin", "1-taym", "2-taym", "Burchak zarbalari", "Statistika"];

export default function MatchViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedBets, setSelectedBets] = useState<Map<string, SelBet>>(new Map());
  const [kuponOpen, setKuponOpen] = useState(false);

  // Fetch match detail
  const fetchMatch = useCallback(async () => {
    try {
      const token = localStorage.getItem("betuz_token");
      const r = await fetch(`/api/sports/match/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setMatch(data.match);
    } catch { toast({ title: "O'yin topilmadi", variant: "destructive" } as any); navigate("/sport"); }
    finally { setLoading(false); }
  }, [id, toast, navigate]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  const countdown = useCountdown(match?.startTime ?? new Date().toISOString(), match?.isLive ?? false, match?.minute ?? 0);

  // Bet selection
  const handleSelect = useCallback((bet: SelBet) => {
    const key = `${bet.marketId}::${bet.label}`;
    setSelectedBets((prev) => {
      const next = new Map(prev);
      if (next.has(key)) { next.delete(key); }
      else {
        // Remove other bets in same market (single selection per market)
        for (const [k] of next) { if (k.startsWith(`${bet.marketId}::`)) next.delete(k); }
        next.set(key, bet);
      }
      return next;
    });
  }, []);

  const removeBet = (key: string) => setSelectedBets((p) => { const n = new Map(p); n.delete(key); return n; });
  const clearBets = () => { setSelectedBets(new Map()); setKuponOpen(false); };
  const betCount = selectedBets.size;
  const betArray = Array.from(selectedBets.values());

  if (loading) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0d1a2e" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.2)",
          borderTop: "3px solid #16a34a", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!match) return null;

  const matchDate = new Date(match.startTime).toLocaleDateString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", background: "#f3f4f6", paddingBottom: 64 }}>

      {/* ── Stadium header ── */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(170deg,#064e3b 0%,#0f3460 50%,#1a0a3b 100%)",
        paddingBottom: 20,
      }}>
        {/* Subtle stadium grid overlay */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.07,
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,.5) 40px,rgba(255,255,255,.5) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.5) 40px,rgba(255,255,255,.5) 41px)",
        }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 80%, rgba(22,163,74,0.22) 0%, transparent 70%)" }} />

        {/* Top bar */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", padding: "10px 12px 4px", gap: 10 }}>
          <button onClick={() => navigate("/sport")} style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <ChevronLeft size={20} color="#fff" />
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>{match.league}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ background: "none", border: "none", cursor: "pointer" }}><Zap size={20} color="#facc15" /></button>
            <button style={{ background: "none", border: "none", cursor: "pointer" }}><MoreVertical size={20} color="rgba(255,255,255,0.6)" /></button>
          </div>
        </div>

        {/* Live subtitle */}
        {match.isLive && (
          <div style={{ textAlign: "center", position: "relative", zIndex: 2, marginBottom: 2 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
              Jonli • {match.minute}' | {match.homeScore}:{match.awayScore}
            </p>
            {match.cards && (match.cards.homeYellow > 0 || match.cards.awayYellow > 0) && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {match.cards.homeYellow > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <span style={{ width: 9, height: 13, background: "#facc15", borderRadius: 2, display: "inline-block", border: "1px solid #ca8a04" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fde047" }}>{match.cards.homeYellow}</span>
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>🟨</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {match.cards.awayYellow > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <span style={{ width: 9, height: 13, background: "#facc15", borderRadius: 2, display: "inline-block", border: "1px solid #ca8a04" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fde047" }}>{match.cards.awayYellow}</span>
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Teams + VS */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "12px 16px 10px" }}>
          {/* Home team */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "linear-gradient(135deg,#166534,#4ade80)",
              border: "2.5px solid rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900, color: "#fff", letterSpacing: "0.05em",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}>
              {initials(match.homeTeam)}
            </div>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.2 }}>
              {abbr(match.homeTeam)}
            </p>
          </div>

          {/* VS / Score */}
          <div style={{ padding: "0 10px", textAlign: "center" }}>
            {match.isLive ? (
              <p style={{ fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: 4 }}>
                {match.homeScore}:{match.awayScore}
              </p>
            ) : (
              <p style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.7)" }}>VS</p>
            )}
          </div>

          {/* Away team */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
              border: "2.5px solid rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900, color: "#fff", letterSpacing: "0.05em",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}>
              {initials(match.awayTeam)}
            </div>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.2 }}>
              {abbr(match.awayTeam)}
            </p>
          </div>
        </div>

        {/* Countdown timer */}
        {!match.isLive && (
          <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Boshlanishiga</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
              {[countdown.h, countdown.m, countdown.s].map((v, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 44, height: 36, background: "rgba(0,0,0,0.55)", borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "0.05em",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    {v}
                  </div>
                  {i < 2 && <span style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.6)" }}>:</span>}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>{matchDate}</p>
          </div>
        )}
      </div>

      {/* ── Market tabs ── */}
      <div style={{
        display: "flex", gap: 8, overflowX: "auto", padding: "12px 12px 8px",
        background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
        scrollbarWidth: "none",
      }}>
        {MARKET_TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            whiteSpace: "nowrap", padding: "7px 14px", borderRadius: 20,
            fontWeight: i === activeTab ? 800 : 600, fontSize: 13, cursor: "pointer",
            border: i === activeTab ? "none" : "1.5px solid #e5e7eb",
            background: i === activeTab ? "#16a34a" : "#fff",
            color: i === activeTab ? "#fff" : "#374151",
            flexShrink: 0, transition: "all 0.15s",
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Markets list ── */}
      <div style={{ background: "#fff", flex: 1 }}>
        {activeTab === 0 && match.markets ? (
          match.markets.map((market: any) => (
            <MarketAccordion
              key={market.id}
              market={market}
              matchId={match.id}
              matchName={`${match.homeTeam} — ${match.awayTeam}`}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              selected={new Set(Array.from(selectedBets.keys()))}
              onSelect={handleSelect}
            />
          ))
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Tez orada qo'shiladi</p>
          </div>
        )}
      </div>

      {/* ── Kupon bottom sheet ── */}
      <AnimatePresence>
        {kuponOpen && betArray.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setKuponOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.4)" }}
            />
            <KuponSheet
              bets={betArray} match={match}
              onRemove={removeBet} onClear={clearBets} onClose={() => setKuponOpen(false)}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom navigation ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 64, zIndex: 50,
        background: "#fff", borderTop: "1px solid #e5e7eb",
        display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px",
      }}>
        {/* Mashxur */}
        <button onClick={() => navigate("/sport")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
          <Flame size={22} color="#f97316" />
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}>Mashxur</span>
        </button>

        {/* Saralangan */}
        <button style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
          <Star size={22} color="#9ca3af" />
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}>Saralangan...</span>
        </button>

        {/* Kupon — green circle */}
        <button
          onClick={() => { if (betCount > 0) setKuponOpen(!kuponOpen); }}
          style={{
            position: "relative",
            width: 52, height: 52, borderRadius: "50%",
            background: betCount > 0 ? "#16a34a" : "#d1d5db",
            border: "none", cursor: betCount > 0 ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: betCount > 0 ? "0 4px 16px rgba(22,163,74,0.5)" : "none",
            transition: "all 0.2s", marginTop: -14,
          }}
        >
          <Ticket size={22} color="#fff" />
          {betCount > 0 && (
            <div style={{
              position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: "50%",
              background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 900, color: "#fff", border: "2px solid #fff",
            }}>{betCount}</div>
          )}
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 9, color: betCount > 0 ? "#16a34a" : "#6b7280", fontWeight: 700, marginTop: 2 }}>Kupon</span>
        </div>

        {/* Tarix */}
        <button onClick={() => navigate("/tarix")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
          <Clock size={22} color="#9ca3af" />
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}>Tarix</span>
        </button>

        {/* Menyu */}
        <button onClick={() => navigate("/")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
          <Grid2x2 size={22} color="#9ca3af" />
          <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}>Menyu</span>
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
