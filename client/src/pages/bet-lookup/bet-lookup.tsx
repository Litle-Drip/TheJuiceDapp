import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, ExternalLink } from 'lucide-react';
import { onBetJoined, onVoteSubmitted, onBetResolved, onBetRefunded, onCopyAction } from '@/lib/feedback';
import { ChallengeData, OfferData, BetData } from './types';
import { ChallengeView } from './challenge-view';
import { OfferView } from './offer-view';

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
        toast({ title: 'Bet not found', description: `No bet exists with ID #${raw}. Double-check the number and make sure you're on the right network.`, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Something went wrong', description: e?.message || 'Could not load this bet. Check the ID and try again.', variant: 'destructive' });
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
      if (action === 'Join' || action === 'Take Offer') {
        onBetJoined();
      } else if (action.startsWith('Vote')) {
        onVoteSubmitted();
      } else if (action === 'Payout' || action === 'Resolve') {
        onBetResolved();
      } else if (action === 'Refund') {
        onBetRefunded();
      }
      toast({ title: 'Success', description: `${action} completed` });
      await new Promise(r => setTimeout(r, 1500));
      await loadBet(true);
    } catch (e: any) {
      toast({ title: 'Transaction failed', description: e?.shortMessage || e?.message || 'Something went wrong. Check your wallet and try again.', variant: 'destructive' });
      throw e;
    } finally {
      setActionLoading('');
    }
  }, [connected, connect, signer, toast, loadBet]);

  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="bet-lookup-page">
      <div className="page-section">
        <h1 className="page-title" data-testid="text-page-title">Bet Lookup</h1>
        <p className="page-subtitle">Enter a bet ID to join, vote on the outcome, or check its status.</p>
      </div>

      <Card className="p-5 sm:p-6">
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
              className="w-full bg-muted/50 border border-border rounded-md py-3 pl-9 pr-3 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
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
                  onCopyAction();
                  toast({ title: 'Copied', description: 'Transaction hash copied' });
                }}
                className="text-2xs font-mono text-muted-foreground truncate flex-1 text-left"
              >
                Last TX: {lastTxHash.slice(0, 10)}...{lastTxHash.slice(-8)}
              </button>
              <a
                href={`${explorerUrl}/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex-shrink-0"
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
