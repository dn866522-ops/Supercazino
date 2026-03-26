import { useState, useRef } from "react";
import { useInitiateDeposit, DepositInitiateRequestMethod } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, UploadCloud, CheckCircle2, X, FileImage, Film, File } from "lucide-react";
import { sounds } from "@/lib/sounds";

const LIMITS: Record<string, { min: number; label: string }> = {
  uzcard: { min: 30000, label: "30,000 UZS" },
  humo: { min: 10000, label: "10,000 UZS" },
  visa: { min: 100000, label: "100,000 UZS" },
};

export default function DepositPage() {
  const [method, setMethod] = useState<DepositInitiateRequestMethod>("uzcard");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState(1);
  const [depositId, setDepositId] = useState<number | null>(null);
  const [cardInfo, setCardInfo] = useState({ number: "", holder: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { mutate: initiate, isPending } = useInitiateDeposit();
  const { toast } = useToast();

  const handleNext = () => {
    const val = Number(amount);
    const min = LIMITS[method].min;
    if (!val || val < min) {
      toast({ title: "Minimal miqdor", description: `${method.toUpperCase()}: ${LIMITS[method].label}`, variant: "destructive" });
      return;
    }
    initiate({ data: { method, amount: val } }, {
      onSuccess: (res) => {
        setDepositId(res.depositId);
        setCardInfo({ number: res.cardNumber, holder: res.cardHolder });
        setStep(2);
        sounds.coin();
      },
      onError: () => toast({ title: "Xatolik", description: "Qayta urinib ko'ring", variant: "destructive" }),
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: "Fayl juda katta", description: "Maksimal 20MB", variant: "destructive" });
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
    sounds.click();
  };

  const handleConfirm = async () => {
    if (!depositId) return;
    if (!file) {
      toast({ title: "Chek yuklang", description: "To'lov chekini yuklash majburiy", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem("betuz_token");
      const formData = new FormData();
      formData.append("depositId", String(depositId));
      formData.append("receipt", file);

      // Use XMLHttpRequest to avoid any fetch interceptor issues with FormData
      const result = await new Promise<{ ok: boolean; data: any }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/deposit/confirm");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, data });
          } catch {
            resolve({ ok: false, data: { error: "Server xatosi" } });
          }
        };
        xhr.onerror = () => resolve({ ok: false, data: { error: "Ulanish xatosi" } });
        xhr.send(formData);
      });

      if (result.ok) {
        setStep(3);
        sounds.bigWin();
        toast({ title: "✅ Chek yuborildi!", description: "Admin tekshirib balansingizni to'ldiradi" });
      } else {
        toast({ title: "Xatolik", description: result.data?.error || "Qayta urinib ko'ring", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Xatolik", description: "Qayta urinib ko'ring", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const copyCard = () => {
    navigator.clipboard.writeText(cardInfo.number.replace(/\s/g, ""));
    toast({ title: "✅ Nusxalandi!" });
    sounds.click();
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">💳 Depozit</h1>

      <div className="flex gap-1">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-white/10"}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="glass-panel p-5 rounded-2xl space-y-5">
            <div>
              <p className="text-sm text-muted-foreground mb-2">To'lov usuli</p>
              <div className="grid grid-cols-3 gap-2">
                {(["uzcard", "humo", "visa"] as const).map((m) => (
                  <motion.button key={m} whileTap={{ scale: 0.95 }}
                    onClick={() => { setMethod(m); sounds.click(); }}
                    className={`py-4 rounded-xl flex flex-col items-center gap-1 border-2 transition-all font-bold uppercase text-sm
                      ${method === m ? "border-primary bg-primary/20 text-white" : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/30"}`}>
                    <span className="text-2xl">{m === "visa" ? "💳" : m === "uzcard" ? "🏧" : "🏦"}</span>
                    <span>{m}</span>
                  </motion.button>
                ))}
              </div>
              <p className="text-xs text-accent mt-2 text-center">Minimal: {LIMITS[method].label}</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground font-semibold mb-2 block">Summa (UZS)</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0" className="text-2xl font-bold text-center h-14" />
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[50000, 100000, 200000, 500000].map((v) => (
                  <Button key={v} variant="outline" size="sm" className="text-xs" onClick={() => setAmount(String(v))}>
                    {v >= 1000000 ? v / 1000000 + "M" : v / 1000 + "k"}
                  </Button>
                ))}
              </div>
            </div>

            <Button variant="gold" className="w-full text-lg h-14" onClick={handleNext} disabled={isPending || !amount}>
              {isPending ? "..." : "Davom etish →"}
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-4 rounded-xl border border-blue-500/30 text-center">
              <p className="text-xs text-muted-foreground mb-1">
                <b className="text-white">{Number(amount).toLocaleString()} UZS</b> quyidagi kartaga yuboring:
              </p>
              <div className="text-xl font-mono font-black tracking-wider text-white mb-1">{cardInfo.number}</div>
              <div className="text-primary font-semibold text-sm">{cardInfo.holder}</div>
              <div className="inline-block bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full mt-1 capitalize">{method}</div>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={copyCard}>
                <Copy className="w-4 h-4 mr-2" /> Nusxalash
              </Button>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">📎 To'lov chekini yuklang <span className="text-red-400">*</span></p>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />
              {file ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl">
                  {preview ? (
                    <img src={preview} alt="" className="w-12 h-12 rounded object-cover" />
                  ) : file.type.startsWith("video/") ? (
                    <Film className="w-8 h-8 text-blue-400 shrink-0" />
                  ) : (
                    <File className="w-8 h-8 text-gray-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={() => { setFile(null); setPreview(null); }} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/20 hover:border-primary/60 rounded-xl p-6 text-center transition-all hover:bg-white/5 active:scale-95">
                  <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="font-semibold text-sm">Chek rasmini yuklang</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF</p>
                </button>
              )}
            </div>

            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-lg h-12"
              onClick={handleConfirm} disabled={uploading || !file}>
              {uploading ? "Yuklanmoqda..." : "✅ Men To'ladim"}
            </Button>
            <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setStep(1)}>← Orqaga</Button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass-panel p-8 rounded-2xl text-center space-y-4 border border-emerald-500/30">
            <CheckCircle2 className="w-20 h-20 text-emerald-400 mx-auto" />
            <h2 className="text-2xl font-black">✅ Chek yuborildi!</h2>
            <p className="text-muted-foreground">Admin chekni ko'rib balansingizni to'ldiradi. Odatda 5–15 daqiqa ichida.</p>
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-3 text-sm text-blue-300">
              💡 Balansingiz yangilanishini sahifani yangilash orqali kuzating.
            </div>
            <Button variant="gold" onClick={() => { setStep(1); setAmount(""); setFile(null); setPreview(null); }}>
              + Yangi depozit
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
