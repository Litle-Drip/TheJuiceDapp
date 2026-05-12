import { ethers } from 'ethers';

/**
 * Scan blockchain logs in reverse-chronological chunks.
 * Handles RPC provider pagination limits (typically 10K blocks per request).
 */
export async function scanLogs(
  provider: ethers.JsonRpcProvider,
  address: string,
  topics: (string | null)[],
  latestBlock: number,
  rangeBlocks = 100000,
  chunkSize = 9999,
): Promise<ethers.Log[]> {
  const results: ethers.Log[] = [];
  const scanStart = Math.max(0, latestBlock - rangeBlocks);

  for (let end = latestBlock; end > scanStart; end -= chunkSize) {
    const start = Math.max(scanStart, end - chunkSize + 1);
    try {
      const logs = await provider.getLogs({
        address,
        topics,
        fromBlock: start,
        toBlock: end,
      });
      results.push(...logs);
    } catch (e) {
      console.error(`[scanLogs] failed for blocks ${start}-${end}:`, e);
    }
  }

  return results;
}

/**
 * Format an ETH value for display with appropriate precision.
 */
export function formatEthDisplay(eth: number, maxDecimals = 6): string {
  if (eth === 0) return '0';
  if (eth < 0.000001) return '<0.000001';
  return eth.toFixed(maxDecimals).replace(/\.?0+$/, '');
}

/**
 * State color class helper for bet states.
 */
export function stateColorClass(state: number): string {
  switch (state) {
    case 0: return 'text-blue-600 dark:text-blue-400 border-blue-600/30 dark:border-blue-400/30';
    case 1: return 'text-amber-600 dark:text-amber-400 border-amber-600/30 dark:border-amber-400/30';
    case 2: return 'text-emerald-600 dark:text-emerald-400 border-emerald-600/30 dark:border-emerald-400/30';
    case 3: return 'text-muted-foreground border-border';
    default: return 'text-muted-foreground border-border';
  }
}
