import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider, useWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Markets from "@/pages/markets";
import CreateChallenge from "@/pages/create-challenge";
import BetLookup from "@/pages/bet-lookup";
import About from "@/pages/about";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import RiskDisclosure from "@/pages/risk";
import FAQ from "@/pages/faq";
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
} from "lucide-react";
import logoImg from "@assets/ChatGPT_Image_Nov_11,_2025,_12_24_49_PM_1771015761494.png";

const navItems = [
  { title: "Markets", url: "/", icon: TrendingUp },
  { title: "Create Challenge", url: "/challenge", icon: Zap },
  { title: "Bet Lookup", url: "/lookup", icon: Search },
];

function WalletButton() {
  const { connected, connect, shortAddress, network, switchNetwork, connecting, explorerUrl, address } = useWallet();
  const net = NETWORKS[network];

  return (
    <div className="space-y-2 p-2">
      {connected ? (
        <>
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
          <button
            data-testid="button-switch-network"
            onClick={switchNetwork}
            className="flex items-center gap-1.5 w-full text-[10px] text-muted-foreground py-1 px-2 rounded-md border border-border"
          >
            <Globe className="w-3 h-3" />
            <span>{net.chainName}</span>
          </button>
        </>
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
    </div>
  );
}

function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" data-testid="link-logo">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="The Juice" className="w-8 h-8 rounded-md" />
            <div>
              <div className="text-base font-bold tracking-tight leading-none">The Juice</div>
              <div className="text-[10px] text-muted-foreground leading-none mt-0.5">P2P Betting on Base</div>
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
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <WalletButton />
      </SidebarFooter>
    </Sidebar>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Markets} />
      <Route path="/challenge" component={CreateChallenge} />
      <Route path="/lookup" component={BetLookup} />
      <Route path="/about" component={About} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/risk" component={RiskDisclosure} />
      <Route path="/faq" component={FAQ} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MainnetBanner() {
  const { network } = useWallet();
  const net = NETWORKS[network];
  if (net.contract) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30" data-testid="mainnet-banner">
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <p className="text-xs text-amber-400">
        {net.chainName} contracts are not yet deployed. Switch to Base Sepolia to use the app.
      </p>
    </div>
  );
}

function LegalFooter() {
  return (
    <footer className="mt-12 mb-4 px-4" data-testid="legal-footer">
      <div className="max-w-2xl mx-auto rounded-lg border border-border/60 px-6 py-5">
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
          &copy; 2026 Edison Labs LLC &middot; Experimental software. Use at your own risk.
        </p>
        <div className="flex items-center justify-between">
          <Link href="/about" className="text-[13px] text-[hsl(var(--primary))]" data-testid="link-about">About</Link>
          <Link href="/terms" className="text-[13px] text-[hsl(var(--primary))]" data-testid="link-terms">Terms of Use</Link>
          <Link href="/privacy" className="text-[13px] text-[hsl(var(--primary))]" data-testid="link-privacy">Privacy Policy</Link>
          <Link href="/risk" className="text-[13px] text-[hsl(var(--primary))]" data-testid="link-risk">Risk Disclosure</Link>
          <Link href="/faq" className="text-[13px] text-[hsl(var(--primary))]" data-testid="link-faq">FAQ</Link>
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
        <WalletProvider>
          <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center gap-2 p-2 border-b border-border h-12 sticky top-0 z-50 bg-background">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <div className="flex-1" />
                  <EthPrice />
                </header>
                <MainnetBanner />
                <main className="flex-1 overflow-auto p-4">
                  <Router />
                  <LegalFooter />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function EthPrice() {
  const { ethUsd } = useWallet();
  return (
    <Badge variant="outline" className="font-mono text-[10px]" data-testid="badge-eth-price">
      ETH ${ethUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
    </Badge>
  );
}

export default App;
