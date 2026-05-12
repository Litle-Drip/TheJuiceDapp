import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ABI_V2, NETWORKS, OFFER_STATES } from '@/lib/contracts';
import { XIcon } from '@/components/x-icon';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, UserPlus, ArrowDownToLine, ThumbsUp, ThumbsDown,
  Trophy, RefreshCw, ExternalLink, TrendingUp, TrendingDown, AlertTriangle, Copy, Share2
} from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ConfirmTxDialog, TxConfirmLine } from '@/components/confirm-tx-dialog';
import { onCopyAction } from '@/lib/feedback';
import { useEnsName, shortAddr } from '@/lib/ens';
import { GasEstimate } from './gas-estimate';
import { OfferData, ViewProps } from './types';

export function OfferView({
  offer, betId, now, address, connected, actionLoading, doAction, networkKey, payoutTxHash, explorerUrl, ethUsd, marketQuestion,
}: ViewProps & { offer: OfferData }) {
  const hasTaker = offer.taker !== ethers.ZeroAddress;
  const joinExpired = offer.joinDeadline > 0 && now > offer.joinDeadline;
  const resolveExpired = offer.resolveDeadline > 0 && now > offer.resolveDeadline;
  const net = NETWORKS[networkKey as keyof typeof NETWORKS];

  const { toast } = useToast();
  const { name: creatorEns, loading: creatorLoading } = useEnsName(offer.creator);
  const { name: takerEns, loading: takerLoading } = useEnsName(hasTaker ? offer.taker : undefined);

  const estimateGas = useCallback(async (method: string, args: any[], value?: bigint) => {
    try {
      const rpcProvider = new ethers.JsonRpcProvider(net.rpc);
      const c = new ethers.Contract(net.v2contract, ABI_V2, rpcProvider);
      const opts = value ? { from: address, value } : { from: address };
      const gasLimit = await c[method].estimateGas(...args, opts);
      const feeData = await rpcProvider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      const gasCostWei = gasLimit * gasPrice;
      const gasEth = Number(ethers.formatEther(gasCostWei));
      return { gasEth, gasUsd: gasEth * ethUsd };
    } catch { return null; }
  }, [net, address, ethUsd]);

  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; label: string; lines: TxConfirmLine[]; action: () => void } | null>(null);

  const creatorStakeEth = Number(ethers.formatEther(offer.creatorStake));
  const takerStakeEth = Number(ethers.formatEther(offer.takerStake));
  const totalPotEth = creatorStakeEth + takerStakeEth;

  const confirmTake = () => {
    const action = () => doAction('Take Offer', async (s) => {
      const c = new ethers.Contract(net.v2contract, ABI_V2, s);
      return c.takeOffer(BigInt(betId), { value: offer.takerStake });
    });
    if (!connected) { action(); return; }
    setPendingConfirm({
      title: 'Confirm Take Offer', label: 'Take Offer',
      lines: [
        { label: 'Bet ID', value: `#${betId}` },
        { label: 'Your side', value: offer.creatorSideYes ? 'NO' : 'YES' },
        { label: 'Your stake', value: `${takerStakeEth.toFixed(6)} ETH` },
        { label: 'Total pot', value: `${totalPotEth.toFixed(6)} ETH` },
      ],
      action,
    });
  };

  const confirmVote = (outcomeYes: boolean) => {
    const action = () => doAction(`Vote: ${outcomeYes ? 'YES' : 'NO'}`, async (s) => {
      const c = new ethers.Contract(net.v2contract, ABI_V2, s);
      return c.submitOfferVote(BigInt(betId), outcomeYes);
    });
    if (!connected) { action(); return; }
    setPendingConfirm({
      title: 'Confirm Vote', label: `Vote: ${outcomeYes ? 'YES' : 'NO'}`,
      lines: [
        { label: 'Bet ID', value: `#${betId}` },
        { label: 'Outcome', value: outcomeYes ? 'YES Won' : 'NO Won', highlight: outcomeYes },
      ],
      action,
    });
  };

  const confirmResolve = () => {
    const action = () => doAction('Resolve', async (s) => {
      const c = new ethers.Contract(net.v2contract, ABI_V2, s);
      return c.resolveOffer(BigInt(betId));
    });
    if (!connected) { action(); return; }
    setPendingConfirm({
      title: 'Confirm Resolve', label: 'Resolve & Payout',
      lines: [
        { label: 'Bet ID', value: `#${betId}` },
        { label: 'Action', value: 'Resolve & pay winner' },
        { label: 'Total pot', value: `${totalPotEth.toFixed(6)} ETH`, highlight: true },
      ],
      action,
    });
  };

  const confirmRefund = (reason: string) => {
    const action = () => doAction('Refund', async (s) => {
      const c = new ethers.Contract(net.v2contract, ABI_V2, s);
      return c.refundOffer(BigInt(betId));
    });
    if (!connected) { action(); return; }
    setPendingConfirm({
      title: 'Confirm Refund', label: 'Claim Refund',
      lines: [
        { label: 'Bet ID', value: `#${betId}` },
        { label: 'Reason', value: reason },
      ],
      action,
    });
  };

  const createSimilarHref = (() => {
    const params = new URLSearchParams();
    params.set('stake', creatorStakeEth.toString());
    params.set('odds', String(offer.pBps));
    params.set('side', offer.creatorSideYes ? 'yes' : 'no');
    if (marketQuestion) params.set('q', marketQuestion);
    return `/?${params.toString()}`;
  })();

  return (
    <div className="space-y-4" data-testid="offer-details">
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">#{betId}</span>
            <Badge variant="secondary" className="text-2xs">Market Offer</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-share-offer"
              onClick={() => {
                const url = `${window.location.origin}/lookup?id=${betId}`;
                navigator.clipboard.writeText(url);
                onCopyAction();
                toast({ title: 'Link copied', description: 'Share this link so someone can take the other side.' });
              }}
            >
              <Share2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-share-x-offer"
              onClick={() => {
                const betUrl = `${window.location.origin}/lookup?id=${betId}`;
                const tweetText = marketQuestion
                  ? `"${marketQuestion}" - Take the other side on The Juice!`
                  : 'Check out this bet on The Juice!';
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(betUrl)}`, '_blank');
              }}
            >
              <XIcon className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-create-similar"
              onClick={() => { window.location.href = createSimilarHref; }}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Create Similar
            </Button>
            <Badge variant={offer.state === 0 ? 'default' : offer.state === 1 ? 'secondary' : 'outline'}>
              {OFFER_STATES[offer.state] || `State ${offer.state}`}
            </Badge>
            {offer.paid && <Badge variant="outline" className="text-success border-success/30">Paid</Badge>}
          </div>
        </div>

        {marketQuestion && (
          <div className="mb-3 p-2.5 rounded-md bg-muted/40 border border-border/50" data-testid="text-bet-question">
            <p className="text-xs text-muted-foreground mb-1">Market Question</p>
            <p className="text-sm font-medium leading-snug">&ldquo;{marketQuestion}&rdquo;</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mb-3 py-2">
          <div className="text-center">
            <div className={`text-2xl font-bold ${offer.creatorSideYes ? 'text-success' : 'text-danger'}`}>
              {offer.creatorSideYes ? 'YES' : 'NO'}
            </div>
            <div className="text-2xs text-muted-foreground">Creator side</div>
          </div>
          <div className="text-center px-4 border-l border-r border-border">
            <div className="text-2xl font-bold font-mono text-primary">
              {Math.round(offer.pBps / 100)}%
            </div>
            <div className="text-2xs text-muted-foreground">YES odds</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${!offer.creatorSideYes ? 'text-success' : 'text-danger'}`}>
              {!offer.creatorSideYes ? 'YES' : 'NO'}
            </div>
            <div className="text-2xs text-muted-foreground">Taker side</div>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creator</span>
            <span className={`font-mono${creatorLoading ? ' opacity-50' : ''}`}>{shortAddr(offer.creator, creatorEns)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taker</span>
            <span className={`font-mono${takerLoading ? ' opacity-50' : ''}`}>{hasTaker ? shortAddr(offer.taker, takerEns) : 'Waiting...'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creator puts in</span>
            <span className="font-mono">{Number(ethers.formatEther(offer.creatorStake)).toFixed(6)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taker puts in</span>
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
            <span className="text-muted-foreground">Accept by</span>
            <span className="font-mono text-2xs">{new Date(offer.joinDeadline * 1000).toLocaleString()}</span>
          </div>
          {offer.state === 0 && !joinExpired && (
            <div className="flex justify-end text-2xs">
              <Countdown deadline={offer.joinDeadline} />
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vote by</span>
            <span className="font-mono text-2xs">{new Date(offer.resolveDeadline * 1000).toLocaleString()}</span>
          </div>
          {offer.state === 1 && !resolveExpired && (
            <div className="flex justify-end text-2xs">
              <Countdown deadline={offer.resolveDeadline} label="Vote closes in" />
            </div>
          )}
          <div className="h-px bg-border" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creator vote</span>
            <span className="font-mono">{offer.creatorVote === 0 ? 'Pending' : offer.creatorVote === 1 ? 'YES' : 'NO'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taker vote</span>
            <span className="font-mono">{offer.takerVote === 0 ? 'Pending' : offer.takerVote === 1 ? 'YES' : 'NO'}</span>
          </div>

          {offer.state === 2 && offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote === offer.takerVote && (
            <>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Winning position</span>
                <Badge
                  variant="outline"
                  className={`${offer.creatorVote === 1 ? 'text-success border-success/30' : 'text-danger border-rose-600/30 dark:border-rose-400/30'}`}
                  data-testid="badge-winner"
                >
                  <Trophy className="w-3 h-3 mr-1" />
                  {offer.creatorVote === 1 ? 'YES' : 'NO'}
                </Badge>
              </div>
              {offer.paid && payoutTxHash && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Payout TX</span>
                  <a
                    href={`${explorerUrl}/tx/${payoutTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-2xs text-primary flex items-center gap-1"
                    data-testid="link-payout-tx"
                  >
                    {payoutTxHash.slice(0, 8)}...{payoutTxHash.slice(-6)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {offer.state === 0 && !hasTaker && !joinExpired && (
        <div className="space-y-1">
          <GasEstimate estimateFn={() => estimateGas('takeOffer', [BigInt(betId)], offer.takerStake)} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-take-offer" onClick={confirmTake} disabled={!!actionLoading} className="w-full" size="lg">
            {actionLoading === 'Take Offer' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownToLine className="w-4 h-4 mr-2" />}
            Take Offer ({takerStakeEth.toFixed(6)} ETH)
          </Button>
        </div>
      )}

      {offer.state === 1 && hasTaker && address && (() => {
        const me = address.toLowerCase();
        const isCreator = offer.creator.toLowerCase() === me;
        const isTaker = offer.taker.toLowerCase() === me;
        const myVote = isCreator ? offer.creatorVote : isTaker ? offer.takerVote : -1;
        const theirVote = isCreator ? offer.takerVote : offer.creatorVote;
        if ((isCreator || isTaker) && myVote === 0) {
          return (
            <div className="flex items-center gap-2.5 p-3 rounded-md border border-amber-500/30 bg-amber-500/5" data-testid="vote-nudge-banner">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Your vote is needed</p>
                <p className="text-2xs text-muted-foreground">
                  {theirVote !== 0
                    ? 'Your opponent has already voted. Submit your vote to proceed with resolution.'
                    : 'This bet is waiting for both players to vote on the outcome.'}
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {offer.state === 1 && hasTaker && (
        <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">What was the outcome?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Both players must agree for payout</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('submitOfferVote', [BigInt(betId), true])} ethUsd={ethUsd} address={address} />
          <div className="grid grid-cols-2 gap-3">
            <button
              data-testid="button-vote-yes"
              onClick={() => confirmVote(true)}
              disabled={!!actionLoading}
              className="flex flex-col items-center gap-1.5 p-4 rounded-md border-2 border-success/40 bg-success/10 transition-all hover:bg-success/20 hover:border-success/60 disabled:opacity-50"
            >
              {actionLoading === 'Vote: YES' ? <Loader2 className="w-6 h-6 animate-spin text-success" /> : <TrendingUp className="w-6 h-6 text-success" />}
              <span className="text-sm font-bold text-success">YES Won</span>
            </button>
            <button
              data-testid="button-vote-no"
              onClick={() => confirmVote(false)}
              disabled={!!actionLoading}
              className="flex flex-col items-center gap-1.5 p-4 rounded-md border-2 border-danger/40 bg-danger/10 transition-all hover:bg-danger/20 hover:border-danger/60 disabled:opacity-50"
            >
              {actionLoading === 'Vote: NO' ? <Loader2 className="w-6 h-6 animate-spin text-danger" /> : <TrendingDown className="w-6 h-6 text-danger" />}
              <span className="text-sm font-bold text-danger">NO Won</span>
            </button>
          </div>
        </div>
      )}

      {offer.state === 1 && offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote === offer.takerVote && !offer.paid && (
        <div className="space-y-1">
          <GasEstimate estimateFn={() => estimateGas('resolveOffer', [BigInt(betId)])} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-resolve-offer" onClick={confirmResolve} disabled={!!actionLoading} className="w-full" size="lg">
            {actionLoading === 'Resolve' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
            Resolve & Payout
          </Button>
        </div>
      )}

      {offer.state === 0 && joinExpired && !hasTaker && !offer.paid && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Join deadline passed with no taker. Creator can reclaim funds.</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('refundOffer', [BigInt(betId)])} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-refund" onClick={() => confirmRefund('No taker')} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (No Taker)
          </Button>
        </div>
      )}

      {offer.state === 1 && offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote !== offer.takerVote && !offer.paid && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Votes disagree - creator and taker voted differently. Both parties can claim a refund.</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('refundOffer', [BigInt(betId)])} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-refund" onClick={() => confirmRefund('Vote conflict')} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (Vote Conflict)
          </Button>
        </div>
      )}

      {offer.state === 1 && resolveExpired && !(offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote !== offer.takerVote) && !offer.paid && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Resolve deadline passed without agreement. Both parties can claim a refund.</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('refundOffer', [BigInt(betId)])} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-refund" onClick={() => confirmRefund('Deadline expired')} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (Deadline Expired)
          </Button>
        </div>
      )}

      {pendingConfirm && (
        <ConfirmTxDialog
          open={true}
          onClose={() => setPendingConfirm(null)}
          onConfirm={async () => { pendingConfirm.action(); }}
          title={pendingConfirm.title}
          confirmLabel={pendingConfirm.label}
          lines={pendingConfirm.lines}
        />
      )}
    </div>
  );
}
