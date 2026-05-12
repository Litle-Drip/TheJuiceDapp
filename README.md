# The Juice — P2P Betting on Base

A peer-to-peer betting and escrow platform on the [Base](https://base.org) network. Create challenges, set custom odds, and bet directly against friends with smart contract security.

## Architecture

- **Smart Contract** (`contracts/TheJuice.sol`) — Solidity contract with two bet types:
  - **V1 Challenges**: Equal-stake head-to-head bets
  - **V2 Market Offers**: Asymmetric odds-based bets
- **Frontend** (`client/`) — React + TypeScript SPA built with Vite, Tailwind CSS, and shadcn/ui
- **Backend** (`server/`) — Express server providing an ETH price API proxy and Open Graph meta tags for social sharing

## Prerequisites

- Node.js 20+
- npm 9+
- MetaMask or Coinbase Wallet browser extension
- (Optional) PostgreSQL for user persistence via Drizzle ORM

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs on `http://localhost:5000` by default (configurable via `PORT`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run check` | Run TypeScript type checking |
| `npm run db:push` | Push Drizzle schema to database |

## Environment Variables

See [`.env.example`](.env.example) for all available configuration options.

## Contract Addresses

| Network | Address |
|---|---|
| Base Mainnet | [`0x80BC4133BcCC0491ACdebf4d7375aeF75729671a`](https://basescan.org/address/0x80BC4133BcCC0491ACdebf4d7375aeF75729671a#code) |
| Base Sepolia | [`0x474b39dF73745CFC9D84A961b2544b4b236757Dc`](https://sepolia.basescan.org/address/0x474b39dF73745CFC9D84A961b2544b4b236757Dc#code) |

## License

MIT
