export function formatEth(eth: number): string {
  if (!isFinite(eth)) return '0';
  const abs = Math.abs(eth);
  if (abs === 0) return '0';
  const decimals = abs < 0.0001 ? 6 : abs < 0.01 ? 5 : 4;
  return eth.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatUsd(usd: number): string {
  if (!isFinite(usd)) return '$0.00';
  const abs = Math.abs(usd);
  if (abs > 0 && abs < 0.01) return '<$0.01';
  return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

export function formatDeadline(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
