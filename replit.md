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
- Dark crypto theme with teal/cyan primary (`hsl(185 85% 45%)`)
- Sidebar navigation with wallet connection

## Key Files
- `client/src/lib/contracts.ts` - Contract ABIs, network config, odds computation
- `client/src/lib/wallet.tsx` - WalletProvider context with MetaMask/Coinbase support
- `client/src/pages/markets.tsx` - Kalshi-style market offer creation (V2)
- `client/src/pages/create-challenge.tsx` - Symmetric challenge creation (V1)
- `client/src/pages/bet-lookup.tsx` - Unified bet lookup: auto-detects V1 challenge or V2 offer by ID
- `client/src/App.tsx` - Main app with sidebar navigation

## Pages
- `/` - Markets (create odds-based offers)
- `/challenge` - Create Challenge (symmetric bets)
- `/lookup` - Bet Lookup (unified join/vote/resolve/refund for both V1 and V2)

## Technical Notes
- Uses ethers.js v6 syntax (`ethers.parseEther`, `ethers.formatEther`, `ethers.BrowserProvider`)
- Odds in basis points: 5000 = 50%, range 500-9500 (5%-95%)
- `computeTakerStake()` calculates asymmetric opponent stake from creator stake + odds
- Protocol fee read from contract (`protocolFeeBps()`)
- Wallet handles chain/account change events
- ETH/USD price from CoinGecko API
