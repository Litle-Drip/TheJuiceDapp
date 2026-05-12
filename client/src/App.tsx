import { lazy, Suspense } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider, useWallet } from "@/lib/wallet";
import { NotificationProvider, useNotifications } from "@/lib/notifications";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { NETWORKS } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NotFound from "@/pages/not-found";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  TrendingUp,
  Zap,
  Search,
  Wallet,
  ExternalLink,
  Globe,
  Loader2,
  AlertTriangle,
  LayoutDashboard,
  Flame,
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

const navItems = [
  { title: "Markets", url: "/", icon: TrendingUp, desc: "Create odds-based bets" },
  { title: "Create Challenge", url: "/challenge", icon: Zap, desc: "Equal-stakes head-to-head" },
  { title: "Bet Lookup", url: "/lookup", icon: Search, desc: "Join, vote, or check status" },
  { title: "My Bets", url: "/my-bets", icon: LayoutDashboard, desc: "Your betting history" },
  { title: "Trending", url: "/trending", icon: Flame, desc: "Browse open bets" },
];

function WalletButton() {
  const { connected, connect, shortAddress, network, switchNetwork, connecting, explorerUrl, address } = useWallet();
  const net = NETWORKS[network];

  return (
    <div className="space-y-2 p-2">
      {connected ? (
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="font-mono text-[10px]" data-testid="badge-address">
            {shortAddress}
          </Badge>
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground"
            data-testid="link-explorer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <Button
          data-testid="button-connect-wallet"
          onClick={connect}
          disabled={connecting}
          className="w-full"
          size="sm"
        >
          {connecting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
          ) : (
            <Wallet className="w-4 h-4 mr-1.5" />
          )}
          {connecting ? "Connecting..." : "Connect Wallet"}
        </Button>
      )}
      <Button
        data-testid="button-switch-network"
        onClick={switchNetwork}
        disabled={connecting}
        variant="outline"
        size="sm"
        className="w-full text-xs justify-start gap-1.5 border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{net.chainName}</span>
        <span className="ml-auto text-[11px] text-foreground/80 font-medium">Switch</span>
      </Button>
    </div>
  );
}

function AppSidebar() {
  const [location] = useLocation();
  const { notificationCount, clearNotifications } = useNotifications();

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <Link href="/" data-testid="link-logo">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="The Juice" className="w-9 h-9 rounded-lg shadow-sm" />
            <div>
              <div className="text-base font-bold tracking-tight leading-none">The Juice</div>
              <div className="text-[10px] text-muted-foreground leading-none mt-1">P2P Betting on Base</div>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} className="h-auto py-2">
                    <Link
                      href={item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => { if (item.url === '/my-bets') clearNotifications(); }}
                    >
                      <item.icon />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm leading-tight">{item.title}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{item.desc}</span>
                      </div>
                      {item.title === 'My Bets' && notificationCount > 0 && (
                        <Badge variant="default" className="ml-auto text-[9px] px-1.5 py-0 min-h-0 h-4 bg-emerald-500 text-white border-0" data-testid="badge-notification-count">
                          {notificationCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border pt-1">
        <WalletButton />
        <VerificationBadge />
      </SidebarFooter>
    </Sidebar>
  );
}

function VerificationBadge() {
  const { network } = useWallet();
  const net = NETWORKS[network];
  const contractAddr = net.contract || net.v2contract;
  const explorerBase = net.explorer;

  if (!contractAddr) return null;

  return (
    <div className="px-2 pb-2">
      <a
        href={`${explorerBase}/address/${contractAddr}#code`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium"
        data-testid="link-verified-contract"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Verified Contract</span>
        <ExternalLink className="w-2.5 h-2.5 ml-auto" />
      </a>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30" data-testid="mainnet-banner">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <p className="text-xs text-amber-600 dark:text-amber-400">
        {net.chainName} contracts are not yet deployed. Switch to Base Sepolia to use the app.
      </p>
    </div>
  );
}

function LegalFooter() {
  return (
    <footer className="mt-16 mb-6" data-testid="legal-footer">
      <div className="max-w-xl mx-auto">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />
        <p className="text-xs text-muted-foreground/70 leading-relaxed mb-3 text-center">
          &copy; 2026 Edison Labs LLC &middot; Experimental software. Use at your own risk.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          <Link href="/about" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-about">About</Link>
          <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">Terms</Link>
          <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy">Privacy</Link>
          <Link href="/risk" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-risk">Risk</Link>
          <Link href="/faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-faq">FAQ</Link>
        </div>
      </div>
    </footer>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
        <WalletProvider>
          <NotificationProvider>
            <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1 min-w-0">
                  <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border h-14 sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="flex-1" />
                    <ThemeToggle />
                    <EthPrice />
                  </header>
                  <MainnetBanner />
                  <main className="flex-1 overflow-auto px-4 py-6 sm:px-6">
                    <Router />
                    <LegalFooter />
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </NotificationProvider>
        </WalletProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
    >
      <Badge variant="outline" className="font-mono text-sm cursor-pointer text-[#627EEA] border-[#627EEA]/30" data-testid="badge-eth-price">
        {ethUsd > 0 ? `ETH $${ethUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'ETH ...'}
      </Badge>
    </a>
  );
}

export default App;
