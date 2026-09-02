---
name: testing-juice-ui
description: How to run and UI-test TheJuiceDapp (React+Vite+Express P2P betting DApp on Base) locally without a wallet, including mobile viewport testing, order-summary math checks, and known pitfalls.
---

# Testing TheJuiceDapp UI locally

## Start the app
- `npm install` then `npm run dev` → serves both API and frontend on http://localhost:5000 (Node 20+).
- Startup can take >10s; background the command and confirm with `curl -s -o /dev/null -w '%{http_code}' localhost:5000`.
- No injected wallet exists in the test browser, so all create/join flows stop at the
  `Connect wallet & create` / `Connect wallet` button. Clicking it is a no-op (no toast) — that is expected,
  not a bug. Transaction submission cannot be exercised without a funded wallet + injected provider.
- ETH price comes from `/api/eth-price`; USD subvalues drift between screenshots. Assert on ETH values, not USD.

## Viewport / responsive testing
- Use Chrome DevTools device toolbar (Responsive) and type widths into the Dimensions fields
  (390 x 844 for mobile, 1280 x 800 for desktop). Avoid `ctrl+shift+m` while the page has focus —
  it can open the Chrome profile menu instead.
- Desktop (>= md) renders `<aside>` + SideNav and hides BottomNav; mobile renders the fixed 5-tab BottomNav.
- Detect horizontal overflow programmatically instead of eyeballing:
  `document.documentElement.scrollWidth > document.documentElement.clientWidth`
  and list offenders with `[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth+1)`.
- Known: the header row (brand + network pill + Connect + theme toggle) may overflow at ~320px widths
  even when 390px is clean. Re-check this width after any header change.

## Order summary math (useful oracles)
- Protocol fee default is 250 bps (2.5%), from `client/src/lib/wallet.tsx`.
- Markets (V2, custom odds): taker stake = ceil(stakeWei * p / (10000 - p)) for YES, mirrored for NO
  (`client/src/lib/contracts.ts:computeTakerStake`). Odds slider is 500–9500 bps with step 50 (0.5%).
- Known display pitfall: the odds slider allows 0.5% increments but labels round to whole percents,
  so a slider value of 4950 shows "50%" / "50¢" / "YES @ 50%" while producing an asymmetric market.
  When testing, read the range input's actual `value` (not the label) before asserting stake numbers.
- Multiplier semantics differ per page: Markets shows payout/stake (1.95x) while Challenge shows
  profit/stake (0.95x) on rows both labelled as profit. Verify which is intended before flagging.

## Quick UI checks worth repeating
- Find a Bet (`/lookup`): letters are filtered out of the ID input; `999999999` → "Bet not found" toast;
  a `0x...` hash → "Wrong format" toast (the field intentionally accepts the pasted hash so the toast can fire).
- Trending: skeletons render for several seconds against the live RPC before the empty state
  ("No open bets right now" / "No bets found on this network") — wait ~5-10s before calling it hung.
- Console should be clean apart from Vite HMR debug lines and the React DevTools info notice.

## Devin Secrets Needed
- None for UI testing. A funded Base Sepolia key + injected wallet would be required to test
  transaction submission, which is otherwise untestable.
