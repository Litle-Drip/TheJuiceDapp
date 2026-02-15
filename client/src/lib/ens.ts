import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const ETH_MAINNET_RPCS = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://eth-mainnet.public.blastapi.io',
];

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

let rpcIndex = 0;

function getProvider(): ethers.JsonRpcProvider {
  const rpc = ETH_MAINNET_RPCS[rpcIndex % ETH_MAINNET_RPCS.length];
  return new ethers.JsonRpcProvider(rpc);
}

async function resolveAddress(address: string): Promise<string | null> {
  const lower = address.toLowerCase();

  if (cache.has(lower)) return cache.get(lower) ?? null;
  if (pending.has(lower)) return pending.get(lower)!;

  const promise = (async () => {
    for (let attempt = 0; attempt < ETH_MAINNET_RPCS.length; attempt++) {
      try {
        const provider = getProvider();
        const name = await provider.lookupAddress(address);
        if (name) {
          cache.set(lower, name);
          return name;
        }
        cache.set(lower, null);
        return null;
      } catch {
        rpcIndex++;
      }
    }
    cache.set(lower, null);
    return null;
  })();

  pending.set(lower, promise);
  try {
    return await promise;
  } finally {
    pending.delete(lower);
  }
}

export function useEnsName(address: string | undefined): { name: string | null; loading: boolean } {
  const [name, setName] = useState<string | null>(() => {
    if (!address) return null;
    return cache.get(address.toLowerCase()) ?? null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || address === ethers.ZeroAddress) {
      setName(null);
      setLoading(false);
      return;
    }

    const lower = address.toLowerCase();
    if (cache.has(lower)) {
      setName(cache.get(lower) ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    resolveAddress(address).then((result) => {
      if (!cancelled) {
        setName(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [address]);

  return { name, loading };
}

export function shortAddr(a: string, ensName?: string | null) {
  if (ensName) return ensName;
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';
}

export function clearEnsCache() {
  cache.clear();
}
