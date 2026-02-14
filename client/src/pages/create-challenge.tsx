import { useState, useCallback, useMemo, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { RANDOM_IDEAS, ABI_V1, NETWORKS } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shuffle, Plus, Minus, Clock, DollarSign, Zap, ExternalLink, Search, Fuel } from 'lucide-react';
import { Link } from 'wouter';

export default function CreateChallenge() {
  const { connected, connect, signer, ethUsd, feeBps, getV1Contract, network, connecting, explorerUrl } = useWallet();
  const { toast } = useToast();

  const [idea, setIdea] = useState('');
  const [stakeMode, setStakeMode] = useState<'USD' | 'ETH'>('USD');
  const [stakeUsd, setStakeUsd] = useState(5);
  const [stakeEthDirect, setStakeEthDirect] = useState('0.0014');
  const [joinMins, setJoinMins] = useState(15);
  const [resolveMins, setResolveMins] = useState(30);
  const [loading, setLoading] = useState(false);
  const [lastChallengeId, setLastChallengeId] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');
  const [gasEstimate, setGasEstimate] = useState<{ gasEth: number; gasUsd: number } | null>(null);
  const [estimatingGas, setEstimatingGas] = useState(false);

  const stakeEthValue = useMemo(() => {
    if (stakeMode === 'USD') {
      return ethUsd > 0 ? stakeUsd / ethUsd : 0;
    }
    return parseFloat(stakeEthDirect) || 0;
  }, [stakeMode, stakeUsd, stakeEthDirect, ethUsd]);

  const displayValue = stakeMode === 'USD' ? stakeUsd : stakeEthDirect;

  const shuffleIdea = () => {
    setIdea(RANDOM_IDEAS[Math.floor(Math.random() * RANDOM_IDEAS.length)]);
  };

  const adjustStake = (dir: number) => {
    if (stakeMode === 'USD') {
      setStakeUsd(Math.max(1, stakeUsd + dir));
    } else {
      const v = Math.max(0.0001, parseFloat(stakeEthDirect || '0') + dir * 0.001);
      setStakeEthDirect(v.toFixed(6));
    }
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
      toast({ title: 'Challenge Created', description: challengeId ? `Challenge #${challengeId}` : 'Check transaction for details' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.shortMessage || e?.message || String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [connected, connect, signer, network, stakeEthValue, joinMins, resolveMins, feeBps, getV1Contract, toast]);

  const potEth = stakeEthValue * 2;
  const potUsd = potEth * ethUsd;
  const feeEth = (potEth * feeBps) / 10000;
  const winnerEth = potEth - feeEth;

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="create-challenge-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Create Challenge</h1>
        <p className="text-sm text-muted-foreground mt-1">Set the challenge, deadlines, and fund the escrow in one step.</p>
      </div>

      <Card className="p-5">
        <div className="mb-5">
          <label className="text-xs text-foreground font-semibold uppercase tracking-wider mb-2 block text-center">Challenge Idea</label>
          <div className="relative">
            <input
              data-testid="input-challenge-idea"
              type="text"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. I can beat you at chess"
              className="w-full bg-muted/50 border border-border rounded-md py-3 pl-3 pr-12 text-sm focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/20"
            />
            <button
              data-testid="button-shuffle-idea"
              onClick={shuffleIdea}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md border border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))]"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-center mb-2 gap-3">
            <label className="text-xs text-foreground font-semibold uppercase tracking-wider">Challenge Amount</label>
            <div className="flex items-center gap-1.5">
              <button
                data-testid="button-mode-eth"
                onClick={() => setStakeMode('ETH')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all ${
                  stakeMode === 'ETH' ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-border text-muted-foreground'
                }`}
              >ETH</button>
              <button
                data-testid="button-mode-usd"
                onClick={() => setStakeMode('USD')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all ${
                  stakeMode === 'USD' ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-border text-muted-foreground'
                }`}
              >USD</button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button data-testid="button-stake-minus" onClick={() => adjustStake(-1)} className="p-2 rounded-md border border-border">
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground font-medium">
                {stakeMode === 'USD' ? '$' : 'Ξ'}
              </span>
              <input
                data-testid="input-stake-amount"
                type="number"
                value={displayValue}
                onChange={(e) => {
                  if (stakeMode === 'USD') setStakeUsd(Number(e.target.value) || 0);
                  else setStakeEthDirect(e.target.value);
                }}
                className="w-full bg-muted/50 border border-border rounded-md py-4 pl-9 pr-3 text-2xl font-bold text-center font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50"
              />
            </div>
            <button data-testid="button-stake-plus" onClick={() => adjustStake(1)} className="p-2 rounded-md border border-border">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center mt-1.5">
            <span className={`text-xs font-mono ${stakeMode === 'USD' ? 'text-muted-foreground' : 'text-emerald-400 font-medium'}`}>
              {stakeMode === 'USD'
                ? `${stakeEthValue.toFixed(6)} ETH`
                : `$${(stakeEthValue * ethUsd).toFixed(2)}`}
            </span>
          </div>

          {stakeMode === 'USD' && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[1, 5, 10, 20].map((amt) => (
                <button
                  key={amt}
                  data-testid={`button-quick-usd-${amt}`}
                  onClick={() => setStakeUsd(amt)}
                  className={`py-2 rounded-md text-sm font-medium border transition-all ${
                    stakeUsd === amt
                      ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >${amt}</button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-xs text-foreground font-semibold uppercase tracking-wider mb-1.5 block text-center">Join Deadline</label>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                data-testid="input-join-deadline"
                type="number"
                min={1}
                max={43200}
                value={joinMins}
                onChange={(e) => setJoinMins(Number(e.target.value))}
                className="w-full bg-muted/50 border border-border rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50"
              />
              <span className="text-[10px] text-muted-foreground">min</span>
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
            <label className="text-xs text-foreground font-semibold uppercase tracking-wider mb-1.5 block text-center">Resolve Deadline</label>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                data-testid="input-resolve-deadline"
                type="number"
                min={1}
                max={43200}
                value={resolveMins}
                onChange={(e) => setResolveMins(Number(e.target.value))}
                className="w-full bg-muted/50 border border-border rounded-md py-2 px-3 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50"
              />
              <span className="text-[10px] text-muted-foreground">min</span>
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

        <div className="rounded-md border border-border bg-muted/30 p-3 mb-5">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Pot value</span><span className="font-mono">{potEth.toFixed(6)} ETH <span className="text-emerald-400">(${potUsd.toFixed(2)})</span></span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fee ({(feeBps/100).toFixed(1)}%)</span><span className="font-mono text-muted-foreground">-{feeEth.toFixed(6)} ETH <span className="text-emerald-400/70">(${(feeEth * ethUsd).toFixed(2)})</span></span></div>
            <div className="h-px bg-border" />
            <div className="flex justify-between"><span className="text-emerald-400 font-medium">Winner gets</span><span className="font-mono font-bold text-emerald-400">{winnerEth.toFixed(6)} ETH <span className="text-emerald-400">(${(winnerEth * ethUsd).toFixed(2)})</span></span></div>
          </div>
        </div>

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

        <div className="flex gap-3">
          <Button
            data-testid="button-create-challenge"
            onClick={handleCreate}
            disabled={loading || stakeEthValue <= 0}
            className="flex-1"
            size="lg"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Confirming...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Create & Fund</>
            )}
          </Button>
          <Button
            data-testid="button-reset"
            variant="outline"
            onClick={() => {
              setStakeUsd(5);
              setStakeEthDirect('0.0014');
              setJoinMins(15);
              setResolveMins(30);
              setIdea('');
            }}
          >
            Reset
          </Button>
        </div>

        {(lastChallengeId || lastTxHash) && (
          <div className="mt-3 p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 space-y-3" data-testid="challenge-created-success">
            {lastChallengeId && (
              <div>
                <p className="text-xs text-emerald-400 font-medium">Challenge #{lastChallengeId} Created</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Share this ID with your opponent. They can join on the Bet Lookup page.</p>
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
            <Link href="/lookup" data-testid="link-go-to-lookup">
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
