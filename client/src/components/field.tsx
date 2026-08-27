import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className,
  ...props
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={props['data-testid']}
      aria-pressed={active}
      className={cn(
        'min-h-11 rounded-md border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-primary/60 bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SummaryRow({
  label,
  value,
  sub,
  tone = 'default',
  strong,
  ...props
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'muted' | 'success' | 'danger';
  strong?: boolean;
  'data-testid'?: string;
}) {
  const valueTone =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground';

  return (
    <div className="flex items-baseline justify-between gap-3" data-testid={props['data-testid']}>
      <span className={cn('text-sm', tone === 'default' ? 'text-muted-foreground' : valueTone)}>{label}</span>
      <span className="text-right">
        <span className={cn('font-mono text-sm tabular-nums', valueTone, strong && 'font-semibold')}>{value}</span>
        {sub && <span className="ml-1.5 text-xs text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}
