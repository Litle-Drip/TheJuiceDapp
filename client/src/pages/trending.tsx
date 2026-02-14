import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/lib/wallet';
import { ABI_V1, ABI_V2, NETWORKS } from '@/lib/contracts';
import { Link } from 'wouter';
import {
  Loader2, Flame, TrendingUp, TrendingDown, Clock,
  Search, RefreshCw, Zap
} from 'lucide-react';

interface TrendingBet {
  id: string;
  type: 'challenge' | 'offer';
  stakeEth: number;
  totalPotEth: number;
  state: number;
  createdAt: number;
  joinDeadline: number;
  creator: string;
  sideYes?: boolean;
  oddsBps?: number;
  hasOpponent: boolean;
}

const CHALLENGE_STATES = ['Open', 'Active', 'Resolved', 'Refunded'];
const OFFER_STATES = ['Open', 'Filled', 'Resolved', 'Refunded'];

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';
}

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
        <p className="text-sm text-muted-foreground mt-1">Browse recent bets ranked by stake size.</p>
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
          <p className="text-sm text-muted-foreground mb-1">
            {filter === 'open' ? 'No open bets available to join.' : 'No bets found on this network.'}
          </p>
          <p className="text-xs text-muted-foreground mb-4">Be the first to create one.</p>
          <Link href="/">
            <Button variant="outline" size="sm" data-testid="button-create-first">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Create a Market Offer
            </Button>
          </Link>
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
                        <span className="text-amber-400 font-bold text-xs">#{idx + 1}</span>
                      )}
                      <span className="text-sm font-bold font-mono">#{bet.id}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {bet.type === 'challenge' ? 'Challenge' : 'Offer'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isJoinable && (
                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
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
                      <span className="text-emerald-400 ml-1">(${(bet.totalPotEth * ethUsd).toFixed(2)})</span>
                    </div>
                    {bet.type === 'offer' && bet.oddsBps && (
                      <div className="flex items-center gap-1">
                        {bet.sideYes ? (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                        )}
                        <span className={`font-mono ${bet.sideYes ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {Math.round(bet.oddsBps / 100)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span>by {shortAddr(bet.creator)}</span>
                    {isJoinable && timeLeft > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {timeLeft < 3600
                          ? `${Math.floor(timeLeft / 60)}m left`
                          : timeLeft < 86400
                          ? `${Math.floor(timeLeft / 3600)}h left`
                          : `${Math.floor(timeLeft / 86400)}d left`}
                      </span>
                    )}
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
