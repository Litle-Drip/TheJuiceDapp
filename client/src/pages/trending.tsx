import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { ABI_V1, ABI_V2, NETWORKS } from '@/lib/contracts';
import { Link } from 'wouter';
import {
  Loader2, Flame, TrendingUp, TrendingDown,
  Search, RefreshCw, Zap, Copy
} from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { useEnsName, shortAddr } from '@/lib/ens';

function CreatorName({ address }: { address: string }) {
  const { name, loading } = useEnsName(address);
  return <span className={loading ? 'opacity-50' : ''}>{shortAddr(address, name)}</span>;
}

interface TrendingBet {
  id: string;
  type: 'challenge' | 'offer';
  stakeEth: number;
  totalPotEth: number;
  state: number;
  createdAt: number;
  joinDeadline: number;
  resolveDeadline: number;
  creator: string;
  sideYes?: boolean;
  oddsBps?: number;
  hasOpponent: boolean;
}

const CHALLENGE_STATES = ['Waiting for opponent', 'Voting in progress', 'Settled', 'Refunded'];
const OFFER_STATES = ['Waiting for taker', 'Voting in progress', 'Settled', 'Refunded'];

export default function Trending() {
  const { ethUsd, network: networkKey } = useWallet();
  const [bets, setBets] = useState<TrendingBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const scanTrending = useCallback(async () => {
    setLoading(true);
    setBets([]);
    try {
      const net = NETWORKS[networkKey];
      const rpcProvider = new ethers.JsonRpcProvider(net.rpc);
      const latest = await rpcProvider.getBlockNumber();
      const results: TrendingBet[] = [];

      const scanRange = 100000;
      const chunkSize = 9999;

      if (net.contract) {
        const c1 = new ethers.Contract(net.contract, ABI_V1, rpcProvider);
        const topic0 = c1.interface.getEvent('ChallengeOpened')?.topicHash;
        if (topic0) {
          for (let end = latest; end > Math.max(0, latest - scanRange); end -= chunkSize) {
            const start = Math.max(0, end - chunkSize + 1);
            try {
              const logs = await rpcProvider.getLogs({
                address: net.contract,
                topics: [topic0],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of logs) {
                try {
                  const parsed = c1.interface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;
                  const cid = String(parsed.args[0]);
                  if (results.find(b => b.id === cid && b.type === 'challenge')) continue;
                  const [core, status] = await Promise.all([
                    c1.getChallengeCore(BigInt(cid)),
                    c1.getChallengeStatus(BigInt(cid)),
                  ]);
                  const stakeEth = Number(ethers.formatEther(core[2]));
                  results.push({
                    id: cid,
                    type: 'challenge',
                    stakeEth,
                    totalPotEth: stakeEth * 2,
                    state: Number(status[1]),
                    createdAt: Number(status[0]),
                    joinDeadline: Number(core[4]),
                    resolveDeadline: Number(core[5]),
                    creator: core[0],
                    hasOpponent: core[1] !== ethers.ZeroAddress,
                  });
                } catch {}
              }
            } catch {}
          }
        }
      }

      if (net.v2contract) {
        const c2 = new ethers.Contract(net.v2contract, ABI_V2, rpcProvider);
        const topic0 = c2.interface.getEvent('OfferOpened')?.topicHash;
        if (topic0) {
          for (let end = latest; end > Math.max(0, latest - scanRange); end -= chunkSize) {
            const start = Math.max(0, end - chunkSize + 1);
            try {
              const logs = await rpcProvider.getLogs({
                address: net.v2contract,
                topics: [topic0],
                fromBlock: start,
                toBlock: end,
              });
              for (const log of logs) {
                try {
                  const parsed = c2.interface.parseLog({ topics: log.topics as string[], data: log.data });
                  if (!parsed) continue;
                  const oid = String(parsed.args[0]);
                  if (results.find(b => b.id === oid && b.type === 'offer')) continue;
                  const [core, status] = await Promise.all([
                    c2.getOfferCore(BigInt(oid)),
                    c2.getOfferStatus(BigInt(oid)),
                  ]);
                  const creatorStake = Number(ethers.formatEther(core[4]));
                  const takerStake = Number(ethers.formatEther(core[5]));
                  results.push({
                    id: oid,
                    type: 'offer',
                    stakeEth: creatorStake,
                    totalPotEth: creatorStake + takerStake,
                    state: Number(status[3]),
                    createdAt: Number(status[2]),
                    joinDeadline: Number(status[0]),
                    resolveDeadline: Number(status[1]),
                    creator: core[0],
                    hasOpponent: core[1] !== ethers.ZeroAddress,
                    sideYes: core[2],
                    oddsBps: Number(core[3]),
                  });
                } catch {}
              }
            } catch {}
          }
        }
      }

      results.sort((a, b) => b.totalPotEth - a.totalPotEth);
      setBets(results);
      setLoaded(true);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [networkKey]);

  useEffect(() => {
    scanTrending();
  }, [scanTrending]);

  const now = Math.floor(Date.now() / 1000);

  const filteredBets = bets.filter(b => {
    if (filter === 'open') return b.state === 0 && !b.hasOpponent && b.joinDeadline > now;
    return true;
  });

  return (
    <div className="space-y-4 max-w-xl mx-auto" data-testid="trending-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Trending</h1>
        <p className="text-sm text-muted-foreground mt-1">See what others are betting on. Jump in and take the other side.</p>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {(['open', 'all'] as const).map(t => (
            <button
              key={t}
              data-testid={`button-filter-${t}`}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                filter === t
                  ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {t === 'open' ? 'Open to Join' : 'All Bets'}
            </button>
          ))}
        </div>
        <Button
          data-testid="button-refresh-trending"
          onClick={scanTrending}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {loading && bets.length === 0 ? (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[hsl(var(--primary))]" />
          <p className="text-sm text-muted-foreground">Scanning blockchain for recent bets...</p>
        </Card>
      ) : loaded && filteredBets.length === 0 ? (
        <Card className="p-8 text-center">
          <Flame className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">
            {filter === 'open' ? 'No open bets right now' : 'No bets found on this network'}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {filter === 'open' ? 'All current bets have been taken. Create a new one or switch to "All Bets" to browse.' : 'Be the first to create one and set the market.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link href="/">
              <Button variant="default" size="sm" data-testid="button-create-first">
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                Create a Bet
              </Button>
            </Link>
            {filter === 'open' && (
              <Button variant="outline" size="sm" onClick={() => setFilter('all')} data-testid="button-show-all-empty">
                Show All Bets
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredBets.map((bet, idx) => {
            const stateLabels = bet.type === 'challenge' ? CHALLENGE_STATES : OFFER_STATES;
            const timeLeft = bet.joinDeadline - now;
            const isJoinable = bet.state === 0 && !bet.hasOpponent && timeLeft > 0;

            return (
              <Link key={`${bet.type}-${bet.id}`} href={`/lookup?id=${bet.id}`} data-testid={`trending-card-${bet.type}-${bet.id}`}>
                <Card className="p-4 hover-elevate cursor-pointer">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-2">
                      {idx < 3 && (
                        <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">#{idx + 1}</span>
                      )}
                      <span className="text-sm font-bold font-mono">#{bet.id}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {bet.type === 'challenge' ? 'Challenge' : 'Offer'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isJoinable && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-600/30 dark:border-emerald-400/30">
                          Open
                        </Badge>
                      )}
                      {!isJoinable && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {stateLabels[bet.state]}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Total pot: </span>
                      <span className="font-mono font-medium text-foreground">{bet.totalPotEth.toFixed(6)} ETH</span>
                      <span className="text-emerald-600 dark:text-emerald-400 ml-1">(${(bet.totalPotEth * ethUsd).toFixed(2)})</span>
                    </div>
                    {bet.type === 'offer' && bet.oddsBps && (
                      <div className="flex items-center gap-1">
                        {bet.sideYes ? (
                          <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        )}
                        <span className={`font-mono ${bet.sideYes ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {Math.round(bet.oddsBps / 100)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span>by <CreatorName address={bet.creator} /></span>
                    <div className="flex items-center gap-2">
                      {isJoinable && timeLeft > 0 && (
                        <Countdown deadline={bet.joinDeadline} />
                      )}
                      {bet.state === 1 && bet.hasOpponent && (
                        <Countdown deadline={bet.resolveDeadline} label="Vote closes in" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid="button-create-similar"
                        className="h-6 px-2 text-[10px]"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          let question = '';
                          try {
                            const stored = JSON.parse(localStorage.getItem('juice_bet_questions') || '{}');
                            const key = bet.type === 'challenge' ? `c${bet.id}` : bet.id;
                            question = stored[key] || '';
                          } catch {}
                          const params = new URLSearchParams();
                          params.set('stake', bet.stakeEth.toString());
                          if (question) params.set('q', question);
                          if (bet.type === 'offer') {
                            if (bet.oddsBps) params.set('odds', String(bet.oddsBps));
                            params.set('side', bet.sideYes ? 'yes' : 'no');
                            window.location.href = `/?${params.toString()}`;
                          } else {
                            window.location.href = `/challenge?${params.toString()}`;
                          }
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Create Similar
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {loaded && bets.length > 0 && (
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">
            {filteredBets.length} of {bets.length} bets shown on {NETWORKS[networkKey].chainName}
          </p>
        </div>
      )}
    </div>
  );
}
