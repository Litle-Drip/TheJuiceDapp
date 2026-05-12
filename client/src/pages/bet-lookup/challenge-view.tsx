import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ABI_V1, NETWORKS, CHALLENGE_STATES } from '@/lib/contracts';
import { XIcon } from '@/components/x-icon';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, UserPlus, ThumbsUp, ThumbsDown,
  Trophy, RefreshCw, ExternalLink, AlertTriangle, Copy, Share2
} from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ConfirmTxDialog, TxConfirmLine } from '@/components/confirm-tx-dialog';
import { onCopyAction } from '@/lib/feedback';
import { useEnsName, shortAddr } from '@/lib/ens';
import { GasEstimate } from './gas-estimate';
import { ChallengeData, ViewProps } from './types';

export function ChallengeView({
  challenge, betId, now, address, connected, actionLoading, doAction, networkKey, payoutTxHash, explorerUrl, ethUsd, marketQuestion,
}: ViewProps & { challenge: ChallengeData }) {
  const joined = challenge.participant !== ethers.ZeroAddress;
  const joinExpired = challenge.joinDeadline > 0 && now > challenge.joinDeadline;
  const resolveExpired = challenge.resolveDeadline > 0 && now > challenge.resolveDeadline;
  const net = NETWORKS[networkKey as keyof typeof NETWORKS];

  const { name: challengerEns, loading: challengerLoading } = useEnsName(challenge.challenger);
  const { toast } = useToast();
  const { name: participantEns, loading: participantLoading } = useEnsName(joined ? challenge.participant : undefined);

  const estimateGas = useCallback(async (method: string, args: any[], value?: bigint) => {
    try {
      const rpcProvider = new ethers.JsonRpcProvider(net.rpc);
      const c = new ethers.Contract(net.contract, ABI_V1, rpcProvider);
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

  const stakeEth = Number(ethers.formatEther(challenge.stakeWei));
  const potEth = stakeEth * 2;
  const feeEth = (potEth * challenge.feeBps) / 10000;
  const winnerEth = potEth - feeEth;

  const directJoin = () => doAction('Join', async (s) => {
    const c = new ethers.Contract(net.contract, ABI_V1, s);
    return c.joinChallenge(BigInt(betId), { value: challenge.stakeWei });
  });
  const confirmJoin = () => {
    if (!connected) { directJoin(); return; }
    setPendingConfirm({
      title: 'Confirm Join Challenge', label: 'Join & Fund',
      lines: [
        { label: 'Bet ID', value: `#${betId}` },
        { label: 'Your stake', value: `${stakeEth.toFixed(6)} ETH` },
        { label: 'Total pot', value: `${potEth.toFixed(6)} ETH` },
        { label: 'Winner takes', value: `${winnerEth.toFixed(6)} ETH`, highlight: true },
      ],
      action: directJoin,
    });
  };

  const confirmVote = (iWon: boolean) => {
    const action = () => doAction(iWon ? 'Vote: I Won' : 'Vote: Opponent Won', async (s) => {
      const c = new ethers.Contract(net.contract, ABI_V1, s);
      const me = (await s.getAddress()).toLowerCase();
      const isCreator = challenge.challenger.toLowerCase() === me;
      const challengerWon = isCreator ? iWon : !iWon;
      return c.submitOutcomeVote(BigInt(betId), challengerWon);
    });
    if (!connected) { action(); return; }
    setPendingConfirm({
      title: 'Confirm Vote', label: iWon ? 'Vote: I Won' : 'Vote: Opponent Won',
      lines: [
        { label: 'Bet ID', value: `#${betId}` },
        { label: 'Your vote', value: iWon ? 'I Won' : 'Opponent Won', highlight: iWon },
      ],
      action,
    });
  };

  const confirmPayout = () => {
    const action = () => doAction('Payout', async (s) => {
      const c = new ethers.Contract(net.contract, ABI_V1, s);
      return c.resolveChallenge(BigInt(betId));
    });
    if (!connected) { action(); return; }
    setPendingConfirm({
      title: 'Confirm Payout', label: 'Finalize & Payout',
      lines: [
        { label: 'Bet ID', value: `#${betId}` },
        { label: 'Action', value: 'Resolve & pay winner' },
        { label: 'Winner receives', value: `${winnerEth.toFixed(6)} ETH`, highlight: true },
      ],
      action,
    });
  };

  const confirmRefund = (reason: string) => {
    const action = () => doAction('Refund', async (s) => {
      const c = new ethers.Contract(net.contract, ABI_V1, s);
      return c.issueRefund(BigInt(betId));
    });
    if (!connected) { action(); return; }
    setPendingConfirm({
      title: 'Confirm Refund', label: 'Claim Refund',
      lines: [
        { label: 'Bet ID', value: `#${betId}` },
        { label: 'Reason', value: reason },
        { label: 'Refund amount', value: `${stakeEth.toFixed(6)} ETH`, highlight: true },
      ],
      action,
    });
  };

  const createSimilarHref = (() => {
    const params = new URLSearchParams();
    params.set('stake', stakeEth.toString());
    if (marketQuestion) params.set('q', marketQuestion);
    return `/challenge?${params.toString()}`;
  })();

  return (
    <div className="space-y-4" data-testid="challenge-details">
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">#{betId}</span>
            <Badge variant="secondary" className="text-2xs">Challenge</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-share-bet"
              onClick={() => {
                const url = `${window.location.origin}/lookup?id=${betId}`;
                navigator.clipboard.writeText(url);
                onCopyAction();
                toast({ title: 'Link copied', description: 'Share this link so someone can join your bet.' });
              }}
            >
              <Share2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-share-x-bet"
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
            <Badge variant={challenge.state === 0 ? 'default' : challenge.state === 1 ? 'secondary' : 'outline'}>
              {CHALLENGE_STATES[challenge.state] || `State ${challenge.state}`}
            </Badge>
          </div>
        </div>

        {marketQuestion && (
          <div className="mb-3 p-2.5 rounded-md bg-muted/40 border border-border/50" data-testid="text-bet-question">
            <p className="text-xs text-muted-foreground mb-1">Market Question</p>
            <p className="text-sm font-medium leading-snug">&ldquo;{marketQuestion}&rdquo;</p>
          </div>
        )}

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creator</span>
            <span className={`font-mono${challengerLoading ? ' opacity-50' : ''}`}>{shortAddr(challenge.challenger, challengerEns)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Opponent</span>
            <span className={`font-mono${participantLoading ? ' opacity-50' : ''}`}>{joined ? shortAddr(challenge.participant, participantEns) : 'Waiting...'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bet amount (each)</span>
            <span className="font-mono">{Number(ethers.formatEther(challenge.stakeWei)).toFixed(6)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Accept by</span>
            <span className="font-mono text-2xs">{new Date(challenge.joinDeadline * 1000).toLocaleString()}</span>
          </div>
          {challenge.state === 0 && !joinExpired && (
            <div className="flex justify-end text-2xs">
              <Countdown deadline={challenge.joinDeadline} />
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vote by</span>
            <span className="font-mono text-2xs">{new Date(challenge.resolveDeadline * 1000).toLocaleString()}</span>
          </div>
          {challenge.state === 1 && !resolveExpired && (
            <div className="flex justify-end text-2xs">
              <Countdown deadline={challenge.resolveDeadline} label="Vote closes in" />
            </div>
          )}
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creator vote</span>
            <span className="font-mono">
              {challenge.challengerVote === 0 ? 'Pending' : challenge.challengerVote === 1 ? 'Creator won' : 'Opponent won'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Opponent vote</span>
            <span className="font-mono">
              {challenge.participantVote === 0 ? 'Pending' : challenge.participantVote === 1 ? 'Creator won' : 'Opponent won'}
            </span>
          </div>

          {challenge.state === 2 && challenge.challengerVote !== 0 && challenge.participantVote !== 0 && challenge.challengerVote === challenge.participantVote && (
            <>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Winner</span>
                <Badge variant="outline" className="text-success border-success/30" data-testid="badge-winner">
                  <Trophy className="w-3 h-3 mr-1" />
                  {challenge.challengerVote === 1 ? 'Creator' : 'Opponent'}
                </Badge>
              </div>
              {payoutTxHash && (
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

      {challenge.state === 0 && !joined && !joinExpired && (
        <div className="space-y-1">
          <GasEstimate estimateFn={() => estimateGas('joinChallenge', [BigInt(betId)], challenge.stakeWei)} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-join" onClick={confirmJoin} disabled={!!actionLoading} className="w-full" size="lg">
            {actionLoading === 'Join' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Join Challenge ({stakeEth.toFixed(6)} ETH)
          </Button>
        </div>
      )}

      {challenge.state === 1 && joined && address && (() => {
        const me = address.toLowerCase();
        const isChallenger = challenge.challenger.toLowerCase() === me;
        const isParticipant = challenge.participant.toLowerCase() === me;
        const myVote = isChallenger ? challenge.challengerVote : isParticipant ? challenge.participantVote : -1;
        const theirVote = isChallenger ? challenge.participantVote : challenge.challengerVote;
        if ((isChallenger || isParticipant) && myVote === 0) {
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

      {challenge.state === 1 && joined && !resolveExpired && (
        <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Who won this bet?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Both players must agree on the outcome. If you disagree, both get refunded.</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('submitOutcomeVote', [BigInt(betId), true])} ethUsd={ethUsd} address={address} />
          <div className="grid grid-cols-2 gap-3">
            <button
              data-testid="button-vote-won"
              onClick={() => confirmVote(true)}
              disabled={!!actionLoading}
              className="flex flex-col items-center gap-1.5 p-4 rounded-md border-2 border-success/40 bg-success/10 transition-all hover:bg-success/20 hover:border-success/60 disabled:opacity-50"
            >
              {actionLoading === 'Vote: I Won' ? <Loader2 className="w-6 h-6 animate-spin text-success" /> : <ThumbsUp className="w-6 h-6 text-success" />}
              <span className="text-sm font-bold text-success">I Won</span>
            </button>
            <button
              data-testid="button-vote-lost"
              onClick={() => confirmVote(false)}
              disabled={!!actionLoading}
              className="flex flex-col items-center gap-1.5 p-4 rounded-md border-2 border-danger/40 bg-danger/10 transition-all hover:bg-danger/20 hover:border-danger/60 disabled:opacity-50"
            >
              {actionLoading === 'Vote: Opponent Won' ? <Loader2 className="w-6 h-6 animate-spin text-danger" /> : <ThumbsDown className="w-6 h-6 text-danger" />}
              <span className="text-sm font-bold text-danger">Opponent Won</span>
            </button>
          </div>
        </div>
      )}

      {challenge.state === 1 && challenge.challengerVote !== 0 && challenge.participantVote !== 0 && challenge.challengerVote === challenge.participantVote && (
        <div className="space-y-1">
          <GasEstimate estimateFn={() => estimateGas('resolveChallenge', [BigInt(betId)])} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-payout" onClick={confirmPayout} disabled={!!actionLoading} className="w-full" size="lg">
            {actionLoading === 'Payout' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
            Finalize & Payout
          </Button>
        </div>
      )}

      {challenge.state === 0 && joinExpired && !joined && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Join deadline passed with no opponent. Creator can reclaim funds.</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('issueRefund', [BigInt(betId)])} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-refund" onClick={() => confirmRefund('No opponent')} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (No Opponent)
          </Button>
        </div>
      )}

      {challenge.state === 1 && challenge.challengerVote !== 0 && challenge.participantVote !== 0 && challenge.challengerVote !== challenge.participantVote && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Votes conflict - creator and opponent disagree on the outcome. Both parties can claim a refund.</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('issueRefund', [BigInt(betId)])} ethUsd={ethUsd} address={address} />
          <Button data-testid="button-refund" onClick={() => confirmRefund('Vote conflict')} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (Vote Conflict)
          </Button>
        </div>
      )}

      {challenge.state === 1 && resolveExpired && !(challenge.challengerVote !== 0 && challenge.participantVote !== 0 && challenge.challengerVote !== challenge.participantVote) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Resolve deadline passed without agreement. Both parties can claim a refund.</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('issueRefund', [BigInt(betId)])} ethUsd={ethUsd} address={address} />
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
