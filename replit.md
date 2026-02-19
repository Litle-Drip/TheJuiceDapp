# The Juice - P2P Betting on Base

## Overview
A peer-to-peer betting/escrow dApp on Base network, similar to Kalshi prediction markets. Supports two contract types:
- **V1 Challenges**: Symmetric stakes (equal bet amounts)
- **V2 Market Offers**: Asymmetric stakes based on implied probability/odds

## Smart Contracts
- **Base Mainnet**: `0x80BC4133BcCC0491ACdebf4d7375aeF75729671a` (V1 + V2 combined contract)
- **Base Sepolia**: `0x474b39dF73745CFC9D84A961b2544b4b236757Dc` (V1 + V2 combined contract)

## Architecture
- Frontend-only dApp (React + Vite) that interacts directly with smart contracts via ethers.js v6
- No database needed - all state is on-chain
- Light/dark theme toggle (defaults to dark) with steel blue primary; dark: `hsl(207 30% 62%)` on `hsl(220 4% 13%)`, light: `hsl(207 35% 48%)` on `hsl(220 6% 97%)`
- ThemeProvider in `client/src/lib/theme.tsx` persists to localStorage key "juice-theme", toggles `.dark` class on `<html>`
- All status colors use `text-{color}-600 dark:text-{color}-400` pattern for proper contrast in both modes
- Sidebar navigation with wallet connection
- Legal footer with links to About, Terms, Privacy, Risk Disclosure, FAQ
- Background notification polling every 30s for bet status changes
- Gas estimation on create pages using `estimateGas()` + `getFeeData()`

## Key Files
- `client/src/lib/contracts.ts` - Contract ABIs, network config, odds computation
- `client/src/lib/wallet.tsx` - WalletProvider context with MetaMask/Coinbase support
- `client/src/lib/notifications.tsx` - NotificationProvider with background event polling for bet updates
- `client/src/lib/ens.ts` - ENS/Basename resolution utility with caching and useEnsName hook
- `client/src/pages/markets.tsx` - Kalshi-style market offer creation (V2) with gas estimation
- `client/src/pages/create-challenge.tsx` - Symmetric challenge creation (V1) with gas estimation
- `client/src/pages/bet-lookup.tsx` - Unified bet lookup: auto-detects V1 challenge or V2 offer by ID, supports URL query params (?id=X)
- `client/src/pages/my-bets.tsx` - My Bets dashboard: scans on-chain events for user's bets, win/loss stats, transaction history
- `client/src/pages/trending.tsx` - Trending/Popular Markets: browse recent bets ranked by stake size
- `client/src/pages/about.tsx` - About Edison Labs
- `client/src/pages/terms.tsx` - Terms of Use
- `client/src/pages/privacy.tsx` - Privacy Policy
- `client/src/pages/risk.tsx` - Risk Disclosure
- `client/src/pages/faq.tsx` - FAQ
- `client/src/components/countdown.tsx` - Reusable live countdown timer component with color-coded urgency
- `client/src/App.tsx` - Main app with sidebar navigation, notification badge, verification badge, and legal footer
- `server/routes.ts` - API routes + OG preview middleware for social crawlers

## Pages
- `/` - Markets (create odds-based offers)
- `/challenge` - Create Challenge (symmetric bets)
- `/lookup` - Bet Lookup (unified join/vote/resolve/refund for both V1 and V2)
- `/my-bets` - My Bets Dashboard (all user's bets from on-chain events)
- `/trending` - Trending Markets (recent bets ranked by stake, filterable to open-only)
- `/about` - About Edison Labs
- `/terms` - Terms of Use
- `/privacy` - Privacy Policy
- `/risk` - Risk Disclosure
- `/faq` - FAQ

## Features
- **My Bets Dashboard**: Scans blockchain events filtered by wallet address, shows all created/joined bets with status, stake, counterparty
- **Transaction History**: Integrated into My Bets with chronological ordering and explorer links
- **Trending Markets**: Scans recent OfferOpened/ChallengeOpened events, ranks by total pot size, shows open bets available to join
- **Bet Notifications**: Background polling (30s interval) watches for OfferResolved, ChallengeResolved, offer-taken, and pending-vote events. Shows toast notifications and badge count on sidebar
- **Gas Estimation**: Shows estimated gas cost in ETH and USD before confirming create transactions
- **Contract Verification Badge**: Sidebar footer link to verified contract source on BaseScan
- **URL Deep Links**: Bet lookup supports `?id=X&q=Q` query params for linking from dashboard/trending
- **OG Share Previews**: Server-side middleware serves dynamic Open Graph meta tags for social crawlers (Twitter, Discord, iMessage) on `/lookup` URLs
- **Live Countdown Timers**: Real-time ticking countdowns for join and vote deadlines on Trending cards and Bet Lookup, color-coded urgency (amber < 5min, rose when expired)
- **Create Similar / Duplicate**: Clone existing bets with pre-filled parameters via URL params, available on Trending cards and Bet Lookup pages
- **Vote Nudge Banners**: Amber warning banners in Bet Lookup when user's vote is pending, with contextual messaging about opponent's vote status
- **Win/Loss Stats**: Stats tab on My Bets page showing win rate, record (W-L-D), total wagered, total won, net P/L, biggest win, and current streak
- **ENS Resolution**: Resolves Ethereum addresses to ENS names (including .base.eth Basenames) with caching, displayed throughout bet lookup, trending, and my bets pages

## UX Conventions
- Use plain language for non-crypto users: "bet amount" not "stake", "time limits" not "deadlines", "accept" not "join", "vote" not "resolve"
- Status labels: "Waiting for opponent", "Voting in progress", "Settled", "Refunded"
- All pages have descriptive subtitles explaining what users can do there
- Empty states include actionable CTAs (Create a Bet, Browse Trending)
- Post-creation success shows "Your bet is live!" with Copy Share Link and View Your Bet buttons
- Share buttons on Bet Lookup for both Challenge and Offer views
- Error toasts use "Transaction failed" with actionable guidance
- Sidebar nav items include small description text under each title

## Design
- Primary color: Steel blue `hsl(207 30% 62%)`
- Background: Cool neutral grey `hsl(220 4% 13%)`
- Cards: `hsl(220 3% 17%)`
- USD amounts: `text-emerald-400`
- Form labels: Bold, uppercase, centered over inputs
- Legal footer: Edison Labs LLC copyright + navigation links

## Technical Notes
- Uses ethers.js v6 syntax (`ethers.parseEther`, `ethers.formatEther`, `ethers.BrowserProvider`)
- Odds in basis points: 5000 = 50%, range 500-9500 (5%-95%)
- `computeTakerStake()` calculates asymmetric opponent stake from creator stake + odds
- Protocol fee read from contract (`protocolFeeBps()`)
- Wallet handles chain/account change events
- ETH/USD price from CoinGecko API
- Event scanning uses 10k-block chunks to stay within RPC limits, scans last 100k blocks
- Notification polling stores last seen block number to only check new blocks
- Gas estimation uses `contract.method.estimateGas()` + `provider.getFeeData()` for accurate cost
