import { useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { ABI_V1, ABI_V2, NETWORKS } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import {
  Loader2, LayoutDashboard, Wallet, ExternalLink, Search,
  TrendingUp, TrendingDown, Zap, Clock, Trophy, RefreshCw, History, BarChart3
} from 'lucide-react';
import { useEnsName, shortAddr } from '@/lib/ens';

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

const CHALLENGE_STATES = ['Waiting for opponent', 'Voting in progress', 'Settled', 'Refunded'];
const OFFER_STATES = ['Waiting for taker', 'Voting in progress', 'Settled', 'Refunded'];

function stateColor(state: number): string {
  switch (state) {
    case 0: return 'text-primary border-primary/30';
    case 1: return 'text-[#b8860b] border-[#b8860b]/30';
    case 2: return 'text-[#6b8f71] border-[#6b8f71]/30';
    case 3: return 'text-muted-foreground border-border';
    default: return 'text-muted-foreground border-border';
  }
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
    <div className="space-y-4 max-w-xl mx-auto" data-testid="my-bets-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">My Bets</h1>
        <p className="text-sm text-muted-foreground mt-1">Track all your bets, see your stats, and check transaction history.</p>
      </div>

      {!connected ? (
        <Card className="p-8 text-center">
          <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Connect your wallet to get started</p>
          <p className="text-xs text-muted-foreground mb-4">We'll scan the blockchain for any bets linked to your wallet address.</p>
          <Button data-testid="button-connect-my-bets" onClick={() => connect()} disabled={connecting}>
            {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
            Connect Wallet
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                data-testid="button-tab-bets"
                onClick={() => setTab('bets')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  tab === 'bets'
                    ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <LayoutDashboard className="w-3 h-3 inline mr-1" />
                Bets
              </button>
              <button
                data-testid="button-tab-history"
                onClick={() => setTab('history')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  tab === 'history'
                    ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <History className="w-3 h-3 inline mr-1" />
                History ({txHistory.length})
              </button>
              <button
                data-testid="button-tab-stats"
                onClick={() => setTab('stats')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  tab === 'stats'
                    ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <BarChart3 className="w-3 h-3 inline mr-1" />
                Stats
              </button>
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
                  <button
                    key={t}
                    data-testid={`button-filter-${t}`}
                    onClick={() => setFilterTab(t)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all ${
                      filterTab === t
                        ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {loading && bets.length === 0 ? (
                <Card className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[hsl(var(--primary))]" />
                  <p className="text-sm text-muted-foreground">Scanning blockchain for your bets...</p>
                </Card>
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
                    <div className="flex items-center justify-center gap-2">
                      <Link href="/">
                        <Button variant="default" size="sm" data-testid="button-create-from-empty">
                          <Zap className="w-3.5 h-3.5 mr-1.5" />
                          Create a Bet
                        </Button>
                      </Link>
                      <Link href="/trending">
                        <Button variant="outline" size="sm" data-testid="button-trending-from-empty">
                          <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                          Browse Trending
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
                              <Badge variant="secondary" className="text-[10px]">
                                {bet.type === 'challenge' ? 'Challenge' : 'Offer'}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {bet.role === 'creator' ? 'Creator' : 'Opponent'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isExpiring && (
                                <Badge variant="outline" className="text-[10px] text-[#b8860b] border-[#b8860b]/30">
                                  <Clock className="w-2.5 h-2.5 mr-0.5" />
                                  Expiring
                                </Badge>
                              )}
                              <Badge variant="outline" className={`text-[10px] ${stateColor(bet.state)}`}>
                                {stateLabels[bet.state] || `State ${bet.state}`}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">
                                Stake: <span className="font-mono text-foreground">{bet.stakeEth.toFixed(6)} ETH</span>
                                <span className="text-[#6b8f71] ml-1">(${(bet.stakeEth * ethUsd).toFixed(2)})</span>
                              </span>
                            </div>
                            {bet.type === 'offer' && bet.oddsBps && (
                              <div className="flex items-center gap-1">
                                {bet.sideYes ? (
                                  <TrendingUp className="w-3 h-3 text-[#6b8f71]" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 text-[#c17c60]" />
                                )}
                                <span className={`font-mono ${bet.sideYes ? 'text-[#6b8f71]' : 'text-[#c17c60]'}`}>
                                  {bet.sideYes ? 'YES' : 'NO'} {Math.round(bet.oddsBps / 100)}%
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-muted-foreground">
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
                <Card className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[hsl(var(--primary))]" />
                  <p className="text-sm text-muted-foreground">Scanning transaction history...</p>
                </Card>
              ) : loaded && txHistory.length === 0 ? (
                <Card className="p-8 text-center">
                  <History className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No transaction history found.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {txHistory.map((tx, idx) => (
                    <Card key={`${tx.txHash}-${idx}`} className="p-3" data-testid={`tx-entry-${idx}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {tx.betType === 'challenge' ? 'Challenge' : 'Offer'} #{tx.betId}
                          </Badge>
                          <span className="text-xs font-medium">{tx.action}</span>
                        </div>
                        <a
                          href={`${explorerUrl}/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-mono text-[hsl(var(--primary))]"
                          data-testid={`link-tx-${idx}`}
                        >
                          {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
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
              const refundedBets = bets.filter(b => b.state === 3);
              const wins = resolvedBets.filter(b => b.winner && b.winner === me);
              const losses = resolvedBets.filter(b => b.winner && b.winner !== ethers.ZeroAddress.toLowerCase() && b.winner !== me);
              const draws = refundedBets.length;
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
                    <Card className="p-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[hsl(var(--primary))]" />
                      <p className="text-sm text-muted-foreground">Scanning blockchain for stats...</p>
                    </Card>
                  ) : loaded && bets.length === 0 ? (
                    <Card className="p-8 text-center">
                      <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No bets found to compute stats.</p>
                    </Card>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="p-4 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Win Rate</p>
                          <p className="text-3xl font-bold text-[hsl(var(--primary))]" data-testid="text-win-rate">
                            {winRate.toFixed(0)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {resolvedBets.length} resolved bet{resolvedBets.length !== 1 ? 's' : ''}
                          </p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Record</p>
                          <p className="text-2xl font-bold">
                            <span className="text-[#6b8f71]">{winCount}</span>
                            <span className="text-muted-foreground mx-1">-</span>
                            <span className="text-[#c17c60]">{lossCount}</span>
                            <span className="text-muted-foreground mx-1">-</span>
                            <span className="text-muted-foreground">{draws}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">W - L - D</p>
                        </Card>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <Card className="p-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Wagered</p>
                          <p className="text-sm font-bold font-mono">{totalWagered.toFixed(4)}</p>
                          <p className="text-[10px] text-muted-foreground">ETH</p>
                          <p className="text-[10px] text-[#6b8f71]">${(totalWagered * ethUsd).toFixed(2)}</p>
                        </Card>
                        <Card className="p-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Won</p>
                          <p className="text-sm font-bold font-mono text-[#6b8f71]">{totalWon.toFixed(4)}</p>
                          <p className="text-[10px] text-muted-foreground">ETH</p>
                          <p className="text-[10px] text-[#6b8f71]">${(totalWon * ethUsd).toFixed(2)}</p>
                        </Card>
                        <Card className="p-3 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Net P/L</p>
                          <p className={`text-sm font-bold font-mono ${netPL >= 0 ? 'text-[#6b8f71]' : 'text-[#c17c60]'}`} data-testid="text-net-pl">
                            {netPL >= 0 ? '+' : ''}{netPL.toFixed(4)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">ETH</p>
                          <p className={`text-[10px] ${netPL >= 0 ? 'text-[#6b8f71]' : 'text-[#c17c60]'}`}>
                            {netPL >= 0 ? '+' : ''}${(netPL * ethUsd).toFixed(2)}
                          </p>
                        </Card>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Card className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Trophy className="w-3.5 h-3.5 text-[#b8860b]" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Biggest Win</p>
                          </div>
                          <p className="text-sm font-bold font-mono text-[#6b8f71]">
                            {biggestWin > 0 ? `${biggestWin.toFixed(4)} ETH` : '—'}
                          </p>
                          {biggestWin > 0 && (
                            <p className="text-[10px] text-[#6b8f71]">${(biggestWin * ethUsd).toFixed(2)}</p>
                          )}
                        </Card>
                        <Card className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-3.5 h-3.5 text-[#b8860b]" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Streak</p>
                          </div>
                          <p className={`text-sm font-bold ${streakType === 'W' ? 'text-[#6b8f71]' : streakType === 'L' ? 'text-[#c17c60]' : 'text-muted-foreground'}`}>
                            {currentStreak > 0 ? `${currentStreak}${streakType}` : '—'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {streakType === 'W' ? 'Winning' : streakType === 'L' ? 'Losing' : 'No streak'}
                          </p>
                        </Card>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center mt-2">
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
              <p className="text-[10px] text-muted-foreground">
                Found {bets.length} bet{bets.length !== 1 ? 's' : ''} on {NETWORKS[networkKey].chainName}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
