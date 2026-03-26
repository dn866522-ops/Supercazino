import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Paperclip, X, Film } from "lucide-react";
import { sounds } from "@/lib/sounds";

interface Msg {
  id: number;
  text?: string | null;
  isOperator: boolean;
  time: string;
  fileUrl?: string | null;
  fileType?: string | null;
}

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastCountRef = useRef(0);
  const { toast } = useToast();

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("betuz_token");
      const res = await fetch("/api/support/messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const msgs: Msg[] = data.messages || [];
      if (msgs.length > lastCountRef.current) {
        const newMsgs = msgs.slice(lastCountRef.current);
        if (newMsgs.some((m) => m.isOperator)) sounds.coin();
      }
      lastCountRef.current = msgs.length;
      setMessages(msgs);
    } catch {}
  };

  useEffect(() => {
    fetchMessages();
    const t = setInterval(fetchMessages, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      toast({ title: "Fayl juda katta", description: "Maksimal 50MB", variant: "destructive" });
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
    sounds.click();
  };

  const clearFile = () => { setFile(null); setFilePreview(null); };

  const handleSend = async () => {
    if (!input.trim() && !file) return;
    setSending(true);
    try {
      const token = localStorage.getItem("betuz_token");
      const formData = new FormData();
      if (input.trim()) formData.append("message", input.trim());
      if (file) formData.append("file", file);

      const result = await new Promise<{ ok: boolean }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/support/message");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300 });
        xhr.onerror = () => resolve({ ok: false });
        xhr.send(formData);
      });

      if (result.ok) {
        setInput("");
        clearFile();
        sounds.coin();
        await fetchMessages();
      } else {
        toast({ title: "Xatolik", description: "Xabar yuborilmadi", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ulanish xatosi", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] rounded-2xl overflow-hidden border border-border/50 shadow-xl bg-card">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-border p-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
          <Bot className="text-primary w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-white">Operator Xizmati</h2>
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online — 24/7
          </p>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">Javob: ~5 daqiqa</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center py-10">
            <Bot className="w-14 h-14 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm font-medium">Assalomu alaykum! 👋</p>
            <p className="text-muted-foreground text-xs mt-1">Savolingizni yozing yoki rasm yuboring</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.isOperator ? "justify-start" : "justify-end"}`}>
              {m.isOperator && (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mr-2 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${m.isOperator ? "bg-slate-800 border border-slate-700" : "bg-primary"}`}>
                {m.isOperator && <p className="text-[10px] text-primary font-bold mb-1">Operator</p>}
                {m.text && <p className="text-sm text-white whitespace-pre-wrap">{m.text}</p>}
                {m.fileUrl && (
                  <div className="mt-2">
                    {m.fileType?.startsWith("image") ? (
                      <img src={m.fileUrl} alt="Rasm" className="rounded-xl max-w-[200px] max-h-[200px] object-cover cursor-pointer border border-white/10"
                        onClick={() => window.open(m.fileUrl!, "_blank")} />
                    ) : m.fileType?.startsWith("video") ? (
                      <video src={m.fileUrl} controls className="rounded-xl max-w-[220px]" />
                    ) : (
                      <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-blue-400 text-xs underline flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> Faylni ko'rish
                      </a>
                    )}
                  </div>
                )}
                <span className={`text-[9px] mt-1 block ${m.isOperator ? "text-muted-foreground" : "text-blue-200 text-right"}`}>{fmt(m.time)}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* File preview bar */}
      <AnimatePresence>
        {file && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-border shrink-0">
            <div className="p-2 flex items-center gap-3 bg-slate-900/80">
              {filePreview ? (
                <img src={filePreview} alt="" className="w-12 h-12 rounded object-cover" />
              ) : file.type.startsWith("video/") ? (
                <div className="w-12 h-12 rounded bg-slate-700 flex items-center justify-center"><Film className="w-5 h-5 text-muted-foreground" /></div>
              ) : (
                <div className="w-12 h-12 rounded bg-slate-700 flex items-center justify-center"><Paperclip className="w-5 h-5 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={clearFile} className="text-muted-foreground hover:text-destructive p-1"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3 bg-background border-t border-border shrink-0">
        <div className="flex gap-2 items-center">
          <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />
          <Button variant="ghost" size="sm" className="px-2 text-muted-foreground hover:text-primary" onClick={() => fileRef.current?.click()}>
            <Paperclip className="w-5 h-5" />
          </Button>
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Xabaringizni yozing..." className="flex-1 bg-card border-none text-sm" />
          <Button size="sm" className="px-3" onClick={handleSend} disabled={sending || (!input.trim() && !file)}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
