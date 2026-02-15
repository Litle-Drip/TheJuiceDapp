import { useState, useCallback, useMemo, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { RANDOM_IDEAS, ABI_V1, NETWORKS } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shuffle, Clock, Shield, Zap, ExternalLink, Search, Fuel, Info, ChevronDown, ChevronUp, MessageSquare, Copy } from 'lucide-react';
import { Link } from 'wouter';
import { ConfirmTxDialog } from '@/components/confirm-tx-dialog';
import { onTransactionSuccess } from '@/lib/feedback';

export default function CreateChallenge() {
  const { connected, connect, signer, ethUsd, feeBps, getV1Contract, network, connecting, explorerUrl } = useWallet();
  const { toast } = useToast();

  const [idea, setIdea] = useState('');
  const [stakeEth, setStakeEth] = useState('0.01');
  const [joinMins, setJoinMins] = useState(15);
  const [resolveMins, setResolveMins] = useState(30);
  const [loading, setLoading] = useState(false);
  const [lastChallengeId, setLastChallengeId] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');
  const [gasEstimate, setGasEstimate] = useState<{ gasEth: number; gasUsd: number } | null>(null);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const stakeEthValue = useMemo(() => {
    return parseFloat(stakeEth) || 0;
  }, [stakeEth]);

  const shuffleIdea = () => {
    setIdea(RANDOM_IDEAS[Math.floor(Math.random() * RANDOM_IDEAS.length)]);
  };

  useEffect(() => {
    if (!connected || !signer || stakeEthValue <= 0) { setGasEstimate(null); return; }
    const net = NETWORKS[network];
    if (!net.contract) { setGasEstimate(null); return; }
    let cancelled = false;
    setEstimatingGas(true);
    (async () => {
      try {
        const c = new ethers.Contract(net.contract, ABI_V1, signer);
        const stakeWei = ethers.parseEther(stakeEthValue.toFixed(18));
        const jm = Math.max(5, Math.min(43200, joinMins));
        const rm = Math.max(30, Math.min(43200, resolveMins));
        const gas = await c.openChallenge.estimateGas(stakeWei, feeBps, BigInt(jm * 60), BigInt(rm * 60), { value: stakeWei });
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
  }, [connected, signer, network, stakeEthValue, joinMins, resolveMins, feeBps, ethUsd]);

  const handleCreate = useCallback(async () => {
    let activeSigner = signer;
    if (!connected) {
      try { activeSigner = await connect(); } catch { return; }
    }
    setLoading(true);
    try {
      const net = NETWORKS[network];
      if (!net.contract) throw new Error('Contract not deployed on this network');
      const c = activeSigner
        ? new ethers.Contract(net.contract, ABI_V1, activeSigner)
        : getV1Contract(false);
      if (!c) throw new Error('Connect wallet first');

      if (stakeEthValue <= 0) throw new Error('Enter a valid stake amount');
      const stakeWei = ethers.parseEther(stakeEthValue.toFixed(18));
      const jm = Math.max(5, Math.min(43200, joinMins));
      const rm = Math.max(30, Math.min(43200, resolveMins));
      if (rm <= jm) throw new Error('Resolve deadline must be after join deadline');

      const tx = await c.openChallenge(stakeWei, feeBps, BigInt(jm * 60), BigInt(rm * 60), { value: stakeWei });
      toast({ title: 'Transaction sent', description: 'Waiting for confirmation...' });
      const receipt = await tx.wait();
      setLastTxHash(receipt.hash);

      let challengeId = '';
      try {
        const iface = new ethers.Interface(ABI_V1);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (parsed?.name === 'ChallengeOpened') {
              challengeId = String(parsed.args[0]);
              break;
            }
          } catch {}
        }
      } catch {}
      if (!challengeId) {
        try {
          const readContract = getV1Contract(true);
          if (readContract) {
            const nextId = await readContract.nextChallengeId();
            challengeId = String(BigInt(nextId) - 1n);
          }
        } catch {}
      }

      setLastChallengeId(challengeId);
      if (challengeId && idea.trim()) {
        try {
          const stored = JSON.parse(localStorage.getItem('juice_bet_questions') || '{}');
          stored[`c${challengeId}`] = idea.trim();
          localStorage.setItem('juice_bet_questions', JSON.stringify(stored));
        } catch {}
      }
      onTransactionSuccess();
      toast({ title: 'Challenge Created', description: challengeId ? `Challenge #${challengeId}` : 'Check transaction for details' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.shortMessage || e?.message || String(e), variant: 'destructive' });
      throw e;
    } finally {
      setLoading(false);
    }
  }, [connected, connect, signer, network, stakeEthValue, joinMins, resolveMins, feeBps, getV1Contract, toast, idea]);

  const preview = useMemo(() => {
    const ethVal = stakeEthValue;
    if (!isFinite(ethVal) || ethVal <= 0) return null;
    const potEth = ethVal * 2;
    const feeEth = (potEth * feeBps) / 10000;
    const winnerEth = potEth - feeEth;
    const profitEth = winnerEth - ethVal;
    return {
      yourStake: ethVal,
      yourStakeUsd: ethVal * ethUsd,
      opponentStake: ethVal,
      opponentStakeUsd: ethVal * ethUsd,
      totalPot: potEth,
      totalPotUsd: potEth * ethUsd,
      fee: feeEth,
      feeUsd: feeEth * ethUsd,
      winnerPayout: winnerEth,
      winnerPayoutUsd: winnerEth * ethUsd,
      profit: profitEth,
      profitUsd: profitEth * ethUsd,
      multiplier: ethVal > 0 ? profitEth / ethVal : 0,
    };
  }, [stakeEthValue, feeBps, ethUsd]);

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="create-challenge-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Create Challenge</h1>
        <p className="text-sm text-muted-foreground mt-1">Equal stakes, head-to-head. Fund the escrow in one step.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[hsl(var(--primary))]" />
          <span className="text-sm font-semibold">New Challenge</span>
        </div>

        <div className="mb-5">
          <div className="relative">
            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              data-testid="input-challenge-idea"
              type="text"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. I can beat you at chess"
              className="w-full bg-muted/50 border border-border rounded-md py-3 pl-9 pr-12 text-sm focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/20"
            />
            <button
              data-testid="button-shuffle-idea"
              onClick={shuffleIdea}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md border border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))]"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mb-5">Off-chain reference only. Both parties vote to resolve.</p>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-foreground font-semibold uppercase tracking-wider">Each Side Stakes</label>
            <span className="text-xs text-emerald-400 font-mono font-medium" data-testid="text-stake-usd">
              {preview ? `$${preview.yourStakeUsd.toFixed(2)}` : '$0.00'}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">&#926;</span>
            <input
              data-testid="input-stake-amount"
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
                  data-testid="input-join-deadline"
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
                  data-testid="input-resolve-deadline"
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
          <div className="rounded-md border border-border bg-muted/30 p-4 mb-5" data-testid="challenge-preview">
            <div className="flex items-center gap-1.5 mb-3">
              <Info className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
              <span className="text-sm font-semibold">Order Preview</span>
            </div>

            {idea.trim() && (
              <div className="mb-3 p-2.5 rounded-md bg-muted/40 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Challenge</p>
                <p className="text-sm font-medium leading-snug" data-testid="text-preview-idea">&ldquo;{idea.trim()}&rdquo;</p>
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your stake</span>
                <span className="text-sm font-mono font-medium" data-testid="text-preview-stake">
                  {preview.yourStake.toFixed(6)} ETH
                  <span className="text-emerald-400 ml-1">(${preview.yourStakeUsd.toFixed(2)})</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Opponent stakes</span>
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
                <span className="text-sm font-medium text-emerald-400">Winner takes</span>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-emerald-400" data-testid="text-preview-payout">
                    +{preview.profit.toFixed(6)} ETH
                  </span>
                  <span className="text-xs text-emerald-400/70 ml-1">(${preview.profitUsd.toFixed(2)})</span>
                  <span className="text-xs text-muted-foreground ml-1">{preview.multiplier.toFixed(2)}x</span>
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
          <div className="flex items-center justify-center gap-1.5 mb-3 text-[10px] text-muted-foreground" data-testid="gas-estimate-challenge">
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
          data-testid="button-create-challenge"
          onClick={() => {
            if (!connected) { handleCreate(); return; }
            setShowConfirm(true);
          }}
          disabled={loading || stakeEthValue <= 0}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Confirming...</>
          ) : connected ? (
            <><Zap className="w-4 h-4 mr-2" /> Create & Fund</>
          ) : (
            <>Connect Wallet & Create</>
          )}
        </Button>

        <ConfirmTxDialog
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleCreate}
          title="Confirm Challenge"
          confirmLabel="Create & Fund"
          gas={gasEstimate}
          lines={preview ? [
            ...(idea.trim() ? [{ label: 'Challenge', value: `"${idea.trim().slice(0, 40)}${idea.trim().length > 40 ? '...' : ''}"` }] : []),
            { label: 'Your stake', value: `${preview.yourStake.toFixed(6)} ETH` },
            { label: 'Opponent stakes', value: `${preview.opponentStake.toFixed(6)} ETH` },
            { label: 'Total pot', value: `${preview.totalPot.toFixed(6)} ETH` },
            { label: `Fee (${(feeBps / 100).toFixed(1)}%)`, value: `-${preview.fee.toFixed(6)} ETH`, muted: true },
            { label: 'Winner takes', value: `+${preview.profit.toFixed(6)} ETH`, highlight: true },
          ] : []}
        />

        {(lastChallengeId || lastTxHash) && (
          <div className="mt-3 p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 space-y-3" data-testid="challenge-created-success">
            {lastChallengeId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs text-emerald-400 font-medium">Challenge Created</p>
                    <p className="text-sm font-mono mt-0.5">ID: {lastChallengeId}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  data-testid="button-copy-share-link"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/lookup?id=${lastChallengeId}${idea.trim() ? `&q=${encodeURIComponent(idea.trim())}` : ''}`;
                    navigator.clipboard.writeText(shareUrl);
                    toast({ title: 'Copied', description: 'Share link copied — send it to your opponent' });
                  }}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Share Link
                </Button>
              </div>
            )}
            {lastTxHash && (
              <div className="flex items-center gap-2">
                <button
                  data-testid="button-copy-tx"
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
                  data-testid="link-tx-explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
            <Link href={`/lookup?id=${lastChallengeId}${idea.trim() ? `&q=${encodeURIComponent(idea.trim())}` : ''}`} data-testid="link-go-to-lookup">
              <Button variant="outline" size="sm" className="w-full">
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Go to Bet Lookup
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
