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
- Dark neutral grey theme with steel blue primary (`hsl(207 30% 62%)`) and cool grey backgrounds (`hsl(220 4% 13%)`)
- Sidebar navigation with wallet connection
- Legal footer with links to About, Terms, Privacy, Risk Disclosure, FAQ

## Key Files
- `client/src/lib/contracts.ts` - Contract ABIs, network config, odds computation
- `client/src/lib/wallet.tsx` - WalletProvider context with MetaMask/Coinbase support
- `client/src/pages/markets.tsx` - Kalshi-style market offer creation (V2)
- `client/src/pages/create-challenge.tsx` - Symmetric challenge creation (V1)
- `client/src/pages/bet-lookup.tsx` - Unified bet lookup: auto-detects V1 challenge or V2 offer by ID
- `client/src/pages/about.tsx` - About Edison Labs
- `client/src/pages/terms.tsx` - Terms of Use
- `client/src/pages/privacy.tsx` - Privacy Policy
- `client/src/pages/risk.tsx` - Risk Disclosure
- `client/src/pages/faq.tsx` - FAQ
- `client/src/App.tsx` - Main app with sidebar navigation and legal footer

## Pages
- `/` - Markets (create odds-based offers)
- `/challenge` - Create Challenge (symmetric bets)
- `/lookup` - Bet Lookup (unified join/vote/resolve/refund for both V1 and V2)
- `/about` - About Edison Labs
- `/terms` - Terms of Use
- `/privacy` - Privacy Policy
- `/risk` - Risk Disclosure
- `/faq` - FAQ

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
