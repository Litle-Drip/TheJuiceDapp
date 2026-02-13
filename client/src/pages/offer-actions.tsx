import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, ArrowDownToLine, ThumbsUp, ThumbsDown, Trophy, RefreshCw, Copy, ExternalLink, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface OfferData {
  creator: string;
  taker: string;
  creatorSideYes: boolean;
  pBps: number;
  creatorStake: bigint;
  takerStake: bigint;
  joinDeadline: number;
  resolveDeadline: number;
  createdAt: number;
  state: number;
  creatorVote: number;
  takerVote: number;
  paid: boolean;
}

const STATE_LABELS = ['Open', 'Filled', 'Resolved', 'Refunded'];

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';
}

export default function OfferActions() {
  const { connected, connect, signer, address, ethUsd, feeBps, getV2Contract, explorerUrl } = useWallet();
  const { toast } = useToast();

  const [offerId, setOfferId] = useState('');
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');

  const loadOffer = useCallback(async () => {
    if (!offerId.trim()) return;
    setLoading(true);
    try {
      const c = getV2Contract(true);
      if (!c) throw new Error('V2 contract not available');
      const id = BigInt(offerId);
      const [core, status] = await Promise.all([
        c.getOfferCore(id),
        c.getOfferStatus(id),
      ]);
      if (core[0] === ethers.ZeroAddress) throw new Error('Offer not found');
      setOffer({
        creator: core[0], taker: core[1], creatorSideYes: core[2], pBps: Number(core[3]),
        creatorStake: core[4], takerStake: core[5],
        joinDeadline: Number(status[0]), resolveDeadline: Number(status[1]),
        createdAt: Number(status[2]), state: Number(status[3]),
        creatorVote: Number(status[4]), takerVote: Number(status[5]), paid: status[6],
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Offer not found', variant: 'destructive' });
      setOffer(null);
    } finally {
      setLoading(false);
    }
  }, [offerId, getV2Contract, toast]);

  const doAction = useCallback(async (action: string, fn: () => Promise<any>) => {
    if (!connected) {
      try { await connect(); } catch { return; }
    }
    setActionLoading(action);
    try {
      const tx = await fn();
      toast({ title: 'Transaction submitted', description: 'Waiting for confirmation...' });
      const receipt = await tx.wait();
      setLastTxHash(receipt.hash);
      toast({ title: 'Success', description: `${action} completed` });
      await loadOffer();
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.shortMessage || e?.message || String(e), variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  }, [connected, connect, toast, loadOffer]);

  const handleTake = () => doAction('Take Offer', async () => {
    const c = getV2Contract(false);
    if (!c || !offer) throw new Error('Not available');
    return c.takeOffer(BigInt(offerId), { value: offer.takerStake });
  });

  const handleVote = (outcomeYes: boolean) => doAction(`Vote: ${outcomeYes ? 'YES' : 'NO'}`, async () => {
    const c = getV2Contract(false);
    if (!c) throw new Error('Not available');
    return c.submitOfferVote(BigInt(offerId), outcomeYes);
  });

  const handleResolve = () => doAction('Resolve', async () => {
    const c = getV2Contract(false);
    if (!c) throw new Error('Not available');
    return c.resolveOffer(BigInt(offerId));
  });

  const handleRefund = () => doAction('Refund', async () => {
    const c = getV2Contract(false);
    if (!c) throw new Error('Not available');
    return c.refundOffer(BigInt(offerId));
  });

  const now = Math.floor(Date.now() / 1000);
  const hasTaker = offer && offer.taker !== ethers.ZeroAddress;
  const joinExpired = offer && offer.joinDeadline > 0 && now > offer.joinDeadline;
  const resolveExpired = offer && offer.resolveDeadline > 0 && now > offer.resolveDeadline;

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="offer-actions-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Offer Actions</h1>
        <p className="text-sm text-muted-foreground mt-1">Take, vote, resolve, or refund market offers.</p>
      </div>

      <Card className="p-5">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              data-testid="input-offer-id"
              type="text"
              value={offerId}
              onChange={(e) => setOfferId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadOffer()}
              placeholder="Offer ID..."
              className="w-full bg-muted/50 border border-border rounded-md py-3 pl-9 pr-3 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/20"
            />
          </div>
          <Button data-testid="button-load-offer" onClick={loadOffer} disabled={loading || !offerId.trim()} variant="secondary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {offer && (
          <div className="space-y-4" data-testid="offer-details">
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold">Offer #{offerId}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={offer.state === 0 ? 'default' : offer.state === 1 ? 'secondary' : 'outline'}>
                    {STATE_LABELS[offer.state] || `State ${offer.state}`}
                  </Badge>
                  {offer.paid && <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Paid</Badge>}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mb-3 py-2">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${offer.creatorSideYes ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {offer.creatorSideYes ? 'YES' : 'NO'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Creator side</div>
                </div>
                <div className="text-center px-4 border-l border-r border-border">
                  <div className="text-2xl font-bold font-mono text-[hsl(var(--primary))]">
                    {Math.round(offer.pBps / 100)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">YES odds</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${!offer.creatorSideYes ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {!offer.creatorSideYes ? 'YES' : 'NO'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Taker side</div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creator</span>
                  <span className="font-mono">{shortAddr(offer.creator)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taker</span>
                  <span className="font-mono">{hasTaker ? shortAddr(offer.taker) : 'Waiting...'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creator stake</span>
                  <span className="font-mono">{Number(ethers.formatEther(offer.creatorStake)).toFixed(6)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taker stake</span>
                  <span className="font-mono">{Number(ethers.formatEther(offer.takerStake)).toFixed(6)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total pot</span>
                  <span className="font-mono font-medium">
                    {Number(ethers.formatEther(offer.creatorStake + offer.takerStake)).toFixed(6)} ETH
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Join by</span>
                  <span className="font-mono text-[10px]">{new Date(offer.joinDeadline * 1000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolve by</span>
                  <span className="font-mono text-[10px]">{new Date(offer.resolveDeadline * 1000).toLocaleString()}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creator vote</span>
                  <span className="font-mono">{offer.creatorVote === 0 ? 'Pending' : offer.creatorVote === 1 ? 'YES' : 'NO'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taker vote</span>
                  <span className="font-mono">{offer.takerVote === 0 ? 'Pending' : offer.takerVote === 1 ? 'YES' : 'NO'}</span>
                </div>
              </div>
            </div>

            {offer.state === 0 && !hasTaker && !joinExpired && (
              <Button data-testid="button-take-offer" onClick={handleTake} disabled={!!actionLoading} className="w-full" size="lg">
                {actionLoading === 'Take Offer' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownToLine className="w-4 h-4 mr-2" />}
                Take Offer ({Number(ethers.formatEther(offer.takerStake)).toFixed(6)} ETH)
              </Button>
            )}

            {offer.state === 1 && hasTaker && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Vote on the outcome (YES or NO won?).</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button data-testid="button-vote-yes" onClick={() => handleVote(true)} disabled={!!actionLoading} variant="outline">
                    {actionLoading === 'Vote: YES' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                    YES Won
                  </Button>
                  <Button data-testid="button-vote-no" onClick={() => handleVote(false)} disabled={!!actionLoading} variant="outline">
                    {actionLoading === 'Vote: NO' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingDown className="w-4 h-4 mr-2" />}
                    NO Won
                  </Button>
                </div>
              </div>
            )}

            {offer.state === 1 && offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote === offer.takerVote && !offer.paid && (
              <Button data-testid="button-resolve-offer" onClick={handleResolve} disabled={!!actionLoading} className="w-full" size="lg">
                {actionLoading === 'Resolve' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
                Resolve & Payout
              </Button>
            )}

            {(
              (offer.state === 0 && joinExpired && !hasTaker) ||
              (offer.state === 1 && resolveExpired) ||
              (offer.state === 1 && offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote !== offer.takerVote)
            ) && !offer.paid && (
              <Button data-testid="button-refund-offer" onClick={handleRefund} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
                {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Request Refund
              </Button>
            )}

            {offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote !== offer.takerVote && (
              <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-400">Votes disagree. Both parties will be refunded.</p>
              </div>
            )}
          </div>
        )}

        {lastTxHash && (
          <div className="mt-3 p-3 rounded-md border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <button
                data-testid="button-copy-offer-action-tx"
                onClick={() => {
                  navigator.clipboard.writeText(lastTxHash);
                  toast({ title: 'Copied', description: 'Transaction hash copied' });
                }}
                className="text-[10px] font-mono text-muted-foreground truncate flex-1 text-left"
              >
                Last TX: {lastTxHash.slice(0, 10)}...{lastTxHash.slice(-8)}
              </button>
              <a
                href={`${explorerUrl}/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--primary))] flex-shrink-0"
                data-testid="link-offer-action-tx-explorer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
