import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AuthPage from "@/pages/auth";
import HomePage from "@/pages/home";
import SportPage from "@/pages/sport";
import CasinoPage from "@/pages/casino";
import SlotlarPage from "@/pages/slotlar";
import SlotsPage from "@/pages/slots";
import MinesPage from "@/pages/mines";
import CrashPage from "@/pages/crash";
import DicePage from "@/pages/dice";
import CoinflipPage from "@/pages/coinflip";
import WheelPage from "@/pages/wheel";
import RoulettePage from "@/pages/roulette";
import PlinkoPage from "@/pages/plinko";
import BlackjackPage from "@/pages/blackjack";
import AppleFortunePage from "@/pages/applefortune";
import WildWestGoldPage from "@/pages/wildwestgold";
import GemsOdysseyPage from "@/pages/gemsodyssey";
import MatchViewPage from "@/pages/matchview";
import DepositPage from "@/pages/deposit";
import WithdrawPage from "@/pages/withdraw";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin";
import SupportPage from "@/pages/support";
import KuponPage from "@/pages/kupon";
import PulTarixiPage from "@/pages/pul-tarixi";
import LuckyWheelPage from "@/pages/lucky-wheel";
import PenaltyPage from "@/pages/penalty";
import MoreMagicApplePage from "@/pages/moremagicapple";
import DownloadPage from "@/pages/download";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import { CouponProvider } from "@/lib/couponContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10000,
    },
  },
});

// Global fetch interceptor — adds JWT token to all requests
// NOTE: Does NOT set Content-Type for FormData (browser handles boundary)
const _origFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem("betuz_token");
  if (!token) return _origFetch(input, init);
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  return _origFetch(input, { ...init, headers });
};

// Resets scroll to top on every route change — prevents "sliding down" effect
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Protected({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("betuz_token");
    if (!token) {
      setLocation("/auth");
    } else {
      setOk(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (ok === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}

// IMPORTANT: These must be defined at MODULE level (outside Router/App) so their
// references are stable across re-renders. If defined inside Router(), every
// re-render creates a new component type → React unmounts/remounts the page
// tree → deposit/game state resets to initial values every 5 seconds.
const WHome         = () => <Protected><Layout><HomePage /></Layout></Protected>;
const WSport        = () => <Protected><Layout><SportPage /></Layout></Protected>;
const WCasino       = () => <Protected><Layout><CasinoPage /></Layout></Protected>;
const WSlotlar      = () => <Protected><Layout><SlotlarPage /></Layout></Protected>;
const WSlots        = () => <Protected><Layout><SlotsPage /></Layout></Protected>;
const WMines        = () => <Protected><Layout><MinesPage /></Layout></Protected>;
const WCrash        = () => <Protected><Layout><CrashPage /></Layout></Protected>;
const WDice         = () => <Protected><Layout><DicePage /></Layout></Protected>;
const WCoinflip     = () => <Protected><Layout><CoinflipPage /></Layout></Protected>;
const WWheel        = () => <Protected><Layout><WheelPage /></Layout></Protected>;
const WRoulette     = () => <Protected><Layout><RoulettePage /></Layout></Protected>;
const WPlinko       = () => <Protected><Layout><PlinkoPage /></Layout></Protected>;
const WBlackjack    = () => <Protected><Layout><BlackjackPage /></Layout></Protected>;
const WAppleFortune  = () => <Protected><Layout><AppleFortunePage /></Layout></Protected>;
const WWildWestGold  = () => <Protected><WildWestGoldPage /></Protected>;
const WGemsOdyssey   = () => <Protected><GemsOdysseyPage /></Protected>;
const WMatchView     = () => <Protected><MatchViewPage /></Protected>;
const WDeposit      = () => <Protected><Layout><DepositPage /></Layout></Protected>;
const WWithdraw     = () => <Protected><Layout><WithdrawPage /></Layout></Protected>;
const WProfile      = () => <Protected><Layout><ProfilePage /></Layout></Protected>;
const WAdmin        = () => <AdminPage />;
const WSupport      = () => <Protected><Layout><SupportPage /></Layout></Protected>;
const WKupon        = () => <Protected><Layout><KuponPage /></Layout></Protected>;
const WPulTarixi    = () => <Protected><Layout><PulTarixiPage /></Layout></Protected>;
const WLuckyWheel   = () => <Protected><LuckyWheelPage /></Protected>;
const WPenalty          = () => <Protected><PenaltyPage /></Protected>;
const WMoreMagicApple   = () => <Protected><MoreMagicApplePage /></Protected>;

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/yuklab-olish" component={DownloadPage} />
        <Route path="/auth"         component={AuthPage} />
        <Route path="/"             component={WHome} />
        <Route path="/sport"        component={WSport} />
        <Route path="/casino"       component={WCasino} />
        <Route path="/slotlar"      component={WSlotlar} />
        <Route path="/slots"        component={WSlots} />
        <Route path="/mines"        component={WMines} />
        <Route path="/crash"        component={WCrash} />
        <Route path="/dice"         component={WDice} />
        <Route path="/coinflip"     component={WCoinflip} />
        <Route path="/wheel"        component={WWheel} />
        <Route path="/roulette"     component={WRoulette} />
        <Route path="/plinko"       component={WPlinko} />
        <Route path="/blackjack"    component={WBlackjack} />
        <Route path="/applefortune" component={WAppleFortune} />
        <Route path="/wildwestgold" component={WWildWestGold} />
        <Route path="/gemsodyssey"  component={WGemsOdyssey} />
        <Route path="/match/:id"    component={WMatchView} />
        <Route path="/deposit"      component={WDeposit} />
        <Route path="/withdraw"     component={WWithdraw} />
        <Route path="/profile"      component={WProfile} />
        <Route path="/admin"        component={WAdmin} />
        <Route path="/support"      component={WSupport} />
        <Route path="/kupon"        component={WKupon} />
        <Route path="/pul-tarixi"   component={WPulTarixi} />
        <Route path="/lucky-wheel"  component={WLuckyWheel} />
        <Route path="/penalty"          component={WPenalty} />
        <Route path="/moremagicapple"   component={WMoreMagicApple} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CouponProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </CouponProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
