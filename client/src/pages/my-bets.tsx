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
  TrendingUp, TrendingDown, Zap, Clock, Trophy, RefreshCw, History
} from 'lucide-react';

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
}

interface TxEntry {
  txHash: string;
  action: string;
  betId: string;
  betType: 'challenge' | 'offer';
  blockNumber: number;
  timestamp?: number;
}

const CHALLENGE_STATES = ['Open', 'Active', 'Resolved', 'Refunded'];
const OFFER_STATES = ['Open', 'Filled', 'Resolved', 'Refunded'];

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';
}

function stateColor(state: number): string {
  switch (state) {
    case 0: return 'text-blue-400 border-blue-400/30';
    case 1: return 'text-amber-400 border-amber-400/30';
    case 2: return 'text-emerald-400 border-emerald-400/30';
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
  const [tab, setTab] = useState<'bets' | 'history'>('bets');
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
                  if (results.find(b => b.id === cid && b.type === 'challenge')) {
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
                  if (results.find(b => b.id === oid && b.type === 'offer')) {
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
        <p className="text-sm text-muted-foreground mt-1">All bets you've created or joined on-chain.</p>
      </div>

      {!connected ? (
        <Card className="p-8 text-center">
          <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Connect your wallet to see your bets.</p>
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
                  <p className="text-sm text-muted-foreground mb-1">
                    {filterTab === 'all' ? 'No bets found for this wallet.' : `No ${filterTab} bets found.`}
                  </p>
                  <p className="text-xs text-muted-foreground">Create a challenge or market offer to get started.</p>
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
                                <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
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
                                <span className="text-emerald-400 ml-1">(${(bet.stakeEth * ethUsd).toFixed(2)})</span>
                              </span>
                            </div>
                            {bet.type === 'offer' && bet.oddsBps && (
                              <div className="flex items-center gap-1">
                                {bet.sideYes ? (
                                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 text-rose-400" />
                                )}
                                <span className={`font-mono ${bet.sideYes ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {bet.sideYes ? 'YES' : 'NO'} {Math.round(bet.oddsBps / 100)}%
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-muted-foreground">
                            <span>{new Date(bet.createdAt * 1000).toLocaleDateString()}</span>
                            {bet.counterparty && (
                              <span>vs {shortAddr(bet.counterparty)}</span>
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

          {loaded && bets.length > 0 && (
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
