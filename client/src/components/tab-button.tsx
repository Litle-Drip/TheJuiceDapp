interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  'data-testid'?: string;
}

export function TabButton({ active, onClick, children, size = 'md', ...props }: TabButtonProps) {
  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1 text-2xs'
    : 'px-3 py-1.5 text-xs';

  return (
    <button
      onClick={onClick}
      data-testid={props['data-testid']}
      className={`${sizeClasses} rounded-md font-medium border transition-all ${
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground'
      }`}
    >
      {children}
    </button>
  );
}
