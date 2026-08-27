import { lazy, Suspense } from "react";
import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider, useWallet } from "@/lib/wallet";
import { NotificationProvider } from "@/lib/notifications";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { NETWORKS } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { SideNav, BottomNav } from "@/components/nav";
import NotFound from "@/pages/not-found";
import {
  Wallet,
  ExternalLink,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Sun,
  Moon,
} from "lucide-react";
import logoImg from "@assets/ChatGPT_Image_Nov_11,_2025,_12_24_49_PM_1771015761494.png";

const Markets = lazy(() => import("@/pages/markets"));
const CreateChallenge = lazy(() => import("@/pages/create-challenge"));
const BetLookup = lazy(() => import("@/pages/bet-lookup"));
const MyBets = lazy(() => import("@/pages/my-bets"));
const Trending = lazy(() => import("@/pages/trending"));
const About = lazy(() => import("@/pages/about"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
const RiskDisclosure = lazy(() => import("@/pages/risk"));
const FAQ = lazy(() => import("@/pages/faq"));

function Brand({ className = "", tagline = true }: { className?: string; tagline?: boolean }) {
  return (
    <Link href="/" data-testid="link-logo" className={`flex shrink-0 items-center gap-2.5 ${className}`}>
      <img src={logoImg} alt="The Juice" className="h-8 w-8 shrink-0 rounded-lg shadow-sm" />
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-base font-bold leading-none tracking-tight">The Juice</span>
        {tagline && (
          <span className="mt-1 block whitespace-nowrap text-2xs leading-none text-muted-foreground">P2P Betting on Base</span>
        )}
      </span>
    </Link>
  );
}

function NetworkPill() {
  const { network, switchNetwork, connecting } = useWallet();
  const net = NETWORKS[network];
  const live = Boolean(net.contract || net.v2contract);

  return (
    <button
      type="button"
      data-testid="button-switch-network"
      onClick={switchNetwork}
      disabled={connecting}
      title="Switch network"
      className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-success" : "bg-amber-500"}`} />
      <span className="max-w-24 truncate">{net.chainName.replace("Base ", "")}</span>
    </button>
  );
}

function WalletButton() {
  const { connected, connect, shortAddress, connecting, explorerUrl, address } = useWallet();

  if (connected) {
    return (
      <a
        href={`${explorerUrl}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="link-explorer"
        className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 font-mono text-xs text-foreground"
      >
        <span data-testid="badge-address">{shortAddress}</span>
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </a>
    );
  }

  return (
    <Button
      data-testid="button-connect-wallet"
      onClick={connect}
      disabled={connecting}
      size="sm"
      className="rounded-full"
    >
      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      <span>{connecting ? "Connecting" : "Connect"}</span>
    </Button>
  );
}

function VerificationBadge() {
  const { network } = useWallet();
  const net = NETWORKS[network];
  const contractAddr = net.contract || net.v2contract;

  if (!contractAddr) return null;

  return (
    <a
      href={`${net.explorer}/address/${contractAddr}#code`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-2xs font-medium text-success/80"
      data-testid="link-verified-contract"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      <span>Verified contract</span>
      <ExternalLink className="ml-auto h-2.5 w-2.5" />
    </a>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Markets} />
        <Route path="/challenge" component={CreateChallenge} />
        <Route path="/lookup" component={BetLookup} />
        <Route path="/my-bets" component={MyBets} />
        <Route path="/trending" component={Trending} />
        <Route path="/about" component={About} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/risk" component={RiskDisclosure} />
        <Route path="/faq" component={FAQ} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function MainnetBanner() {
  const { network } = useWallet();
  const net = NETWORKS[network];
  if (net.contract) return null;
  return (
    <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2" data-testid="mainnet-banner">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
        {net.chainName} contracts are not yet deployed. Switch to Base Sepolia to use the app.
      </p>
    </div>
  );
}

const legalLinks = [
  { href: "/about", label: "About", testId: "link-about" },
  { href: "/terms", label: "Terms", testId: "link-terms" },
  { href: "/privacy", label: "Privacy", testId: "link-privacy" },
  { href: "/risk", label: "Risk", testId: "link-risk" },
  { href: "/faq", label: "FAQ", testId: "link-faq" },
];

function LegalFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-xl border-t border-border/60 pt-6" data-testid="legal-footer">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {legalLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            data-testid={l.testId}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground/70">
        &copy; 2026 Edison Labs LLC &middot; Experimental software. Use at your own risk.
      </p>
    </footer>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="button-theme-toggle" title="Toggle theme">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function EthPrice() {
  const { ethUsd } = useWallet();
  return (
    <a
      href="https://www.coinbase.com/price/ethereum"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="link-eth-price"
      className="hidden sm:block"
    >
      <span
        className="flex min-h-9 items-center rounded-full border border-[#627EEA]/30 px-2.5 font-mono text-xs text-[#627EEA]"
        data-testid="badge-eth-price"
      >
        {ethUsd > 0 ? `ETH $${ethUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "ETH ..."}
      </span>
    </a>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <WalletProvider>
            <NotificationProvider>
              <div className="flex min-h-screen w-full">
                <aside
                  className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex"
                  data-testid="app-sidebar"
                >
                  <div className="border-b border-sidebar-border px-4 py-4">
                    <Brand />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <SideNav />
                  </div>
                  <div className="space-y-2 border-t border-sidebar-border p-3">
                    <VerificationBadge />
                  </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                  <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b border-border bg-background/85 px-3 backdrop-blur sm:gap-2 sm:px-4">
                    <Brand className="md:hidden" tagline={false} />
                    <div className="flex-1" />
                    <EthPrice />
                    <NetworkPill />
                    <WalletButton />
                    <ThemeToggle />
                  </header>
                  <MainnetBanner />
                  <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 md:pb-10 md:pt-8">
                    <Router />
                    <LegalFooter />
                  </main>
                </div>
              </div>
              <BottomNav />
              <Toaster />
            </NotificationProvider>
          </WalletProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
