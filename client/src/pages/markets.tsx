import { useState, useCallback, useMemo, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { computeTakerStake, ABI_V2, NETWORKS } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { RANDOM_IDEAS } from '@/lib/contracts';
import { TrendingUp, TrendingDown, ArrowRight, Zap, Clock, Shield, ChevronDown, ChevronUp, Info, Loader2, Copy, ExternalLink, Shuffle, MessageSquare, Search, Fuel } from 'lucide-react';
import { Link } from 'wouter';

export default function Markets() {
  const { connected, connect, signer, ethUsd, feeBps, getV2Contract, network: networkKey, explorerUrl, connecting } = useWallet();
  const { toast } = useToast();

  const [question, setQuestion] = useState('');
  const [sideYes, setSideYes] = useState(true);
  const [oddsBps, setOddsBps] = useState(5000);
  const [stakeEth, setStakeEth] = useState('0.01');
  const [joinMins, setJoinMins] = useState(15);
  const [resolveMins, setResolveMins] = useState(30);
  const [loading, setLoading] = useState(false);
  const [lastOfferId, setLastOfferId] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<{ gasEth: number; gasUsd: number } | null>(null);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [showSliderTooltip, setShowSliderTooltip] = useState(false);

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
        opponentProfit: Number(ethers.formatEther(winnerPayout)) - Number(ethers.formatEther(takerWei)),
        opponentProfitUsd: (Number(ethers.formatEther(winnerPayout)) - Number(ethers.formatEther(takerWei))) * ethUsd,
        opponentMultiplier: Number(ethers.formatEther(winnerPayout)) / Number(ethers.formatEther(takerWei)),
        yourProfit: Number(ethers.formatEther(winnerPayout)) - ethVal,
        yourProfitUsd: (Number(ethers.formatEther(winnerPayout)) - ethVal) * ethUsd,
        takerWei,
      };
    } catch {
      return null;
    }
  }, [stakeEth, sideYes, oddsBps, feeBps, ethUsd]);

  useEffect(() => {
    if (!preview || !connected || !signer) { setGasEstimate(null); return; }
    const net = NETWORKS[networkKey];
    if (!net.v2contract) { setGasEstimate(null); return; }
    let cancelled = false;
    setEstimatingGas(true);
    (async () => {
      try {
        const c = new ethers.Contract(net.v2contract, ABI_V2, signer);
        const ethVal = parseFloat(stakeEth);
        if (!isFinite(ethVal) || ethVal <= 0) return;
        const Awei = ethers.parseEther(ethVal.toFixed(18));
        const joinSecs = joinMins * 60;
        const resolveSecs = resolveMins * 60;
        const gas = await c.openOffer.estimateGas(sideYes, oddsBps, joinSecs, resolveSecs, { value: Awei });
        const provider = signer.provider;
        if (!provider) return;
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || 0n;
        const costWei = gas * gasPrice;
        const costEth = Number(ethers.formatEther(costWei));
        if (!cancelled) {
          setGasEstimate({ gasEth: costEth, gasUsd: costEth * ethUsd });
        }
      } catch {
        if (!cancelled) setGasEstimate(null);
      } finally {
        if (!cancelled) setEstimatingGas(false);
      }
    })();
    return () => { cancelled = true; };
  }, [preview, connected, signer, networkKey, stakeEth, sideYes, oddsBps, joinMins, resolveMins, ethUsd]);

  const handleCreateOffer = useCallback(async () => {
    let activeSigner = signer;
    if (!connected) {
      try { activeSigner = await connect(); } catch { return; }
    }
    setLoading(true);
    try {
      const ethVal = parseFloat(stakeEth);
      if (!isFinite(ethVal) || ethVal <= 0) throw new Error('Enter a valid stake amount');
      if (oddsBps < 500 || oddsBps > 9500) throw new Error('Odds must be between 5% and 95%');
      if (joinMins < 1) throw new Error('Join window must be at least 1 minute');
      if (resolveMins < 1) throw new Error('Resolve window must be at least 1 minute');
      const net = NETWORKS[networkKey];
      if (!net.v2contract) throw new Error('Contract not deployed on this network');
      const c = activeSigner
        ? new ethers.Contract(net.v2contract, ABI_V2, activeSigner)
        : getV2Contract(false);
      if (!c) throw new Error('Contract not available');
      const Awei = ethers.parseEther(ethVal.toFixed(18));
      const joinSecs = joinMins * 60;
      const resolveSecs = resolveMins * 60;

      const tx = await c.openOffer(sideYes, oddsBps, joinSecs, resolveSecs, { value: Awei });
      toast({ title: 'Transaction submitted', description: 'Waiting for confirmation...' });
      const receipt = await tx.wait();
      setLastTxHash(receipt.hash);

      let offerId = '';
      try {
        const iface = new ethers.Interface(ABI_V2);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (parsed?.name === 'OfferOpened') {
              offerId = String(parsed.args[0]);
              break;
            }
          } catch {}
        }
      } catch {}

      setLastOfferId(offerId);
      toast({
        title: 'Offer Created',
        description: offerId ? `Offer #${offerId} is live` : 'Check transaction for details',
      });
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      toast({ title: 'Failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [connected, connect, signer, networkKey, stakeEth, sideYes, oddsBps, joinMins, resolveMins, getV2Contract, toast]);

  const yesPriceDisplay = `${yesPercent}¢`;
  const noPriceDisplay = `${noPercent}¢`;

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="markets-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Markets</h1>
        <p className="text-sm text-muted-foreground mt-1">Create odds-based offers. Set your price, pick a side.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[hsl(var(--primary))]" />
          <span className="text-sm font-semibold">New Market Offer</span>
        </div>

        <div className="mb-5">
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
        </div>
        <p className="text-[10px] text-muted-foreground text-center mb-5">Off-chain reference only. Both parties vote to resolve.</p>

        <div className="mb-5">
          <label className="text-xs text-foreground mb-2 block font-semibold uppercase tracking-wider text-center">Pick Your Side</label>
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
            <label className="text-xs text-foreground font-semibold uppercase tracking-wider">Implied Probability</label>
            <div className="flex items-center gap-2">
              <Badge variant={sideYes ? "default" : "outline"} className={`font-mono text-xs ${sideYes ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'text-muted-foreground'}`}>
                YES {yesPercent}%
              </Badge>
              <Badge variant={!sideYes ? "default" : "outline"} className={`font-mono text-xs ${!sideYes ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'text-muted-foreground'}`}>
                NO {noPercent}%
              </Badge>
            </div>
          </div>
          <div className="relative">
            <div className="relative">
              {showSliderTooltip && (
                <div
                  className="absolute -top-8 transform -translate-x-1/2 pointer-events-none z-10"
                  style={{ left: `${((oddsBps - 500) / 9000) * 100}%` }}
                >
                  <div className="bg-foreground text-background text-[10px] font-mono font-bold px-2 py-1 rounded-md whitespace-nowrap">
                    {yesPercent}%
                  </div>
                </div>
              )}
              <input
                data-testid="input-odds"
                type="range"
                min={500}
                max={9500}
                step={50}
                value={oddsBps}
                onChange={(e) => setOddsBps(Number(e.target.value))}
                onMouseDown={() => setShowSliderTooltip(true)}
                onMouseUp={() => setShowSliderTooltip(false)}
                onTouchStart={() => setShowSliderTooltip(true)}
                onTouchEnd={() => setShowSliderTooltip(false)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(16,185,129) ${yesPercent}%, rgb(244,63,94) ${yesPercent}%)`,
                }}
              />
            </div>
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
            <label className="text-xs text-foreground font-semibold uppercase tracking-wider">Your Stake</label>
            <span className="text-xs text-emerald-400 font-mono font-medium" data-testid="text-stake-usd">
              {preview ? `$${preview.yourStakeUsd.toFixed(2)}` : '$0.00'}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">&#926;</span>
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
          <span className="font-semibold text-foreground">Deadlines</span>
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-4 mb-5 max-w-xs mx-auto">
            <div className="space-y-1.5">
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block text-center">Join Window</label>
              <div className="relative">
                <input
                  data-testid="input-join-mins"
                  type="number"
                  min={1}
                  max={43200}
                  value={joinMins}
                  onChange={(e) => setJoinMins(Number(e.target.value))}
                  className="w-full bg-muted/50 border border-border rounded-md py-1.5 px-3 pr-10 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">min</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[15, 60, 1440].map(m => (
                  <button
                    key={m}
                    onClick={() => setJoinMins(m)}
                    className={`text-[10px] font-medium border rounded-md py-1 text-center transition-all ${
                      joinMins === m
                        ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {m < 60 ? `${m}m` : m < 1440 ? `${m/60}h` : `${m/1440}d`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block text-center">Resolve Window</label>
              <div className="relative">
                <input
                  data-testid="input-resolve-mins"
                  type="number"
                  min={1}
                  max={43200}
                  value={resolveMins}
                  onChange={(e) => setResolveMins(Number(e.target.value))}
                  className="w-full bg-muted/50 border border-border rounded-md py-1.5 px-3 pr-10 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">min</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[30, 120, 2880].map(m => (
                  <button
                    key={m}
                    onClick={() => setResolveMins(m)}
                    className={`text-[10px] font-medium border rounded-md py-1 text-center transition-all ${
                      resolveMins === m
                        ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
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
              <Info className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
              <span className="text-sm font-semibold">Order Preview</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your stake</span>
                <span className="text-sm font-mono font-medium" data-testid="text-preview-stake">
                  {preview.yourStake.toFixed(6)} ETH
                  <span className="text-emerald-400 ml-1">(${preview.yourStakeUsd.toFixed(2)})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Opponent pays</span>
                <span className="text-sm font-mono font-medium" data-testid="text-preview-opponent">
                  {preview.opponentStake.toFixed(6)} ETH
                  <span className="text-emerald-400 ml-1">(${preview.opponentStakeUsd.toFixed(2)})</span>
                </span>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total pot</span>
                <span className="text-sm font-mono font-medium" data-testid="text-preview-pot">
                  {preview.totalPot.toFixed(6)} ETH
                  <span className="text-emerald-400 ml-1">(${preview.totalPotUsd.toFixed(2)})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fee ({(feeBps / 100).toFixed(1)}%)</span>
                <span className="text-sm font-mono text-muted-foreground" data-testid="text-preview-fee">
                  -{preview.fee.toFixed(6)} ETH <span className="text-emerald-400/70">(${preview.feeUsd.toFixed(2)})</span>
                </span>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-400">You win (profit)</span>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-emerald-400" data-testid="text-preview-payout">
                    +{preview.yourProfit.toFixed(6)} ETH
                  </span>
                  <span className="text-xs text-emerald-400/70 ml-1">(${preview.yourProfitUsd.toFixed(2)})</span>
                  <span className="text-xs text-muted-foreground ml-1">{preview.multiplier.toFixed(2)}x</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-rose-400">Opponent wins (profit)</span>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-rose-400" data-testid="text-preview-opponent-payout">
                    +{preview.opponentProfit.toFixed(6)} ETH
                  </span>
                  <span className="text-xs text-rose-400/70 ml-1">(${preview.opponentProfitUsd.toFixed(2)})</span>
                  <span className="text-xs text-muted-foreground ml-1">{preview.opponentMultiplier.toFixed(2)}x</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-xs font-medium text-[hsl(var(--primary))]">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Join: {joinMins < 60 ? `${joinMins}m` : joinMins < 1440 ? `${(joinMins/60).toFixed(0)}h` : `${(joinMins/1440).toFixed(0)}d`}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Resolve: {resolveMins < 60 ? `${resolveMins}m` : resolveMins < 1440 ? `${(resolveMins/60).toFixed(0)}h` : `${(resolveMins/1440).toFixed(0)}d`}</span>
                </div>
                <span className="font-semibold">Base</span>
              </div>
            </div>
          </div>
        )}

        {connected && gasEstimate && (
          <div className="flex items-center justify-center gap-1.5 mb-3 text-[10px] text-muted-foreground" data-testid="gas-estimate-offer">
            <Fuel className="w-3 h-3" />
            <span>Est. gas: {gasEstimate.gasEth.toFixed(6)} ETH</span>
            <span className="text-emerald-400">(${gasEstimate.gasUsd.toFixed(4)})</span>
          </div>
        )}
        {connected && estimatingGas && !gasEstimate && (
          <div className="flex items-center justify-center gap-1.5 mb-3 text-[10px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Estimating gas...</span>
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

        {(lastOfferId || lastTxHash) && (
          <div className="mt-3 p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 space-y-3" data-testid="offer-created-success">
            {lastOfferId && (
              <div className="flex items-center justify-between flex-wrap gap-2">
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
            )}
            {lastTxHash && (
              <div className="flex items-center gap-2">
                <button
                  data-testid="button-copy-offer-tx"
                  onClick={() => {
                    navigator.clipboard.writeText(lastTxHash);
                    toast({ title: 'Copied', description: 'Transaction hash copied' });
                  }}
                  className="text-[10px] font-mono text-muted-foreground truncate flex-1 text-left"
                >
                  TX: {lastTxHash.slice(0, 10)}...{lastTxHash.slice(-8)}
                </button>
                <a
                  href={`${explorerUrl}/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[hsl(var(--primary))] flex-shrink-0"
                  data-testid="link-offer-tx-explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
            <Link href="/lookup" data-testid="link-go-to-lookup">
              <Button variant="outline" size="sm" className="w-full">
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Go to Bet Lookup
              </Button>
            </Link>
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
          <p>After creating an offer, share the <span className="text-foreground font-medium">Bet ID</span> with your opponent. They can accept it on the <span className="text-foreground font-medium">Bet Lookup</span> page.</p>
        </div>
      </Card>
    </div>
  );
}
