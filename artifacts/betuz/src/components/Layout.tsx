import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Home, Trophy, Dice5, User, Headset, LogOut, TicketCheck, Wallet, Layers, Download } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "./ui/button";
import { useCoupon } from "@/lib/couponContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetMe({ query: { retry: false, refetchInterval: 5000 } });
  const [location, setLocation] = useLocation();
  const { items } = useCoupon();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(installed);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const isTelegram = /telegram/i.test(navigator.userAgent);

  const handleInstall = async () => {
    if (isTelegram) {
      // Telegram brauzerida PWA installi ishlamaydi — bot'ga yuboramiz
      window.open("https://t.me/Super_cazino_bot?start=apk", "_blank");
      return;
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
    } else {
      setLocation("/yuklab-olish");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("betuz_token");
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 glass-panel border-b-0 px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="BetUZ Logo" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-display font-bold gold-text">BetUZ</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground font-medium">{user.username}</span>
              <span className="font-bold text-primary">{formatMoney(user.balance || 0)}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="px-2 text-muted-foreground hover:text-destructive">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setLocation("/auth")}>Kirish</Button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full glass-panel border-t-0 z-50 pb-safe">
        <div className="flex justify-around items-center p-1.5 overflow-x-auto no-scrollbar">
          <NavItem href="/"        icon={<Home className="w-5 h-5" />}      label="Asosiy"   isActive={location === "/"} />
          <NavItem href="/sport"   icon={<Trophy className="w-5 h-5" />}    label="Sport"    isActive={location === "/sport"} color="green" />
          <NavItem href="/casino"  icon={<Dice5 className="w-5 h-5" />}     label="Kazino"   isActive={location === "/casino"} color="purple" />
          <NavItem href="/slotlar" icon={<Layers className="w-5 h-5" />}    label="Slotlar"  isActive={location === "/slotlar"} color="orange" />
          <NavItem href="/kupon"   badge={items.length > 0 ? items.length : undefined}
            icon={<TicketCheck className="w-5 h-5" />} label="Kupon" isActive={location === "/kupon"} color="gold" />
          <NavItem href="/pul-tarixi" icon={<Wallet className="w-5 h-5" />} label="Pul"      isActive={location === "/pul-tarixi"} color="orange" />
          <NavItem href="/profile" icon={<User className="w-5 h-5" />}      label="Profil"   isActive={location === "/profile"} />
          <NavItem href="/support" icon={<Headset className="w-5 h-5" />}   label="Operator" isActive={location === "/support"} />

          {/* Install / Download button */}
          {!isInstalled && (
            <button
              onClick={handleInstall}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 min-w-[44px] relative group"
            >
              <div className="mb-0.5 relative">
                <div className="w-5 h-5 flex items-center justify-center text-yellow-400 group-active:scale-90 transition-transform drop-shadow-[0_0_6px_rgba(212,175,55,0.8)]">
                  <Download className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[9px] font-bold text-yellow-400 tracking-wide">Yuklab ol</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

type NavColor = "default" | "green" | "purple" | "orange" | "gold";

function NavItem({
  href, icon, label, isActive, color = "default", badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  color?: NavColor;
  badge?: number;
}) {
  const activeColors: Record<NavColor, string> = {
    default: "text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.9)]",
    green:   "text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.9)]",
    purple:  "text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]",
    orange:  "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.9)]",
    gold:    "text-yellow-400 drop-shadow-[0_0_8px_rgba(212,175,55,0.9)]",
  };

  return (
    <Link href={href} className={cn(
      "flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 min-w-[40px] relative",
      isActive ? "scale-110" : "text-muted-foreground hover:text-white hover:bg-white/5"
    )}>
      <div className={cn("mb-0.5 transition-all relative", isActive && activeColors[color])}>
        {icon}
        {badge !== undefined && badge > 0 && (
          <span style={{
            position: "absolute", top: -6, right: -8,
            background: "#d4af37", color: "#000",
            fontSize: 9, fontWeight: 900, borderRadius: 999,
            minWidth: 16, height: 16, display: "flex",
            alignItems: "center", justifyContent: "center", padding: "0 4px",
          }}>{badge}</span>
        )}
      </div>
      <span className={cn(
        "text-[9px] font-semibold tracking-wide transition-all",
        isActive ? activeColors[color] : "text-muted-foreground"
      )}>{label}</span>
    </Link>
  );
}
