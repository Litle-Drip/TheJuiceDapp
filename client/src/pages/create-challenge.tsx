import { useState, useCallback, useMemo, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { RANDOM_IDEAS, ABI_V1, NETWORKS } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shuffle, Clock, Shield, Zap, ExternalLink, Search, Fuel, ChevronDown, ChevronUp, MessageSquare, Copy } from 'lucide-react';
import { Link } from 'wouter';
import { Field, Chip, SummaryRow } from '@/components/field';
import { formatEth, formatUsd, formatDuration, formatDeadline } from '@/lib/format';
import { ConfirmTxDialog } from '@/components/confirm-tx-dialog';
import { XIcon } from '@/components/x-icon';
import { onBetCreated, onCopyAction } from '@/lib/feedback';

export default function CreateChallenge() {
  const { connected, connect, signer, ethUsd, feeBps, getV1Contract, network, explorerUrl } = useWallet();
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
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stakeParam = params.get('stake');
    const qParam = params.get('q');
    if (stakeParam) setStakeEth(stakeParam);
    if (qParam) setIdea(decodeURIComponent(qParam));
  }, []);

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
      onBetCreated();
      toast({ title: 'Challenge created!', description: challengeId ? `Challenge #${challengeId} is live. Share it with a friend to get them to accept.` : 'Your challenge is live on the blockchain.' });
    } catch (e: any) {
      toast({ title: 'Transaction failed', description: e?.shortMessage || e?.message || 'Something went wrong. Check your wallet and try again.', variant: 'destructive' });
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
    <div className="mx-auto max-w-xl space-y-4" data-testid="create-challenge-page">
      <div className="page-section">
        <h1 className="page-title" data-testid="text-page-title">Challenge</h1>
        <p className="page-subtitle">Both players stake the same amount. Winner takes the pot, minus a small protocol fee.</p>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="stack-divider">
          <Field label="What's the bet?" hint="Optional">
            <div className="relative">
              <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid="input-challenge-idea"
                type="text"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. I can beat you at chess"
                className="field-input pl-9 pr-12"
              />
              <button
                data-testid="button-shuffle-idea"
                onClick={shuffleIdea}
                title="Random idea"
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-primary hover:bg-primary/10"
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </div>
          </Field>

          <Field label="Stake per player" hint={preview ? formatUsd(preview.yourStakeUsd) : formatUsd(0)}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">ETH</span>
              <input
                data-testid="input-stake-amount"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={stakeEth}
                onChange={(e) => setStakeEth(e.target.value)}
                className="field-input pl-12 pr-3 font-mono"
                placeholder="0.01"
              />
              <span className="hidden" data-testid="text-stake-usd">{preview ? formatUsd(preview.yourStakeUsd) : formatUsd(0)}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['0.001', '0.005', '0.01', '0.05'].map((amt) => (
                <Chip
                  key={amt}
                  data-testid={`button-stake-${amt}`}
                  active={stakeEth === amt}
                  onClick={() => setStakeEth(amt)}
                  className="font-mono"
                >
                  {amt}
                </Chip>
              ))}
            </div>
          </Field>

          <div>
            <button
              data-testid="button-toggle-advanced"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-sm font-medium">Time limits</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Accept {formatDuration(joinMins)} · Vote {formatDuration(resolveMins)}</span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Time to accept</span>
                  <div className="relative">
                    <input
                      data-testid="input-join-deadline"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={43200}
                      value={joinMins}
                      onChange={(e) => setJoinMins(Number(e.target.value))}
                      className="field-input pl-3 pr-12 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 60, 1440].map(m => (
                      <Chip key={m} active={joinMins === m} onClick={() => setJoinMins(m)}>
                        {formatDuration(m)}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-join-deadline-preview">
                    Accept by {formatDeadline(new Date(Date.now() + joinMins * 60_000))}
                  </p>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Time to vote</span>
                  <div className="relative">
                    <input
                      data-testid="input-resolve-deadline"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={43200}
                      value={resolveMins}
                      onChange={(e) => setResolveMins(Number(e.target.value))}
                      className="field-input pl-3 pr-12 font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[30, 120, 2880].map(m => (
                      <Chip key={m} active={resolveMins === m} onClick={() => setResolveMins(m)}>
                        {formatDuration(m)}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-resolve-deadline-preview">
                    Vote by {formatDeadline(new Date(Date.now() + (joinMins + resolveMins) * 60_000))}
                  </p>
                </div>
              </div>
            )}
          </div>

          {preview && (
            <div data-testid="challenge-preview">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Order summary</span>
                <Badge variant="outline" className="text-2xs">Even odds</Badge>
              </div>

              {idea.trim() && (
                <p className="mb-3 text-sm font-medium leading-snug" data-testid="text-preview-idea">
                  &ldquo;{idea.trim()}&rdquo;
                </p>
              )}

              <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-4">
                <SummaryRow
                  label="You stake"
                  value={`${formatEth(preview.yourStake)} ETH`}
                  sub={formatUsd(preview.yourStakeUsd)}
                  data-testid="text-preview-stake"
                />
                <SummaryRow
                  label="Opponent stakes"
                  value={`${formatEth(preview.opponentStake)} ETH`}
                  sub={formatUsd(preview.opponentStakeUsd)}
                  data-testid="text-preview-opponent"
                />
                <SummaryRow
                  label="Total pot"
                  value={`${formatEth(preview.totalPot)} ETH`}
                  sub={formatUsd(preview.totalPotUsd)}
                  data-testid="text-preview-pot"
                />
                <SummaryRow
                  label={`Protocol fee (${(feeBps / 100).toFixed(1)}%)`}
                  value={`-${formatEth(preview.fee)} ETH`}
                  tone="muted"
                  data-testid="text-preview-fee"
                />
                <div className="h-px bg-border" />
                <SummaryRow
                  label="Winner profit"
                  value={`+${formatEth(preview.profit)} ETH`}
                  sub={`${preview.multiplier.toFixed(2)}x`}
                  tone="success"
                  strong
                  data-testid="text-preview-payout"
                />
                <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Accept {formatDuration(joinMins)}</span>
                  <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Vote {formatDuration(resolveMins)}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <Button
              data-testid="button-create-challenge"
              onClick={() => {
                if (!connected) { handleCreate(); return; }
                setShowConfirm(true);
              }}
              disabled={loading || stakeEthValue <= 0}
              className="h-12 w-full text-base"
              size="lg"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</>
              ) : connected ? (
                <><Zap className="h-4 w-4" /> Create &amp; fund</>
              ) : (
                <>Connect wallet &amp; create</>
              )}
            </Button>

            {connected && gasEstimate && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-muted-foreground" data-testid="gas-estimate-challenge">
                <Fuel className="h-3 w-3" />
                <span>Est. gas {formatEth(gasEstimate.gasEth)} ETH · {formatUsd(gasEstimate.gasUsd)}</span>
              </p>
            )}
            {connected && estimatingGas && !gasEstimate && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Estimating gas…</span>
              </p>
            )}

            {(lastChallengeId || lastTxHash) && (
              <div className="mt-4 space-y-3 rounded-lg border border-success/30 bg-success/5 p-4" data-testid="challenge-created-success">
                {lastChallengeId && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-success">Your challenge is live</p>
                      <p className="mt-0.5 font-mono text-sm">Challenge #{lastChallengeId}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="min-h-11 w-full"
                        data-testid="button-copy-share-link"
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/lookup?id=${lastChallengeId}${idea.trim() ? `&q=${encodeURIComponent(idea.trim())}` : ''}`;
                          navigator.clipboard.writeText(shareUrl);
                          onCopyAction();
                          toast({ title: 'Link copied!', description: 'Send this to a friend so they can accept the challenge.' });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy share link
                      </Button>
                      <Button
                        variant="outline"
                        className="min-h-11 w-full"
                        data-testid="button-share-x-challenge-success"
                        onClick={() => {
                          const betUrl = `${window.location.origin}/lookup?id=${lastChallengeId}`;
                          const tweetText = idea.trim()
                            ? `"${idea.trim()}" - Take the other side on The Juice!`
                            : 'Check out this bet on The Juice!';
                          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(betUrl)}`, '_blank');
                        }}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                        Share on X
                      </Button>
                    </div>
                  </>
                )}
                <Link href={`/lookup?id=${lastChallengeId}${idea.trim() ? `&q=${encodeURIComponent(idea.trim())}` : ''}`} data-testid="link-go-to-lookup">
                  <Button variant="secondary" className="min-h-11 w-full">
                    <Search className="h-3.5 w-3.5" />
                    View your challenge
                  </Button>
                </Link>
                {lastTxHash && (
                  <div className="flex items-center gap-2">
                    <button
                      data-testid="button-copy-tx"
                      onClick={() => {
                        navigator.clipboard.writeText(lastTxHash);
                        onCopyAction();
                        toast({ title: 'Copied', description: 'Transaction hash copied' });
                      }}
                      className="flex-1 truncate text-left font-mono text-2xs text-muted-foreground"
                    >
                      TX: {lastTxHash.slice(0, 10)}...{lastTxHash.slice(-8)}
                    </button>
                    <a
                      href={`${explorerUrl}/tx/${lastTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-primary"
                      data-testid="link-tx-explorer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <ConfirmTxDialog
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleCreate}
          title="Confirm Challenge"
          confirmLabel="Create & Fund"
          gas={gasEstimate}
          lines={preview ? [
            ...(idea.trim() ? [{ label: 'Challenge', value: `"${idea.trim().slice(0, 40)}${idea.trim().length > 40 ? '...' : ''}"` }] : []),
            { label: 'Your stake', value: `${formatEth(preview.yourStake)} ETH` },
            { label: 'Opponent stakes', value: `${formatEth(preview.opponentStake)} ETH` },
            { label: 'Total pot', value: `${formatEth(preview.totalPot)} ETH` },
            { label: `Fee (${(feeBps / 100).toFixed(1)}%)`, value: `-${formatEth(preview.fee)} ETH`, muted: true },
            { label: 'Winner takes', value: `+${formatEth(preview.profit)} ETH`, highlight: true },
          ] : []}
        />
      </Card>
    </div>
  );
}
