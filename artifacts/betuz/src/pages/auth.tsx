import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      loginMutation.mutate({ data: { username, password } }, {
        onSuccess: (res) => {
          localStorage.setItem("betuz_token", res.token);
          toast({ title: "Muvaffaqiyatli", description: "Tizimga kirdingiz!" });
          setLocation("/");
        },
        onError: () => toast({ title: "Xatolik", description: "Login yoki parol noto'g'ri", variant: "destructive" })
      });
    } else {
      registerMutation.mutate({ data: { username, password, phone } }, {
        onSuccess: (res) => {
          localStorage.setItem("betuz_token", res.token);
          toast({ title: "Muvaffaqiyatli", description: "Ro'yxatdan o'tdingiz!" });
          setLocation("/");
        },
        onError: () => toast({ title: "Xatolik", description: "Xatolik yuz berdi", variant: "destructive" })
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-8 rounded-3xl relative z-10"
      >
        <div className="text-center mb-8">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-display font-bold text-white mb-2">Hush Kelibsiz</h1>
          <p className="text-muted-foreground">O'zbekistonning eng ishonchli platformasi</p>
        </div>

        <div className="flex bg-background rounded-xl p-1 mb-8 border border-border">
          <button 
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isLogin ? 'bg-card text-white shadow-md' : 'text-muted-foreground'}`}
            onClick={() => setIsLogin(true)}
          >
            Kirish
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isLogin ? 'bg-card text-white shadow-md' : 'text-muted-foreground'}`}
            onClick={() => setIsLogin(false)}
          >
            Ro'yxatdan O'tish
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Foydalanuvchi nomi</label>
            <Input required value={username} onChange={e => setUsername(e.target.value)} placeholder="username123" />
          </div>
          
          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <label className="text-sm font-medium text-muted-foreground mb-1 block mt-4">Telefon raqam</label>
                <Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Parol</label>
            <Input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <Button 
            type="submit" 
            className="w-full mt-6" 
            variant="gold"
            disabled={loginMutation.isPending || registerMutation.isPending}
          >
            {loginMutation.isPending || registerMutation.isPending ? "Kutilmoqda..." : (isLogin ? "Tizimga Kirish" : "Ro'yxatdan O'tish")}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
