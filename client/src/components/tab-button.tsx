interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  'data-testid'?: string;
}

export function TabButton({ active, onClick, children, size = 'md', ...props }: TabButtonProps) {
  const sizeClasses = size === 'sm'
    ? 'min-h-8 px-3 text-2xs'
    : 'min-h-9 px-3.5 text-xs';

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
