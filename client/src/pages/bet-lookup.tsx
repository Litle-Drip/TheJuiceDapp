import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { ABI_V1, ABI_V2, NETWORKS } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Search, UserPlus, ArrowDownToLine, ThumbsUp, ThumbsDown,
  Trophy, RefreshCw, ExternalLink, TrendingUp, TrendingDown, AlertTriangle
} from 'lucide-react';

interface ChallengeData {
  type: 'challenge';
  challenger: string;
  participant: string;
  stakeWei: bigint;
  feeBps: number;
  joinDeadline: number;
  resolveDeadline: number;
  createdAt: number;
  state: number;
  challengerVote: number;
  participantVote: number;
}

interface OfferData {
  type: 'offer';
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

type BetData = ChallengeData | OfferData;

const CHALLENGE_STATES = ['Open', 'Active', 'Resolved', 'Refunded'];
const OFFER_STATES = ['Open', 'Filled', 'Resolved', 'Refunded'];

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';
}

export default function BetLookup() {
  const { connected, connect, signer, address, ethUsd, feeBps, getV1Contract, getV2Contract, explorerUrl, network: networkKey } = useWallet();
  const { toast } = useToast();

  const [betId, setBetId] = useState('');
  const [bet, setBet] = useState<BetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');
  const [payoutTxHash, setPayoutTxHash] = useState('');

  const loadBet = useCallback(async () => {
    const raw = betId.trim();
    if (!raw) return;
    if (raw.startsWith('0x') && raw.length > 10) {
      toast({ title: 'Wrong format', description: 'Enter the numeric Bet ID (e.g. 3), not a transaction hash.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setBet(null);
    setPayoutTxHash('');
    try {
      const id = BigInt(raw);
      const c1 = getV1Contract(true);
      const c2 = getV2Contract(true);

      let challengeResult: ChallengeData | null = null as ChallengeData | null;
      let offerResult: OfferData | null = null as OfferData | null;

      const promises: Promise<void>[] = [];

      if (c1) {
        promises.push(
          (async () => {
            try {
              const [core, status] = await Promise.all([
                c1.getChallengeCore(id),
                c1.getChallengeStatus(id),
              ]);
              if (core[0] !== ethers.ZeroAddress) {
                challengeResult = {
                  type: 'challenge',
                  challenger: core[0], participant: core[1], stakeWei: core[2], feeBps: Number(core[3]),
                  joinDeadline: Number(core[4]), resolveDeadline: Number(core[5]),
                  createdAt: Number(status[0]), state: Number(status[1]),
                  challengerVote: Number(status[2]), participantVote: Number(status[3]),
                };
              }
            } catch {}
          })()
        );
      }

      if (c2) {
        promises.push(
          (async () => {
            try {
              const [core, status] = await Promise.all([
                c2.getOfferCore(id),
                c2.getOfferStatus(id),
              ]);
              if (core[0] !== ethers.ZeroAddress) {
                offerResult = {
                  type: 'offer',
                  creator: core[0], taker: core[1], creatorSideYes: core[2], pBps: Number(core[3]),
                  creatorStake: core[4], takerStake: core[5],
                  joinDeadline: Number(status[0]), resolveDeadline: Number(status[1]),
                  createdAt: Number(status[2]), state: Number(status[3]),
                  creatorVote: Number(status[4]), takerVote: Number(status[5]), paid: status[6],
                };
              }
            } catch {}
          })()
        );
      }

      await Promise.all(promises);

      if (challengeResult && offerResult) {
        const cTime = challengeResult.createdAt;
        const oTime = offerResult.createdAt;
        setBet(oTime >= cTime ? offerResult : challengeResult);
      } else if (challengeResult) {
        setBet(challengeResult);
      } else if (offerResult) {
        setBet(offerResult);
      } else {
        toast({ title: 'Not found', description: `No bet found with ID #${raw}`, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Lookup failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [betId, getV1Contract, getV2Contract, toast]);

  const doAction = useCallback(async (action: string, fn: (activeSigner: ethers.Signer) => Promise<any>) => {
    let activeSigner = signer;
    if (!connected || !activeSigner) {
      try { activeSigner = await connect(); } catch { return; }
    }
    setActionLoading(action);
    try {
      const tx = await fn(activeSigner);
      toast({ title: 'Transaction submitted', description: 'Waiting for confirmation...' });
      const receipt = await tx.wait();
      setLastTxHash(receipt.hash);
      if (action === 'Payout' || action === 'Resolve') {
        setPayoutTxHash(receipt.hash);
      }
      toast({ title: 'Success', description: `${action} completed` });
      await new Promise(r => setTimeout(r, 1500));
      await loadBet();
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.shortMessage || e?.message || String(e), variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  }, [connected, connect, signer, toast, loadBet]);

  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="bet-lookup-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Bet Lookup</h1>
      </div>

      <Card className="p-5">
        <div className="flex gap-2 mb-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              data-testid="input-bet-id"
              type="text"
              value={betId}
              onChange={(e) => setBetId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadBet()}
              placeholder="Enter a numeric ID, e.g. 1, 2, 3..."
              className="w-full bg-muted/50 border border-border rounded-md py-3 pl-9 pr-3 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/20"
            />
          </div>
          <Button data-testid="button-load-bet" onClick={loadBet} disabled={loading || !betId.trim()} variant="secondary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {bet?.type === 'challenge' && (
          <ChallengeView
            challenge={bet}
            betId={betId}
            now={now}
            address={address}
            actionLoading={actionLoading}
            doAction={doAction}
            networkKey={networkKey}
            payoutTxHash={payoutTxHash}
            explorerUrl={explorerUrl}
          />
        )}

        {bet?.type === 'offer' && (
          <OfferView
            offer={bet}
            betId={betId}
            now={now}
            address={address}
            actionLoading={actionLoading}
            doAction={doAction}
            networkKey={networkKey}
            payoutTxHash={payoutTxHash}
            explorerUrl={explorerUrl}
          />
        )}

        {lastTxHash && (
          <div className="mt-3 p-3 rounded-md border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <button
                data-testid="button-copy-tx"
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
                data-testid="link-tx-explorer"
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

function ChallengeView({
  challenge, betId, now, address, actionLoading, doAction, networkKey, payoutTxHash, explorerUrl,
}: {
  challenge: ChallengeData;
  betId: string;
  now: number;
  address: string;
  actionLoading: string;
  doAction: (action: string, fn: (s: ethers.Signer) => Promise<any>) => void;
  networkKey: string;
  payoutTxHash: string;
  explorerUrl: string;
}) {
  const joined = challenge.participant !== ethers.ZeroAddress;
  const joinExpired = challenge.joinDeadline > 0 && now > challenge.joinDeadline;
  const resolveExpired = challenge.resolveDeadline > 0 && now > challenge.resolveDeadline;
  const net = NETWORKS[networkKey as keyof typeof NETWORKS];

  const handleJoin = () => doAction('Join', async (s) => {
    const c = new ethers.Contract(net.contract, ABI_V1, s);
    return c.joinChallenge(BigInt(betId), { value: challenge.stakeWei });
  });

  const handleVote = (iWon: boolean) => doAction(iWon ? 'Vote: I Won' : 'Vote: Opponent Won', async (s) => {
    const c = new ethers.Contract(net.contract, ABI_V1, s);
    const me = (await s.getAddress()).toLowerCase();
    const isCreator = challenge.challenger.toLowerCase() === me;
    const challengerWon = isCreator ? iWon : !iWon;
    return c.submitOutcomeVote(BigInt(betId), challengerWon);
  });

  const handlePayout = () => doAction('Payout', async (s) => {
    const c = new ethers.Contract(net.contract, ABI_V1, s);
    return c.resolveChallenge(BigInt(betId));
  });

  const handleRefund = () => doAction('Refund', async (s) => {
    const c = new ethers.Contract(net.contract, ABI_V1, s);
    return c.issueRefund(BigInt(betId));
  });

  return (
    <div className="space-y-4" data-testid="challenge-details">
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">#{betId}</span>
            <Badge variant="secondary" className="text-[10px]">Challenge</Badge>
          </div>
          <Badge variant={challenge.state === 0 ? 'default' : challenge.state === 1 ? 'secondary' : 'outline'}>
            {CHALLENGE_STATES[challenge.state] || `State ${challenge.state}`}
          </Badge>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creator</span>
            <span className="font-mono">{shortAddr(challenge.challenger)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Opponent</span>
            <span className="font-mono">{joined ? shortAddr(challenge.participant) : 'Waiting...'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Each stake</span>
            <span className="font-mono">{Number(ethers.formatEther(challenge.stakeWei)).toFixed(6)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Join by</span>
            <span className="font-mono text-[10px]">{new Date(challenge.joinDeadline * 1000).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resolve by</span>
            <span className="font-mono text-[10px]">{new Date(challenge.resolveDeadline * 1000).toLocaleString()}</span>
          </div>
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
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30" data-testid="badge-winner">
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
                    className="font-mono text-[10px] text-[hsl(var(--primary))] flex items-center gap-1"
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
        <Button data-testid="button-join" onClick={handleJoin} disabled={!!actionLoading} className="w-full" size="lg">
          {actionLoading === 'Join' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
          Join Challenge ({Number(ethers.formatEther(challenge.stakeWei)).toFixed(6)} ETH)
        </Button>
      )}

      {challenge.state === 1 && joined && !resolveExpired && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">Vote on the outcome. Both players must agree for payout.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button data-testid="button-vote-won" onClick={() => handleVote(true)} disabled={!!actionLoading} variant="outline">
              {actionLoading === 'Vote: I Won' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ThumbsUp className="w-4 h-4 mr-2" />}
              I Won
            </Button>
            <Button data-testid="button-vote-lost" onClick={() => handleVote(false)} disabled={!!actionLoading} variant="outline">
              {actionLoading === 'Vote: Opponent Won' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ThumbsDown className="w-4 h-4 mr-2" />}
              Opponent Won
            </Button>
          </div>
        </div>
      )}

      {challenge.state === 1 && challenge.challengerVote !== 0 && challenge.participantVote !== 0 && challenge.challengerVote === challenge.participantVote && (
        <Button data-testid="button-payout" onClick={handlePayout} disabled={!!actionLoading} className="w-full" size="lg">
          {actionLoading === 'Payout' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
          Finalize & Payout
        </Button>
      )}

      {challenge.state === 0 && joinExpired && !joined && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Join deadline passed with no opponent. Creator can reclaim funds.</p>
          </div>
          <Button data-testid="button-refund" onClick={handleRefund} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (No Opponent)
          </Button>
        </div>
      )}

      {challenge.state === 1 && challenge.challengerVote !== 0 && challenge.participantVote !== 0 && challenge.challengerVote !== challenge.participantVote && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Votes conflict - creator and opponent disagree on the outcome. Both parties can claim a refund.</p>
          </div>
          <Button data-testid="button-refund" onClick={handleRefund} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (Vote Conflict)
          </Button>
        </div>
      )}

      {challenge.state === 1 && resolveExpired && !(challenge.challengerVote !== 0 && challenge.participantVote !== 0 && challenge.challengerVote !== challenge.participantVote) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Resolve deadline passed without agreement. Both parties can claim a refund.</p>
          </div>
          <Button data-testid="button-refund" onClick={handleRefund} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (Deadline Expired)
          </Button>
        </div>
      )}
    </div>
  );
}

function OfferView({
  offer, betId, now, address, actionLoading, doAction, networkKey, payoutTxHash, explorerUrl,
}: {
  offer: OfferData;
  betId: string;
  now: number;
  address: string;
  actionLoading: string;
  doAction: (action: string, fn: (s: ethers.Signer) => Promise<any>) => void;
  networkKey: string;
  payoutTxHash: string;
  explorerUrl: string;
}) {
  const hasTaker = offer.taker !== ethers.ZeroAddress;
  const joinExpired = offer.joinDeadline > 0 && now > offer.joinDeadline;
  const resolveExpired = offer.resolveDeadline > 0 && now > offer.resolveDeadline;
  const net = NETWORKS[networkKey as keyof typeof NETWORKS];

  const handleTake = () => doAction('Take Offer', async (s) => {
    const c = new ethers.Contract(net.v2contract, ABI_V2, s);
    return c.takeOffer(BigInt(betId), { value: offer.takerStake });
  });

  const handleVote = (outcomeYes: boolean) => doAction(`Vote: ${outcomeYes ? 'YES' : 'NO'}`, async (s) => {
    const c = new ethers.Contract(net.v2contract, ABI_V2, s);
    return c.submitOfferVote(BigInt(betId), outcomeYes);
  });

  const handleResolve = () => doAction('Resolve', async (s) => {
    const c = new ethers.Contract(net.v2contract, ABI_V2, s);
    return c.resolveOffer(BigInt(betId));
  });

  const handleRefund = () => doAction('Refund', async (s) => {
    const c = new ethers.Contract(net.v2contract, ABI_V2, s);
    return c.refundOffer(BigInt(betId));
  });

  return (
    <div className="space-y-4" data-testid="offer-details">
      <div className="rounded-md border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">#{betId}</span>
            <Badge variant="secondary" className="text-[10px]">Market Offer</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={offer.state === 0 ? 'default' : offer.state === 1 ? 'secondary' : 'outline'}>
              {OFFER_STATES[offer.state] || `State ${offer.state}`}
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

          {offer.state === 2 && offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote === offer.takerVote && (
            <>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Winning position</span>
                <Badge
                  variant="outline"
                  className={`${offer.creatorVote === 1 ? 'text-emerald-400 border-emerald-400/30' : 'text-rose-400 border-rose-400/30'}`}
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
                    className="font-mono text-[10px] text-[hsl(var(--primary))] flex items-center gap-1"
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

      {offer.state === 0 && joinExpired && !hasTaker && !offer.paid && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Join deadline passed with no taker. Creator can reclaim funds.</p>
          </div>
          <Button data-testid="button-refund" onClick={handleRefund} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (No Taker)
          </Button>
        </div>
      )}

      {offer.state === 1 && offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote !== offer.takerVote && !offer.paid && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Votes disagree - creator and taker voted differently. Both parties can claim a refund.</p>
          </div>
          <Button data-testid="button-refund" onClick={handleRefund} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (Vote Conflict)
          </Button>
        </div>
      )}

      {offer.state === 1 && resolveExpired && !(offer.creatorVote !== 0 && offer.takerVote !== 0 && offer.creatorVote !== offer.takerVote) && !offer.paid && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Resolve deadline passed without agreement. Both parties can claim a refund.</p>
          </div>
          <Button data-testid="button-refund" onClick={handleRefund} disabled={!!actionLoading} variant="outline" className="w-full" size="lg">
            {actionLoading === 'Refund' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refund (Deadline Expired)
          </Button>
        </div>
      )}
    </div>
  );
}
