import { createContext, useContext, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './wallet';
import { ABI_V1, ABI_V2, NETWORKS } from './contracts';
import { useToast } from '@/hooks/use-toast';

interface NotificationContextType {
  notificationCount: number;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType>({ notificationCount: 0, clearNotifications: () => {} });

export function useNotifications() {
  return useContext(NotificationContext);
}

// Note: Notification polling tracks bets the user created via OfferOpened/ChallengeOpened events.
// Vote nudge notifications only fire for bets the user created, not bets they joined as taker/participant.
// The vote nudge banners in Bet Lookup cover both sides since they check the loaded bet data directly.
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { connected, address, network: networkKey } = useWallet();
  const { toast } = useToast();
  const [notificationCount, setNotificationCount] = useState(0);
  const lastBlockRef = useRef(0);
  const knownEventsRef = useRef<Set<string>>(new Set());
  const trackedOffersRef = useRef<Map<string, number>>(new Map());
  const trackedChallengesRef = useRef<Map<string, number>>(new Map());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const clearNotifications = useCallback(() => {
    setNotificationCount(0);
  }, []);

  const poll = useCallback(async () => {
    if (!connected || !address) return;
    const net = NETWORKS[networkKey];
    try {
      const rpcProvider = new ethers.JsonRpcProvider(net.rpc);
      const latest = await rpcProvider.getBlockNumber();
      const me = address.toLowerCase();

      if (lastBlockRef.current === 0) {
        lastBlockRef.current = latest;

        if (net.contract) {
          const c1 = new ethers.Contract(net.contract, ABI_V1, rpcProvider);
          const challengeOpenedTopic = c1.interface.getEvent('ChallengeOpened')?.topicHash;
          const addrTopicC = ethers.zeroPadValue(address.toLowerCase(), 32);
          if (challengeOpenedTopic) {
            const scanStart = Math.max(0, latest - 50000);
            for (let end = latest; end > scanStart; end -= 9999) {
              const start = Math.max(scanStart, end - 9998);
              try {
                const logs = await rpcProvider.getLogs({
                  address: net.contract,
                  topics: [challengeOpenedTopic, null, addrTopicC],
                  fromBlock: start,
                  toBlock: end,
                });
                for (const log of logs) {
                  try {
                    const parsed = c1.interface.parseLog({ topics: log.topics as string[], data: log.data });
                    if (!parsed) continue;
                    const cid = String(parsed.args[0]);
                    const status = await c1.getChallengeStatus(BigInt(cid));
                    const state = Number(status[1]);
                    if (state === 0 || state === 1) {
                      trackedChallengesRef.current.set(cid, state);
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
          const addrTopic = ethers.zeroPadValue(address.toLowerCase(), 32);
          if (offerOpenedTopic) {
            const scanStart = Math.max(0, latest - 50000);
            for (let end = latest; end > scanStart; end -= 9999) {
              const start = Math.max(scanStart, end - 9998);
              try {
                const logs = await rpcProvider.getLogs({
                  address: net.v2contract,
                  topics: [offerOpenedTopic, null, addrTopic],
                  fromBlock: start,
                  toBlock: end,
                });
                for (const log of logs) {
                  try {
                    const parsed = c2.interface.parseLog({ topics: log.topics as string[], data: log.data });
                    if (!parsed) continue;
                    const oid = String(parsed.args[0]);
                    const [, status] = await Promise.all([
                      c2.getOfferCore(BigInt(oid)),
                      c2.getOfferStatus(BigInt(oid)),
                    ]);
                    const state = Number(status[3]);
                    if (state === 0) {
                      trackedOffersRef.current.set(oid, state);
                    }
                  } catch {}
                }
              } catch {}
            }
          }
        }
        return;
      }

      if (latest <= lastBlockRef.current) return;
      const fromBlock = lastBlockRef.current + 1;
      const toBlock = latest;
      lastBlockRef.current = latest;

      if (net.contract) {
        const c1 = new ethers.Contract(net.contract, ABI_V1, rpcProvider);
        const resolvedTopic = c1.interface.getEvent('ChallengeResolved')?.topicHash;
        if (resolvedTopic) {
          try {
            const logs = await rpcProvider.getLogs({
              address: net.contract,
              topics: [resolvedTopic],
              fromBlock,
              toBlock,
            });
            for (const log of logs) {
              try {
                const parsed = c1.interface.parseLog({ topics: log.topics as string[], data: log.data });
                if (!parsed) continue;
                const cid = String(parsed.args[0]);
                const winner = String(parsed.args[1]).toLowerCase();
                const key = `c-resolved-${cid}`;
                if (knownEventsRef.current.has(key)) continue;
                const [core] = await Promise.all([c1.getChallengeCore(BigInt(cid))]);
                const challenger = core[0].toLowerCase();
                const participant = core[1].toLowerCase();
                if (challenger === me || participant === me) {
                  knownEventsRef.current.add(key);
                  const iWon = winner === me;
                  setNotificationCount(c => c + 1);
                  toast({
                    title: iWon ? 'You won!' : 'Challenge resolved',
                    description: `Challenge #${cid} has been resolved. ${iWon ? 'Payout sent to your wallet.' : 'Better luck next time.'}`,
                  });
                }
              } catch {}
            }
          } catch {}
        }

        for (const [cid] of Array.from(trackedChallengesRef.current.entries())) {
          try {
            const [core, status] = await Promise.all([
              c1.getChallengeCore(BigInt(cid)),
              c1.getChallengeStatus(BigInt(cid)),
            ]);
            const state = Number(status[1]);
            if (state === 1) {
              const challenger = core[0].toLowerCase();
              const participant = core[1].toLowerCase();
              const challengerVote = Number(status[2]);
              const participantVote = Number(status[3]);
              const isChallenger = challenger === me;
              const isParticipant = participant === me;
              const myVote = isChallenger ? challengerVote : isParticipant ? participantVote : -1;
              const theirVote = isChallenger ? participantVote : challengerVote;
              if ((isChallenger || isParticipant) && myVote === 0 && theirVote !== 0) {
                const key = `c-vote-nudge-${cid}`;
                if (!knownEventsRef.current.has(key)) {
                  knownEventsRef.current.add(key);
                  setNotificationCount(c => c + 1);
                  toast({
                    title: 'Vote needed',
                    description: `Your opponent voted on Challenge #${cid}. Submit your vote to resolve the bet.`,
                  });
                }
              }
            }
          } catch {}
        }
      }

      if (net.v2contract) {
        const c2 = new ethers.Contract(net.v2contract, ABI_V2, rpcProvider);
        const resolvedTopic = c2.interface.getEvent('OfferResolved')?.topicHash;
        if (resolvedTopic) {
          try {
            const logs = await rpcProvider.getLogs({
              address: net.v2contract,
              topics: [resolvedTopic],
              fromBlock,
              toBlock,
            });
            for (const log of logs) {
              try {
                const parsed = c2.interface.parseLog({ topics: log.topics as string[], data: log.data });
                if (!parsed) continue;
                const oid = String(parsed.args[0]);
                const winner = String(parsed.args[1]).toLowerCase();
                const key = `o-resolved-${oid}`;
                if (knownEventsRef.current.has(key)) continue;
                const [core] = await Promise.all([c2.getOfferCore(BigInt(oid))]);
                const creator = core[0].toLowerCase();
                const taker = core[1].toLowerCase();
                if (creator === me || taker === me) {
                  knownEventsRef.current.add(key);
                  const iWon = winner === me;
                  setNotificationCount(c => c + 1);
                  toast({
                    title: iWon ? 'You won!' : 'Offer resolved',
                    description: `Offer #${oid} has been resolved. ${iWon ? 'Payout sent to your wallet.' : 'Better luck next time.'}`,
                  });
                }
              } catch {}
            }
          } catch {}
        }

        for (const [oid, prevState] of Array.from(trackedOffersRef.current.entries())) {
          try {
            const [core, status] = await Promise.all([
              c2.getOfferCore(BigInt(oid)),
              c2.getOfferStatus(BigInt(oid)),
            ]);
            const newState = Number(status[3]);
            if (newState !== prevState && prevState === 0) {
              trackedOffersRef.current.set(oid, newState);
              if (newState === 1) {
                const key = `o-taken-${oid}`;
                if (!knownEventsRef.current.has(key)) {
                  knownEventsRef.current.add(key);
                  setNotificationCount(c => c + 1);
                  toast({
                    title: 'Opponent joined!',
                    description: `Someone took your offer #${oid}. Time to vote on the outcome.`,
                  });
                }
              }
            }
            if (newState === 1) {
              const creator = core[0].toLowerCase();
              const taker = core[1].toLowerCase();
              const creatorVote = Number(status[4]);
              const takerVote = Number(status[5]);
              const isCreator = creator === me;
              const isTaker = taker === me;
              const myVote = isCreator ? creatorVote : isTaker ? takerVote : -1;
              const theirVote = isCreator ? takerVote : creatorVote;
              if ((isCreator || isTaker) && myVote === 0 && theirVote !== 0) {
                const key = `o-vote-nudge-${oid}`;
                if (!knownEventsRef.current.has(key)) {
                  knownEventsRef.current.add(key);
                  setNotificationCount(c => c + 1);
                  toast({
                    title: 'Vote needed',
                    description: `Your opponent voted on Offer #${oid}. Submit your vote to resolve the bet.`,
                  });
                }
              }
            }
          } catch {}
        }
      }
    } catch {}
  }, [connected, address, networkKey, toast]);

  useEffect(() => {
    if (!connected || !address) return;
    lastBlockRef.current = 0;
    knownEventsRef.current.clear();
    trackedOffersRef.current.clear();
    trackedChallengesRef.current.clear();
    setNotificationCount(0);

    poll();
    pollIntervalRef.current = setInterval(poll, 30000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [connected, address, networkKey, poll]);

  return (
    <NotificationContext.Provider value={{ notificationCount, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}
