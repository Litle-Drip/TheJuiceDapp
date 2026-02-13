import { useState, useCallback, useMemo, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { computeTakerStake, ABI_V2 } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { RANDOM_IDEAS } from '@/lib/contracts';
import { TrendingUp, TrendingDown, ArrowRight, Zap, Clock, DollarSign, Shield, ChevronDown, ChevronUp, Info, Loader2, Copy, ExternalLink, Shuffle, MessageSquare } from 'lucide-react';

export default function Markets() {
  const { connected, connect, signer, ethUsd, feeBps, getV2Contract, network, explorerUrl, connecting } = useWallet();
  const { toast } = useToast();

  const [question, setQuestion] = useState('');
  const [sideYes, setSideYes] = useState(true);
  const [oddsBps, setOddsBps] = useState(5000);
  const [stakeEth, setStakeEth] = useState('0.01');
  const [joinMins, setJoinMins] = useState(15);
  const [resolveMins, setResolveMins] = useState(30);
  const [loading, setLoading] = useState(false);
  const [lastOfferId, setLastOfferId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const shuffleQuestion = () => {
    setQuestion(RANDOM_IDEAS[Math.floor(Math.random() * RANDOM_IDEAS.length)]);
  };

  const yesPercent = Math.round(oddsBps / 100);
  const noPercent = 100 - yesPercent;

  const preview = useMemo(() => {
    try {
      const ethVal = parseFloat(stakeEth);
      if (!isFinite(ethVal) || ethVal <= 0) return null;
      const weiVal = ethers.parseEther(String(ethVal));
      const takerWei = computeTakerStake(weiVal, sideYes, oddsBps);
      const gross = weiVal + takerWei;
      const fee = (gross * BigInt(feeBps)) / 10000n;
      const winnerPayout = gross - fee;

      return {
        yourStake: ethVal,
        yourStakeUsd: ethVal * ethUsd,
        opponentStake: Number(ethers.formatEther(takerWei)),
        opponentStakeUsd: Number(ethers.formatEther(takerWei)) * ethUsd,
        totalPot: Number(ethers.formatEther(gross)),
        totalPotUsd: Number(ethers.formatEther(gross)) * ethUsd,
        fee: Number(ethers.formatEther(fee)),
        feeUsd: Number(ethers.formatEther(fee)) * ethUsd,
        winnerPayout: Number(ethers.formatEther(winnerPayout)),
        winnerPayoutUsd: Number(ethers.formatEther(winnerPayout)) * ethUsd,
        multiplier: Number(ethers.formatEther(winnerPayout)) / ethVal,
        takerWei,
      };
    } catch {
      return null;
    }
  }, [stakeEth, sideYes, oddsBps, feeBps, ethUsd]);

  const handleCreateOffer = useCallback(async () => {
    if (!connected) {
      try { await connect(); } catch { return; }
    }
    setLoading(true);
    try {
      const ethVal = parseFloat(stakeEth);
      if (!isFinite(ethVal) || ethVal <= 0) throw new Error('Enter a valid stake amount');
      const c = getV2Contract(false);
      if (!c) throw new Error('Contract not available');
      const Awei = ethers.parseEther(ethVal.toFixed(18));
      const joinSecs = joinMins * 60;
      const resolveSecs = resolveMins * 60;

      const tx = await c.openOffer(sideYes, oddsBps, joinSecs, resolveSecs, { value: Awei });
      toast({ title: 'Transaction submitted', description: 'Waiting for confirmation...' });
      const receipt = await tx.wait();

      let offerId = '';
      try {
        const iface = new ethers.Interface(ABI_V2);
        for (const log of receipt.logs) {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'OfferOpened') {
            offerId = String(parsed.args.offerId);
            break;
          }
        }
      } catch {}

      setLastOfferId(offerId);
      toast({
        title: 'Offer Created',
        description: offerId ? `Offer #${offerId} is live` : 'Your offer is live on-chain',
      });
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      toast({ title: 'Failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [connected, connect, signer, stakeEth, sideYes, oddsBps, joinMins, resolveMins, getV2Contract, toast]);

  const yesPriceDisplay = `${yesPercent}¢`;
  const noPriceDisplay = `${noPercent}¢`;

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="markets-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Markets</h1>
        <p className="text-sm text-muted-foreground mt-1">Create odds-based offers. Set your price, pick a side.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[hsl(var(--primary))]" />
          <span className="text-sm font-semibold">New Market Offer</span>
        </div>

        <div className="mb-5">
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Market Question</label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              data-testid="input-market-question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will BTC hit $150K by end of Q1?"
              className="w-full bg-muted/50 border border-border rounded-md py-3 pl-9 pr-12 text-sm focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/20"
            />
            <button
              data-testid="button-shuffle-question"
              onClick={shuffleQuestion}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md border border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))]"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Off-chain reference only. Both parties vote to resolve.</p>
        </div>

        <div className="mb-5">
          <label className="text-xs text-muted-foreground mb-2 block font-medium uppercase tracking-wider">Pick Your Side</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              data-testid="button-side-yes"
              onClick={() => setSideYes(true)}
              className={`relative flex flex-col items-center justify-center py-4 rounded-md border transition-all ${
                sideYes
                  ? 'border-emerald-500/60 bg-emerald-500/10'
                  : 'border-border bg-card'
              }`}
            >
              <TrendingUp className={`w-5 h-5 mb-1 ${sideYes ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              <span className={`text-lg font-bold ${sideYes ? 'text-emerald-400' : 'text-foreground'}`}>YES</span>
              <span className={`text-xs mt-0.5 font-mono ${sideYes ? 'text-emerald-400/80' : 'text-muted-foreground'}`}>{yesPriceDisplay}</span>
            </button>
            <button
              data-testid="button-side-no"
              onClick={() => setSideYes(false)}
              className={`relative flex flex-col items-center justify-center py-4 rounded-md border transition-all ${
                !sideYes
                  ? 'border-rose-500/60 bg-rose-500/10'
                  : 'border-border bg-card'
              }`}
            >
              <TrendingDown className={`w-5 h-5 mb-1 ${!sideYes ? 'text-rose-400' : 'text-muted-foreground'}`} />
              <span className={`text-lg font-bold ${!sideYes ? 'text-rose-400' : 'text-foreground'}`}>NO</span>
              <span className={`text-xs mt-0.5 font-mono ${!sideYes ? 'text-rose-400/80' : 'text-muted-foreground'}`}>{noPriceDisplay}</span>
            </button>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Implied Probability</label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                YES {yesPercent}%
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                NO {noPercent}%
              </Badge>
            </div>
          </div>
          <div className="relative">
            <input
              data-testid="input-odds"
              type="range"
              min={500}
              max={9500}
              step={50}
              value={oddsBps}
              onChange={(e) => setOddsBps(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgb(16,185,129) ${yesPercent}%, rgb(244,63,94) ${yesPercent}%)`,
              }}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">5%</span>
              <span className="text-[10px] text-muted-foreground">50%</span>
              <span className="text-[10px] text-muted-foreground">95%</span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5 mt-3">
            {[1500, 2500, 5000, 7500, 8500].map((bps) => (
              <button
                key={bps}
                data-testid={`button-odds-${bps}`}
                onClick={() => setOddsBps(bps)}
                className={`py-1.5 rounded-md text-xs font-medium border transition-all ${
                  oddsBps === bps
                    ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {Math.round(bps / 100)}%
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Your Stake</label>
            <span className="text-xs text-muted-foreground font-mono" data-testid="text-stake-usd">
              {preview ? `$${preview.yourStakeUsd.toFixed(2)}` : '$0.00'}
            </span>
          </div>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              data-testid="input-stake"
              type="number"
              step="0.001"
              min="0"
              value={stakeEth}
              onChange={(e) => setStakeEth(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-md py-3 pl-8 pr-14 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/20"
              placeholder="0.01"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">ETH</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {['0.001', '0.005', '0.01', '0.05'].map((amt) => (
              <button
                key={amt}
                data-testid={`button-stake-${amt}`}
                onClick={() => setStakeEth(amt)}
                className={`py-1.5 rounded-md text-xs font-mono border transition-all ${
                  stakeEth === amt
                    ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        <button
          data-testid="button-toggle-advanced"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3"
        >
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>Deadlines</span>
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Join Window</label>
              <div className="flex items-center gap-1.5">
                <input
                  data-testid="input-join-mins"
                  type="number"
                  min={1}
                  max={43200}
                  value={joinMins}
                  onChange={(e) => setJoinMins(Number(e.target.value))}
                  className="w-full bg-muted/50 border border-border rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50"
                />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">min</span>
              </div>
              <div className="flex gap-1 mt-1">
                {[15, 60, 1440].map(m => (
                  <button key={m} onClick={() => setJoinMins(m)} className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    {m < 60 ? `${m}m` : m < 1440 ? `${m/60}h` : `${m/1440}d`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Resolve Window</label>
              <div className="flex items-center gap-1.5">
                <input
                  data-testid="input-resolve-mins"
                  type="number"
                  min={1}
                  max={43200}
                  value={resolveMins}
                  onChange={(e) => setResolveMins(Number(e.target.value))}
                  className="w-full bg-muted/50 border border-border rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50"
                />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">min</span>
              </div>
              <div className="flex gap-1 mt-1">
                {[30, 120, 2880].map(m => (
                  <button key={m} onClick={() => setResolveMins(m)} className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    {m < 60 ? `${m}m` : m < 1440 ? `${m/60}h` : `${m/1440}d`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {preview && (
          <div className="rounded-md border border-border bg-muted/30 p-4 mb-5" data-testid="market-preview">
            <div className="flex items-center gap-1.5 mb-3">
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Order Preview</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Your stake</span>
                <span className="text-sm font-mono font-medium" data-testid="text-preview-stake">
                  {preview.yourStake.toFixed(6)} ETH
                  <span className="text-muted-foreground ml-1">(${preview.yourStakeUsd.toFixed(2)})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Opponent pays</span>
                <span className="text-sm font-mono font-medium" data-testid="text-preview-opponent">
                  {preview.opponentStake.toFixed(6)} ETH
                  <span className="text-muted-foreground ml-1">(${preview.opponentStakeUsd.toFixed(2)})</span>
                </span>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total pot</span>
                <span className="text-sm font-mono font-medium" data-testid="text-preview-pot">
                  {preview.totalPot.toFixed(6)} ETH
                  <span className="text-muted-foreground ml-1">(${preview.totalPotUsd.toFixed(2)})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Fee ({(feeBps / 100).toFixed(1)}%)</span>
                <span className="text-sm font-mono text-muted-foreground" data-testid="text-preview-fee">
                  -{preview.fee.toFixed(6)} ETH
                </span>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-400">If you win</span>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-emerald-400" data-testid="text-preview-payout">
                    {preview.winnerPayout.toFixed(6)} ETH
                  </span>
                  <span className="text-xs text-emerald-400/70 ml-1">(${preview.winnerPayoutUsd.toFixed(2)})</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Return</span>
                <span className="text-sm font-mono font-bold text-[hsl(var(--primary))]" data-testid="text-preview-multiplier">
                  {preview.multiplier.toFixed(2)}x
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Join: {joinMins < 60 ? `${joinMins}m` : joinMins < 1440 ? `${(joinMins/60).toFixed(0)}h` : `${(joinMins/1440).toFixed(0)}d`}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>Resolve: {resolveMins < 60 ? `${resolveMins}m` : resolveMins < 1440 ? `${(resolveMins/60).toFixed(0)}h` : `${(resolveMins/1440).toFixed(0)}d`}</span>
                </div>
                <span>Network: {network === 'mainnet' ? 'Base' : 'Sepolia'}</span>
              </div>
            </div>
          </div>
        )}

        <Button
          data-testid="button-create-offer"
          onClick={handleCreateOffer}
          disabled={loading || !preview}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Confirming...</>
          ) : connected ? (
            <><Zap className="w-4 h-4 mr-2" /> Create Offer</>
          ) : (
            <>Connect Wallet & Create</>
          )}
        </Button>

        {lastOfferId && (
          <div className="mt-3 p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5" data-testid="offer-created-success">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-medium">Offer Created</p>
                <p className="text-sm font-mono mt-0.5">ID: {lastOfferId}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid="button-copy-offer-id"
                  onClick={() => {
                    navigator.clipboard.writeText(lastOfferId);
                    toast({ title: 'Copied', description: 'Offer ID copied to clipboard' });
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">How Market Odds Work</span>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>Market offers use <span className="text-foreground font-medium">asymmetric stakes</span> based on implied probability, just like Kalshi prediction markets.</p>
          <p>If you set YES at <span className="text-foreground font-medium">70%</span>, you risk more for a smaller return. Your opponent gets a better payout if they're right.</p>
          <p>Both sides vote on the outcome. If votes match, the winner is paid automatically. If they disagree, funds are refunded after the deadline.</p>
        </div>
      </Card>
    </div>
  );
}
