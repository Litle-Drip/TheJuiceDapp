import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownProps {
  deadline: number;
  label?: string;
}

export function Countdown({ deadline, label }: CountdownProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, deadline - Math.floor(Date.now() / 1000));
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400" data-testid="countdown-timer">
        <Clock className="w-2.5 h-2.5" />
        {label ? `${label} ` : ''}Expired
      </span>
    );
  }

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  const colorClass = remaining < 300 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-0.5 ${colorClass}`} data-testid="countdown-timer">
      <Clock className="w-2.5 h-2.5" />
      {label ? `${label} ` : ''}{parts.join(' ')}
    </span>
  );
}
