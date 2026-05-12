import { useState, useEffect, useRef } from 'react';
import { Fuel } from 'lucide-react';

export function GasEstimate({ estimateFn, ethUsd, address }: { estimateFn: () => Promise<{ gasEth: number; gasUsd: number } | null>; ethUsd: number; address?: string }) {
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
      <div className="flex items-center justify-center gap-1.5 text-2xs text-muted-foreground py-1">
        <Fuel className="w-3 h-3" />
        <span>Estimating gas...</span>
      </div>
    );
  }
  if (!gas) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 text-2xs text-muted-foreground py-1" data-testid="gas-estimate">
      <Fuel className="w-3 h-3" />
      <span>Est. gas: {gas.gasEth.toFixed(8)} ETH</span>
      <span className="text-success">(${gas.gasUsd.toFixed(4)})</span>
    </div>
  );
}
