import { Link, useLocation } from 'wouter';
import { TrendingUp, Zap, Search, LayoutDashboard, Flame } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
  { title: 'Markets', short: 'Markets', url: '/', icon: TrendingUp, desc: 'Bet with custom odds' },
  { title: 'Challenge', short: 'Challenge', url: '/challenge', icon: Zap, desc: 'Equal stakes, winner takes all' },
  { title: 'Find a Bet', short: 'Find', url: '/lookup', icon: Search, desc: 'Join, vote, or check status' },
  { title: 'My Bets', short: 'My Bets', url: '/my-bets', icon: LayoutDashboard, desc: 'Your positions and history' },
  { title: 'Trending', short: 'Trending', url: '/trending', icon: Flame, desc: 'Browse open bets' },
];

function testId(title: string) {
  return `nav-${title.toLowerCase().replace(/\s+/g, '-')}`;
}

export function SideNav() {
  const [location] = useLocation();
  const { notificationCount, clearNotifications } = useNotifications();

  return (
    <nav className="p-3" data-testid="side-nav">
      {NAV_ITEMS.map((item) => {
        const active = location === item.url;
        return (
          <Link
            key={item.url}
            href={item.url}
            data-testid={testId(item.title)}
            onClick={() => { if (item.url === '/my-bets') clearNotifications(); }}
            className={cn(
              'flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/60',
            )}
          >
            <item.icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-tight">{item.title}</span>
              <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">{item.desc}</span>
            </span>
            {item.url === '/my-bets' && notificationCount > 0 && (
              <span
                className="mt-0.5 min-w-5 rounded-full bg-success px-1.5 text-center text-2xs font-semibold leading-5 text-white"
                data-testid="badge-notification-count"
              >
                {notificationCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  const { notificationCount, clearNotifications } = useNotifications();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      data-testid="bottom-nav"
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = location === item.url;
          return (
            <Link
              key={item.url}
              href={item.url}
              data-testid={`tab-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => { if (item.url === '/my-bets') clearNotifications(); }}
              className={cn(
                'relative flex min-h-14 flex-col items-center justify-center gap-1',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-none">{item.short}</span>
              {item.url === '/my-bets' && notificationCount > 0 && (
                <span className="absolute right-1/4 top-2 h-2 w-2 rounded-full bg-success" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
