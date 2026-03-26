import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("pwa_install_dismissed");
    if (wasDismissed) return;

    const isInstalled = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    if (isInstalled) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowBanner(false);
        setDeferredPrompt(null);
        localStorage.setItem("pwa_install_dismissed", "1");
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem("pwa_install_dismissed", "1");
  };

  if (dismissed || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed bottom-20 left-3 right-3 z-50 sm:left-auto sm:right-4 sm:w-96"
        >
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-yellow-500/40 rounded-2xl shadow-2xl shadow-black/60 p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0 border border-yellow-500/30">
                <Smartphone className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-sm">BetUZ ilovasini o'rnating</h3>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Tezroq kirish va bildirishnomalar uchun qurilmangizga o'rnating
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleInstall}
                    disabled={installing}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs py-2 px-3 rounded-xl transition-colors disabled:opacity-60"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {installing ? "O'rnatilmoqda..." : "O'rnatish"}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-2 text-slate-400 hover:text-white text-xs rounded-xl hover:bg-slate-700/50 transition-colors"
                  >
                    Keyinroq
                  </button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-500 hover:text-white transition-colors shrink-0 -mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
