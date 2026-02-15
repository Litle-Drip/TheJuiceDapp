import { useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { ABI_V1, ABI_V2, NETWORKS } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Search, UserPlus, ArrowDownToLine, ThumbsUp, ThumbsDown,
  Trophy, RefreshCw, ExternalLink, TrendingUp, TrendingDown, AlertTriangle, Fuel, Copy
} from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ConfirmTxDialog, TxConfirmLine } from '@/components/confirm-tx-dialog';
import { onTransactionSuccess } from '@/lib/feedback';

function GasEstimate({ estimateFn, ethUsd, address }: { estimateFn: () => Promise<{ gasEth: number; gasUsd: number } | null>; ethUsd: number; address?: string }) {
  const [gas, setGas] = useState<{ gasEth: number; gasUsd: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const lastKey = useRef('');

  useEffect(() => {
    const key = `${address || ''}-${ethUsd}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (!address) { setGas(null); return; }
    setLoading(true);
    estimateFn().then(r => { setGas(r); }).catch(() => { setGas(null); }).finally(() => setLoading(false));
  }, [estimateFn, address, ethUsd]);

  if (!address) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground py-1">
        <Fuel className="w-3 h-3" />
        <span>Estimating gas...</span>
      </div>
    );
  }
  if (!gas) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground py-1" data-testid="gas-estimate">
      <Fuel className="w-3 h-3" />
      <span>Est. gas: {gas.gasEth.toFixed(8)} ETH</span>
      <span className="text-emerald-400">(${gas.gasUsd.toFixed(4)})</span>
    </div>
  );
}

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
  const [loadedBetId, setLoadedBetId] = useState('');
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [marketQuestion, setMarketQuestion] = useState('');

  const findResolveTx = useCallback(async (contract: ethers.Contract, eventName: string, id: bigint): Promise<string> => {
    try {
      const provider = contract.runner as ethers.Provider;
      if (!provider || !('getBlockNumber' in provider)) return '';
      const latest = await (provider as ethers.JsonRpcProvider).getBlockNumber();
      const idTopic = ethers.zeroPadValue(ethers.toBeHex(id), 32);
      const eventFrag = contract.interface.getEvent(eventName);
      if (!eventFrag) return '';
      const topic0 = eventFrag.topicHash;
      for (let end = latest; end > Math.max(0, latest - 50000); end -= 9999) {
        const start = Math.max(0, end - 9998);
        const logs = await provider.getLogs({
          address: await contract.getAddress(),
          topics: [topic0, idTopic],
          fromBlock: start,
          toBlock: end,
        });
        if (logs.length > 0) return logs[logs.length - 1].transactionHash;
      }
    } catch {}
    return '';
  }, []);

  const loadBet = useCallback(async (isRefresh?: boolean) => {
    const raw = betId.trim();
    if (!raw) return;
    if (raw.startsWith('0x') && raw.length > 10) {
      toast({ title: 'Wrong format', description: 'Enter the numeric Bet ID (e.g. 3), not a transaction hash.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setBet(null);
    if (!isRefresh) {
      setPayoutTxHash('');
      setLoadedBetId(raw);
      if (!marketQuestion) {
        try {
          const stored = JSON.parse(localStorage.getItem('juice_bet_questions') || '{}');
          if (stored[raw]) setMarketQuestion(stored[raw]);
        } catch {}
      }
    }
    try {
      const id = BigInt(raw);
      const c1 = getV1Contract(true);
      const c2 = getV2Contract(true);

      let challengeResult: ChallengeData | null = null as ChallengeData | null;
      let offerResult: OfferData | null = null as OfferData | null;
      let hadRpcError = false;

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
            } catch { hadRpcError = true; }
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
            } catch { hadRpcError = true; }
          })()
        );
      }

      await Promise.all(promises);

      let finalBet: BetData | null = null;
      if (challengeResult && offerResult) {
        finalBet = offerResult.createdAt >= challengeResult.createdAt ? offerResult : challengeResult;
      } else if (challengeResult) {
        finalBet = challengeResult;
      } else if (offerResult) {
        finalBet = offerResult;
      }

      if (finalBet) {
        setBet(finalBet);
        if (finalBet.state === 2 && !isRefresh) {
          const contract = finalBet.type === 'offer' ? c2 : c1;
          const eventName = finalBet.type === 'offer' ? 'OfferResolved' : 'ChallengeResolved';
          if (contract) {
            findResolveTx(contract, eventName, id).then(hash => {
              if (hash) setPayoutTxHash(hash);
            });
          }
        }
      } else if (hadRpcError && !isRefresh) {
        await new Promise(r => setTimeout(r, 1500));
        const retryPromises: Promise<void>[] = [];
        if (c1 && !challengeResult) {
          retryPromises.push(
            (async () => {
              try {
                const rc1 = getV1Contract(true);
                if (!rc1) return;
                const [core, status] = await Promise.all([rc1.getChallengeCore(id), rc1.getChallengeStatus(id)]);
                if (core[0] !== ethers.ZeroAddress) {
                  challengeResult = {
                    type: 'challenge', challenger: core[0], participant: core[1], stakeWei: core[2], feeBps: Number(core[3]),
                    joinDeadline: Number(core[4]), resolveDeadline: Number(core[5]),
                    createdAt: Number(status[0]), state: Number(status[1]),
                    challengerVote: Number(status[2]), participantVote: Number(status[3]),
                  };
                }
              } catch {}
            })()
          );
        }
        if (c2 && !offerResult) {
          retryPromises.push(
            (async () => {
              try {
                const rc2 = getV2Contract(true);
                if (!rc2) return;
                const [core, status] = await Promise.all([rc2.getOfferCore(id), rc2.getOfferStatus(id)]);
                if (core[0] !== ethers.ZeroAddress) {
                  offerResult = {
                    type: 'offer', creator: core[0], taker: core[1], creatorSideYes: core[2], pBps: Number(core[3]),
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
        await Promise.all(retryPromises);
        finalBet = challengeResult && offerResult
          ? (offerResult.createdAt >= challengeResult.createdAt ? offerResult : challengeResult)
          : challengeResult || offerResult;
        if (finalBet) {
          setBet(finalBet);
          if (finalBet.state === 2) {
            const contract = finalBet.type === 'offer' ? c2 : c1;
            const eventName = finalBet.type === 'offer' ? 'OfferResolved' : 'ChallengeResolved';
            if (contract) findResolveTx(contract, eventName, id).then(hash => { if (hash) setPayoutTxHash(hash); });
          }
        } else {
          toast({ title: 'Network error', description: 'Could not reach the blockchain. Please try again.', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Not found', description: `No bet found with ID #${raw}`, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Lookup failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [betId, getV1Contract, getV2Contract, toast, findResolveTx]);

  useEffect(() => {
    if (autoLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const qParam = params.get('q');
    if (qParam) {
      const decoded = decodeURIComponent(qParam);
      setMarketQuestion(decoded);
      if (idParam) {
        try {
          const stored = JSON.parse(localStorage.getItem('juice_bet_questions') || '{}');
          stored[idParam] = decoded;
          localStorage.setItem('juice_bet_questions', JSON.stringify(stored));
        } catch {}
      }
    }
    if (idParam && /^\d+$/.test(idParam)) {
      setBetId(idParam);
      if (!qParam) {
        try {
          const stored = JSON.parse(localStorage.getItem('juice_bet_questions') || '{}');
          if (stored[idParam]) setMarketQuestion(stored[idParam]);
        } catch {}
      }
      setAutoLoaded(true);
    }
  }, [autoLoaded]);

  useEffect(() => {
    if (autoLoaded && betId && !bet && !loading) {
      loadBet();
    }
  }, [autoLoaded, betId, bet, loading, loadBet]);

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
      onTransactionSuccess();
      toast({ title: 'Success', description: `${action} completed` });
      await new Promise(r => setTimeout(r, 1500));
      await loadBet(true);
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.shortMessage || e?.message || String(e), variant: 'destructive' });
      throw e;
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
          <Button data-testid="button-load-bet" onClick={() => loadBet()} disabled={loading || !betId.trim()} variant="secondary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {bet?.type === 'challenge' && (
          <ChallengeView
            challenge={bet}
            betId={betId}
            now={now}
            address={address}
            connected={connected}
            actionLoading={actionLoading}
            doAction={doAction}
            networkKey={networkKey}
            payoutTxHash={payoutTxHash}
            explorerUrl={explorerUrl}
            ethUsd={ethUsd}
            marketQuestion={marketQuestion}
          />
        )}

        {bet?.type === 'offer' && (
          <OfferView
            offer={bet}
            betId={betId}
            now={now}
            address={address}
            connected={connected}
            actionLoading={actionLoading}
            doAction={doAction}
            networkKey={networkKey}
            payoutTxHash={payoutTxHash}
            explorerUrl={explorerUrl}
            ethUsd={ethUsd}
            marketQuestion={marketQuestion}
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
  challenge, betId, now, address, connected, actionLoading, doAction, networkKey, payoutTxHash, explorerUrl, ethUsd, marketQuestion,
}: {
  challenge: ChallengeData;
  betId: string;
  now: number;
  address: string;
  connected: boolean;
  actionLoading: string;
  doAction: (action: string, fn: (s: ethers.Signer) => Promise<any>) => void;
  networkKey: string;
  payoutTxHash: string;
  explorerUrl: string;
  ethUsd: number;
  marketQuestion: string;
}) {
  const joined = challenge.participant !== ethers.ZeroAddress;
  const joinExpired = challenge.joinDeadline > 0 && now > challenge.joinDeadline;
  const resolveExpired = challenge.resolveDeadline > 0 && now > challenge.resolveDeadline;
  const net = NETWORKS[networkKey as keyof typeof NETWORKS];

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
            <Badge variant="secondary" className="text-[10px]">Challenge</Badge>
          </div>
          <div className="flex items-center gap-2">
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
          {challenge.state === 0 && !joinExpired && (
            <div className="flex justify-end text-[10px]">
              <Countdown deadline={challenge.joinDeadline} />
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resolve by</span>
            <span className="font-mono text-[10px]">{new Date(challenge.resolveDeadline * 1000).toLocaleString()}</span>
          </div>
          {challenge.state === 1 && !resolveExpired && (
            <div className="flex justify-end text-[10px]">
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
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-400">Your vote is needed</p>
                <p className="text-[10px] text-muted-foreground">
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
        <div className="rounded-md border-2 border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5 p-4 space-y-3">
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Who won?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Both players must agree for payout</p>
          </div>
          <GasEstimate estimateFn={() => estimateGas('submitOutcomeVote', [BigInt(betId), true])} ethUsd={ethUsd} address={address} />
          <div className="grid grid-cols-2 gap-3">
            <button
              data-testid="button-vote-won"
              onClick={() => confirmVote(true)}
              disabled={!!actionLoading}
              className="flex flex-col items-center gap-1.5 p-4 rounded-md border-2 border-emerald-500/40 bg-emerald-500/10 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/60 disabled:opacity-50"
            >
              {actionLoading === 'Vote: I Won' ? <Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> : <ThumbsUp className="w-6 h-6 text-emerald-400" />}
              <span className="text-sm font-bold text-emerald-400">I Won</span>
            </button>
            <button
              data-testid="button-vote-lost"
              onClick={() => confirmVote(false)}
              disabled={!!actionLoading}
              className="flex flex-col items-center gap-1.5 p-4 rounded-md border-2 border-rose-500/40 bg-rose-500/10 transition-all hover:bg-rose-500/20 hover:border-rose-500/60 disabled:opacity-50"
            >
              {actionLoading === 'Vote: Opponent Won' ? <Loader2 className="w-6 h-6 animate-spin text-rose-400" /> : <ThumbsDown className="w-6 h-6 text-rose-400" />}
              <span className="text-sm font-bold text-rose-400">Opponent Won</span>
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
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Join deadline passed with no opponent. Creator can reclaim funds.</p>
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
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Votes conflict - creator and opponent disagree on the outcome. Both parties can claim a refund.</p>
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
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Resolve deadline passed without agreement. Both parties can claim a refund.</p>
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

function OfferView({
  offer, betId, now, address, connected, actionLoading, doAction, networkKey, payoutTxHash, explorerUrl, ethUsd, marketQuestion,
}: {
  offer: OfferData;
  betId: string;
  now: number;
  address: string;
  connected: boolean;
  actionLoading: string;
  doAction: (action: string, fn: (s: ethers.Signer) => Promise<any>) => void;
  networkKey: string;
  payoutTxHash: string;
  explorerUrl: string;
  ethUsd: number;
  marketQuestion: string;
}) {
  const hasTaker = offer.taker !== ethers.ZeroAddress;
  const joinExpired = offer.joinDeadline > 0 && now > offer.joinDeadline;
  const resolveExpired = offer.resolveDeadline > 0 && now > offer.resolveDeadline;
  const net = NETWORKS[networkKey as keyof typeof NETWORKS];

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
            <Badge variant="secondary" className="text-[10px]">Market Offer</Badge>
          </div>
          <div className="flex items-center gap-2">
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
            {offer.paid && <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Paid</Badge>}
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
          {offer.state === 0 && !joinExpired && (
            <div className="flex justify-end text-[10px]">
              <Countdown deadline={offer.joinDeadline} />
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resolve by</span>
            <span className="font-mono text-[10px]">{new Date(offer.resolveDeadline * 1000).toLocaleString()}</span>
          </div>
          {offer.state === 1 && !resolveExpired && (
            <div className="flex justify-end text-[10px]">
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
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-400">Your vote is needed</p>
                <p className="text-[10px] text-muted-foreground">
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
        <div className="rounded-md border-2 border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5 p-4 space-y-3">
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
              className="flex flex-col items-center gap-1.5 p-4 rounded-md border-2 border-emerald-500/40 bg-emerald-500/10 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/60 disabled:opacity-50"
            >
              {actionLoading === 'Vote: YES' ? <Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> : <TrendingUp className="w-6 h-6 text-emerald-400" />}
              <span className="text-sm font-bold text-emerald-400">YES Won</span>
            </button>
            <button
              data-testid="button-vote-no"
              onClick={() => confirmVote(false)}
              disabled={!!actionLoading}
              className="flex flex-col items-center gap-1.5 p-4 rounded-md border-2 border-rose-500/40 bg-rose-500/10 transition-all hover:bg-rose-500/20 hover:border-rose-500/60 disabled:opacity-50"
            >
              {actionLoading === 'Vote: NO' ? <Loader2 className="w-6 h-6 animate-spin text-rose-400" /> : <TrendingDown className="w-6 h-6 text-rose-400" />}
              <span className="text-sm font-bold text-rose-400">NO Won</span>
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
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Join deadline passed with no taker. Creator can reclaim funds.</p>
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
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Votes disagree - creator and taker voted differently. Both parties can claim a refund.</p>
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
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">Resolve deadline passed without agreement. Both parties can claim a refund.</p>
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
