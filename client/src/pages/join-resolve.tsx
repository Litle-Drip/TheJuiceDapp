import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, UserPlus, ArrowDownToLine, ThumbsUp, ThumbsDown, Trophy, RefreshCw, Copy, ExternalLink, AlertTriangle } from 'lucide-react';

interface ChallengeData {
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

const STATE_LABELS = ['Open', 'Active', 'Resolved', 'Refunded'];

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';
}

export default function JoinResolve() {
  const { connected, connect, signer, address, ethUsd, getV1Contract, getV2Contract, explorerUrl } = useWallet();
  const { toast } = useToast();

  const [challengeId, setChallengeId] = useState('');
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');

  const loadChallenge = useCallback(async () => {
    const raw = challengeId.trim();
    if (!raw) return;
    if (raw.startsWith('0x') && raw.length > 10) {
      toast({ title: 'Wrong format', description: 'Enter the numeric Challenge ID (e.g. 3), not a transaction hash.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const c = getV1Contract(true);
      if (!c) throw new Error('Contract not available');
      const id = BigInt(raw);
      const [core, status] = await Promise.all([
        c.getChallengeCore(id),
        c.getChallengeStatus(id),
      ]);
      if (core[0] === ethers.ZeroAddress) {
        const c2 = getV2Contract(true);
        if (c2) {
          try {
            const offerCore = await c2.getOfferCore(id);
            if (offerCore[0] !== ethers.ZeroAddress) {
              toast({ title: 'This is a Market Offer', description: `ID #${raw} is a V2 Market Offer, not a V1 Challenge. Go to the Offer Actions page instead.`, variant: 'destructive' });
              setChallenge(null);
              return;
            }
          } catch {}
        }
        throw new Error('Challenge not found');
      }
      setChallenge({
        challenger: core[0], participant: core[1], stakeWei: core[2], feeBps: Number(core[3]),
        joinDeadline: Number(core[4]), resolveDeadline: Number(core[5]),
        createdAt: Number(status[0]), state: Number(status[1]),
        challengerVote: Number(status[2]), participantVote: Number(status[3]),
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Challenge not found', variant: 'destructive' });
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [challengeId, getV1Contract, getV2Contract, toast]);

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
      await loadChallenge();
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.shortMessage || e?.message || String(e), variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  }, [connected, connect, toast, loadChallenge]);

  const handleJoin = () => doAction('Join', async () => {
    const c = getV1Contract(false);
    if (!c || !challenge) throw new Error('Not available');
    return c.joinChallenge(BigInt(challengeId), { value: challenge.stakeWei });
  });

  const handleVote = (iWon: boolean) => doAction(iWon ? 'Vote: I Won' : 'Vote: Opponent Won', async () => {
    const c = getV1Contract(false);
    if (!c || !challenge) throw new Error('Not available');
    const me = address.toLowerCase();
    const isCreator = challenge.challenger.toLowerCase() === me;
    const challengerWon = isCreator ? iWon : !iWon;
    return c.submitOutcomeVote(BigInt(challengeId), challengerWon);
  });

  const handlePayout = () => doAction('Payout', async () => {
    const c = getV1Contract(false);
    if (!c) throw new Error('Not available');
    return c.resolveChallenge(BigInt(challengeId));
  });

  const handleRefund = () => doAction('Refund', async () => {
    const c = getV1Contract(false);
    if (!c) throw new Error('Not available');
    return c.issueRefund(BigInt(challengeId));
  });

  const now = Math.floor(Date.now() / 1000);
  const joined = challenge && challenge.participant !== ethers.ZeroAddress;
  const joinExpired = challenge && challenge.joinDeadline > 0 && now > challenge.joinDeadline;
  const resolveExpired = challenge && challenge.resolveDeadline > 0 && now > challenge.resolveDeadline;

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="join-resolve-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Join & Resolve</h1>
        <p className="text-sm text-muted-foreground mt-1">Paste a Challenge ID to join, vote, or finalize.</p>
      </div>

      <Card className="p-5">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              data-testid="input-challenge-id"
              type="text"
              value={challengeId}
              onChange={(e) => setChallengeId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadChallenge()}
              placeholder="Challenge ID..."
              className="w-full bg-muted/50 border border-border rounded-md py-3 pl-9 pr-3 text-sm font-mono focus:outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-1 focus:ring-[hsl(var(--primary))]/20"
            />
          </div>
          <Button data-testid="button-load-challenge" onClick={loadChallenge} disabled={loading || !challengeId.trim()} variant="secondary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {challenge && (
          <div className="space-y-4" data-testid="challenge-details">
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold">Challenge #{challengeId}</span>
                <Badge variant={challenge.state === 0 ? 'default' : challenge.state === 1 ? 'secondary' : 'outline'}>
                  {STATE_LABELS[challenge.state] || `State ${challenge.state}`}
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
        )}

        {lastTxHash && (
          <div className="mt-3 p-3 rounded-md border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <button
                data-testid="button-copy-action-tx"
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
                data-testid="link-action-tx-explorer"
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
