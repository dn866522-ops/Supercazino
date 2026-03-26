import { useState } from "react";
import { useRequestWithdrawal, WithdrawalRequestMethod, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/utils";
import { CreditCard, Banknote, AlertCircle } from "lucide-react";

const METHODS = [
  { id: "uzcard" as const, label: "Uzcard", max: 5_000_000, min: 10_000, color: "from-blue-600 to-blue-500" },
  { id: "humo"   as const, label: "Humo",   max: 5_000_000, min: 10_000, color: "from-emerald-600 to-emerald-500" },
  { id: "visa"   as const, label: "Visa",   max: 10_000_000, min: 10_000, color: "from-yellow-600 to-yellow-500" },
];

const QUICK = [50_000, 100_000, 250_000, 500_000, 1_000_000];

export default function WithdrawPage() {
  const [method, setMethod] = useState<WithdrawalRequestMethod>("uzcard");
  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const { mutate: withdraw, isPending } = useRequestWithdrawal();
  const { toast } = useToast();
  const { data: user } = useGetMe();

  const selectedMethod = METHODS.find(m => m.id === method)!;

  const handleSubmit = () => {
    const val = Number(amount);
    if (!cardNumber.trim()) {
      toast({ title: "Karta raqami kiriting", variant: "destructive" } as any);
      return;
    }
    if (!val || val < selectedMethod.min) {
      toast({ title: `Minimal miqdor: ${selectedMethod.min.toLocaleString()} UZS`, variant: "destructive" } as any);
      return;
    }
    withdraw({ data: { method, amount: val, cardNumber } }, {
      onSuccess: () => {
        toast({ title: "✅ So'rov qabul qilindi", description: "Admin tasdiqlagandan keyin mablag' tushadi." });
        setAmount("");
        setCardNumber("");
      },
      onError: (err: any) => {
        toast({ title: "Xatolik", description: err?.error || "Xatolik yuz berdi", variant: "destructive" } as any);
      },
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-6">
      <h1 className="text-2xl font-black text-white">💸 Pul Yechish</h1>

      {/* Balance card */}
      <div className="glass-panel p-4 rounded-2xl border border-accent/20 flex items-center gap-3">
        <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
          <Banknote className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mavjud balans</p>
          <p className="text-xl font-black text-accent">{formatMoney(user?.balance ?? 0)}</p>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-2xl space-y-5 border border-white/10">
        {/* Method selector */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">To'lov usuli</p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => { setMethod(m.id); setAmount(""); }}
                className={`py-3 rounded-xl font-black text-sm transition-all border ${
                  method === m.id
                    ? `bg-gradient-to-b ${m.color} text-white border-transparent shadow-lg scale-[1.03]`
                    : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Max: <span className="text-accent font-bold">{selectedMethod.max.toLocaleString()} UZS</span>
          </p>
        </div>

        {/* Card number */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <CreditCard className="w-3 h-3" /> Karta raqami
          </label>
          <Input
            value={cardNumber}
            onChange={e => setCardNumber(e.target.value)}
            placeholder="0000 0000 0000 0000"
            className="font-mono tracking-widest text-base h-12"
            maxLength={19}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Summa (UZS)</label>
          <Input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Summani kiriting..."
            className="text-base h-12"
          />
          {/* Quick amounts */}
          <div className="grid grid-cols-5 gap-1 mt-2">
            {QUICK.map(v => (
              <button
                key={v}
                onClick={() => setAmount(String(Math.min(v, selectedMethod.max, user?.balance ?? 0)))}
                className="text-[11px] py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              >
                {v >= 1_000_000 ? v / 1_000_000 + "M" : v / 1_000 + "k"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAmount(String(Math.min(selectedMethod.max, user?.balance ?? 0)))}
            className="text-xs text-accent underline mt-1.5 hover:text-accent/80 transition-colors"
          >
            Hammasini yechish
          </button>
        </div>

        {/* Submit */}
        <Button
          className="w-full h-12 text-base font-black"
          variant="gold"
          onClick={handleSubmit}
          disabled={!amount || !cardNumber.trim() || isPending || Number(amount) > (user?.balance ?? 0)}
        >
          {isPending ? "Yuborilmoqda..." : `💸 ${Number(amount) > 0 ? Number(amount).toLocaleString() + " UZS" : ""} Yechish`}
        </Button>

        {/* Info */}
        <div className="bg-card/50 p-3 rounded-xl text-xs text-muted-foreground border border-white/5 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p>Profil ma'lumotlari (ism, familiya, shahar) to'ldirilgan bo'lishi shart</p>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p>Chiqim admin tasdiqlashidan so'ng 24 soat ichida amalga oshiriladi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
