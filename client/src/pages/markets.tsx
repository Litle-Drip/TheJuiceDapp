import { useState, useCallback, useMemo, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { computeTakerStake, ABI_V2, NETWORKS } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { RANDOM_IDEAS } from '@/lib/contracts';
import { TrendingUp, TrendingDown, Zap, Clock, Shield, ChevronDown, ChevronUp, Info, Loader2, Copy, ExternalLink, Shuffle, MessageSquare, Search, Fuel } from 'lucide-react';
import { Link } from 'wouter';
import { Field, Chip, SummaryRow } from '@/components/field';
import { formatEth, formatUsd, formatDuration, formatDeadline } from '@/lib/format';
import { ConfirmTxDialog } from '@/components/confirm-tx-dialog';
import { XIcon } from '@/components/x-icon';
import { onBetCreated, onCopyAction } from '@/lib/feedback';

export default function Markets() {
  const { connected, connect, signer, ethUsd, feeBps, getV2Contract, network: networkKey, explorerUrl } = useWallet();
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
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [gasEstimate, setGasEstimate] = useState<{ gasEth: number; gasUsd: number } | null>(null);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [showSliderTooltip, setShowSliderTooltip] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stakeParam = params.get('stake');
    const oddsParam = params.get('odds');
    const sideParam = params.get('side');
    const qParam = params.get('q');
    if (stakeParam) setStakeEth(stakeParam);
    if (oddsParam) { const v = Number(oddsParam); if (v >= 500 && v <= 9500) setOddsBps(v); }
    if (sideParam) setSideYes(sideParam === 'yes');
    if (qParam) setQuestion(decodeURIComponent(qParam));
  }, []);

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
      if (offerId && question.trim()) {
        try {
          const stored = JSON.parse(localStorage.getItem('juice_bet_questions') || '{}');
          stored[offerId] = question.trim();
          localStorage.setItem('juice_bet_questions', JSON.stringify(stored));
        } catch {}
      }
      onBetCreated();
      toast({
        title: 'Offer created!',
        description: offerId ? `Offer #${offerId} is live. Share the link or wait for someone to take the other side.` : 'Your offer is live on the blockchain.',
      });
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      toast({ title: 'Transaction failed', description: msg, variant: 'destructive' });
      throw e;
    } finally {
      setLoading(false);
    }
  }, [connected, connect, signer, networkKey, stakeEth, sideYes, oddsBps, joinMins, resolveMins, getV2Contract, toast]);

  const yesPriceDisplay = `${yesPercent}¢`;
  const noPriceDisplay = `${noPercent}¢`;

  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="markets-page">
      <div className="page-section">
        <h1 className="page-title" data-testid="text-page-title">Markets</h1>
        <p className="page-subtitle">Set your own odds. Your opponent stakes more or less depending on how likely the outcome is.</p>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="stack-divider">
          <Field label="What's the bet?" hint="Optional">
            <div className="relative">
              <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid="input-market-question"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Will ETH close above $4k Friday?"
                className="field-input pl-9 pr-12"
              />
              <button
                data-testid="button-shuffle-question"
                onClick={shuffleQuestion}
                title="Random idea"
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-primary hover:bg-primary/10"
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </div>
          </Field>

          <Field label="Pick your side" hint={`${yesPercent}% YES · ${noPercent}% NO`}>
            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="button-side-yes"
                onClick={() => setSideYes(true)}
                aria-pressed={sideYes}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors ${
                  sideYes ? 'border-success/60 bg-success/10' : 'border-border bg-card'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <TrendingUp className={`h-4 w-4 ${sideYes ? 'text-success' : 'text-muted-foreground'}`} />
                  <span className={`text-base font-bold ${sideYes ? 'text-success' : 'text-foreground'}`}>YES</span>
                </span>
                <span className={`font-mono text-sm ${sideYes ? 'text-success/80' : 'text-muted-foreground'}`}>{yesPriceDisplay}</span>
              </button>
              <button
                data-testid="button-side-no"
                onClick={() => setSideYes(false)}
                aria-pressed={!sideYes}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors ${
                  !sideYes ? 'border-danger/60 bg-danger/10' : 'border-border bg-card'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <TrendingDown className={`h-4 w-4 ${!sideYes ? 'text-danger' : 'text-muted-foreground'}`} />
                  <span className={`text-base font-bold ${!sideYes ? 'text-danger' : 'text-foreground'}`}>NO</span>
                </span>
                <span className={`font-mono text-sm ${!sideYes ? 'text-danger/80' : 'text-muted-foreground'}`}>{noPriceDisplay}</span>
              </button>
            </div>
          </Field>

          <Field label="Chance of YES" hint={`${yesPercent}%`}>
            <div className="relative pt-1">
              {showSliderTooltip && (
                <div
                  className="pointer-events-none absolute -top-6 z-10 -translate-x-1/2"
                  style={{ left: `${((oddsBps - 500) / 9000) * 100}%` }}
                >
                  <div className="whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-2xs font-bold text-background">
                    {yesPercent}%
                  </div>
                </div>
              )}
              <input
                data-testid="input-odds"
                type="range"
                min={500}
                max={9500}
                step={100}
                value={oddsBps}
                onChange={(e) => setOddsBps(Number(e.target.value))}
                onMouseDown={() => setShowSliderTooltip(true)}
                onMouseUp={() => setShowSliderTooltip(false)}
                onTouchStart={() => setShowSliderTooltip(true)}
                onTouchEnd={() => setShowSliderTooltip(false)}
                className="w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(to right, hsl(var(--success)) ${yesPercent}%, hsl(var(--danger)) ${yesPercent}%)`,
                }}
              />
              <div className="mt-2 flex justify-between text-2xs text-muted-foreground">
                <span>5%</span>
                <span>50%</span>
                <span>95%</span>
              </div>
            </div>
          </Field>

          <Field label="Your stake" hint={preview ? formatUsd(preview.yourStakeUsd) : formatUsd(0)}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">ETH</span>
              <input
                data-testid="input-stake"
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
                      data-testid="input-join-mins"
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
                      data-testid="input-resolve-mins"
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
            <div data-testid="market-preview">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Order summary</span>
                <Badge variant="outline" className={`text-2xs ${sideYes ? 'text-success' : 'text-danger'}`}>
                  {sideYes ? 'YES' : 'NO'} @ {yesPercent}%
                </Badge>
              </div>

              {question.trim() && (
                <p className="mb-3 text-sm font-medium leading-snug" data-testid="text-preview-question">
                  &ldquo;{question.trim()}&rdquo;
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
                  label="If you win"
                  value={`+${formatEth(preview.yourProfit)} ETH`}
                  sub={`${preview.multiplier.toFixed(2)}x`}
                  tone="success"
                  strong
                  data-testid="text-preview-payout"
                />
                <SummaryRow
                  label="If they win"
                  value={`+${formatEth(preview.opponentProfit)} ETH`}
                  sub={`${preview.opponentMultiplier.toFixed(2)}x`}
                  tone="danger"
                  strong
                  data-testid="text-preview-opponent-payout"
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
              data-testid="button-create-offer"
              onClick={() => {
                if (!connected) { handleCreateOffer(); return; }
                setShowConfirm(true);
              }}
              disabled={loading || !preview}
              className="h-12 w-full text-base"
              size="lg"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</>
              ) : connected ? (
                <><Zap className="h-4 w-4" /> Create offer</>
              ) : (
                <>Connect wallet &amp; create</>
              )}
            </Button>

            {connected && gasEstimate && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-muted-foreground" data-testid="gas-estimate-offer">
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

            {(lastOfferId || lastTxHash) && (
              <div className="mt-4 space-y-3 rounded-lg border border-success/30 bg-success/5 p-4" data-testid="offer-created-success">
                {lastOfferId && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-success">Your bet is live</p>
                      <p className="mt-0.5 font-mono text-sm">Bet #{lastOfferId}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="min-h-11 w-full"
                        data-testid="button-copy-share-link"
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/lookup?id=${lastOfferId}${question.trim() ? `&q=${encodeURIComponent(question.trim())}` : ''}`;
                          navigator.clipboard.writeText(shareUrl);
                          onCopyAction();
                          toast({ title: 'Link copied!', description: 'Send this to a friend so they can take the other side.' });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy share link
                      </Button>
                      <Button
                        variant="outline"
                        className="min-h-11 w-full"
                        data-testid="button-share-x-offer-success"
                        onClick={() => {
                          const betUrl = `${window.location.origin}/lookup?id=${lastOfferId}`;
                          const tweetText = question.trim()
                            ? `"${question.trim()}" - Take the other side on The Juice!`
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
                <Link href={`/lookup?id=${lastOfferId}${question.trim() ? `&q=${encodeURIComponent(question.trim())}` : ''}`} data-testid="link-go-to-lookup">
                  <Button variant="secondary" className="min-h-11 w-full">
                    <Search className="h-3.5 w-3.5" />
                    View your bet
                  </Button>
                </Link>
                {lastTxHash && (
                  <div className="flex items-center gap-2">
                    <button
                      data-testid="button-copy-offer-tx"
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
                      data-testid="link-offer-tx-explorer"
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
          onConfirm={handleCreateOffer}
          title="Confirm Market Offer"
          confirmLabel="Create Offer"
          gas={gasEstimate}
          lines={preview ? [
            ...(question.trim() ? [{ label: 'Question', value: `"${question.trim().slice(0, 40)}${question.trim().length > 40 ? '...' : ''}"`, muted: false }] : []),
            { label: 'Your side', value: `${sideYes ? 'YES' : 'NO'} @ ${yesPercent}%` },
            { label: 'Your stake', value: `${formatEth(preview.yourStake)} ETH`, highlight: false },
            { label: 'Opponent pays', value: `${formatEth(preview.opponentStake)} ETH` },
            { label: 'Total pot', value: `${formatEth(preview.totalPot)} ETH` },
            { label: `Fee (${(feeBps / 100).toFixed(1)}%)`, value: `-${formatEth(preview.fee)} ETH`, muted: true },
            { label: 'If you win', value: `+${formatEth(preview.yourProfit)} ETH`, highlight: true },
          ] : []}
        />
      </Card>

      <details className="rounded-xl border border-card-border bg-card p-4 sm:p-6" data-testid="how-it-works">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground">
          <Info className="h-4 w-4" />
          How market odds work
          <ChevronDown className="ml-auto h-4 w-4" />
        </summary>
        <div className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted-foreground">
          <p>Stakes are <span className="font-medium text-foreground">asymmetric</span>: the side with the higher implied probability risks more for a smaller return.</p>
          <p>Both sides vote on the outcome. Matching votes pay the winner automatically; a disagreement refunds both sides after the deadline.</p>
          <p>Share your <span className="font-medium text-foreground">Bet ID</span> so an opponent can take the other side from Find a Bet.</p>
        </div>
      </details>
    </div>
  );
}
