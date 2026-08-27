import { useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { ABI_V1, ABI_V2, NETWORKS, CHALLENGE_STATES, OFFER_STATES } from '@/lib/contracts';
import { stateColorClass } from '@/lib/chain-utils';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import {
  Loader2, LayoutDashboard, Wallet, ExternalLink, Search,
  TrendingUp, TrendingDown, Zap, Clock, Trophy, RefreshCw, History, BarChart3, Copy
} from 'lucide-react';
import { useEnsName, shortAddr } from '@/lib/ens';
import { Skeleton } from '@/components/ui/skeleton';
import { onCopyAction } from '@/lib/feedback';
import { TabButton } from '@/components/tab-button';
import { formatEth, formatUsd } from '@/lib/format';

function AddressName({ address }: { address: string }) {
  const { name, loading } = useEnsName(address);
  return <span className={loading ? 'opacity-50' : ''}>{shortAddr(address, name)}</span>;
}

interface BetEntry {
  id: string;
  type: 'challenge' | 'offer';
  role: 'creator' | 'opponent';
  stakeEth: number;
  state: number;
  createdAt: number;
  joinDeadline: number;
  resolveDeadline: number;
  counterparty: string;
  sideYes?: boolean;
  oddsBps?: number;
  winner?: string;
  payoutEth?: number;
}

interface TxEntry {
  txHash: string;
  action: string;
  betId: string;
  betType: 'challenge' | 'offer';
  blockNumber: number;
  timestamp?: number;
}





export default function MyBets() {
  const { connected, connect, address, ethUsd, network: networkKey, explorerUrl, getV1Contract, getV2Contract, connecting } = useWallet();
  const { toast } = useToast();
  const [bets, setBets] = useState<BetEntry[]>([]);
  const [txHistory, setTxHistory] = useState<TxEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'bets' | 'history' | 'stats'>('bets');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'resolved'>('all');
  const prevAddrRef = useRef('');

  const scanBets = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setBets([]);
    setTxHistory([]);
    try {
      const net = NETWORKS[networkKey];
      const rpcProvider = new ethers.JsonRpcProvider(net.rpc);
      const latest = await rpcProvider.getBlockNumber();
      const results: BetEntry[] = [];
      const txResults: TxEntry[] = [];
      const addrTopic = ethers.zeroPadValue(address.toLowerCase(), 32);

      const scanRange = 100000;
      const chunkSize = 9999;

      if (net.contract) {
        const c1 = new ethers.Contract(net.contract, ABI_V1, rpcProvider);
        const challengeOpenedTopic = c1.interface.getEvent('ChallengeOpened')?.topicHash;
        const challengeResolvedTopic = c1.interface.getEvent('ChallengeResolved')?.topicHash;

        if (challengeOpenedTopic) {
          for (let end = latest; end > Math.max(0, latest - scanRange); end -= chunkSize) {
            const start = Math.max(0, end - chunkSize + 1);
            try {
              const logs = await rpcProvider.getLogs({
                address: net.contract,
                topics: [challengeOpenedTopic, null, addrTopic],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of logs) {
                try {
                  const parsed = c1.interface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;
                  const cid = String(parsed.args[0]);
                  const [core, status] = await Promise.all([
                    c1.getChallengeCore(BigInt(cid)),
                    c1.getChallengeStatus(BigInt(cid)),
                  ]);
                  results.push({
                    id: cid,
                    type: 'challenge',
                    role: 'creator',
                    stakeEth: Number(ethers.formatEther(core[2])),
                    state: Number(status[1]),
                    createdAt: Number(status[0]),
                    joinDeadline: Number(core[4]),
                    resolveDeadline: Number(core[5]),
                    counterparty: core[1] !== ethers.ZeroAddress ? core[1] : '',
                  });
                  txResults.push({
                    txHash: log.transactionHash,
                    action: 'Created Challenge',
                    betId: cid,
                    betType: 'challenge',
                    blockNumber: log.blockNumber,
                  });
                } catch {}
              }

              const logsAll = await rpcProvider.getLogs({
                address: net.contract,
                topics: [challengeOpenedTopic],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of logsAll) {
                try {
                  const parsed = c1.interface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;
                  const cid = String(parsed.args[0]);
                  if (results.find(b => b.id === cid && b.type === 'challenge')) continue;
                  const [core, status] = await Promise.all([
                    c1.getChallengeCore(BigInt(cid)),
                    c1.getChallengeStatus(BigInt(cid)),
                  ]);
                  if (core[1].toLowerCase() === address.toLowerCase()) {
                    results.push({
                      id: cid,
                      type: 'challenge',
                      role: 'opponent',
                      stakeEth: Number(ethers.formatEther(core[2])),
                      state: Number(status[1]),
                      createdAt: Number(status[0]),
                      joinDeadline: Number(core[4]),
                      resolveDeadline: Number(core[5]),
                      counterparty: core[0],
                    });
                    txResults.push({
                      txHash: log.transactionHash,
                      action: 'Joined Challenge',
                      betId: cid,
                      betType: 'challenge',
                      blockNumber: log.blockNumber,
                    });
                  }
                } catch {}
              }
            } catch {}
          }
        }

        if (challengeResolvedTopic) {
          for (let end = latest; end > Math.max(0, latest - scanRange); end -= chunkSize) {
            const start = Math.max(0, end - chunkSize + 1);
            try {
              const logs = await rpcProvider.getLogs({
                address: net.contract,
                topics: [challengeResolvedTopic],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of logs) {
                try {
                  const parsed = c1.interface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;
                  const cid = String(parsed.args[0]);
                  const winner = String(parsed.args[1]).toLowerCase();
                  const me = address.toLowerCase();
                  const matchedChallenge = results.find(b => b.id === cid && b.type === 'challenge');
                  if (matchedChallenge) {
                    matchedChallenge.winner = winner;
                    matchedChallenge.payoutEth = Number(ethers.formatEther(parsed.args[2]));
                    txResults.push({
                      txHash: log.transactionHash,
                      action: winner === me ? 'Won Challenge' : 'Challenge Resolved',
                      betId: cid,
                      betType: 'challenge',
                      blockNumber: log.blockNumber,
                    });
                  }
                } catch {}
              }
            } catch {}
          }
        }
      }

      if (net.v2contract) {
        const c2 = new ethers.Contract(net.v2contract, ABI_V2, rpcProvider);
        const offerOpenedTopic = c2.interface.getEvent('OfferOpened')?.topicHash;
        const offerResolvedTopic = c2.interface.getEvent('OfferResolved')?.topicHash;

        if (offerOpenedTopic) {
          for (let end = latest; end > Math.max(0, latest - scanRange); end -= chunkSize) {
            const start = Math.max(0, end - chunkSize + 1);
            try {
              const createdLogs = await rpcProvider.getLogs({
                address: net.v2contract,
                topics: [offerOpenedTopic, null, addrTopic],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of createdLogs) {
                try {
                  const parsed = c2.interface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;
                  const oid = String(parsed.args[0]);
                  const [core, status] = await Promise.all([
                    c2.getOfferCore(BigInt(oid)),
                    c2.getOfferStatus(BigInt(oid)),
                  ]);
                  results.push({
                    id: oid,
                    type: 'offer',
                    role: 'creator',
                    stakeEth: Number(ethers.formatEther(core[4])),
                    state: Number(status[3]),
                    createdAt: Number(status[2]),
                    joinDeadline: Number(status[0]),
                    resolveDeadline: Number(status[1]),
                    counterparty: core[1] !== ethers.ZeroAddress ? core[1] : '',
                    sideYes: core[2],
                    oddsBps: Number(core[3]),
                  });
                  txResults.push({
                    txHash: log.transactionHash,
                    action: 'Created Offer',
                    betId: oid,
                    betType: 'offer',
                    blockNumber: log.blockNumber,
                  });
                } catch {}
              }

              const allLogs = await rpcProvider.getLogs({
                address: net.v2contract,
                topics: [offerOpenedTopic],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of allLogs) {
                try {
                  const parsed = c2.interface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;
                  const oid = String(parsed.args[0]);
                  if (results.find(b => b.id === oid && b.type === 'offer')) continue;
                  const [core, status] = await Promise.all([
                    c2.getOfferCore(BigInt(oid)),
                    c2.getOfferStatus(BigInt(oid)),
                  ]);
                  if (core[1].toLowerCase() === address.toLowerCase()) {
                    results.push({
                      id: oid,
                      type: 'offer',
                      role: 'opponent',
                      stakeEth: Number(ethers.formatEther(core[5])),
                      state: Number(status[3]),
                      createdAt: Number(status[2]),
                      joinDeadline: Number(status[0]),
                      resolveDeadline: Number(status[1]),
                      counterparty: core[0],
                      sideYes: !core[2],
                      oddsBps: Number(core[3]),
                    });
                    txResults.push({
                      txHash: log.transactionHash,
                      action: 'Took Offer',
                      betId: oid,
                      betType: 'offer',
                      blockNumber: log.blockNumber,
                    });
                  }
                } catch {}
              }
            } catch {}
          }
        }

        if (offerResolvedTopic) {
          for (let end = latest; end > Math.max(0, latest - scanRange); end -= chunkSize) {
            const start = Math.max(0, end - chunkSize + 1);
            try {
              const logs = await rpcProvider.getLogs({
                address: net.v2contract,
                topics: [offerResolvedTopic],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of logs) {
                try {
                  const parsed = c2.interface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;
                  const oid = String(parsed.args[0]);
                  const winner = String(parsed.args[1]).toLowerCase();
                  const me = address.toLowerCase();
                  const matchedOffer = results.find(b => b.id === oid && b.type === 'offer');
                  if (matchedOffer) {
                    matchedOffer.winner = winner;
                    matchedOffer.payoutEth = Number(ethers.formatEther(parsed.args[2]));
                    txResults.push({
                      txHash: log.transactionHash,
                      action: winner === me ? 'Won Offer' : 'Offer Resolved',
                      betId: oid,
                      betType: 'offer',
                      blockNumber: log.blockNumber,
                    });
                  }
                } catch {}
              }
            } catch {}
          }
        }
      }

      results.sort((a, b) => b.createdAt - a.createdAt);
      txResults.sort((a, b) => b.blockNumber - a.blockNumber);
      setBets(results);
      setTxHistory(txResults);
      setLoaded(true);
    } catch (e: any) {
      toast({ title: 'Scan failed', description: e?.message || 'Could not scan blockchain events', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [address, networkKey, toast]);

  useEffect(() => {
    if (connected && address && address !== prevAddrRef.current) {
      prevAddrRef.current = address;
      scanBets();
    }
  }, [connected, address, scanBets]);

  const filteredBets = bets.filter(b => {
    if (filterTab === 'active') return b.state === 0 || b.state === 1;
    if (filterTab === 'resolved') return b.state === 2 || b.state === 3;
    return true;
  });

  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="my-bets-page">
      <div className="page-section">
        <h1 className="page-title" data-testid="text-page-title">My Bets</h1>
        <p className="page-subtitle">Track all your bets, see your stats, and check transaction history.</p>
      </div>

      {!connected ? (
        <Card className="p-8 text-center">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="mb-1 text-sm font-medium">Connect your wallet to get started</p>
          <p className="mb-5 text-xs leading-relaxed text-muted-foreground">We'll scan the blockchain for any bets linked to your wallet address.</p>
          <Button data-testid="button-connect-my-bets" onClick={() => connect()} disabled={connecting} className="min-h-11 w-full sm:w-auto">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Connect wallet
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <TabButton data-testid="button-tab-bets" active={tab === 'bets'} onClick={() => setTab('bets')}>
                <LayoutDashboard className="w-3 h-3 inline mr-1" />Bets
              </TabButton>
              <TabButton data-testid="button-tab-history" active={tab === 'history'} onClick={() => setTab('history')}>
                <History className="w-3 h-3 inline mr-1" />History ({txHistory.length})
              </TabButton>
              <TabButton data-testid="button-tab-stats" active={tab === 'stats'} onClick={() => setTab('stats')}>
                <BarChart3 className="w-3 h-3 inline mr-1" />Stats
              </TabButton>
            </div>
            <Button
              data-testid="button-refresh-bets"
              onClick={scanBets}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Refresh
            </Button>
          </div>

          {tab === 'bets' && (
            <>
              <div className="flex items-center gap-1.5">
                {(['all', 'active', 'resolved'] as const).map(t => (
                  <TabButton key={t} data-testid={`button-filter-${t}`} active={filterTab === t} onClick={() => setFilterTab(t)} size="sm">
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </TabButton>
                ))}
              </div>

              {loading && bets.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2].map(i => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-10" />
                          <Skeleton className="h-4 w-16 rounded-full" />
                          <Skeleton className="h-4 w-14 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-24 rounded-full" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3 w-36" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : loaded && filteredBets.length === 0 ? (
                <Card className="p-8 text-center">
                  <LayoutDashboard className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">
                    {filterTab === 'all' ? 'No bets found yet' : `No ${filterTab} bets`}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {filterTab === 'all'
                      ? 'Create your first bet or join one from Trending to get started.'
                      : `Try switching to "All" to see all your bets.`}
                  </p>
                  {filterTab === 'all' && (
                    <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row">
                      <Link href="/">
                        <Button className="min-h-11 w-full sm:w-auto" data-testid="button-create-from-empty">
                          <Zap className="h-4 w-4" />
                          Create a bet
                        </Button>
                      </Link>
                      <Link href="/trending">
                        <Button variant="outline" className="min-h-11 w-full sm:w-auto" data-testid="button-trending-from-empty">
                          <TrendingUp className="h-4 w-4" />
                          Browse trending
                        </Button>
                      </Link>
                    </div>
                  )}
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredBets.map((bet) => {
                    const stateLabels = bet.type === 'challenge' ? CHALLENGE_STATES : OFFER_STATES;
                    const isExpiring = (bet.state === 0 && bet.joinDeadline > 0 && bet.joinDeadline - now < 300 && now < bet.joinDeadline) ||
                      (bet.state === 1 && bet.resolveDeadline > 0 && bet.resolveDeadline - now < 300 && now < bet.resolveDeadline);

                    return (
                      <Link key={`${bet.type}-${bet.id}`} href={`/lookup?id=${bet.id}`} data-testid={`bet-card-${bet.type}-${bet.id}`}>
                        <Card className="p-4 hover-elevate cursor-pointer">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold font-mono">#{bet.id}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-copy-bet-${bet.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(bet.id);
                                  onCopyAction();
                                  toast({ title: 'Copied', description: `Bet ID ${bet.id} copied to clipboard` });
                                }}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Badge variant="secondary" className="text-2xs">
                                {bet.type === 'challenge' ? 'Challenge' : 'Offer'}
                              </Badge>
                              <Badge variant="outline" className="text-2xs">
                                {bet.role === 'creator' ? 'Creator' : 'Opponent'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isExpiring && (
                                <Badge variant="outline" className="text-2xs text-amber-600 dark:text-amber-400 border-amber-600/30 dark:border-amber-400/30">
                                  <Clock className="w-2.5 h-2.5 mr-0.5" />
                                  Expiring
                                </Badge>
                              )}
                              <Badge variant="outline" className={`text-2xs ${stateColorClass(bet.state)}`}>
                                {stateLabels[bet.state] || `State ${bet.state}`}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">
                                Stake <span className="font-mono text-foreground">{formatEth(bet.stakeEth)} ETH</span>
                                <span className="ml-1">{formatUsd(bet.stakeEth * ethUsd)}</span>
                              </span>
                            </div>
                            {bet.type === 'offer' && bet.oddsBps && (
                              <div className="flex items-center gap-1">
                                {bet.sideYes ? (
                                  <TrendingUp className="w-3 h-3 text-success" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 text-danger" />
                                )}
                                <span className={`font-mono ${bet.sideYes ? 'text-success' : 'text-danger'}`}>
                                  {bet.sideYes ? 'YES' : 'NO'} {Math.round(bet.oddsBps / 100)}%
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-1.5 text-2xs text-muted-foreground">
                            <span>{new Date(bet.createdAt * 1000).toLocaleDateString()}</span>
                            {bet.counterparty && (
                              <span>vs <AddressName address={bet.counterparty} /></span>
                            )}
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'history' && (
            <>
              {loading && txHistory.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2].map(i => (
                    <Card key={i} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-24 rounded-full" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <div className="mt-1">
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : loaded && txHistory.length === 0 ? (
                <Card className="p-8 text-center">
                  <History className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No transaction history found</p>
                  <p className="text-xs text-muted-foreground mb-4">Create or join a bet to see your transaction history here.</p>
                  <div className="flex items-center justify-center gap-2">
                    <Link href="/">
                      <Button variant="default" size="sm" data-testid="button-create-from-history-empty">
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                        Create a Bet
                      </Button>
                    </Link>
                    <Link href="/trending">
                      <Button variant="outline" size="sm" data-testid="button-trending-from-history-empty">
                        <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                        Browse Trending
                      </Button>
                    </Link>
                  </div>
                </Card>
              ) : (
                <div className="space-y-2">
                  {txHistory.map((tx, idx) => (
                    <Card key={`${tx.txHash}-${idx}`} className="p-3" data-testid={`tx-entry-${idx}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-2xs">
                            {tx.betType === 'challenge' ? 'Challenge' : 'Offer'} #{tx.betId}
                          </Badge>
                          <span className="text-xs font-medium">{tx.action}</span>
                        </div>
                        <a
                          href={`${explorerUrl}/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-2xs font-mono text-primary"
                          data-testid={`link-tx-${idx}`}
                        >
                          {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="text-2xs text-muted-foreground mt-1">
                        Block #{tx.blockNumber}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'stats' && (
            (() => {
              const me = address?.toLowerCase() || '';
              const resolvedBets = bets.filter(b => b.state === 2);
              const wins = resolvedBets.filter(b => b.winner && b.winner === me);
              const losses = resolvedBets.filter(b => b.winner && b.winner !== ethers.ZeroAddress.toLowerCase() && b.winner !== me);
              const draws = resolvedBets.filter(b => b.winner && b.winner === ethers.ZeroAddress.toLowerCase()).length;
              const cancelledBets = bets.filter(b => b.state === 3);
              const winCount = wins.length;
              const lossCount = losses.length;
              const winRate = (winCount + lossCount) > 0 ? (winCount / (winCount + lossCount)) * 100 : 0;
              const totalWagered = resolvedBets.reduce((sum, b) => sum + b.stakeEth, 0);
              const totalWon = wins.reduce((sum, b) => sum + (b.payoutEth || 0), 0);
              const netPL = totalWon - totalWagered;
              const biggestWin = wins.length > 0 ? Math.max(...wins.map(b => b.payoutEth || 0)) : 0;

              let currentStreak = 0;
              let streakType: 'W' | 'L' | '' = '';
              const sortedResolved = [...resolvedBets].sort((a, b) => b.createdAt - a.createdAt);
              for (const b of sortedResolved) {
                if (!b.winner || b.winner === ethers.ZeroAddress.toLowerCase()) continue;
                const isWin = b.winner === me;
                const type = isWin ? 'W' : 'L';
                if (streakType === '') {
                  streakType = type;
                  currentStreak = 1;
                } else if (type === streakType) {
                  currentStreak++;
                } else {
                  break;
                }
              }

              return (
                <div data-testid="stats-panel" className="space-y-3">
                  {loading && bets.length === 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {[0, 1].map(i => (
                          <Card key={i} className="p-4 text-center">
                            <Skeleton className="h-3 w-16 mx-auto mb-2" />
                            <Skeleton className="h-8 w-12 mx-auto mb-1" />
                            <Skeleton className="h-3 w-20 mx-auto" />
                          </Card>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[0, 1, 2].map(i => (
                          <Card key={i} className="p-3 text-center">
                            <Skeleton className="h-3 w-14 mx-auto mb-2" />
                            <Skeleton className="h-4 w-16 mx-auto mb-1" />
                            <Skeleton className="h-3 w-8 mx-auto" />
                          </Card>
                        ))}
                      </div>
                    </>
                  ) : loaded && bets.length === 0 ? (
                    <Card className="p-8 text-center">
                      <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium mb-1">No bets found to compute stats</p>
                      <p className="text-xs text-muted-foreground mb-4">Place your first bet to start tracking your performance.</p>
                      <div className="flex items-center justify-center gap-2">
                        <Link href="/">
                          <Button variant="default" size="sm" data-testid="button-create-from-stats-empty">
                            <Zap className="w-3.5 h-3.5 mr-1.5" />
                            Create a Bet
                          </Button>
                        </Link>
                        <Link href="/trending">
                          <Button variant="outline" size="sm" data-testid="button-trending-from-stats-empty">
                            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                            Browse Trending
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="p-4 text-center">
                          <p className="text-2xs text-muted-foreground uppercase tracking-wider mb-1">Win Rate</p>
                          <p className="text-3xl font-bold text-primary" data-testid="text-win-rate">
                            {winRate.toFixed(0)}%
                          </p>
                          <p className="text-2xs text-muted-foreground mt-1">
                            {winCount + lossCount} decided{draws > 0 ? `, ${draws} draw${draws !== 1 ? 's' : ''}` : ''}
                          </p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-2xs text-muted-foreground uppercase tracking-wider mb-1">Record</p>
                          <p className="text-2xl font-bold">
                            <span className="text-success">{winCount}</span>
                            <span className="text-muted-foreground mx-1">-</span>
                            <span className="text-danger">{lossCount}</span>
                            <span className="text-muted-foreground mx-1">-</span>
                            <span className="text-muted-foreground">{draws}</span>
                          </p>
                          <p className="text-2xs text-muted-foreground mt-1">W - L - D{cancelledBets.length > 0 ? ` (${cancelledBets.length} cancelled)` : ''}</p>
                        </Card>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Card className="p-3 text-center">
                          <p className="text-2xs text-muted-foreground uppercase tracking-wider mb-1">Wagered</p>
                          <p className="text-sm font-bold font-mono">{totalWagered.toFixed(4)}</p>
                          <p className="text-2xs text-muted-foreground">ETH</p>
                          <p className="text-2xs text-success">${(totalWagered * ethUsd).toFixed(2)}</p>
                        </Card>
                        <Card className="p-3 text-center">
                          <p className="text-2xs text-muted-foreground uppercase tracking-wider mb-1">Won</p>
                          <p className="text-sm font-bold font-mono text-success">{totalWon.toFixed(4)}</p>
                          <p className="text-2xs text-muted-foreground">ETH</p>
                          <p className="text-2xs text-success">${(totalWon * ethUsd).toFixed(2)}</p>
                        </Card>
                        <Card className="p-3 text-center">
                          <p className="text-2xs text-muted-foreground uppercase tracking-wider mb-1">Net P/L</p>
                          <p className={`text-sm font-bold font-mono ${netPL >= 0 ? 'text-success' : 'text-danger'}`} data-testid="text-net-pl">
                            {netPL >= 0 ? '+' : ''}{netPL.toFixed(4)}
                          </p>
                          <p className="text-2xs text-muted-foreground">ETH</p>
                          <p className={`text-2xs ${netPL >= 0 ? 'text-success' : 'text-danger'}`}>
                            {netPL >= 0 ? '+' : ''}${(netPL * ethUsd).toFixed(2)}
                          </p>
                        </Card>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Card className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <p className="text-2xs text-muted-foreground uppercase tracking-wider">Biggest Win</p>
                          </div>
                          <p className="text-sm font-bold font-mono text-success">
                            {biggestWin > 0 ? `${biggestWin.toFixed(4)} ETH` : '—'}
                          </p>
                          {biggestWin > 0 && (
                            <p className="text-2xs text-success">${(biggestWin * ethUsd).toFixed(2)}</p>
                          )}
                        </Card>
                        <Card className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <p className="text-2xs text-muted-foreground uppercase tracking-wider">Streak</p>
                          </div>
                          <p className={`text-sm font-bold ${streakType === 'W' ? 'text-success' : streakType === 'L' ? 'text-danger' : 'text-muted-foreground'}`}>
                            {currentStreak > 0 ? `${currentStreak}${streakType}` : '—'}
                          </p>
                          <p className="text-2xs text-muted-foreground">
                            {streakType === 'W' ? 'Winning' : streakType === 'L' ? 'Losing' : 'No streak'}
                          </p>
                        </Card>
                      </div>
                      <p className="text-2xs text-muted-foreground text-center mt-2">
                        Based on bets found in the last ~100k blocks on {NETWORKS[networkKey].chainName}.
                      </p>
                    </>
                  )}
                </div>
              );
            })()
          )}

          {loaded && bets.length > 0 && tab !== 'stats' && (
            <div className="text-center">
              <p className="text-2xs text-muted-foreground">
                Found {bets.length} bet{bets.length !== 1 ? 's' : ''} on {NETWORKS[networkKey].chainName}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
